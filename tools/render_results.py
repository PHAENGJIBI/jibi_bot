# วาดการ์ดผลแข่ง (PNG) — python3 render_results.py data.json out.png
import json, sys, re
from PIL import Image, ImageDraw, ImageFont
F = '/home/claude/tools/fonts/'
def fnt(n, s): return ImageFont.truetype(F + n, s, layout_engine=ImageFont.Layout.RAQM)
Y = (255, 196, 0); W = (245, 245, 245); G = (160, 163, 170); BG = (17, 17, 19); ROW = (28, 29, 33); ROW2 = (34, 35, 40)
MEDAL = {1: (255, 196, 0), 2: (205, 210, 220), 3: (214, 140, 70)}
LAO = re.compile(r'[຀-໿]+')
def runs(text):
    out, i = [], 0
    for m in LAO.finditer(text):
        if m.start() > i: out.append((text[i:m.start()], False))
        out.append((m.group(), True)); i = m.end()
    if i < len(text): out.append((text[i:], False))
    return out
def tw(d, text, latin, lao):
    return sum(d.textlength(t, font=lao if is_lao else latin) for t, is_lao in runs(text))
def draw_mixed(d, xy, text, latin, lao, fill, anchor='ls'):
    x, y = xy
    if anchor in ('ms', 'rs'):
        w = tw(d, text, latin, lao); x = x - w / 2 if anchor == 'ms' else x - w
    for t, is_lao in runs(text):
        f = lao if is_lao else latin
        d.text((x, y), t, font=f, fill=fill, anchor='ls'); x += d.textlength(t, font=f)
def fit(d, text, latin, lao, maxw):
    while tw(d, text, latin, lao) > maxw and len(text) > 3: text = text[:-2] + '…'
    return text

def render(data, out):
    rows = data['rows']; cols = data.get('cols', ['K', 'D'])
    Wd = 1200; head = 236; rh = 74; Hd = head + rh * len(rows) + 90
    im = Image.new('RGB', (Wd, Hd), BG); d = ImageDraw.Draw(im)
    d.rounded_rectangle([3, 3, Wd - 4, Hd - 4], radius=24, outline=Y, width=4)
    t1 = fnt('bc600.ttf', 34); t2l = fnt('bc800.ttf', 64); t2o = fnt('lao800.ttf', 56)
    draw_mixed(d, (Wd / 2, 70), data.get('event', 'VALORANT DEATHMATCH MINI CUP #1'), t1, fnt('lao600.ttf', 30), G, 'ms')
    draw_mixed(d, (Wd / 2, 145), data['title'], t2l, t2o, Y, 'ms')
    if data.get('sub'): draw_mixed(d, (Wd / 2, 188), data['sub'], fnt('bc600.ttf', 30), fnt('lao600.ttf', 28), W, 'ms')
    # header row
    hy = head + 8; hf = fnt('bc600.ttf', 24); hl = fnt('lao600.ttf', 22)
    colx = [Wd - 90 - i * 130 for i in range(len(cols))][::-1]
    draw_mixed(d, (60, hy), '#', hf, hl, G); draw_mixed(d, (150, hy), 'ຜູ້ຫຼິ້ນ', hf, hl, G)
    for x, c in zip(colx, cols): draw_mixed(d, (x, hy), c, hf, hl, Y if c == cols[-1] else G, 'ms')
    nl = fnt('bc800.ttf', 40); no = fnt('lao800.ttf', 34); sl = fnt('bc600.ttf', 22); so = fnt('lao600.ttf', 20); num = fnt('bc800.ttf', 40)
    for i, r in enumerate(rows):
        y0 = head + 22 + i * rh
        d.rounded_rectangle([30, y0, Wd - 30, y0 + rh - 10], radius=14, fill=ROW if i % 2 == 0 else ROW2, outline=MEDAL.get(r['rank']), width=2 if r['rank'] in MEDAL else 0)
        cy = y0 + (rh - 10) / 2
        rc = MEDAL.get(r['rank'], G)
        d.ellipse([50, cy - 22, 94, cy + 22], fill=rc if r['rank'] in MEDAL else (45, 46, 52))
        d.text((72, cy), str(r['rank']), font=fnt('bc800.ttf', 30), fill=(30, 22, 0) if r['rank'] in MEDAL else W, anchor='mm')
        maxw = colx[0] - 90 - 150
        draw_mixed(d, (150, cy + 4), fit(d, r['name'], nl, no, maxw), nl, no, W)
        if r.get('riot'): draw_mixed(d, (150, cy + 30), fit(d, r['riot'], sl, so, maxw), sl, so, G)
        for j, (x, c) in enumerate(zip(colx, cols)):
            v = r['vals'][j]
            d.text((x, cy + 14), str(v), font=num, fill=Y if j == len(cols) - 1 else W, anchor='ms')
    d.rounded_rectangle([60, Hd - 40, Wd - 60, Hd - 32], radius=4, fill=Y)
    draw_mixed(d, (Wd / 2, Hd - 52), 'JIBI · P SHOP GAMERPOWER', fnt('bc600.ttf', 22), fnt('lao600.ttf', 20), G, 'ms')
    im.save(out)

if __name__ == '__main__':
    render(json.load(open(sys.argv[1], encoding='utf8')), sys.argv[2])
