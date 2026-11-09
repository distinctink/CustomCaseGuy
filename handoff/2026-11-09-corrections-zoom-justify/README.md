# corrections loop: zoom before move + bottom justify (2026-11-09)

Follows 122_telegram-corrections-loop_2026-10-18. Trigger: 17E-M-MS|296-wide, order
112-9611287-8070606. Daren replied "zoom in 10% move down 3%". The worker read it as
12% bigger and 205px down, then refused it as impossible, and held the order.

## What was wrong
1. corrections.py parser: a number was only looked for BEFORE a word. "10%" after
   "zoom in" was ignored (canned 12% used), then taken by "down" as a 10% move
   (205px on 2051). His "3%" after "down" was never read.
2. art_restage.recut_jpeg: zoom was DROPPED on full-bleed art, and the no-slack check
   ran on the unzoomed fit. A 110% zoom is exactly what creates room to move.
3. No "bottom justify" at all.

## What changed
- corrections.py: a size verb claims the number next to it first; a move reads the
  nearest explicit px/% before OR after it, skipping numbers already claimed.
  "zoom in 10%" = x1.10 exactly. New JUSTIFY intent ("bottom justify", "justify it to
  the bottom", "bottom aligned"); a same-axis move in the same reply yields to it.
  Card text lists zoom first, because it is applied first.
- art_restage.py: full-bleed re-cut is now ZOOM (window shrinks about its default
  spot) -> JUSTIFY (absolute) -> MOVE (finished-print px). Zoom < 1 on full-bleed is
  refused (would leave a border). Upscale > 1.02x refused. zoom==1 with no justify
  still goes through pattern_print_jpeg unchanged.
- Bottom justify puts the SUBJECT's bottom (detected vs a blurred ground) on the
  bottom of the FLAT FACE, from FLAT_FACE_BOTTOM. Only 17E-M is calibrated (0.9088,
  from Daren's hand crop). Other blanks, and top/left/right, are refused in plain
  English (-> for-code note) instead of guessed.

## Verified (off-Studio, real 296-wide master, Studio modules stubbed)
- corrections.py --selftest: 29/29 PASS, including all 18 original vectors.
- original code reproduces the bug: "zoom in 10% move down 3%" -> x1.12, 205px.
- restage(zoom 1.10, justify bottom) -> box (839,240,3257,3964) == Daren's
  838,240,3257,3964; mean pixel diff vs his recipe 0.97/255 (JPEG noise).
- a later "up 40px" stacks from base: dy -30 -> -70, no compounding.
- NOT run here: test_loop_end_to_end.py, test_restage_fullbleed.py (need the Studio).

## Apply on the Studio
    cd ~/brief && cp corrections.py corrections.py.bak-20261109 && cp art_restage.py art_restage.py.bak-20261109
    patch -p1 --dry-run < zoom-before-move_bottom-justify.patch && patch -p1 < zoom-before-move_bottom-justify.patch
    python3 corrections.py --selftest && python3 test_restage_fullbleed.py && python3 test_loop_end_to_end.py
If --dry-run rejects a hunk, the Studio copy drifted after 2026-10-19: merge by hand
from corrections.py / art_restage.py in this folder. Rollback = the .bak files.
