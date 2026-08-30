"""A+ content assets."""
from build_common import *
from PIL import Image, ImageDraw
import random

def card(w, h, bg, fg, accent, lines, sub=None):
    im = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, 14], fill=accent)
    size = 44
    f = font('black', size)
    # shrink to fit
    while any(text_w(d, ln, f) > w - 60 for ln in lines):
        size -= 2
        f = font('black', size)
    y = 60
    for ln in lines:
        d.text((30, y), ln, font=f, fill=fg)
        y += int(size * 1.22)
    d.rectangle([30, y + 14, 130, y + 24], fill=accent)
    if sub:
        f_s = font('mono', 26)
        yy = h - 110 - (len(sub) - 1) * 34 - 34
        for s in sub:
            d.text((30, yy), s, font=f_s, fill=fg if bg != CREAM else GREY)
            yy += 34
    f_l = font('black', 28)
    d.text((w - 30 - text_w(d, 'DISTINCT INK.', f_l), h - 48), 'DISTINCT INK.', font=f_l,
           fill=accent if bg == BLACK else BLACK)
    return im

def brand_cards():
    specs = [
        (BLACK, CREAM, ORANGE, ['PRINTED', 'IN', 'ORLANDO'], ['flatbed presses,', 'real ink']),
        (ORANGE, BLACK, CREAM, ['12 YEARS,', '5 MARKET-', 'PLACES'], ['selling online', 'since 2014']),
        (CREAM, BLACK, ORANGE, ['DESIGNS', 'YOU WON\'T', 'FIND ANY-', 'WHERE ELSE'], ['drawn for our', 'own catalog']),
        (BLACK, CREAM, ORANGE, ['ONE', 'PHONE,', 'ONE CASE'], ['cut for exactly', 'one model']),
    ]
    for i, (bg, fg, ac, lines, sub) in enumerate(specs, 1):
        save_jpg(card(362, 453, bg, fg, ac, lines, sub), f'{OUT_A}/brand-story-card-{i}-362x453.jpg')

def linen(w, h, base=CREAM):
    im = Image.new('RGB', (w, h), base)
    d = ImageDraw.Draw(im)
    rnd = random.Random(56)
    for y in range(0, h, 3):
        v = rnd.randint(-5, 5)
        c = tuple(max(0, min(255, ch + v)) for ch in base)
        d.line([(0, y), (w, y)], fill=c)
    for x in range(0, w, 3):
        v = rnd.randint(-4, 4)
        c = tuple(max(0, min(255, ch + v)) for ch in base)
        d.line([(x, 0), (x, h)], fill=c, width=1)
    return im.filter(ImageFilter.GaussianBlur(0.6))

def cutout(src, target_h):
    """Cut the product from its white ground; background = white connected to border."""
    im = load(src)
    bb = product_bbox(im)
    pad = 6
    im = im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad),
                  min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))
    marker = (255, 0, 255)
    ff = im.copy()
    for seed in [(0, 0), (ff.width - 1, 0), (0, ff.height - 1), (ff.width - 1, ff.height - 1)]:
        if ff.getpixel(seed) != marker:
            ImageDraw.floodfill(ff, seed, marker, thresh=24)
    mask = Image.new('L', im.size, 255)
    px_ff = ff.load(); px_m = mask.load()
    for y in range(im.height):
        for x in range(im.width):
            if px_ff[x, y] == marker:
                px_m[x, y] = 0
    sc = target_h / im.height
    size = (int(im.width * sc), target_h)
    return im.resize(size, Image.LANCZOS), mask.resize(size, Image.LANCZOS)

def module1_banner():
    """970x300: three Strawberry Thief cases fanned on linen."""
    im = linen(970, 300)
    cases = [
        (stack_path('iphone-17', '01-hero'), -10, 120, 25),
        (stack_path('iphone-17e', '01-hero'), 0, 400, 15),
        (stack_path('iphone-17-pro-max', '01-hero'), 10, 680, 25),
    ]
    for src, rot, x, y in cases:
        c, m = cutout(src, 250)
        c = c.rotate(rot, expand=True, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        m = m.rotate(rot, expand=True, resample=Image.BICUBIC, fillcolor=0)
        shm = m.filter(ImageFilter.GaussianBlur(8)).point(lambda v: int(v * 0.30))
        im.paste((70, 60, 48), (x + 10, y + 14), shm)
        im.paste(c, (x, y), m)
    return im

def module2_tiles():
    """3x 300x300: shell / liner / bezel."""
    # shell: outer case lifted off (17 exploded crop, upper case)
    im = load(stack_path('iphone-17', '03-exploded'))
    shell = center_crop(im.resize((600, 600), Image.LANCZOS), 300, 300)
    save_jpg(shell, f'{OUT_A}/module2-tile-1-shell-300x300.jpg')
    # liner: interior view (17air exploded)
    im = load(stack_path('iphone-17-air', '04-exploded'))
    liner = center_crop(im.resize((640, 640), Image.LANCZOS), 300, 300)
    save_jpg(liner, f'{OUT_A}/module2-tile-2-liner-300x300.jpg')
    # bezel: camera closeup
    im = load(stack_path('iphone-17', '02-closeup'))
    bez = im.resize((460, 460), Image.LANCZOS).crop((60, 20, 360, 320))
    save_jpg(bez, f'{OUT_A}/module2-tile-3-bezel-300x300.jpg')

def module3_comparison():
    """3x 150x300 columns: Tough / Clear / Slim(placeholder)."""
    # tough
    c, m = cutout(stack_path('iphone-17', '01-hero'), 270)
    cv = Image.new('RGB', (150, 300), (255, 255, 255))
    cs = c.resize((int(c.width * 270 / c.height), 270), Image.LANCZOS) if c.height != 270 else c
    cv.paste(cs, ((150 - cs.width) // 2, 15), m.resize(cs.size))
    save_jpg(cv, f'{OUT_A}/module3-col-1-tough-150x300.jpg')
    # clear
    im = load(f'{SRC}/clear/clr17-255-hero.jpg')
    bb = product_bbox(im); im = im.crop(bb)
    sc = 270 / im.height
    im = im.resize((int(im.width * sc), 270), Image.LANCZOS)
    cv = Image.new('RGB', (150, 300), (255, 255, 255))
    cv.paste(im, ((150 - im.width) // 2, 15))
    save_jpg(cv, f'{OUT_A}/module3-col-2-clear-150x300.jpg')
    # slim placeholder
    cv = Image.new('RGB', (150, 300), CREAM)
    d = ImageDraw.Draw(cv)
    d.rounded_rectangle([30, 40, 120, 230], radius=22, outline=GREY, width=4)
    f = font('mono', 16)
    for i, s in enumerate(['SLIM', 'RENDER', 'PENDING']):
        d.text(((150 - text_w(d, s, f)) // 2, 244 + i * 18), s, font=f, fill=GREY)
    save_jpg(cv, f'{OUT_A}/module3-col-3-slim-PLACEHOLDER-150x300.jpg')

def module4_tiles():
    """4x 300x300 use-case tiles from existing scenes where honest."""
    # garden: lifestyle greenery crop (no face)
    im = load(stack_path('iphone-17', '06-lifestyle'))
    g = im.crop((430, 250, 1530, 1350)).resize((300, 300), Image.LANCZOS)
    save_jpg(g, f'{OUT_A}/module4-tile-2-garden-300x300.jpg')
    # desk: hero on linen flat
    cv = linen(300, 300, (238, 233, 223))
    c, m = cutout(stack_path('iphone-17e', '01-hero'), 260)
    cv.paste(c, ((300 - c.width) // 2, 20), m)
    save_jpg(cv, f'{OUT_A}/module4-tile-3-desk-300x300.jpg')
    # gift: case on cream with orange ribbon band drawn
    cv = linen(300, 300, (244, 236, 226))
    d = ImageDraw.Draw(cv)
    d.rectangle([0, 210, 300, 258], fill=ORANGE)
    d.rectangle([0, 222, 300, 246], fill=(200, 58, 16))
    c, m = cutout(stack_path('iphone-16-pro-max', '01-hero'), 230)
    cv.paste(c, ((300 - c.width) // 2, 12), m)
    save_jpg(cv, f'{OUT_A}/module4-tile-1-gift-300x300.jpg')
    # travel: angled/action crop
    im = load(stack_path('iphone-17-air', '06-action'))
    t = center_crop(im.resize((420, 420), Image.LANCZOS), 300, 300)
    save_jpg(t, f'{OUT_A}/module4-tile-4-travel-300x300.jpg')

FAQ = '''A+ MODULE 5 — FAQ (text module, Q&A format)

Q: Which phones does this case fit?
A: Each listing is cut for exactly one model. Pick your phone in the size
selector — an iPhone 17 case fits the iPhone 17 only, not the 17 Pro, 17 Air,
or any other model. The camera opening, buttons, and port line up only on the
model named on the listing.

Q: Does wireless charging work through the case?
A: Yes. The case has a built-in magnet ring and is compatible with magnetic
wireless chargers and accessories. Leave the case on and set the phone on the
charger.

Q: Where is it made?
A: Each case is printed in Orlando, Florida on our own flatbed presses, then
assembled and shipped from the same shop.

Q: What if I order the wrong size?
A: Contact us through Amazon and we will help you sort out an exchange or
return under Amazon's return policy. Double-check your phone model in
Settings > General > About before ordering — "iPhone 17" and "iPhone 17 Pro"
take different cases.
'''

def main():
    brand_cards()
    save_jpg(module1_banner(), f'{OUT_A}/module1-banner-970x300.jpg')
    module2_tiles()
    module3_comparison()
    module4_tiles()
    with open(f'{OUT_A}/module5-faq.txt', 'w') as fh:
        fh.write(FAQ)
    print('aplus done')

if __name__ == '__main__':
    main()
