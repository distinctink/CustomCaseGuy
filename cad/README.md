# Mahjong tile blank (parametric CAD)

`mahjong_tile.py` generates a mahjong tile blank and exports a STEP file for
upload to [Xometry's instant quote](https://get.xometry.com/) tool, plus an STL
for a quick 3D-print check and a PNG isometric render.

## Geometry

- Rectangular tile, **20 mm W x 32 mm H x 7 mm T**.
- **2 mm** radius on all four vertical corners (rounded in plan view).
- **1 mm** fillet on the top and bottom face perimeters, so every surface flows
  into the next with no sharp edge. The part is vacuum sublimated, and sharp
  corners cause film tearing and dye gaps, so nothing is left crisp.

All dimensions live in the `DIMENSIONS` block at the top of the script. Change
them there to regenerate the blank at any other size (the output filenames pick
up the new dimensions automatically).

## Setup

Uses [build123d](https://build123d.readthedocs.io/) (OpenCascade kernel) in an
isolated virtual environment. It does not touch system Python.

```bash
cd cad
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

## Run

```bash
.venv/bin/python mahjong_tile.py
```

Outputs land in `cad/output/`:

- `tile_20x32x7.step` -- upload this to Xometry
- `tile_20x32x7.stl` -- quick 3D-print sanity check
- `tile_20x32x7.png` -- isometric render to eyeball the shape

The script also prints the part volume (mm^3) and bounding box so you can sanity
check before uploading. For the default 20x32x7 blank that is ~4413 mm^3 in a
20 x 32 x 7 box.

## Notes

- `build123d` is preferred; the script uses its algebra API. If you ever need to
  fall back to CadQuery the same three operations apply: rounded-rectangle
  extrude, then fillet the top and bottom perimeter edge loops.
- The PNG is rendered with matplotlib from the tessellated solid, so no VTK or
  display is required (works headless in CI / on the web).
