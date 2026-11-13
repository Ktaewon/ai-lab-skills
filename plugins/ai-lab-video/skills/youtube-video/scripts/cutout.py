"""Cut a grid sheet of characters on white into transparent PNGs.
usage: cutout.py <sheet> <cols> <rows> <outdir> <prefix>"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sheet, cols, rows, outdir, prefix = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
im = Image.open(sheet).convert("RGB")
W, H = im.size
for r in range(rows):
    for c in range(cols):
        box = (round(c * W / cols), round(r * H / rows), round((c + 1) * W / cols), round((r + 1) * H / rows))
        cell = im.crop(box)
        a = np.asarray(cell).astype(int)
        mx, mn = a.max(2), a.min(2)
        # background candidates: bright and grey (white field + soft grey floor shadow)
        cand = ((mn > 105) & ((mx - mn) < 20)) | ((mn > 150) & ((mx - mn) < 36))
        mask = Image.fromarray(np.where(cand, 255, 0).astype("uint8")).copy()
        w, h = mask.size
        for x in range(0, w, 4):
            for y in (0, h - 1):
                if mask.getpixel((x, y)) == 255:
                    ImageDraw.floodfill(mask, (x, y), 128)
        for y in range(0, h, 4):
            for x in (0, w - 1):
                if mask.getpixel((x, y)) == 255:
                    ImageDraw.floodfill(mask, (x, y), 128)
        # background pockets enclosed by the character (between legs, under arms): any remaining
        # background-coloured blob bigger than MIN_POCKET px is background too. Eye highlights are
        # far smaller, so they stay.
        MIN_POCKET = 120
        m = np.asarray(mask).copy()
        bright = mn > 200  # pockets are near-white; fur speckles rarely are, so seed only from these
        for _ in range(4000):
            left = np.argwhere((m == 255) & bright)
            if not len(left):
                break
            y0, x0 = left[0]
            tmp = Image.fromarray(m).copy()
            ImageDraw.floodfill(tmp, (int(x0), int(y0)), 77)
            m = np.asarray(tmp).copy()
            comp = m == 77
            area = int(comp.sum())
            # only near-neutral white/grey pockets; cream or pastel fur (hamster belly, bunny) is warmer
            neutral = float((mx - mn)[comp].mean()) < 15 and float(mn[comp].mean()) > 205
            m[comp] = 128 if (area >= MIN_POCKET and neutral) else 60
        mask = Image.fromarray(m)
        fg = Image.fromarray(np.where(np.asarray(mask) == 128, 0, 255).astype("uint8")).copy()
        # drop foreground islands that touch the cell edge (bits of the neighbouring character)
        arr = np.asarray(fg)
        edge = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
        total = int((arr == 255).sum())
        for (x, y) in edge:
            if fg.getpixel((x, y)) == 255:
                ImageDraw.floodfill(fg, (x, y), 77)
                part = int((np.asarray(fg) == 77).sum())
                ImageDraw.floodfill(fg, (x, y), 0 if part < 0.15 * total else 254)
        fg = fg.point(lambda v: 255 if v >= 254 else 0)
        alpha = fg
        # floor shadows: in the bottom band of the character, drop light low-saturation pixels.
        # Feet are darker or more saturated than the soft shadow, so they stay.
        al = np.asarray(alpha).copy()
        ys = np.where(al.max(1) > 0)[0]
        if len(ys):
            top, bot = ys[0], ys[-1]
            band = int(bot - 0.18 * (bot - top))
            shadow = (((mx - mn) < 45) & (mn > 120)) | (((mx - mn) < 40) & (mn > 95))
            al[band:][shadow[band:]] = 0
        alpha = Image.fromarray(al)
        alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.9))
        rgba = cell.convert("RGBA")
        rgba.putalpha(alpha)
        bb = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
        rgba = rgba.crop(bb)
        idx = r * cols + c
        rgba.save(f"{outdir}/{prefix}{idx}.png")
        print(idx, rgba.size)
