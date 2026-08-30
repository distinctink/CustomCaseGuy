"""Brand slides: 03 (Orlando, shared), 04 (protection, shared), 05 (fits-one-phone, per device)."""
from build_common import *
from PIL import Image, ImageDraw, ImageOps
import math

W = 2000

def draw_check(d, cx, cy, r, color, width):
    d.line([(cx - r, cy), (cx - r * 0.25, cy + r * 0.7)], fill=color, width=width)
    d.line([(cx - r * 0.25, cy + r * 0.7), (cx + r * 1.1, cy - r * 0.8)], fill=color, width=width)

def draw_x(d, cx, cy, r, color, width):
    d.line([(cx - r, cy - r), (cx + r, cy + r)], fill=color, width=width)
    d.line([(cx - r, cy + r), (cx + r, cy - r)], fill=color, width=width)

# ---------------- slide 03: orange Orlando slide ----------------
def slide03():
    im = Image.new('RGB', (W, W), ORANGE)
    d = ImageDraw.Draw(im)
    # faint concentric arcs, bottom-left (echo of original texture)
    for r in range(200, 2600, 90):
        d.arc([200 - r, 1450 - r + 900, 200 + r, 1450 + r + 900],
              start=180, end=360, fill=(220, 62, 20), width=6)
    # outline circle top-right
    d.ellipse([1770, 130, 1870, 230], outline=BLACK, width=14)
    # headline
    f_h = font('black', 176)
    lines = ['PRINTED IN', 'ORLANDO.', 'DIRECT FROM', 'THE MAKER.']
    y = 250
    for i, ln in enumerate(lines):
        d.text((150, y), ln, font=f_h, fill=BLACK)
        y += 205
    # cream square accent after "ORLANDO." and "MAKER."
    w1 = text_w(d, 'ORLANDO.', f_h)
    d.rectangle([150 + w1 + 18, 250 + 205 + 128, 150 + w1 + 62, 250 + 205 + 172], fill=CREAM)
    # black sub-bar
    bar_y0, bar_y1 = 1300, 1585
    d.rectangle([150, bar_y0, 1850, bar_y1], fill=BLACK)
    f_s = font('black', 74)
    d.text((210, bar_y0 + 55), 'REAL PRESSES. REAL INK.', font=f_s, fill=CREAM)
    d.text((210, bar_y0 + 152), 'NO MIDDLEMAN.', font=f_s, fill=CREAM)
    wnm = text_w(d, 'NO MIDDLEMAN.', f_s)
    d.rectangle([210 + wnm - 26, bar_y0 + 152 + 58, 210 + wnm - 4, bar_y0 + 152 + 80], fill=ORANGE)
    # footer
    f_m = font('monob', 46)
    d.text((150, 1840), 'MADE IN ORLANDO, FLORIDA', font=f_m, fill=BLACK)
    f_l = font('black', 52)
    s = 'DISTINCT INK.'
    d.text((1850 - text_w(d, s, f_l), 1834), s, font=f_l, fill=BLACK)
    return im

# ---------------- slide 04: protection infographic ----------------
def slide04():
    im = Image.new('RGB', (W, W), BLACK)
    d = ImageDraw.Draw(im)
    # orange header band
    d.rectangle([0, 0, W, 250], fill=ORANGE)
    f_h = font('black', 105)
    d.text((105, 40), 'BUILT LIKE A', font=f_h, fill=BLACK)
    d.text((105, 145), 'PRESS PLATE', font=f_h, fill=BLACK)
    d.rectangle([1860, 120, 1900, 160], fill=CREAM)

    # center: case diagram
    cx0, cy0, cx1, cy1 = 720, 460, 1280, 1660
    d.rectangle([cx0 - 22, cy0 - 22, cx1 + 22, cy1 + 22], fill=ORANGE)
    d.rectangle([cx0, cy0, cx1, cy1], fill=CREAM)
    # camera cutout
    d.rounded_rectangle([cx0 + 55, cy0 + 55, cx0 + 205, cy0 + 205], radius=45, fill=BLACK)
    # magnet ring
    ring_r = 170
    ring_cx, ring_cy = (cx0 + cx1) // 2, cy0 + 760
    d.ellipse([ring_cx - ring_r, ring_cy - ring_r, ring_cx + ring_r, ring_cy + ring_r],
              outline=(150, 146, 140), width=16)

    f_t = font('black', 62)
    f_b = font('mono', 40)

    # left top: dual-layer
    d.text((105, 400), 'DUAL-LAYER', font=f_t, fill=CREAM)
    d.text((105, 470), 'CONSTRUCTION', font=f_t, fill=CREAM)
    d.rectangle([105, 560, 600, 572], fill=ORANGE)
    d.text((105, 600), 'polycarbonate shell', font=f_b, fill=(168, 163, 155))
    d.text((105, 652), '+ TPU inner liner', font=f_b, fill=(168, 163, 155))

    # left bottom: precise cutouts
    d.text((105, 1130), 'PRECISE', font=f_t, fill=CREAM)
    d.text((105, 1200), 'CUTOUTS', font=f_t, fill=CREAM)
    d.rectangle([105, 1290, 480, 1302], fill=ORANGE)
    d.text((105, 1330), 'every port & button,', font=f_b, fill=(168, 163, 155))
    d.text((105, 1382), 'open', font=f_b, fill=(168, 163, 155))

    # left mid: drop-test placeholder callout
    d.rectangle([105, 830, 620, 1010], fill=ORANGE)
    f_d = font('black', 58)
    d.text((135, 862), '[DROP_FT] FT', font=f_d, fill=BLACK)
    d.text((135, 928), 'DROP TESTED', font=f_d, fill=BLACK)

    # right top: raised bezel with camera close-up inset
    cam = load(stack_path('iphone-17', '02-closeup'))
    cam = center_crop(cam.resize((1400, 1400), Image.LANCZOS), 560, 560)
    mask = Image.new('L', (560, 560), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, 560, 560], fill=255)
    ring = Image.new('RGB', (600, 600), ORANGE)
    rmask = Image.new('L', (600, 600), 0)
    ImageDraw.Draw(rmask).ellipse([0, 0, 600, 600], fill=255)
    im.paste(ring, (1360, 430), rmask)
    im.paste(cam, (1380, 450), mask)
    f_rt = font('black', 62)
    s = 'RAISED'
    d.text((1895 - text_w(d, s, f_rt), 1080), s, font=f_rt, fill=CREAM)
    s = 'BEZEL'
    d.text((1895 - text_w(d, s, f_rt), 1150), s, font=f_rt, fill=CREAM)
    d.rectangle([1550, 1240, 1895, 1252], fill=ORANGE)
    for i, s in enumerate(['lip around screen', '& camera island']):
        d.text((1895 - text_w(d, s, f_b), 1280 + i * 52), s, font=f_b, fill=(168, 163, 155))

    # right bottom: wireless charging
    d.ellipse([1690, 1430, 1800, 1540], outline=ORANGE, width=22)
    lines = ['COMPATIBLE WITH', 'MAGNETIC WIRELESS', 'CHARGING']
    f_c = font('black', 52)
    for i, s in enumerate(lines):
        d.text((1895 - text_w(d, s, f_c), 1580 + i * 62), s, font=f_c, fill=CREAM)

    # footer
    f_m = font('monob', 44)
    d.text((105, 1870), 'MADE IN ORLANDO, FLORIDA', font=f_m, fill=(168, 163, 155))
    f_l = font('black', 52)
    d.text((1895 - text_w(d, 'DISTINCT INK.', f_l), 1858), 'DISTINCT INK.', font=f_l, fill=CREAM)
    return im

# ---------------- slide 05: fits-one-phone, per device ----------------
DEVS = [
    ('iPhone 16',        147.6, 71.6, 'vdual'),
    ('iPhone 16 Plus',   160.9, 77.8, 'vdual'),
    ('iPhone 16 Pro',    149.6, 71.5, 'triple'),
    ('iPhone 16 Pro Max',163.0, 77.6, 'triple'),
    ('iPhone 16e',       146.7, 71.5, 'single'),
    ('iPhone 17',        149.6, 71.6, 'vdual'),
    ('iPhone 17 Air',    156.2, 74.7, 'bar1'),
    ('iPhone 17 Pro',    150.0, 71.9, 'bar3'),
    ('iPhone 17 Pro Max',163.4, 78.0, 'bar3'),
    ('iPhone 17e',       146.7, 71.5, 'single'),
]

def draw_phone(d, x, y, ph, pw, cam, body, detail):
    """Back-of-phone silhouette at top-left (x,y), ph/pw in px."""
    r = int(pw * 0.16)
    d.rounded_rectangle([x, y, x + pw, y + ph], radius=r, fill=body)
    inset = int(pw * 0.07)
    if cam == 'vdual':
        cw = int(pw * 0.30); chh = int(pw * 0.56)
        d.rounded_rectangle([x + inset, y + inset, x + inset + cw, y + inset + chh],
                            radius=cw // 2, fill=detail)
        cr = int(cw * 0.30)
        for cyy in (y + inset + int(chh * 0.27), y + inset + int(chh * 0.73)):
            d.ellipse([x + inset + cw // 2 - cr, cyy - cr, x + inset + cw // 2 + cr, cyy + cr], fill=body)
    elif cam == 'triple':
        cs = int(pw * 0.46)
        d.rounded_rectangle([x + inset, y + inset, x + inset + cs, y + inset + cs],
                            radius=int(cs * 0.3), fill=detail)
        cr = int(cs * 0.16)
        pts = [(0.30, 0.28), (0.30, 0.72), (0.68, 0.50)]
        for fx, fy in pts:
            cxx, cyy = x + inset + int(cs * fx), y + inset + int(cs * fy)
            d.ellipse([cxx - cr, cyy - cr, cxx + cr, cyy + cr], fill=body)
    elif cam == 'single':
        cr = int(pw * 0.14)
        cxx, cyy = x + inset + cr, y + inset + cr
        d.ellipse([cxx - cr, cyy - cr, cxx + cr, cyy + cr], fill=detail)
    elif cam in ('bar1', 'bar3'):
        bh = int(pw * 0.34)
        d.rounded_rectangle([x + inset, y + inset, x + pw - inset, y + inset + bh],
                            radius=bh // 2, fill=detail)
        cr = int(bh * 0.30)
        if cam == 'bar3':
            xs = [0.18, 0.38, 0.58]
        else:
            xs = [0.16]
        for fx in xs:
            cxx = x + inset + int((pw - 2 * inset) * fx) + cr
            cyy = y + inset + bh // 2
            d.ellipse([cxx - cr, cyy - cr, cxx + cr, cyy + cr], fill=body)

def slide05(label):
    im = Image.new('RGB', (W, W), CREAM)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 46, W], fill=ORANGE)
    f_m = font('monob', 52)
    d.text((160, 130), 'THIS CASE FITS ONE PHONE:', font=f_m, fill=GREY)
    # black bar with device + green check
    d.rectangle([160, 240, 1840, 480], fill=BLACK)
    f_dev = font('black', 108)
    head = label.upper().replace('IPHONE', 'iPHONE')
    if label.endswith('e'):
        head = head[:-1] + 'e'
    d.text((240, 300), head, font=f_dev, fill=CREAM)
    d.rectangle([1620, 300, 1770, 450], fill=GREEN)
    draw_check(d, 1687, 375, 42, CREAM, 18)
    f_sub = font('monob', 44)
    d.text((160, 560), 'WILL NOT FIT OTHER MODELS - CHECK YOUR PHONE BEFORE ORDERING',
           font=f_sub, fill=GREY)
    d.rectangle([160, 670, 1840, 678], fill=BLACK)

    # 5 x 2 silhouette line-up
    grid_x0, grid_y0 = 160, 760
    cell_w, cell_h = 340, 500
    scale = 1.55  # px per mm
    for i, (name, hmm, wmm, cam) in enumerate(DEVS):
        col, row = i % 5, i // 5
        cx = grid_x0 + col * cell_w
        cy = grid_y0 + row * cell_h
        ph, pw = int(hmm * scale), int(wmm * scale)
        px = cx + (cell_w - 60 - pw) // 2
        py = cy + (390 - ph) // 2
        match = (name == label)
        body = BLACK if match else (196, 190, 180)
        detail = ORANGE if match else (232, 227, 217)
        draw_phone(d, px, py, ph, pw, cam, body, detail)
        # badge
        if match:
            d.ellipse([px + pw - 40, py + ph - 60, px + pw + 40, py + ph + 20], fill=GREEN)
            draw_check(d, px + pw - 2, py + ph - 22, 22, CREAM, 11)
        else:
            draw_x(d, px + pw - 6, py + ph - 16, 16, (150, 144, 136), 8)
        # label
        f_lab = font('monob' if match else 'mono', 34)
        short = name.replace('iPhone ', '')
        lw = text_w(d, short, f_lab)
        d.text((cx + (cell_w - 60 - lw) // 2, cy + 400), short, font=f_lab,
               fill=BLACK if match else GREY)

    f_ft = font('monob', 40)
    d.text((160, 1870), 'CAMERA CUTOUT   BUTTONS   CHARGING: EXACT FIT', font=f_ft, fill=GREY)
    f_l = font('black', 52)
    d.text((1840 - text_w(d, 'DISTINCT INK.', f_l), 1848), 'DISTINCT INK.', font=f_l, fill=BLACK)
    return im

def main():
    s3 = slide03(); save_jpg(s3, f'{S}/work/slide03.jpg')
    s4 = slide04(); save_jpg(s4, f'{S}/work/slide04.jpg')
    for asin, (label, stack, pref, borrow) in FAMILY.items():
        save_jpg(s3, f'{OUT_L}/{asin}.03.jpg')
        save_jpg(s4, f'{OUT_L}/{asin}.04.jpg')
        save_jpg(slide05(label), f'{OUT_L}/{asin}.05.jpg')
        print('slides done', asin, label)

if __name__ == '__main__':
    main()
