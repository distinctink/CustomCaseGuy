"""Video storyboards, 1920x1080 — no video model available in this session."""
from build_common import *
from PIL import Image, ImageDraw

def frame(idx, total, title, desc_lines, ref_src=None, tag='BRAND VIDEO 40s'):
    im = Image.new('RGB', (1920, 1080), BLACK)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 1920, 14], fill=ORANGE)
    f_tag = font('monob', 34)
    d.text((80, 50), f'STORYBOARD - {tag}', font=f_tag, fill=ORANGE)
    s = f'FRAME {idx:02d}/{total:02d}'
    d.text((1840 - text_w(d, s, f_tag), 50), s, font=f_tag, fill=(150, 145, 138))
    f_t = font('black', 82)
    y = 170
    for ln in wrap_to(d, title, f_t, 900):
        d.text((80, y), ln, font=f_t, fill=CREAM)
        y += 98
    d.rectangle([80, y + 16, 420, y + 28], fill=ORANGE)
    f_b = font('mono', 36)
    y += 70
    for ln in desc_lines:
        d.text((80, y), ln, font=f_b, fill=(168, 163, 155))
        y += 50
    if ref_src:
        ref = load(ref_src)
        sc = 800 / ref.height
        ref = ref.resize((int(ref.width * sc), 800), Image.LANCZOS)
        ref = center_crop(ref, min(760, ref.width), 800)
        im.paste(ref, (1920 - ref.width - 80, 160))
        d.rectangle([1920 - ref.width - 80, 960, 1840, 966], fill=ORANGE)
        f_r = font('mono', 26)
        d.text((1920 - ref.width - 80, 976), 'reference still (existing render)', font=f_r, fill=GREY)
    else:
        d.rounded_rectangle([1160, 160, 1840, 960], radius=24, outline=(70, 66, 60), width=6)
        f_r = font('mono', 30)
        s = 'to be shot / generated'
        d.text((1500 - text_w(d, s, f_r) // 2, 540), s, font=f_r, fill=GREY)
    f_ft = font('black', 40)
    d.text((80, 990), 'DISTINCT INK.', font=f_ft, fill=CREAM)
    return im

BRAND = [
    ('Flatbed printer lays down the Morris print',
     ['0:00-0:08', 'top-down, printer head passes over', 'case blanks; Strawberry Thief art', 'appears line by line', 'NO on-screen text'], None),
    ('Print head detail, ink hitting the shell',
     ['0:04 insert (within clip 1)', 'macro, shallow depth of field', 'UV ink cures matte'], None),
    ('Case lifted off the bed',
     ['0:08-0:16', 'gloved hand lifts the finished', 'case toward camera', 'print fills frame'], stack_path('iphone-17', '02-closeup')),
    ('Case turned in hand, corner detail',
     ['0:12 insert (within clip 2)', 'raised bezel + corner wrap visible'], f'{S}/work/shared-08-texture.jpg'),
    ('Hands snap the case onto the phone',
     ['0:16-0:24', 'two hands, phone face-down,', 'case clicks on over the camera', 'island - exact model fit'], stack_path('iphone-17', '03-exploded')),
    ('Fit check: camera island through the cutout',
     ['0:20 insert (within clip 3)', 'camera island seats into opening'], stack_path('iphone-17', '01-hero')),
    ('Magnetic charger puck clicks on',
     ['0:24-0:32', 'case-on phone face-down on wood/', 'linen, charger puck snaps to the', 'built-in magnet ring, cable trails'], stack_path('iphone-17', '04-magsafe')),
    ('Charging glow, slow settle',
     ['0:28 insert (within clip 4)', 'screen lights briefly; hold'], None),
    ('Slow push-in on the finished case',
     ['0:32-0:40', 'case on phone, back view, garden', 'light; push-in to the birds motif'], stack_path('iphone-17', '06-lifestyle')),
    ('End card: "Printed in Orlando"',
     ['0:37-0:40 (3s)', 'only on-screen text in the video', 'cream type on black, orange accent'], None),
]

TURN = [(f'Turntable {a}°', [f'15s silent loop, iPhone 17 Pro case', f'continuous rotation, {a}° position', 'pure white sweep, soft shadow'],
         None) for a in range(0, 360, 36)]
TURN_REFS = {0: stack_path('iphone-17-pro-max', '01-hero'),
             36: stack_path('iphone-17-pro-max', '05-angled'),
             72: stack_path('iphone-17-pro-max', '03-exploded'),
             180: stack_path('iphone-17-pro-max', '02-lifestyle')}

def main():
    for i, (t, dl, ref) in enumerate(BRAND, 1):
        save_jpg(frame(i, 10, t, dl, ref), f'{OUT_V}/brand-video-storyboard-{i:02d}.jpg')
    for i, (t, dl, _) in enumerate(TURN, 1):
        a = (i - 1) * 36
        save_jpg(frame(i, 10, t, dl, TURN_REFS.get(a), tag='TURNTABLE 15s - SLOT 09'),
                 f'{OUT_V}/turntable-storyboard-{i:02d}.jpg')
    print('storyboards done')

if __name__ == '__main__':
    main()
