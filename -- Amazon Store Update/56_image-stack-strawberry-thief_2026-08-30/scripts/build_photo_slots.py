"""Slots 01, 02, 06, 07 per ASIN + shared 08 texture macro."""
from build_common import *
from PIL import Image, ImageDraw

def build_texture():
    """Shared slot 08: macro of the print at the case corner (from iPhone 17 hero)."""
    im = load(stack_path('iphone-17', '01-hero'))
    bb = product_bbox(im)
    x0, y0, x1, y1 = bb
    # lower-left corner of the case, plus a bit of white so the corner curve shows
    side = int((y1 - y0) * 0.42)
    cx0 = max(0, x0 - 40)
    cy1 = min(im.height, y1 + 40)
    crop = im.crop((cx0, cy1 - side, cx0 + side, cy1))
    big = crop.resize((2000, 2000), Image.LANCZOS)
    return big

def grid_2x3(stack, texture_im):
    cell_w, cell_h = 1000, 667
    cv = Image.new('RGB', (2000, 2000), (255, 255, 255))
    shots = STACK[stack]['grid']
    for i, shot in enumerate(shots):
        if shot == 'TEXTURE':
            im = texture_im.copy()
        else:
            im = load(stack_path(stack, shot))
        # scale to cover cell then center-crop
        scale = max(cell_w / im.width, cell_h / im.height)
        im = im.resize((int(im.width * scale) + 1, int(im.height * scale) + 1), Image.LANCZOS)
        im = center_crop(im, cell_w, cell_h)
        x = (i % 2) * cell_w
        y = (i // 2) * cell_h
        cv.paste(im, (x, y))
    # thin separators, brand cream
    d = ImageDraw.Draw(cv)
    for gx in (1000,):
        d.rectangle([gx - 3, 0, gx + 3, 2000], fill=(255, 255, 255))
    for gy in (667, 1334):
        d.rectangle([0, gy - 3, 2000, gy + 3], fill=(255, 255, 255))
    return cv

def main():
    texture = build_texture()
    save_jpg(texture, f'{S}/work/shared-08-texture.jpg')

    grids = {}
    for stack in STACK:
        grids[stack] = grid_2x3(stack, texture)

    for asin, (label, stack, pref, borrow) in FAMILY.items():
        sp = STACK[stack]
        save_jpg(hero_2000(stack_path(stack, sp['hero'])), f'{OUT_L}/{asin}.01.jpg')
        save_jpg(square_2000(stack_path(stack, sp['lifestyle'])), f'{OUT_L}/{asin}.02.jpg')
        save_jpg(grids[stack], f'{OUT_L}/{asin}.06.jpg')
        save_jpg(hero_2000(stack_path(stack, sp['ring']), fill=0.92), f'{OUT_L}/{asin}.07.jpg')
        save_jpg(texture, f'{OUT_L}/{asin}.08.jpg')
        print('done', asin, label)

if __name__ == '__main__':
    main()
