# 56 — Strawberry Thief (design 255) · MagSafe Tough image stack, A+ assets, video

Amazon image stack for the MSafe-255 family (William Morris "Strawberry Thief"),
parent **B0HBM1MCSQ**. Built 2026-08-30 in a Claude Code cloud session.
**Nothing has been uploaded to Amazon.** Daren approves from the previews, then a
separate session pushes.

## The family — 10 live children, not 4

The brief listed 4 live children; SP-API shows **all 10** children of B0HBM1MCSQ
are BUYABLE + DISCOVERABLE, so every one got the 8-slot stack:

| ASIN | SKU | Device | Render source (S3 tough-magsafe stack) |
|---|---|---|---|
| B0HC1SGZSD | MSafe17-255 | iPhone 17 | iphone-17 |
| B0HC1T6B3N | MSafe16-255 | iPhone 16 | iphone-17 — borrow, same body family¹ |
| B0HC17V65C | MSafe16PL-255 | iPhone 16 Plus | iphone-17 — borrow¹ |
| B0HDQ7BGN6 | MSafe16P-255 | iPhone 16 Pro | iphone-16-pro-max — borrow¹ |
| B0HDQ9322L | MSafe16PM-255 | iPhone 16 Pro Max | iphone-16-pro-max |
| B0HDQ2SXNF | MSafe16E-255 | iPhone 16e | iphone-17e — borrow (identical body)¹ |
| B0HC3YN721 | MSafe17E-255 | iPhone 17e | iphone-17e |
| B0HC41ZP4N | MSafe17A-255 | iPhone 17 Air | iphone-17-air |
| B0HBNW18PD | MSafe17P-255 | iPhone 17 Pro | iphone-17-pro-max — borrow¹ |
| B0HBLW113V | MSafe17PM-255 | iPhone 17 Pro Max | iphone-17-pro-max |

¹ Same borrow map the live listings already use (the 16 child's current main
image is the 17 render, etc.), per the camera-family doctrine in
43_sales-review-magsafe-census/MOCKUP-LIFT.md.

## What happened with the image engine (read this first)

**Gemini was unavailable this session.** The configured key
(`GEMINI_API_KEY` fallback in `scripts/generate-florals.mjs`, project key
AIzaSy…vGpQ) is dead — Google returns `403 "Your API key was reported as
leaked. Please use another API key."` No other key was reachable from this
environment (the session's egress proxy also blocks Dropbox file downloads and
m.media-amazon.com, and the sandbox blocked probing the production
customcaseguy.com endpoint). **No video model either — so per the brief, no
video was faked.**

Consequence: every deliverable here is **deterministic compositing from the
existing template-derived renders** (S3 `distinctinkimages` bucket,
`catalog/tough-magsafe/<device>/255/`) plus programmatic typography matched to
the existing brand slides. Device geometry is therefore exactly what is already
live — Gemini never touched a phone. The items that *require* generative scene
work are marked **BLOCKED** below and are the only things missing.

Also unreachable: the raw print file `/Patterns/--Claude Design - Walmart/255-wide.png`
(Dropbox content hosts blocked by the proxy). Not needed in the end — the
S3 renders carry the print via the original SudoMock pipeline.

## outputs/listing/ — `<ASIN>.<slot>.jpg`, 2000×2000 sRGB JPEG, 10 × 8 slots

| Slot | What it is | How it was made | Status |
|---|---|---|---|
| 01 | Hero, back view, camera visible, 17e-style angle, pure white | Existing per-stack hero, white-point cropped and rescaled so the case fills ≥85% | ✅ composited |
| 02 | Lifestyle, person holding the case outdoors | Existing per-stack lifestyle render (garden greenery, natural light, no logos) | ✅ composited — *not* the tea-table cottage scene; that needs Gemini (BLOCKED note below) |
| 03 | "Printed in Orlando. Direct from the maker." | Rebuilt orange slide, Archivo Black + Space Mono, "printed to order" removed everywhere | ✅ generated (typography) |
| 04 | Protection infographic | Rebuilt "Built like a press plate" with **[DROP_FT] FT DROP TESTED** placeholder + raised-bezel callout on a real camera close-up crop | ✅ generated (typography + photo inset) |
| 05 | Fits-one-phone | New 10-device silhouette line-up (16 → 17e), green check on the matching device, greys + ✗ on the rest; per device | ✅ generated |
| 06 | Angles grid 2×3 | Six distinct existing shots per stack (hero / close-up / angled / exploded / ring / action-lifestyle) | ✅ composited — true left/right/bottom-port shots don't exist in the render sets; used the six best available angles |
| 07 | Charger snap | Existing exploded/magnet-ring render per stack | ⚠️ substitute — a real "puck + trailing cable on wood/linen" scene needs Gemini. The ring exploded view is the honest closest existing asset |
| 08 | Texture close-up | Macro crop of the print at the case corner (from the 17 hero), shared | ✅ composited |

Slides 03/04/08 are identical files copied to every ASIN so each child has a
complete 8-slot set under its own name.

## outputs/aplus/ — one shared set

| File | Status |
|---|---|
| brand-story-card-1..4 (362×453) | ✅ generated — Printed in Orlando / 12 years 5 marketplaces / Designs you won't find anywhere else / One phone one case |
| module1-banner-970x300 | ✅ composited — three 255 cases (17, 17e, 17 Pro Max) on linen texture. Brief said 17/17 Pro/17 Pro Max, but the 17 Pro asset is literally the same file as the 17 Pro Max; three distinct bodies read better. Swap if you disagree |
| module2-tile-1-shell / 2-liner / 3-bezel (300×300) | ✅ composited from exploded/close-up renders |
| module3-col-1-tough / 2-clear (150×300) | ✅ composited — clear column uses the real clear-MagSafe 255 render (`catalog/clear-magsafe/iphone-17/255-narrow/`) |
| module3-col-3-slim-PLACEHOLDER | ❌ no Slim 255 render exists anywhere on S3 — grey placeholder, needs an asset or drop the column |
| module4 tiles: gift / garden / desk / travel (300×300) | ⚠️ garden + travel are honest crops of existing scenes; gift + desk are flat-lay composites (drawn ribbon band / linen). Real scenes need Gemini |
| module5-faq.txt | ✅ written — fit, wireless charging, where it's made, wrong-size returns; no guarantees, no eco, no superlatives |
| Brand Story header 1464×625 (print shop) | ❌ **BLOCKED** — pure generative scene, needs Gemini |

## outputs/video/ — storyboards only

No video model available → per the brief, storyboard frames and stop:

- `brand-video-storyboard-01..10.jpg` (1920×1080) — the five 8s clips broken
  into 10 frames with timecodes, camera notes, and reference stills from the
  existing renders. End card "Printed in Orlando" is the only on-screen text.
- `turntable-storyboard-01..10.jpg` — 15s turntable at 36° steps, reference
  stills on the four angles that exist.

Note: each device's existing Ken Burns product video is already on S3
(`catalog/tough-magsafe/<device>/255/*-video.mp4`) if a slot-09 video is wanted
before Veo access exists.

## Apple-logo check — PASS, every file

- Zoom-audited every render that shows a naked phone (the five unique
  exploded/ring shots used in slots 06/07 and the A+ tiles): the phone mid-back
  is covered by the black liner or plain metal in all of them. **No Apple logo
  anywhere in any output.** No MagSafe logo mark either — magnet rings only,
  wording limited to "Compatible with magnetic wireless charging".
- Slides/typographic assets contain no device marks at all.
- Heroes/lifestyles show the case-on-phone only (no bare back).

## Preview for approval (phone-friendly)

- `preview/<ASIN>-preview.jpg` — one tall 750px-wide sheet per child, all 8
  slots in order with filenames.
- `preview/contact-sheet-all.jpg` — the whole 10×8 matrix on one sheet.

## Open items for Daren

1. **Drop-test number** — slide 04 ships with `[DROP_FT] FT DROP TESTED`.
   Send the number and the slide regenerates in seconds.
2. A working **Gemini API key** (the old one was killed as leaked) unlocks the
   BLOCKED items: cottage-garden lifestyle scene (02), charger-puck scene (07),
   A+ print-shop header, gift/desk use-case scenes — and Veo for the videos.
3. Slim 255 render (or drop the third comparison column).
4. Approve/reject the module1 banner body swap (17e in place of the duplicate
   17 Pro).

## Where things are

Built in the repo working copy on branch
`claude/strawberry-thief-magsafe-stack-4wbrg4` (this folder). The session's
egress proxy blocks binary uploads to Dropbox, so the files live on the branch;
a Dropbox `/-- Amazon Store Update/56_image-stack-strawberry-thief_2026-08-30/`
folder with this README points here. Sources pulled from the public S3 bucket
`distinctinkimages` (tough-magsafe 255 stacks, `catalog/_shared` slides) and the
SP-API family lookup above. Build scripts (Pillow, deterministic, re-runnable)
are in the session scratchpad: `build_common.py`, `build_photo_slots.py`,
`build_slides.py`, `build_aplus.py`, `build_storyboards.py`.
