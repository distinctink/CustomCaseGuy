#!/usr/bin/env python3
"""Re-build Casestry art with a correction applied, and ask again (2026-10-19).

Used by ~/brief/corrections.py. Split out of it because this half is all image
work and S3, and the other half is all queue and Telegram.

TWO WAYS TO MOVE ART, AND THE CHOICE IS FORCED BY THE FILE
  * A CLEAR-BODY PNG (cl / sp / an / wo / me / pclear) is ink on a transparent
    canvas that is already exactly the blank's print_specs. Moving it is honest
    translation: crop to the ink, put it back down somewhere else. Nothing is lost.
  * A FULL-BLEED JPEG (pfit / wide / narrow / vdog / duo) covers the whole print
    area edge to edge. Translating those pixels would slide a blank strip into
    frame. The only correct move is to RE-CUT from the master with the crop window
    shifted, which is why casestry_sync.pattern_print_jpeg gained a cx argument.
    If there is no master on disk, or the master has no spare image in that
    direction, this refuses rather than printing a white edge -- CannotRestage,
    which corrections.py turns into a plain-English Telegram message plus a
    for-code/ note.

A CORRECTED FILE NEVER OVERWRITES THE ORIGINAL. It goes to a new S3 key carrying
the cumulative offset (cl318-18D-MS-C-o25_120.png), so the file a live order is
already pointing at cannot change under it, every step is reversible by resetting
offset_dx/dy to zero, and rules/casestry-artwork-urls' back-up-before-overwrite
rule is never even reached.

OFFSETS ARE CUMULATIVE AND ALWAYS APPLIED TO THE ORIGINAL. brief
.casestry_art_approvals.base_options holds the first file ever offered; dx/dy on
the row are totals. "A little further right" twice is one rebuild from base at
dx=54, not a rebuild of a rebuild, so nothing compounds and nothing softens.

AND THE NUMBERS REPORTED ARE THE ONES THAT LANDED. A shift is clamped at the edge
of the print area rather than cropping the design. The stored offset, the S3 key
and the sentence on the new card all use the ACHIEVED figure, never the requested
one -- the first live tap asked for 82px right on art with 30px of room, and the
first version of this file cheerfully told Daren it had moved 82.
"""

import io
import os
import sys
import urllib.request

sys.path.insert(0, "/Users/darenellington/brief")
from common import log_line  # noqa: E402

LOG = "corrections"

# The four one-tap corrections that ride on every art card. The text is what gets
# queued in core.corrections, so it has to read the same way a typed reply would.
NUDGES = [("⬇️ down", "move the art down"),
          ("⬆️ up", "move the art up"),
          ("⬅️ left", "move the art left"),
          ("➡️ right", "move the art right")]


class CannotRestage(Exception):
    """Plain-English reason this particular art cannot take this correction."""


# WHERE THE FLAT FACE ENDS, as a fraction of print height from the top. Below this
# line the case curves round into its edge, so art "bottom-justified" to the print
# canvas looks cut off. Keyed on the blank's model prefix (the part of item_sku
# before the first "-", plus the next part when it is the MagSafe M).
# 17E-M-MS calibrated 2026-11-09 from Daren's hand crop of 296-wide (box
# 838,240,3257,3964 on the 4096 master, zoom 110%): the subject bottom lands at
# 0.9088 of print height (as measured by subject_bottom). Any blank not listed is refused for a justify rather than
# guessed at -- add it here once one hand crop has been approved.
FLAT_FACE_BOTTOM = {
    "17E-M": 0.9088,
}


def _flat_bottom(blank):
    parts = (blank or "").upper().split("-")
    for k in ("-".join(parts[:2]), parts[0]):
        if k in FLAT_FACE_BOTTOM:
            return FLAT_FACE_BOTTOM[k]
    return None


def subject_bottom(img, x0=None, x1=None):
    """Lowest row of the SUBJECT in a full-bleed master, in master pixels.

    Full-bleed masters are a subject on a soft painted ground, so the subject is
    whatever differs from a heavily blurred copy of the image. Measured at 1024px
    for speed; a row counts once more than 1% of it (between x0 and x1, the
    columns the crop will keep) is subject."""
    from PIL import ImageFilter
    import numpy as np
    W, H = img.size
    small = img.convert("RGB").resize((1024, 1024))
    a = np.asarray(small).astype(float)
    bg = np.asarray(small.filter(ImageFilter.GaussianBlur(60))).astype(float)
    diff = np.sqrt(((a - bg) ** 2).sum(2)) > 35
    c0 = int((x0 or 0) * 1024 / W)
    c1 = max(c0 + 1, int((x1 if x1 is not None else W) * 1024 / W))
    rows = np.where(diff[:, c0:c1].mean(1) > 0.01)[0]
    if not len(rows):
        return None
    return (rows.max() + 1) * H / 1024.0


def _sgn(v):
    v = int(round(v))
    return f"m{abs(v)}" if v < 0 else str(v)


def variant_key(base_url, dx, dy, scale):
    stem, ext = os.path.splitext(base_url.rsplit("/", 1)[-1])
    tag = f"-o{_sgn(dx)}_{_sgn(dy)}"
    if abs(scale - 1.0) > 0.005:
        tag += f"s{int(round(scale * 100))}"
    return f"{stem}{tag}{ext}"


def _fetch(url):
    from PIL import Image
    req = urllib.request.Request(url, headers={"User-Agent": "distinctink-restage/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        blob = r.read()
    return Image.open(io.BytesIO(blob))


# ---------------------------------------------------------------- clear PNG ---

def translate_png(url, key, dx, dy, scale, notes, achieved=None):
    """Move (and optionally resize) the ink inside its own transparent canvas.

    `achieved` is filled in with the shift that ACTUALLY happened. It is not always
    the shift that was asked for: on 2026-10-18 Daren tapped the right arrow on art
    whose ink already sat 30px off the right edge, the clamp correctly stopped it at
    30, and the card still said "82px right". A system whose whole value is that you
    can trust what it tells you does not get to round that off."""
    from PIL import Image
    import casestry_sync as cs

    im = _fetch(url).convert("RGBA")
    W, H = im.size
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        raise CannotRestage("the staged file has no ink in it at all")
    x0, y0, x1, y1 = bbox
    if dx and (x1 - x0) > 0.98 * W:
        raise CannotRestage("this design already runs the full width of the print "
                            "area, so there is no room to move it sideways")
    if dy and (y1 - y0) > 0.98 * H:
        raise CannotRestage("this design already runs the full height of the print "
                            "area, so there is no room to move it up or down")

    ink = im.crop(bbox)
    if abs(scale - 1.0) > 0.005:
        tw, th = max(1, round(ink.width * scale)), max(1, round(ink.height * scale))
        if tw > W or th > H:
            raise CannotRestage(f"that size would make the design {tw}x{th}, bigger "
                                f"than the {W}x{H} print area")
        ink = ink.resize((tw, th), Image.LANCZOS)

    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2          # keep the ink's own centre
    nx = round(cx - ink.width / 2 + dx)
    ny = round(cy - ink.height / 2 + dy)
    cnx, cny = min(max(0, nx), W - ink.width), min(max(0, ny), H - ink.height)
    if (cnx, cny) != (nx, ny):
        notes.append("(It hit the edge of the print area, so it has gone as far as "
                     "it can that way.)")
    if achieved is not None:
        achieved["dx"] = cnx - round(cx - ink.width / 2)
        achieved["dy"] = cny - round(cy - ink.height / 2)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(ink, (cnx, cny))
    os.makedirs(cs.WORK, exist_ok=True)
    out = os.path.join(cs.WORK, key)
    canvas.save(out, optimize=True)
    return out


# --------------------------------------------------------------- full bleed ---

def _cy_default(label, blank, art):
    if (label or "").lower().startswith("keep top"):
        return 0.0
    if (label or "").lower().startswith("centered"):
        return 0.5
    if art and art[0] == "pfit":
        return 0.0 if blank.split("-")[0].upper() in _top_anchor() else 0.5
    return 0.5


def _top_anchor():
    import casestry_sync as cs
    return cs.TOP_ANCHOR_MODELS


def recut_jpeg(row, catalog, opt, key, pw, ph, dx, dy, scale, notes, achieved=None,
               justify=None):
    """Re-cut a full-bleed design from its master with the crop window shifted."""
    from PIL import Image
    import casestry_sync as cs

    blank, design = row["blank"], row["design"]
    art = cs.art_tuple(blank, design, catalog)
    src = cs.art_source(art)
    if not src:
        raise CannotRestage(
            f"this one is a full-bleed design and I cannot find the master file for "
            f"{design} on the drive, so there is nothing to re-cut from. Moving the "
            f"staged file instead would slide a blank edge into the print")
    # ORDER OF OPERATIONS (fixed 2026-11-09, 17E-M-MS|296-wide): ZOOM FIRST, THEN
    # MOVE. Zoom tightens the crop window about its own default position, which is
    # what CREATES spare image round the edges; only then is the window moved,
    # with the move measured in pixels of the finished print. Until this date zoom
    # was dropped on full-bleed art with a note, the no-slack check ran on the
    # UNZOOMED fit, and "zoom in 10% move down 3%" was refused as impossible --
    # when the 10% zoom alone makes 205px of room top to bottom.
    zoom = float(scale or 1.0)
    if zoom < 0.995:
        raise CannotRestage(
            "a full-bleed design already fills the case edge to edge at its smallest "
            "size, so making it smaller would leave a blank border")
    zoom = max(zoom, 1.0)

    im = Image.open(src)
    w, h = im.size
    fit = max(pw / w, ph / h) * zoom           # master px -> print px
    ww, wh = pw / fit, ph / fit                # crop window, in master px
    sx, sy = w - ww, h - wh                    # spare master image, in master px
    if dx and sx * fit < 2:
        raise CannotRestage(
            f"the {design} master is exactly as wide as this case's print area once "
            f"it is scaled to fit, so there is no spare image to slide sideways into"
            + ("" if zoom > 1 else " (zooming in first would make some)"))
    if (dy or justify) and sy * fit < 2:
        raise CannotRestage(
            f"the {design} master is exactly as tall as this case's print area once "
            f"it is scaled to fit, so there is no spare image to slide up or down"
            + ("" if zoom > 1 else " (zooming in first would make some)"))

    # 1. zoom: the window's default spot, AFTER the zoom
    cy0 = _cy_default(opt.get("label"), blank, art)
    ref_x, ref_y = 0.5 * sx, cy0 * sy
    x0, y0 = ref_x, ref_y
    # 2. justify, an absolute placement on its axis
    if justify:
        if justify != "bottom":
            raise CannotRestage(
                f"only BOTTOM justify is calibrated so far; I do not know where the "
                f"flat face of this case ends on the {justify}")
        flat = _flat_bottom(blank)
        if flat is None:
            raise CannotRestage(
                f"I do not know where the flat face ends on {blank} yet (it is not in "
                f"art_restage.FLAT_FACE_BOTTOM), so I cannot bottom-justify on it")
        yb = subject_bottom(im, x0, x0 + ww)
        if yb is None:
            raise CannotRestage(f"I cannot find the subject in the {design} master")
        y0 = yb - flat * ph / fit
    # 3. move, in finished-print px. Moving the ART down moves the WINDOW up.
    x0 -= dx / fit
    y0 -= dy / fit
    if not (0 <= x0 <= sx and 0 <= y0 <= sy):
        notes.append("(It ran out of master image, so it has gone as far that way as "
                     "the artwork allows.)")
        x0, y0 = min(max(x0, 0.0), sx), min(max(y0, 0.0), sy)
    if achieved is not None:
        achieved["dx"] = round((ref_x - x0) * fit)
        achieved["dy"] = round((ref_y - y0) * fit)

    if abs(zoom - 1.0) <= 0.005 and not justify:
        # unchanged path: the one verified against 295/165/277-wide on 2026-10-18
        cx = x0 / sx if sx else 0.5
        cy = y0 / sy if sy else cy0
        try:
            return cs.pattern_print_jpeg(src, key, pw, ph, blank, cy=cy, cx=cx)
        except cs.Flag as e:
            raise CannotRestage(str(e)) from e

    if ww < pw / 1.02:
        raise CannotRestage(
            f"zoomed that far the {design} master would be stretched "
            f"{pw / ww:.2f}x to fill the print, and anything over 1.02x prints soft")
    box = (x0, y0, x0 + ww, y0 + wh)
    out = im.convert("RGB").resize((pw, ph), Image.LANCZOS, box=box)
    os.makedirs(cs.WORK, exist_ok=True)
    path = os.path.join(cs.WORK, key)
    out.save(path, "JPEG", quality=95)
    log_line(LOG, f"recut {design} for {blank}: zoom {zoom:.3f}, box "
                  f"{tuple(round(v) for v in box)} -> {pw}x{ph}")
    return path


# -------------------------------------------------------------------- public --

def restage(row, catalog, dx, dy, scale, justify=None):
    """Build every option again with the cumulative correction applied.

    Returns (options, prefit, notes, achieved). `prefit` is True when the rebuild
    produced a file cut to the blank's exact print_specs where the original was not
    -- the art gate must then send autoscale "" for it, or Casestry scales it a
    second time. `achieved` is the shift that actually landed, which is smaller than
    the one requested whenever the art ran into the edge of the print area; the card
    and the stored offset both use the achieved figure, never the requested one.
    """
    import casestry_sync as cs

    pw, ph = cs.print_specs(catalog.get(row["blank"]))
    base = row.get("base_options") or row.get("options") or []
    if not base:
        raise CannotRestage("no record of what was originally offered for this combo")

    out, prefit, notes = [], None, []
    achieved = {"dx": dx, "dy": dy}
    for opt in base:
        url = opt["url"]
        # Built under a scratch name, then renamed to a key that states the shift
        # that ACTUALLY landed. Asking twice for room that does not exist then lands
        # on the same key, so the same bytes are not re-uploaded under a second name
        # and no key ever claims a move the file does not contain.
        tmp = "_building-" + variant_key(url, dx, dy, scale)
        if url.lower().endswith(".png"):
            if justify:
                raise CannotRestage("justify is only built for full-bleed designs so "
                                    "far; a clear-case design still moves by nudges")
            local = translate_png(url, tmp, dx, dy, scale, notes, achieved)
            ctype = "image/png"
        else:
            local = recut_jpeg(row, catalog, opt, tmp, pw, ph, dx, dy, scale, notes,
                               achieved, justify=justify)
            ctype = "image/jpeg"
            prefit = True       # a re-cut file is exactly print_specs by construction
        key = variant_key(url, achieved["dx"], achieved["dy"], scale)
        final = os.path.join(cs.WORK, key)
        os.replace(local, final)
        local = final
        if not cs.DRY:
            cs.s3_put(local, key, ctype)
        out.append({"label": opt["label"], "url": cs.S3_PUBLIC + key, "local": local})
        log_line(LOG, f"restaged {row['combo']} {opt['label']} -> {key} "
                      f"(asked dx={dx} dy={dy}, applied dx={achieved['dx']} "
                      f"dy={achieved['dy']}, scale={scale:.3f})")
    # de-duplicate the same note coming off both options
    seen, uniq = set(), []
    for n in notes:
        if n not in seen:
            seen.add(n)
            uniq.append(n)
    return out, prefit, uniq, achieved


def reask(row, catalog, options, headline, prefit=None, said=None):
    """Send a fresh art-check card for this combo. Returns the new approval ref.

    Same sheet, same two buttons and the same meaning as the original card in
    casestry_art_gate.ask -- a tap is still the only thing that places the order.
    What is new is the "you said / here is what I did" preamble and the one-tap
    nudge row, so the next round trip costs him a tap instead of a sentence.
    """
    import approvals
    import casestry_sync as cs
    import casestry_art_gate as gate

    blank, design, combo = row["blank"], row["design"], row["combo"]
    line_type = row.get("line_type") or ("clear" if blank.upper().endswith("-C") else "tough")
    art = cs.art_tuple(blank, design, catalog)
    if prefit is None:
        prefit = art[0] in ("pfit", "duo")
    cat_row = catalog[blank]

    panels = []
    for letter, opt in zip("AB", options):
        item = cs.build_item(line_type, blank, opt["url"], 1, prefit=prefit)
        if cs.DRY and opt.get("local"):
            item["_local"] = opt["local"]
        try:
            pv = gate.portal_preview(item, cat_row)
        except Exception as e:
            log_line(LOG, f"reask {combo}: preview {opt['label']} failed "
                          f"({type(e).__name__}: {str(e)[:150]})")
            pv = None
        panels.append(("PREVIEW" if len(options) == 1 else f"{letter}: {opt['label']}", pv))
    panels.append(("LISTING photo", gate.listing_image(row.get("listing_photo"))))
    panels.append(("source file", gate.source_image(cs.art_source(art))))

    title = f"{blank}  +  {design}"
    gate.send_sheet(panels, title, f"{combo}-r{int(row.get('corrections') or 0) + 1}",
                    f"Casestry art check (corrected): {title}", cs.DRY, cs.s3_put)

    lines = [f"CASESTRY ART CHECK  {title}   (take "
             f"{int(row.get('corrections') or 0) + 2})", ""]
    if row.get("first_order"):
        lines.append(f"Order {row['first_order']}"
                     + (f", SKU {row['order_sku']}" if row.get("order_sku") else ""))
        lines.append("")
    if said:
        lines += [f'You said: "{said}"', ""]
    lines += [headline, "",
              "Compare the PREVIEW against the LISTING photo in the picture above.",
              "LOOKS RIGHT places every waiting order and is remembered for this "
              "design on this case. HOLD stops them.",
              "Still not right? Tap a nudge below, or reply with what to change "
              "(\"a little lower\", \"30px left\", \"bigger\")."]
    if len(options) > 1:
        lines.insert(2, f"A = {options[0]['label']}    B = {options[1]['label']}")
    if cs.DRY:
        print("\n".join(lines))
        return None
    return approvals.ask("\n".join(lines), category="code-casestry-art",
                         requested_by="corrections", ttl_minutes=gate.ASK_TTL_MIN,
                         buttons=("LOOKS RIGHT", "HOLD"), nudges=NUDGES)
