"""
Parametric mahjong tile blank -> STEP / STL / PNG for Xometry instant quote.

Geometry:
  * Rectangular tile, rounded in plan view (2 mm radius on the 4 vertical corners).
  * Top and bottom face perimeters filleted (1 mm) so every surface flows into the
    next with no sharp edge. The part is vacuum sublimated; sharp corners cause film
    tearing and dye gaps, so nothing is left crisp.

Built with build123d (OpenCascade kernel). Edit the DIMENSIONS block below to
regenerate the same blank at any other size.

Usage:
    python mahjong_tile.py
Outputs land in ./output next to this script.
"""

from pathlib import Path

from build123d import (
    Axis,
    RectangleRounded,
    export_step,
    export_stl,
    extrude,
    fillet,
)

# ---------------------------------------------------------------------------
# DIMENSIONS  (all millimetres) -- change these to regenerate at other sizes
# ---------------------------------------------------------------------------
TILE_WIDTH = 20.0       # X, plan-view width
TILE_HEIGHT = 32.0      # Y, plan-view height
TILE_THICKNESS = 7.0    # Z, tile thickness
CORNER_RADIUS = 2.0     # rounding of the 4 vertical corners (plan view)
EDGE_FILLET = 1.0       # fillet on top & bottom face perimeters

# Meshing / render settings
STL_TOLERANCE = 0.05    # mm, deviation for STL + render tessellation
STL_ANGULAR = 0.1       # rad, angular deviation for tessellation

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
BASENAME = f"tile_{int(TILE_WIDTH)}x{int(TILE_HEIGHT)}x{int(TILE_THICKNESS)}"


def build_tile():
    """Return the finished tile solid (build123d Part)."""
    # Rounded rectangle in plan view, extruded to full thickness. This already
    # gives us the 2 mm vertical corners.
    tile = extrude(
        RectangleRounded(TILE_WIDTH, TILE_HEIGHT, CORNER_RADIUS),
        amount=TILE_THICKNESS,
    )

    # Group the edges by height: bottom perimeter (z=0), the vertical edges
    # (z=thickness/2), and the top perimeter (z=thickness). We fillet only the
    # top and bottom perimeter loops so both faces flow into the sides.
    edges_by_z = tile.edges().group_by(Axis.Z)
    perimeter = edges_by_z[0] + edges_by_z[-1]

    return fillet(perimeter, radius=EDGE_FILLET)


def render_png(tile, path):
    """Isometric matplotlib render of the tessellated solid (no VTK required)."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    vertices, faces = tile.tessellate(tolerance=STL_TOLERANCE, angular_tolerance=STL_ANGULAR)
    verts = [(v.X, v.Y, v.Z) for v in vertices]
    tris = [[verts[i] for i in face] for face in faces]

    fig = plt.figure(figsize=(6, 8))
    ax = fig.add_subplot(111, projection="3d")

    mesh = Poly3DCollection(
        tris, facecolor="#d8cbb0", edgecolor="#4d4636", linewidths=0.15, alpha=1.0
    )
    ax.add_collection3d(mesh)

    bb = tile.bounding_box()
    # Equal aspect: pad each axis to the largest extent so the tile isn't skewed.
    span = max(bb.size.X, bb.size.Y, bb.size.Z)
    cx, cy, cz = (bb.min.X + bb.max.X) / 2, (bb.min.Y + bb.max.Y) / 2, (bb.min.Z + bb.max.Z) / 2
    ax.set_xlim(cx - span / 2, cx + span / 2)
    ax.set_ylim(cy - span / 2, cy + span / 2)
    ax.set_zlim(cz - span / 2, cz + span / 2)
    ax.set_box_aspect((1, 1, 1))

    ax.view_init(elev=28, azim=-52)  # isometric-ish
    ax.set_xlabel("X (mm)")
    ax.set_ylabel("Y (mm)")
    ax.set_zlabel("Z (mm)")
    ax.set_title(f"{BASENAME}  ({TILE_WIDTH}x{TILE_HEIGHT}x{TILE_THICKNESS} mm)")

    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tile = build_tile()

    step_path = OUTPUT_DIR / f"{BASENAME}.step"
    stl_path = OUTPUT_DIR / f"{BASENAME}.stl"
    png_path = OUTPUT_DIR / f"{BASENAME}.png"

    export_step(tile, str(step_path))
    export_stl(tile, str(stl_path), tolerance=STL_TOLERANCE, angular_tolerance=STL_ANGULAR)
    render_png(tile, str(png_path))

    # Sanity-check report ----------------------------------------------------
    bb = tile.bounding_box()
    print("=" * 56)
    print(f"Mahjong tile blank: {BASENAME}")
    print("=" * 56)
    print(f"Nominal size (mm)   : {TILE_WIDTH} W x {TILE_HEIGHT} H x {TILE_THICKNESS} T")
    print(f"Corner radius (mm)  : {CORNER_RADIUS}  (vertical corners)")
    print(f"Edge fillet (mm)    : {EDGE_FILLET}  (top & bottom perimeters)")
    print("-" * 56)
    print(f"Volume (mm^3)       : {tile.volume:.3f}")
    print(f"Bounding box (mm)   : "
          f"{bb.size.X:.3f} x {bb.size.Y:.3f} x {bb.size.Z:.3f}")
    print(f"  X range           : {bb.min.X:.3f} .. {bb.max.X:.3f}")
    print(f"  Y range           : {bb.min.Y:.3f} .. {bb.max.Y:.3f}")
    print(f"  Z range           : {bb.min.Z:.3f} .. {bb.max.Z:.3f}")
    print("-" * 56)
    print("Wrote:")
    print(f"  {step_path}")
    print(f"  {stl_path}")
    print(f"  {png_path}")
    print("=" * 56)


if __name__ == "__main__":
    main()
