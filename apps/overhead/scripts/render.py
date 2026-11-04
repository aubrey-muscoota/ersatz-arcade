"""Render zoom-level crops of Sentinel-2 true color around a point.

Usage: python render.py places.json outdir [--only id,id]
Reads public Sentinel-2 L2A COGs from the AWS open data bucket (no account).
"""
import concurrent.futures as cf
import json
import math
import os
import re
import sys
import time
import urllib.request

import mgrs
import numpy as np
import rasterio
from PIL import Image
from pyproj import CRS, Transformer
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT

BUCKET = "https://sentinel-cogs.s3.us-west-2.amazonaws.com"
PREFIX = "sentinel-s2-l2a-cogs"
LEVELS_KM = [2, 4, 8, 16, 32, 64]
PX = 640
YEARS = [2025, 2024]
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")

M = mgrs.MGRS()


def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.read()
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(2 ** k)


def list_prefixes(prefix):
    xml = get(f"{BUCKET}/?list-type=2&delimiter=/&prefix={prefix}").decode()
    return re.findall(r"<Prefix>([^<]+/)</Prefix>", xml)[1:]


def tile_path(tile):
    m = re.match(r"(\d+)([A-Z])([A-Z]{2})", tile)
    return f"{int(m.group(1))}/{m.group(2)}/{m.group(3)}"


def scenes_for_tile(tile, months):
    out = []
    jobs = [f"{PREFIX}/{tile_path(tile)}/{y}/{mo}/" for y in YEARS for mo in months]
    with cf.ThreadPoolExecutor(16) as ex:
        for res in ex.map(list_prefixes, jobs):
            out += res
    return out


def scene_meta(prefix):
    name = prefix.rstrip("/").split("/")[-1]
    date = name.split("_")[2]
    try:
        p = json.loads(get(f"{BUCKET}/{prefix}{name}.json"))["properties"]
        return prefix, p.get("eo:cloud_cover", 100), p.get("s2:nodata_pixel_percentage", 100), date
    except Exception:
        return prefix, 100, 100, date


def tile_scenes(tile, months):
    scenes = scenes_for_tile(tile, months)
    with cf.ThreadPoolExecutor(16) as ex:
        metas = list(ex.map(scene_meta, scenes))
    return [m for m in metas if m[1] < 30 and m[2] < 90]


def tiles_around(lat, lon, half_km):
    tiles = set()
    for dy in np.linspace(-half_km, half_km, 5):
        for dx in np.linspace(-half_km, half_km, 5):
            la = lat + dy / 111.0
            lo = lon + dx / (111.0 * math.cos(math.radians(lat)))
            tiles.add(M.toMGRS(la, lo, MGRSPrecision=0))
    return sorted(tiles)


def render(place, outdir):
    lat, lon = place["lat"], place["lon"]
    months = place.get("months", list(range(1, 13)))
    zone = int((lon + 180) // 6) + 1
    dst_crs = CRS.from_epsg((32600 if lat >= 0 else 32700) + zone)
    cx, cy = Transformer.from_crs(4326, dst_crs, always_xy=True).transform(lon, lat)
    tiles = tiles_around(lat, lon, LEVELS_KM[-1] / 2)
    center_tile = M.toMGRS(lat, lon, MGRSPrecision=0)
    with cf.ThreadPoolExecutor(8) as ex:
        per_tile = dict(zip(tiles, ex.map(lambda t: tile_scenes(t, months), tiles)))
    # pick one date that is clear over as many tiles as possible (fewer seams);
    # the center tile counts double and must be very clear
    score = {}
    for t, ms in per_tile.items():
        for _, cloud, nod, date in ms:
            if cloud < 8:
                score[date] = score.get(date, 0) + (2 if t == center_tile else 1) * (1 - nod / 100) * (1 - cloud / 10)
    centre_ok = {m[3] for m in per_tile.get(center_tile, []) if m[1] < 3 and m[2] < 20}
    dates = sorted(score, key=lambda d: (d in centre_ok, score[d]), reverse=True)
    best_date = place.get("date") or (dates[0] if dates else None)
    layers = []  # list of scene prefixes, painted in order until filled
    for t in sorted(per_tile, key=lambda t: t != center_tile):
        ms = per_tile[t]
        layers += [m[0] for m in ms if m[3] == best_date]
    for t in sorted(per_tile, key=lambda t: t != center_tile):
        ms = sorted(per_tile[t], key=lambda m: m[1] + m[2] / 10)
        layers += [m[0] for m in ms[:3] if m[0] not in layers]
    info = {"date": best_date, "layers": layers}
    os.makedirs(outdir, exist_ok=True)
    for i, km in enumerate(LEVELS_KM):
        res = km * 1000 / PX
        ovr = None
        for k, f in enumerate([2, 4, 8, 16]):
            if res >= 10 * f:
                ovr = k
        transform = from_origin(cx - km * 500, cy + km * 500, res, res)
        canvas = np.zeros((3, PX, PX), np.uint8)
        filled = np.zeros((PX, PX), bool)
        for scene in layers:
            if filled.all():
                break
            url = f"{BUCKET}/{scene}TCI.tif"
            kw = {"overview_level": ovr} if ovr is not None else {}
            for k in range(4):
                try:
                    with rasterio.open(url, **kw) as src:
                        with WarpedVRT(src, crs=dst_crs, transform=transform, width=PX, height=PX,
                                       resampling=Resampling.bilinear, nodata=0) as vrt:
                            arr = vrt.read()
                    break
                except Exception:
                    if k == 3:
                        raise
                    time.sleep(2 ** k)
            valid = arr.max(axis=0) > 0
            take = valid & ~filled
            canvas[:, take] = arr[:, take]
            filled |= take
        img = canvas.transpose(1, 2, 0).astype(np.float32) / 255.0
        if i == 0:
            lum = img.mean(axis=2)[filled]
            gain = place.get("gain") or min(2.2, 0.93 / max(np.percentile(lum, 99.5), 0.05))
        img = np.clip(img * gain, 0, 1) ** 0.9
        Image.fromarray((img * 255).astype(np.uint8)).save(
            f"{outdir}/{i + 1}.jpg", quality=84, optimize=True, progressive=True)
    return {"id": place["id"], "date": best_date, "gain": round(float(gain), 2), "scenes": layers[:4], "coverage": float(filled.mean())}


if __name__ == "__main__":
    places = json.load(open(sys.argv[1]))
    outroot = sys.argv[2]
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    for p in places:
        if only and p["id"] not in only:
            continue
        try:
            r = render(p, f"{outroot}/{p['id']}")
            print(json.dumps(r), flush=True)
        except Exception as e:
            print(p["id"], "FAILED", repr(e), flush=True)
