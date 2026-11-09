#!/usr/bin/env python3
"""Act on the corrections Daren types into Telegram (2026-10-19).

Daren, 2026-10-18, filing for-code/telegram-corrections-loop: "It's too hard for me
to respond with corrections and then they don't run back through."

WHAT WAS BROKEN. A Telegram card offers fixed buttons. When the thing is WRONG the
natural move is to reply with what to change. Until today that reply settled the
approval as status='answered', the work item went to "held" with a note reading
"replied in words instead of tapping (text never approves)", and absolutely nothing
read the words. Five real corrections died that way on code-casestry-art alone,
including the same fix asked for twice ("not right. Art needs to move to the right",
then "still needs to go a little further right") and one card he could not even judge
("preview image didn't come through"). Nine more on code-permission were real
instructions. Each one then cost him finding a Code session and saying it again.

THE SHAPE OF THE FIX, three layers:

  1. public.approval_settle (in the DATABASE, so it runs with the Studio asleep)
     turns a typed reply into a row in core.corrections and sends an immediate
     receipt. A reply that is only the 8-char ref reopens the card instead of
     killing it. See 02_approval_settle_corrections.sql for why it lives there.

  2. THIS FILE drains that queue every two minutes: it reads the words, applies the
     change, re-stages the art, and sends a NEW card with the NEW preview. Repeat
     until he taps.

  3. One-tap nudge buttons on the art card (approvals.add_nudges) put the four
     common corrections one tap away. They queue the same canned text here, so there
     is exactly one correction path, not two.

THE RULE THAT DOES NOT MOVE: a tap is the only approval. Nothing in this file places
an order, and "looks good" typed in words is answered by re-sending the card and
asking for a tap. Every re-staged file goes back through the same art gate.

WHEN IT CANNOT ACT it says so on Telegram and files the work itself -- a for-code/
note, which code_watcher.py then offers to run with one tap -- instead of silently
holding, which is the failure mode this whole thing exists to kill.

    python3 corrections.py                 # drain the queue (launchd does this)
    python3 corrections.py --dry-run       # parse and report, change nothing
    python3 corrections.py --selftest      # parser test vectors, no network
    python3 corrections.py list            # the queue
"""

import json
import os
import re
import sys
from datetime import date

sys.path.insert(0, "/Users/darenellington/brief")
from common import brain_sql, lit, log_line, job_start, job_finish  # noqa: E402

LOG = "corrections"
DRY = "--dry-run" in sys.argv
MAX_PER_RUN = 5                 # a runaway queue must not stall the next run
MAX_CORRECTIONS_PER_COMBO = 4   # then stop guessing and hand it to Code
UNCLEAR_BEFORE_HANDOFF = 2      # two failed readings, then file it for Code
GENERIC_GRACE_MIN = 20          # let a waiting session claim its own answer first

# Non-art corrections are handled by a Code session, not by this file. Art is the
# one domain with a real re-stage path, because the art gate already knows how to
# build a file, preview it and ask again.
ART = "code-casestry-art"


# ============================================================================
# Reading the words
# ============================================================================
#
# Rule-based on purpose. This runs unattended every two minutes and decides what
# gets printed on a case: a model call here would be a non-deterministic step in
# front of a physical, paid, irreversible action, and it would fail differently
# every time it failed. Anything the rules cannot read is handed to a human.
#
# THE STEP SIZE IS CALIBRATED, NOT GUESSED. On 2026-10-18 Daren replied "move text
# down and slightly right" to the cl318 card, and the fix he then approved by hand
# was 120px down and 25px right on a 906x1337 print canvas. 120/1337 = 0.090 and
# 25/906 = 0.028 = 0.09 / 3.2. So one plain step is 9% of the print dimension and
# "slightly" is about a third of that. Those two numbers reproduce his judgment.

STEP = 0.09          # one plain step, as a fraction of the print dimension
SMALL = 1.0 / 3.0    # "slightly", "a little", "a bit"
BIG = 2.0            # "way", "much", "a lot"

DIRECTIONS = {
    "down": (0, 1), "downward": (0, 1), "downwards": (0, 1), "lower": (0, 1),
    "south": (0, 1),
    "up": (0, -1), "upward": (0, -1), "upwards": (0, -1), "higher": (0, -1),
    "north": (0, -1), "raise": (0, -1),
    "right": (1, 0), "rightward": (1, 0), "rightwards": (1, 0),
    "left": (-1, 0), "leftward": (-1, 0), "leftwards": (-1, 0),
}

# "right" is the trap. It is a direction in "move it to the right" and an ADJECTIVE
# in "looks right", "not right", "that's right" -- and Daren's own card says LOOKS
# RIGHT, so he echoes the word constantly. A direction word preceded by any of these
# is not a direction. ("not right. Art needs to move to the right" must read as ONE
# rightward nudge, not two, and certainly not as approval.)
NOT_A_DIRECTION_AFTER = {
    "look", "looks", "looked", "looking", "not", "that", "thats", "that's", "is",
    "isn't", "isnt", "seems", "seemed", "all", "aint", "ain't", "quite", "its",
    "it's", "perfectly", "about", "alright",
}

SMALL_WORDS = {"slightly", "slight", "little", "bit", "touch", "hair", "tad",
               "smidge", "tiny", "tad", "nudge", "fraction"}
BIG_WORDS = {"way", "much", "lot", "far", "really", "lots", "significantly",
             "considerably", "loads"}

BIGGER = re.compile(r"\b(bigger|larger|enlarge|blow\s+it\s+up|scale\s+it?\s*up|"
                    r"zoom\s+in|too\s+small)\b")
SMALLER = re.compile(r"\b(smaller|shrink|reduce|scale\s+it?\s*down|zoom\s+out|"
                     r"too\s+big|too\s+large)\b")

PREVIEW_BROKEN = re.compile(
    r"(preview|image|photo|picture|pic|mockup|sheet)[^.]{0,30}?"
    r"(didn'?t|did\s+not|never|won'?t|wont|not)\s+"
    r"(come\s+through|came\s+through|load|show|appear|arrive)"
    r"|can'?t\s+see\s+(the\s+)?(preview|image|photo|picture)"
    r"|no\s+(preview|image|photo|picture)\b"
    r"|(preview|image|photo|picture)\s+is\s+(blank|broken|missing|black|white)"
    r"|resend\s+(the\s+)?(preview|image|photo|card)")

APPROVE_IN_WORDS = re.compile(
    r"^\W*(looks?\s+(good|right|great|fine|perfect|ok|okay)"
    r"|that'?s?\s+(good|right|it|perfect|fine)"
    r"|ok|okay|yes|yep|yeah|yup|sure|fine|good|great|perfect|correct"
    r"|approved?|ship\s+it|send\s+it|go\s+ahead|do\s+it|run\s+it)\W*$")

HOLD = re.compile(r"\b(hold|stop|wait|cancel|don'?t|do\s+not|hold\s+off|pause)\b")

WRONG_ART = re.compile(r"\bwrong\s+(design|art|artwork|image|picture|file|case|"
                       r"colou?r|product|size)\b|\bthat'?s\s+not\s+the\b")

PIXELS = re.compile(r"^(\d{1,4})(px|pixels?)?$")
PERCENT = re.compile(r"^(\d{1,3})%$")

# "bottom justify", "justify to the bottom", "align it to the bottom", "bottom
# aligned". Added 2026-11-09 for 17E-M-MS|296-wide. On a full-bleed design it puts
# the BOTTOM OF THE SUBJECT on the bottom of the case's FLAT FACE (where the face
# starts to curve into the edge), not on the bottom of the print canvas -- the
# canvas runs on round the curve, and art sitting there reads as cut off.
JUSTIFY = re.compile(
    r"\b(bottom|top|left|right)[\s-]*(justif(?:y|ied)|align(?:ed)?)\b"
    r"|\b(?:justify|align)(?:\s+(?:it|the\s+art|art|the\s+design))?"
    r"(?:\s+(?:to|on|at|with))?(?:\s+the)?\s+(bottom|top|left|right)\b")

# A size verb owns a number written right after it: "zoom in 10%" is a 10% zoom,
# and that 10% must NOT then be read as the size of the next move. Until
# 2026-11-09 it was: "zoom in 10% move down 3%" came out as 12% bigger (the canned
# step, ignoring his 10) and 205px DOWN (10% of 2051, stolen from the zoom, with
# his 3% ignored because it sat AFTER the word "down").
STOP_WORDS = {"and", "then", "also", "plus", "but", "move", "shift", "zoom", "make",
              "go", "push", "nudge", "scale", "bump"}


def _tokens(text):
    return re.findall(r"[a-z0-9']+%?|\d+%", (text or "").lower())


def _explicit(w):
    m = PIXELS.fullmatch(w)
    if m and m.group(2):
        return ("px", int(m.group(1)))
    m = PERCENT.fullmatch(w)
    if m:
        return ("frac", int(m.group(1)) / 100.0)
    return None


def _magnitude(words, i, used=frozenset(), after=0):
    """How big a step the word at index i asks for, as a multiplier.

    Looks at the three tokens before it and, when `after` is set, that many tokens
    after it (stopping at the next verb or direction), skipping any token in `used`
    -- a number some other instruction already owns. An explicit "120px" or "10%"
    wins outright, the nearest one first. A diminutive beats an intensifier,
    because "a little further right" is a LITTLE further -- that exact phrase is
    one of the real replies, and reading "further" as the operative word would
    have overshot.
    """
    before = [j for j in range(max(0, i - 3), i) if j not in used]
    ahead = []
    for j in range(i + 1, min(len(words), i + 1 + after)):
        if words[j] in STOP_WORDS or words[j] in DIRECTIONS:
            break
        if j not in used:
            ahead.append(j)
    # nearest explicit number wins: right after the word, then right before it
    for j in ahead + before[::-1]:
        hit = _explicit(words[j])
        if hit:
            return hit + (j,)
    window = [words[j] for j in before]
    if any(w in SMALL_WORDS for w in window):
        return ("mult", SMALL, None)
    if any(w in BIG_WORDS for w in window):
        return ("mult", BIG, None)
    return ("mult", 1.0, None)


def parse_correction(text):
    """Read one typed correction. Returns a dict the handlers can act on.

    kind: nudge | resize | nudge+resize | resend_preview | approve_in_words
          | hold | wrong_art | unclear
    dx / dy: horizontal and vertical shift, each either ('frac', f) of the print
          dimension or ('px', n). Positive = right / down.
    scale: multiplier on the ink size, 1.0 for no change.
    """
    raw = (text or "").strip()
    low = raw.lower()
    out = {"kind": "unclear", "dx": None, "dy": None, "scale": 1.0,
           "text": raw, "reasons": []}

    if PREVIEW_BROKEN.search(low):
        out["kind"] = "resend_preview"
        out["reasons"].append("says the preview did not arrive")
        return out
    if WRONG_ART.search(low):
        out["kind"] = "wrong_art"
        out["reasons"].append("says the wrong art is on the case")
        return out

    words = _tokens(low)
    used = set()                   # token indices some instruction already owns

    def _span(m):
        return range(len(_tokens(low[:m.start()])), len(_tokens(low[:m.end()])))

    # ---- size first, so it claims its own number before any move can take it
    scale = 1.0
    if BIGGER.search(low) or SMALLER.search(low):
        grow = bool(BIGGER.search(low))
        hit = (BIGGER if grow else SMALLER).search(low)
        span = _span(hit)
        used.update(span)
        kind, amount, owned = _magnitude(words, span[-1] if len(span) else 0,
                                         used, after=2)
        if owned is not None:
            used.add(owned)
        if kind == "frac":
            scale = (1 + amount) if grow else max(0.05, 1 - amount)
        else:
            step = 0.12 * (amount if kind == "mult" else 1.0)
            scale = (1 + step) if grow else 1 / (1 + step)
        out["reasons"].append(("bigger" if grow else "smaller") + f" (x{scale:.2f})")
    out["scale"] = scale

    # ---- justify: an absolute placement, not a relative nudge
    out["justify"] = None
    jm = JUSTIFY.search(low)
    if jm:
        out["justify"] = jm.group(1) or jm.group(3)
        used.update(_span(jm))     # "right justify" is not also a move right
        out["reasons"].append(f"{out['justify']} justify")

    dx = dy = None
    for i, w in enumerate(words):
        if w not in DIRECTIONS or i in used:
            continue
        if i and words[i - 1] in NOT_A_DIRECTION_AFTER:
            continue                      # "looks right", "not right", "that's right"
        hx, hy = DIRECTIONS[w]
        kind, amount, owned = _magnitude(words, i, used, after=2)
        if owned is not None:
            used.add(owned)
        step = ("px", amount * (hx or hy)) if kind == "px" else \
               ("frac", (amount if kind == "frac" else amount * STEP) * (hx or hy))
        if hx:
            dx = step if dx is None else dx          # first mention of an axis wins
        else:
            dy = step if dy is None else dy
        out["reasons"].append(f"{w} ({kind} {amount:g})")

    # A justify sets that axis outright, so a move on the same axis in the same
    # breath would fight it. The justify wins; say so rather than drop it silently.
    if out["justify"] in ("top", "bottom") and dy is not None:
        dy = None
        out["reasons"].append("vertical move ignored: justify sets the height")
    if out["justify"] in ("left", "right") and dx is not None:
        dx = None
        out["reasons"].append("sideways move ignored: justify sets the side")

    out["dx"], out["dy"] = dx, dy
    moved = dx is not None or dy is not None or out["justify"] is not None
    if moved and scale != 1.0:
        out["kind"] = "nudge+resize"
    elif moved:
        out["kind"] = "nudge"
    elif scale != 1.0:
        out["kind"] = "resize"
    elif APPROVE_IN_WORDS.match(low):
        out["kind"] = "approve_in_words"
        out["reasons"].append("reads as approval, which only a tap can give")
    elif HOLD.search(low):
        out["kind"] = "hold"
        out["reasons"].append("reads as hold/stop")
    return out


def describe(intent, pw=None, ph=None):
    """One plain sentence for what we are about to do. Goes on the new card."""
    bits = []
    for axis, step, span, pos, neg in (("x", intent["dx"], pw, "right", "left"),
                                       ("y", intent["dy"], ph, "down", "up")):
        if not step:
            continue
        px = step[1] if step[0] == "px" else (step[1] * (span or 1000))
        bits.append(f"{abs(round(px))}px {pos if px > 0 else neg}")
    if intent["scale"] != 1.0:
        # zoom FIRST in the sentence, because it is applied first
        bits.insert(0, f"{round(abs(1 - intent['scale']) * 100)}% "
                       f"{'bigger' if intent['scale'] > 1 else 'smaller'}")
    if intent.get("justify"):
        bits.append(f"{intent['justify']}-justified to the flat face")
    return ", then ".join(bits) if bits else "no measurable change"


# ============================================================================
# Queue
# ============================================================================

COLS = ("id, approval_id, ref, category, source, correction_text, chat_id, "
        "received_at, status, attempts")


def claim(limit=MAX_PER_RUN):
    """Take the due queued corrections. Art is due at once; everything else waits
    out GENERIC_GRACE_MIN so a Code session blocked in approvals.wait() gets first
    refusal on its own answer rather than being told about it second-hand."""
    rows = brain_sql(
        "update core.corrections set status='working', claimed_at=now(), "
        "attempts=attempts+1 where id in (select id from core.corrections "
        f"where status='queued' and (category = {lit(ART)} or received_at < now() "
        f"- interval '{int(GENERIC_GRACE_MIN)} minutes') "
        f"order by received_at limit {int(limit)}) returning {COLS}")
    return rows


def finish(c, status, note=None, result_ref=None, parsed=None):
    brain_sql(
        f"update core.corrections set status={lit(status)}, handled_at=now(), "
        f"note={lit((note or '')[:800] or None)}, result_ref={lit(result_ref)}, "
        f"parsed={lit(parsed) if parsed else 'parsed'} where id={lit(c['id'])}")
    log_line(LOG, f"{c['ref']} {c['category']} -> {status}"
                  f"{' (' + note[:120] + ')' if note else ''}")


def say(c, text):
    """Tell Daren something. A statement, never a question, never a button."""
    import approvals
    if DRY:
        print(f"  [dry] telegram: {text}")
        return
    approvals.tg("sendMessage", {
        "chat_id": c.get("chat_id") or approvals._secret("leo_telegram_chat"),
        "text": text}, fatal=False)


def file_for_code(slug_suffix, title, body):
    """Hand it to a Code session. code_watcher.py sees a new for-code/ note within
    five minutes and offers Daren a one-tap "Run it now?" -- which is precisely the
    chasing-down-a-session step this project exists to remove.

    One live note per slug is enforced by a unique index, so an existing live note
    is appended to rather than duplicated."""
    slug = f"for-code/{slug_suffix}"
    if DRY:
        print(f"  [dry] would file {slug}")
        return slug
    hit = brain_sql("select id from core.notes where lifecycle='live' and "
                    f"deleted_at is null and slug={lit(slug)}")
    if hit:
        brain_sql(f"update core.notes set body = body || {lit(chr(10) * 2 + body)}, "
                  f"updated_at=now() where id={lit(hit[0]['id'])}")
        return slug
    brain_sql(
        "insert into core.notes (slug, note_class, lifecycle, written_by, reviewed, body) "
        f"values ({lit(slug)}, 'runbook', 'live', 'corrections-worker', false, "
        f"{lit(title + chr(10) * 2 + body)})")
    return slug


# ============================================================================
# The art handler -- the one domain that re-stages by itself
# ============================================================================

def art_row(ref):
    rows = brain_sql("select * from brief.casestry_art_approvals where "
                     f"approval_ref={lit(ref)}")
    return rows[0] if rows else None


def handle_art(c):
    import casestry_sync as cs
    import casestry_art_gate as gate
    import art_restage

    intent = parse_correction(c["correction_text"])
    row = art_row(c["ref"])
    if not row:
        # The receipt has already promised him a new card, so this cannot be a
        # silent dead end -- that is the whole defect being fixed here. It happens
        # when the combo row was reset or deleted under a live card.
        say(c, f"I cannot act on \"{c['correction_text'][:140]}\": the art record "
               f"behind that card [{c['ref']}] is gone, so there is nothing to "
               f"re-stage. Nothing was ordered. The next card for that design will "
               f"ask again from scratch.")
        return finish(c, "unsupported",
                      "no brief.casestry_art_approvals row carries this approval ref", parsed=intent)
    combo = row["combo"]
    done = int(row.get("corrections") or 0)
    print(f"  {combo}: {intent['kind']}  ({', '.join(intent['reasons']) or 'no signal'})")

    if DRY:
        return finish(c, "queued", f"dry run: would treat as {intent['kind']}")

    if done >= MAX_CORRECTIONS_PER_COMBO:
        gate.save(combo, False, status="held",
                  note=f"{done} corrections and still not right -- handed to Code")
        say(c, f"That is {done} goes at {combo} and it is still not right, so I have "
               f"stopped guessing and handed it to Code. Nothing was ordered.")
        file_for_code(f"casestry-art-{combo.replace('|', '-').lower()}",
                      f"FOR CODE: {combo} art is still wrong after {done} corrections.",
                      f"Daren's latest: \"{c['correction_text']}\"\n"
                      f"Order {row.get('first_order')}, SKU {row.get('order_sku')}.\n"
                      f"Cumulative offset applied so far: dx={row.get('offset_dx')} "
                      f"dy={row.get('offset_dy')} scale={row.get('art_scale')}.\n"
                      f"Rebuild the art by hand, then: casestry_art_gate.py reset "
                      f"'{combo}'")
        return finish(c, "unsupported", f"correction cap ({done}) reached, filed for Code", parsed=intent)

    catalog = cs.casestry_catalog(cs.casestry_key())
    specs = cs.print_specs(catalog.get(row["blank"])) or (None, None)
    pw, ph = specs

    # ---- he could not see the card at all
    if intent["kind"] == "resend_preview":
        ref = art_restage.reask(row, catalog, row["options"],
                                "Re-sending this one -- the preview did not come "
                                "through last time.", said=c["correction_text"])
        bump(combo, done, ref)
        return finish(c, "applied", "preview re-sent unchanged", result_ref=ref, parsed=intent)

    # ---- he approved in words. Words never approve.
    if intent["kind"] == "approve_in_words":
        ref = art_restage.reask(row, catalog, row["options"],
                                "Reading that as 'this is fine' -- but I can only "
                                "place an order on a TAP, never on text. Here it is "
                                "again: tap a button and it goes.",
                                said=c["correction_text"])
        bump(combo, done, ref)
        return finish(c, "applied", "re-asked for a tap", result_ref=ref, parsed=intent)

    if intent["kind"] == "hold":
        gate.save(combo, False, status="held", decided_at="now()",
                  note=f"Daren: {c['correction_text'][:200]}")
        say(c, f"Holding {combo}. Nothing ordered. When the art is fixed, run\n"
               f"  casestry_art_gate.py reset '{combo}'")
        return finish(c, "applied", "held at his request", parsed=intent)

    if intent["kind"] == "wrong_art":
        gate.save(combo, False, status="held", note=f"wrong art: {c['correction_text'][:200]}")
        slug = file_for_code(f"casestry-art-{combo.replace('|', '-').lower()}",
                             f"FOR CODE: wrong artwork on {combo}.",
                             f"Daren: \"{c['correction_text']}\"\nOrder "
                             f"{row.get('first_order')}, SKU {row.get('order_sku')}.\n"
                             f"Currently offered: {json.dumps(row.get('options'))}\n"
                             f"This needs a human to pick the right source file; a "
                             f"nudge cannot fix it.")
        say(c, "Wrong artwork is not something I can fix by moving it, so I have held "
               f"{combo} and filed it for Code ({slug}). You will get the usual "
               "'Run it now?' card in a few minutes. Nothing was ordered.")
        return finish(c, "unsupported", "wrong-art, filed for Code", parsed=intent)

    # ---- a real nudge or resize
    if intent["kind"] in ("nudge", "resize", "nudge+resize"):
        if not pw:
            return finish(c, "failed", f"{row['blank']} publishes no print_specs", parsed=intent)
        dx = round(_px(intent["dx"], pw)) + int(row.get("offset_dx") or 0)
        dy = round(_px(intent["dy"], ph)) + int(row.get("offset_dy") or 0)
        scale = float(row.get("art_scale") or 1.0) * intent["scale"]
        try:
            options, prefit, notes, got = art_restage.restage(
                row, catalog, dx, dy, scale, justify=intent.get("justify"))
        except art_restage.CannotRestage as e:
            slug = file_for_code(
                f"casestry-art-{combo.replace('|', '-').lower()}",
                f"FOR CODE: cannot auto-nudge {combo}.",
                f"Daren: \"{c['correction_text']}\"\nWanted: "
                f"{describe(intent, pw, ph)}\nBlocked: {e}\n"
                f"Order {row.get('first_order')}, SKU {row.get('order_sku')}.")
            gate.save(combo, False, status="held", note=f"cannot auto-nudge: {str(e)[:200]}")
            say(c, f"I understood '{c['correction_text']}' as {describe(intent, pw, ph)}, "
                   f"but I cannot apply it to this art: {e}\n\nHeld, nothing ordered, "
                   f"filed for Code ({slug}).")
            return finish(c, "unsupported", f"cannot restage: {str(e)[:300]}", parsed=intent)

        # Report what ACTUALLY happened, not what was asked for. They differ
        # whenever the art hits the edge of the print area -- and they did, on the
        # very first live tap.
        dx, dy = int(got["dx"]), int(got["dy"])
        # Zoom is listed first because it is APPLIED first: the crop is tightened
        # about its centre, and only then moved. A move in px means px on the
        # finished print, whatever the zoom.
        moved = ", then ".join(
            ([f"{round(abs(1 - scale) * 100)}% "
              f"{'bigger' if scale > 1 else 'smaller'}"] if abs(scale - 1) > .005 else [])
            + [f"{abs(v)}px {p if v > 0 else n}"
               for v, p, n in ((dx, "right", "left"), (dy, "down", "up")) if v]
            + ([f"{intent['justify']}-justified to the flat face"]
               if intent.get("justify") else []))
        headline = (f"Moved it {moved} from where it started."
                    if moved else
                    "It is already as far that way as the print area allows, so "
                    "nothing moved.") + " Does this look right now?"
        if notes:
            headline += "\n" + "\n".join(notes)
        ref = art_restage.reask(row, catalog, options, headline, prefit=prefit,
                                said=c["correction_text"])
        # The OFFERED options must become the corrected files, or the next tap
        # approves the old one: refresh() copies chosen_url straight out of
        # options. base_options is deliberately left alone -- every rebuild starts
        # from the original, so offsets never compound.
        brain_sql("update brief.casestry_art_approvals set "
                  f"options={lit([{'label': o['label'], 'url': o['url']} for o in options])}, "
                  f"offset_dx={int(dx)}, offset_dy={int(dy)}, art_scale={scale:.4f}, "
                  f"chosen_prefit={lit(prefit)}, updated_at=now() "
                  f"where combo={lit(combo)}")
        bump(combo, done, ref)
        return finish(c, "applied", f"dx={dx} dy={dy} scale={scale:.3f}", result_ref=ref, parsed=intent)

    # ---- could not read it
    if done + 1 < UNCLEAR_BEFORE_HANDOFF:
        ref = art_restage.reask(
            row, catalog, row["options"],
            f"I could not work out what to change from \"{c['correction_text']}\", so "
            f"nothing has moved and nothing is ordered.\nTell me a DIRECTION (down, "
            f"up, left, right -- add 'slightly' or a number of px), or 'bigger' / "
            f"'smaller', or tap a nudge button below.")
        bump(combo, done, ref)
        return finish(c, "unsupported", "unreadable, re-asked with instructions",
                      result_ref=ref, parsed=intent)

    slug = file_for_code(
        f"casestry-art-{combo.replace('|', '-').lower()}",
        f"FOR CODE: unreadable art correction on {combo}.",
        f"Daren: \"{c['correction_text']}\"\nThe rule parser found no direction, "
        f"size change or preview complaint in it.\nOrder {row.get('first_order')}, "
        f"SKU {row.get('order_sku')}. Offered: {json.dumps(row.get('options'))}")
    gate.save(combo, False, status="held", note=f"unreadable: {c['correction_text'][:200]}")
    say(c, f"I still cannot tell what to change from \"{c['correction_text']}\", so I "
           f"have stopped guessing. Held, nothing ordered, filed for Code ({slug}).")
    return finish(c, "unsupported", "unreadable twice, filed for Code", parsed=intent)


def _px(step, span):
    if not step:
        return 0
    return step[1] if step[0] == "px" else step[1] * (span or 1000)


def bump(combo, done, new_ref):
    brain_sql("update brief.casestry_art_approvals set "
              f"corrections={int(done) + 1}, status='pending', "
              f"approval_ref={lit(new_ref)}, asked_at=now(), decided_at=null, "
              f"note=null, updated_at=now() where combo={lit(combo)}")


# ============================================================================
# Everything else -- hand it to a Code session, and SAY so
# ============================================================================

def handle_generic(c):
    """A typed reply on a code-permission / code-handoff card.

    If a session was blocked in approvals.wait() it has already taken the answer and
    acted on it (approvals.consume stamps detail.consumed_at). Only an answer nobody
    picked up needs filing, which is the case that used to vanish.
    """
    rows = brain_sql("select summary, category, detail, requested_by from core.approvals "
                     f"where id={lit(c['approval_id'])}")
    if not rows:
        return finish(c, "failed", "approval row has gone")
    a = rows[0]
    detail = a.get("detail") or {}
    if isinstance(detail, str):
        detail = json.loads(detail)
    if detail.get("consumed_at"):
        return finish(c, "superseded",
                      f"a waiting session read it at {detail['consumed_at']}")

    question = (a.get("summary") or "").strip()
    slug = file_for_code(
        f"answered-{c['ref']}",
        f"FOR CODE: Daren answered a Telegram question nobody was listening to.",
        f"QUESTION (approval {c['ref']}, category {a.get('category')}, asked by "
        f"{a.get('requested_by')}):\n{question}\n\n"
        f"HIS ANSWER, {c['received_at']}:\n\"{c['correction_text']}\"\n\n"
        f"No Code session was blocked on this when he answered, so the answer was "
        f"about to be lost. Do what it says, or if it no longer applies, say so and "
        f"set this note to lifecycle='log'.")
    say(c, f"Nothing was waiting on that one, so I have filed your answer for Code "
           f"({slug}). You will get a 'Run it now?' card shortly.\n\nYou said: "
           f"\"{c['correction_text'][:200]}\"")
    return finish(c, "applied", f"filed {slug}")


# ============================================================================

def run_once():
    problems = []
    taken = claim()
    if not taken:
        return problems, 0
    for c in taken:
        try:
            if c["category"] == ART:
                handle_art(c)
            else:
                handle_generic(c)
        except Exception as e:
            log_line(LOG, f"{c['ref']}: {type(e).__name__}: {str(e)[:300]}")
            problems.append(f"{c['ref']}: {type(e).__name__}: {str(e)[:150]}")
            try:
                # Three tries, then stop and tell him. A correction that silently
                # retries forever is the same invisible hole in a different place.
                if int(c.get("attempts") or 1) >= 3:
                    finish(c, "failed", f"{type(e).__name__}: {e}")
                    say(c, f"I could not act on \"{c['correction_text'][:160]}\" "
                           f"({type(e).__name__}). Nothing was ordered. It is logged "
                           f"and needs a look.")
                else:
                    brain_sql("update core.corrections set status='queued' "
                              f"where id={lit(c['id'])}")
            except Exception:
                pass
    return problems, len(taken)


def main():
    if "--selftest" in sys.argv:
        return selftest()
    if "list" in sys.argv:
        print(json.dumps(brain_sql(
            "select left(id::text,8) id, ref, category, source, status, "
            "left(correction_text,60) text, received_at, result_ref, left(note,80) note "
            "from core.corrections order by received_at desc limit 25"),
            indent=2, default=str))
        return
    run_id = None if DRY else job_start("corrections", date.today())
    problems, n = run_once()
    if n:
        log_line(LOG, f"run ok: {n} correction(s), {len(problems)} problem(s)")
    if run_id:
        job_finish(run_id, ok=not problems, missing=problems or None)
    print(f"ok ({n} handled)" if not problems else f"{len(problems)} problem(s)")


# ---------------------------------------------------------------- parser tests

CASES = [
    # (text, expected kind, expected dx sign, expected dy sign)  -- the first four
    # are Daren's REAL replies, verbatim from core.approvals.
    ("move text down and slightly right", "nudge", +1, +1),
    ("not right. Art needs to move to the right", "nudge", +1, 0),
    ("still needs to go a little further right", "nudge", +1, 0),
    ("preview image didn't come through", "resend_preview", 0, 0),
    ("move it up a bit", "nudge", 0, -1),
    ("needs to go left", "nudge", -1, 0),
    ("move it 120px down", "nudge", 0, +1),
    ("shift it 10% left", "nudge", -1, 0),
    ("make it bigger", "resize", 0, 0),
    ("a little smaller and down", "nudge+resize", 0, +1),
    ("looks right", "approve_in_words", 0, 0),
    ("Looks good", "approve_in_words", 0, 0),
    ("that's right", "approve_in_words", 0, 0),
    ("hold this one", "hold", 0, 0),
    ("wrong design on this case", "wrong_art", 0, 0),
    ("the image is blank", "resend_preview", 0, 0),
    ("what is this", "unclear", 0, 0),
    # 2026-11-09, 17E-M-MS|296-wide, his real reply: the 10% is the zoom and the
    # 3% is the move. It used to read as 12% bigger and 205px down.
    ("zoom in 10% move down 3%", "nudge+resize", 0, +1),
    ("bottom justify", "nudge", 0, 0),
    ("zoom in 10% and bottom justify", "nudge+resize", 0, 0),
    ("justify it to the bottom", "nudge", 0, 0),
    ("right justify", "nudge", 0, 0),
]


def selftest():
    bad = 0
    for text, kind, sx, sy in CASES:
        got = parse_correction(text)
        dx = _px(got["dx"], 906)
        dy = _px(got["dy"], 1337)
        ok = (got["kind"] == kind
              and (dx > 0) == (sx > 0) and (dx < 0) == (sx < 0)
              and (dy > 0) == (sy > 0) and (dy < 0) == (sy < 0))
        bad += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'}  {text!r:50} -> {got['kind']:16} "
              f"dx={dx:+.0f} dy={dy:+.0f} scale={got['scale']:.2f}")
    # the calibration itself, from the 2026-10-18 cl318 fix Daren approved by hand
    g = parse_correction("move text down and slightly right")
    dx, dy = round(_px(g["dx"], 906)), round(_px(g["dy"], 1337))
    cal = abs(dy - 120) <= 3 and abs(dx - 25) <= 5
    bad += 0 if cal else 1
    print(f"{'PASS' if cal else 'FAIL'}  calibration against the hand fix: "
          f"dx={dx} (hand: 25), dy={dy} (hand: 120)")
    # numbers belong to the instruction they sit next to
    g = parse_correction("zoom in 10% move down 3%")
    ok = abs(g["scale"] - 1.10) < 1e-9 and g["dy"] == ("frac", 0.03) and g["dx"] is None
    bad += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  'zoom in 10% move down 3%' -> scale "
          f"{g['scale']:.2f} (want 1.10), dy {g['dy']} (want frac 0.03)")
    for text, edge in (("bottom justify", "bottom"), ("zoom in 10% and bottom justify",
                       "bottom"), ("justify it to the bottom", "bottom"),
                       ("right justify", "right"), ("move it right", None)):
        g = parse_correction(text)
        ok = g["justify"] == edge and (edge != "right" or g["dx"] is None)
        bad += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'}  justify {text!r:36} -> {g['justify']}")
    print("\nALL PASS" if not bad else f"\n{bad} FAILED")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
