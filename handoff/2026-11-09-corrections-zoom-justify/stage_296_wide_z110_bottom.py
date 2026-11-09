#!/usr/bin/env python3
"""Order 112-9611287-8070606, combo 17E-M-MS|296-wide. Daren's exact recipe, 2026-11-09.
Builds casestryorders/296-wide-17E-M-MS-z110-bottom.jpg from the S3 master and uploads it
to a NEW key (refuses if the key exists). Does not touch the DB, send a card, or place anything.
    python3 stage_296_wide_z110_bottom.py [--dry-run]
"""
import io, subprocess, sys, urllib.request
from PIL import Image
BASE = "https://distinctinkimages.s3.us-east-2.amazonaws.com/casestryorders/"
SRC, KEY = "296-wide.jpg", "296-wide-17E-M-MS-z110-bottom.jpg"
OUT = "/tmp/" + KEY
im = Image.open(io.BytesIO(urllib.request.urlopen(BASE + SRC, timeout=60).read()))
assert im.size == (4096, 4096), im.size
im.convert("RGB").crop((838, 240, 3257, 3964)).resize((1332, 2051), Image.LANCZOS).save(OUT, "JPEG", quality=95)
print("built", OUT)
try:
    urllib.request.urlopen(urllib.request.Request(BASE + KEY, method="HEAD"), timeout=30)
    sys.exit(f"REFUSED: s3://distinctinkimages/casestryorders/{KEY} already exists")
except urllib.error.HTTPError as e:
    if e.code not in (403, 404):
        raise
if "--dry-run" in sys.argv:
    sys.exit(0)
subprocess.run(["aws", "s3", "cp", OUT, f"s3://distinctinkimages/casestryorders/{KEY}",
                "--content-type", "image/jpeg", "--profile", "claude-automation"], check=True)
with urllib.request.urlopen(BASE + KEY, timeout=60) as r:
    ct, blob = r.headers.get("Content-Type"), r.read()
got = Image.open(io.BytesIO(blob)).size
assert ct.startswith("image/") and got == (1332, 2051) and blob == open(OUT, "rb").read(), (ct, got)
print("verified", BASE + KEY, ct, got)
