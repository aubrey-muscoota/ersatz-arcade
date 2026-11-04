"""Turn `npx expo export -p web` output into one self-contained HTML file.

Usage: python scripts/web-single.py dist out.html
Inlines the JS bundle, fonts and images as data URIs (images re-encoded smaller).
"""
import base64
import glob
import io
import os
import re
import sys

from PIL import Image

dist, out = sys.argv[1], sys.argv[2]
html = open(os.path.join(dist, "index.html")).read()
js_path = re.search(r'src="(/_expo/[^"]+\.js)"', html).group(1)
js = open(dist + js_path).read()
MIME = {"ttf": "font/ttf", "png": "image/png", "jpg": "image/jpeg"}


def data_uri(m):
    path = m.group(1)
    ext = path.rsplit(".", 1)[1]
    raw = open(dist + path, "rb").read()
    if ext == "jpg":
        buf = io.BytesIO()
        Image.open(io.BytesIO(raw)).save(buf, "JPEG", quality=70, optimize=True, progressive=True)
        raw = buf.getvalue()
    return '"data:%s;base64,%s"' % (MIME[ext], base64.b64encode(raw).decode())


js = re.sub(r'"(/assets/[^"]+\.(?:ttf|png|jpg))"', data_uri, js)
js = js.replace("</script", "<\\/script")
html = html.replace('<link rel="icon" href="/favicon.ico"/>', "")
html = re.sub(r'<script src="/_expo[^"]+" defer></script>', lambda _: "<script>" + js + "</script>", html)
html = html.replace("<head>", '<head>\n<style>:root{color-scheme:dark}body{background:#0B1220}</style>', 1)
# The artifact host adds its own document skeleton, so keep only the inner parts.
html = re.sub(r"<!doctype html>|</?html[^>]*>|</?head>|</?body>", "", html, flags=re.I)
html = re.sub(r'<meta httpEquiv="X-UA-Compatible"[^>]*>|<meta name="viewport"[^>]*>|<meta charset="utf-8" />', "", html)
html = html.strip()
open(out, "w").write(html)
print(out, round(len(html) / 1e6, 1), "MB")
