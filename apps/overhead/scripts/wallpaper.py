"""Render full-resolution Sentinel-2 scenes for phone wallpapers and prints.

Usage: python wallpaper.py wallpapers.json outdir [--only id,id]
Each entry: {"id", "name", "lat", "lon", "months"?, "date"?, "gain"?, "rotate"?}
Writes <id>-phone.jpg (1290x2796, 10 m/px, about 13 x 28 km) and
<id>-print.jpg (4800x6000, 10 m/px, 48 x 60 km, 16x20 in at 300 dpi).
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from pyproj import CRS, Transformer
from rasterio.transform import from_origin

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R  # noqa: E402

SIZES = {"phone": (1290, 2796, 10.0), "print": (4800, 6000, 10.0)}


def mosaic(layers, dst_crs, transform, w, h):
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.vrt import WarpedVRT

    canvas = np.zeros((3, h, w), np.uint8)
    filled = np.zeros((h, w), bool)
    for scene in layers:
        if filled.all():
            break
        with rasterio.open(f"{R.BUCKET}/{scene}TCI.tif") as src:
            with WarpedVRT(src, crs=dst_crs, transform=transform, width=w, height=h,
                           resampling=Resampling.bilinear, nodata=0) as vrt:
                arr = vrt.read()
        take = (arr.max(axis=0) > 0) & ~filled
        canvas[:, take] = arr[:, take]
        filled |= take
    return canvas, filled


def pick_layers(place, half_km):
    lat, lon = place["lat"], place["lon"]
    months = place.get("months", list(range(1, 13)))
    center = R.M.toMGRS(lat, lon, MGRSPrecision=0)
    tiles = R.tiles_around(lat, lon, half_km)
    per_tile = {t: R.tile_scenes(t, months) for t in tiles}
    score = {}
    for t, ms in per_tile.items():
        for _, cloud, nod, date in ms:
            if cloud < 5:
                score[date] = score.get(date, 0) + (2 if t == center else 1) * (1 - nod / 100) * (1 - cloud / 6)
    best = place.get("date") or (max(score, key=score.get) if score else None)
    layers = [m[0] for t in sorted(per_tile, key=lambda t: t != center) for m in per_tile[t] if m[3] == best]
    for t in sorted(per_tile, key=lambda t: t != center):
        layers += [m[0] for m in sorted(per_tile[t], key=lambda m: m[1])[:2] if m[0] not in layers]
    return best, layers


def run(place, outdir):
    lat, lon = place["lat"], place["lon"]
    zone = int((lon + 180) // 6) + 1
    dst_crs = CRS.from_epsg((32600 if lat >= 0 else 32700) + zone)
    cx, cy = Transformer.from_crs(4326, dst_crs, always_xy=True).transform(lon, lat)
    best, layers = pick_layers(place, 32)
    out = {"id": place["id"], "date": best}
    for kind, (w, h, res) in SIZES.items():
        t = from_origin(cx - w * res / 2, cy + h * res / 2, res, res)
        canvas, filled = mosaic(layers, dst_crs, t, w, h)
        img = canvas.transpose(1, 2, 0).astype(np.float32) / 255.0
        if kind == "phone":
            lum = img.mean(axis=2)[filled]
            gain = place.get("gain") or min(2.2, 0.95 / max(np.percentile(lum, 99.7), 0.05))
        img = np.clip(img * gain, 0, 1) ** 0.9
        Image.fromarray((img * 255).astype(np.uint8)).save(
            f"{outdir}/{place['id']}-{kind}.jpg", quality=90, optimize=True, progressive=True)
        out[kind + "_coverage"] = round(float(filled.mean()), 3)
    out["gain"] = round(float(gain), 2)
    return out


if __name__ == "__main__":
    places = json.load(open(sys.argv[1]))
    outdir = sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    for p in places:
        if only and p["id"] not in only:
            continue
        try:
            print(json.dumps(run(p, outdir)), flush=True)
        except Exception as e:
            print(p["id"], "FAILED", repr(e), flush=True)
