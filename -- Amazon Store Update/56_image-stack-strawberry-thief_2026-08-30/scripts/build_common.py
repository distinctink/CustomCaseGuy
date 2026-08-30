"""Shared helpers + brand tokens for the 56_ Strawberry Thief stack build."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = '/tmp/claude-0/-home-user-CustomCaseGuy/0d31c323-0da1-549d-87d3-ce2fb75be1d9/scratchpad'
SRC = S + '/src'
REPO = '/home/user/CustomCaseGuy/-- Amazon Store Update/56_image-stack-strawberry-thief_2026-08-30'
OUT_L = REPO + '/outputs/listing'
OUT_A = REPO + '/outputs/aplus'
OUT_V = REPO + '/outputs/video'
PREV = REPO + '/preview'
FONTS = S + '/fonts'

# Brand tokens (sampled from img9-trust-2000.jpg / img7)
ORANGE = (232, 71, 27)     # slide orange
BLACK  = (17, 16, 15)
CREAM  = (242, 237, 227)
GREY   = (120, 116, 110)
GREEN  = (28, 122, 62)     # green check per task

def font(name, size):
    path = {
        'black': FONTS + '/ArchivoBlack.ttf',
        'bold':  FONTS + '/Archivo-Bold.ttf',
        'med':   FONTS + '/Archivo-Medium.ttf',
        'mono':  FONTS + '/SpaceMono.ttf',
        'monob': FONTS + '/SpaceMono-Bold.ttf',
    }[name]
    return ImageFont.truetype(path, size)

def text_w(draw, s, f):
    b = draw.textbbox((0, 0), s, font=f)
    return b[2] - b[0]

def wrap_to(draw, s, f, maxw):
    words = s.split()
    lines, cur = [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if text_w(draw, t, f) <= maxw:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def load(p):
    return Image.open(p).convert('RGB')

def product_bbox(im, thresh=248):
    """Bounding box of non-white content."""
    g = im.convert('L').point(lambda v: 255 if v < thresh else 0)
    return g.getbbox()

def hero_2000(src_path, fill=0.86, canvas=2000):
    im = load(src_path)
    bb = product_bbox(im)
    if bb:
        im = im.crop(bb)
    target = int(canvas * fill)
    scale = min(target / im.width, target / im.height)
    im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    cv = Image.new('RGB', (canvas, canvas), (255, 255, 255))
    cv.paste(im, ((canvas - im.width) // 2, (canvas - im.height) // 2))
    return cv

def square_2000(src_path):
    im = load(src_path)
    if im.size != (2000, 2000):
        im = im.resize((2000, 2000), Image.LANCZOS)
    return im

def center_crop(im, w, h):
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))

def save_jpg(im, path, q=90):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.convert('RGB').save(path, 'JPEG', quality=q, optimize=True)
    return path

# ASIN -> (device label, stack dir, file prefix, borrowed_from or None)
FAMILY = {
    'B0HC1SGZSD': ('iPhone 17',         'iphone-17',         'msafe17',    None),
    'B0HC1T6B3N': ('iPhone 16',         'iphone-17',         'msafe17',    'iPhone 17 render (same body family)'),
    'B0HC17V65C': ('iPhone 16 Plus',    'iphone-17',         'msafe17',    'iPhone 17 render (same body family)'),
    'B0HDQ7BGN6': ('iPhone 16 Pro',     'iphone-16-pro-max', 'msafe16pm',  'iPhone 16 Pro Max render (same camera family)'),
    'B0HDQ9322L': ('iPhone 16 Pro Max', 'iphone-16-pro-max', 'msafe16pm',  None),
    'B0HDQ2SXNF': ('iPhone 16e',        'iphone-17e',        'msafe17e',   'iPhone 17e render (identical body)'),
    'B0HC3YN721': ('iPhone 17e',        'iphone-17e',        'msafe17e',   None),
    'B0HC41ZP4N': ('iPhone 17 Air',     'iphone-17-air',     'msafe17air', None),
    'B0HBNW18PD': ('iPhone 17 Pro',     'iphone-17-pro-max', 'msafe17pm',  'iPhone 17 Pro Max render (same camera family)'),
    'B0HBLW113V': ('iPhone 17 Pro Max', 'iphone-17-pro-max', 'msafe17pm',  None),
}

# per-stack shot map: hero, lifestyle, magsafe/ring shot, grid list (6)
STACK = {
    'iphone-17': dict(
        hero='01-hero', lifestyle='06-lifestyle', ring='04-magsafe',
        grid=['01-hero', '02-closeup', '03-exploded', '04-magsafe', '05-action', '06-lifestyle']),
    'iphone-17e': dict(
        hero='01-hero', lifestyle='05-lifestyle', ring='04-magsafe',
        grid=['01-hero', '02-closeup', '03-angled', '04-magsafe', '05-lifestyle', 'TEXTURE']),
    'iphone-17-air': dict(
        hero='01-hero', lifestyle='07-lifestyle', ring='05-magsafe',
        grid=['01-hero', '02-closeup', '03-angled', '04-exploded', '05-magsafe', '06-action']),
    'iphone-17-pro-max': dict(
        hero='01-hero', lifestyle='02-lifestyle', ring='03-exploded',
        grid=['01-hero', '04-closeup', '05-angled', '03-exploded', '06-fourangle', '02-lifestyle']),
    'iphone-16-pro-max': dict(
        hero='01-hero', lifestyle='08-lifestyle', ring='04-exploded',
        grid=['01-hero', '02-closeup', '03-angled', '04-exploded', '05-action', '07-action2']),
}

def stack_path(stack, shot):
    pref = {'iphone-17': 'msafe17', 'iphone-17e': 'msafe17e', 'iphone-17-air': 'msafe17air',
            'iphone-17-pro-max': 'msafe17pm', 'iphone-16-pro-max': 'msafe16pm'}[stack]
    return f'{SRC}/renders/{stack}/{pref}-255-{shot}.jpg'
