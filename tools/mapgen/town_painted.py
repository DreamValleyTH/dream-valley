"""Turn the painted town (PixelLab over the blueprint) into the game's town map: walk grid, places, exits,
and occluder sprites cut out of the painting so people can walk behind houses and trees."""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import town as TOWN
from blueprint import TW, TH

NAMES = {'taew_shop': 'ร้านชำป้าแต๋ว', 'noi_noodle': 'ร้านก๋วยเตี๋ยวพี่หน่อย', 'store24': 'ร้าน 24 ชม.', 'pharmacy': 'ร้านขายยา', 'heng_shop': 'ร้านปุ๋ยยาเสี่ยเฮง',
         'rice_yard': 'ลานรับซื้อพืชไร่เสี่ยเฮง', 'garage': 'อู่บอล', 'workshop': 'ร้านช่างเปี๊ยก', 'obt': 'ที่ทำการ อบต.ดงเย็น', 'police': 'ป้อมตำรวจ',
         'clinic': 'รพ.สต.ดงเย็น', 'school': 'โรงเรียนบ้านดงเย็น', 'coffee': 'ร้านกาแฟ', 'kamnan_house': 'บ้านกำนัน', 'company_office': 'สำนักงานบริษัท',
         'market': 'ตลาดนัด', 'sala': 'ศาลาหมู่บ้าน', 'bus_stop': 'ป้ายรถเมล์', 'water_tower': 'หอถังน้ำ', 'temple': 'วัดดงเย็น', 'house_bua': 'บ้านยายบัว',
         'house_thongbai': 'บ้านป้าทองใบ', 'house_sommai': 'บ้านลุงสมหมาย', 'house_chan': 'บ้านยายจันทร์', 'nok_house': 'บ้านนก', 'coop_garden': 'สวนผักอินทรีย์',
         'pasture': 'ทุ่งเลี้ยงควาย', 'forest_edge': 'ชายป่าท้ายหมู่บ้าน', 'shrine': 'ศาลปู่ตา', 'canal': 'คลองส่งน้ำ', 'bank': 'ป้ายรถเมล์ (ธนาคารอยู่ที่อำเภอ)'}
RENAME = {'cvs': 'store24', 'kamnan': 'kamnan_house', 'house_nok': 'nok_house', 'spirit': 'shrine'}

def build(painted_path, atlas, T=32):
    b = TOWN.build(1.0); W, H = TOWN.W, TOWN.H; sem = b.sem
    paint = Image.open(painted_path).convert('RGBA')
    blocked = np.zeros((H, W), int); water = np.zeros((H, W), int)
    def mark(x0, y0, x1, y1, arr=blocked):
        for y in range(max(0, int(math.floor(y0))), min(H, int(math.ceil(y1)))):
            for x in range(max(0, int(math.floor(x0))), min(W, int(math.ceil(x1)))): arr[y][x] = 1
    for h in sem['houses']: mark(h['x'] + .15, h['y'] + .15, h['x'] + h['w'] - .15, h['y'] + h['d'] - .15)
    for (x0, y0, x1, y1) in sem['walls']:
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n): x, y = x0 + (x1 - x0) * i / max(1, n - 1), y0 + (y1 - y0) * i / max(1, n - 1); mark(x - .3, y - .3, x + .3, y + .3)
    for (cx, cy, rx, ry) in sem['ponds']: mark(cx - rx * .8, cy - ry * .8, cx + rx * .8, cy + ry * .8, water)
    for pts, wd in sem['water']:
        for (x, y) in pts: mark(x - wd / 2 + .2, y - wd / 2 + .2, x + wd / 2 - .2, y + wd / 2 - .2, water)
    for (x, y, r, k) in sem['trees']:
        if 0 <= int(x) < W and 0 <= int(y) < H: blocked[int(y)][int(x)] = 1
    for (x, y, r) in sem['chedis']: mark(x - .8, y - .8, x + .8, y + .8)
    # the highway bridge over the canal is walkable
    road = [(-4, 32.5), (8, 30.5), (20, 27.5), (30, 25.5), (40, 23.5), (50, 21.5), (60, 20)]
    roadpts = b.spline(road)
    road_cells = set()
    for (x, y) in roadpts:
        for dy in (-1, 0, 1):
            if 0 <= int(x) < W and 0 <= int(y + dy) < H: road_cells.add((int(x), int(y + dy)))
    for (x, y) in road_cells: water[y][x] = 0
    blocked = np.maximum(blocked, water)
    for (x, y) in road_cells: blocked[y][x] = 0
    def free_near(x, y):
        best = None
        for r in range(0, 6):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    cx, cy = int(x) + dx, int(y) + dy
                    if 0 < cx < W - 1 and 0 < cy < H - 1 and not blocked[cy][cx]:
                        d = abs(dx) + abs(dy) + (2.5 if dx + dy < 0 else 0)   # prefer the side facing the viewer (in front of the building)
                        if best is None or d < best[0]: best = (d, cx, cy)
            if best and r >= 2: return [best[1], best[2]]
        return [int(x), int(y)]
    places = {}
    for k, (x, y) in TOWN.PLACES.items():
        pid = RENAME.get(k, k); door = free_near(x, y)
        spots = [door] + [s for s in (free_near(door[0] + dx, door[1] + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1))) if s != door]
        places[pid] = dict(name=NAMES.get(pid, pid), door=door, spots=spots[:4], kind='place')
    places['canal'] = dict(name=NAMES['canal'], door=free_near(42, 10), spots=[free_near(42, 10)], kind='place')
    places['bank'] = dict(places['bus_stop'], name=NAMES['bank'])
    # occluders: each house / tree / chedi cut out of the painting (silhouette polygon), drawn depth-sorted like sprites
    objs = []
    def cut(poly, foot_xy, oid, block, place=None, label=None, kind='building'):
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
        x0, y0, x1, y1 = int(min(xs)) - 2, int(min(ys)) - 2, int(max(xs)) + 2, int(max(ys)) + 2
        m = Image.new('L', paint.size, 0); ImageDraw.Draw(m).polygon(poly, fill=255)
        sp = paint.crop((x0, y0, x1, y1)); sp.putalpha(m.crop((x0, y0, x1, y1)))
        fx, fy = foot_xy; ix, iy = round(fx), round(fy)
        # sprite is drawn at (ix - w/2, iy - h): pad the crop so that lands on (x0, y0)
        w = max(ix - x0, x1 - ix) * 2; h = iy - y0
        if h <= 4 or w <= 4: return
        canvas = Image.new('RGBA', (w, h)); canvas.alpha_composite(sp.crop((0, 0, sp.width, min(sp.height, h))), (x0 - (ix - w // 2), 0))
        key = atlas.add(canvas)
        bx = [c[0] for c in block] or [0]; by = [c[1] for c in block] or [0]
        dep = ((min(bx) + max(bx) + 1) / 2 + (min(by) + max(by) + 1) / 2) * T
        tap = 'place' if place else None
        objs.append(dict(id=oid, s=key, x=0, y=0, w=w, h=h, block=[list(c) for c in block], tap=tap, place=place, front=False, label=label,
                         ix=ix, iy=iy, si=key, iw=w, ih=h, dep=dep, shadow=None, painted=True))
    # which place owns each house: nearest place point in front of it
    for i, hh in enumerate(sem['houses']):
        x, y, w, d, hz = hh['x'], hh['y'], hh['w'], hh['d'], hh['h']; lift = .7 if hh['stilt'] else 0
        z = (hz + lift) * TH + hz * TH * .9 + 14   # wall + roof ridge + overhang
        A, B, Cc, D = b.P(x - .3, y - .3), b.P(x + w + .3, y - .3), b.P(x + w + .3, y + d + .3), b.P(x - .3, y + d + .3)
        poly = [D, Cc, B, (B[0], B[1] - z), (A[0], A[1] - z - 6), (D[0], D[1] - z)]
        block = [(cx, cy) for cy in range(int(y), int(math.ceil(y + d))) for cx in range(int(x), int(math.ceil(x + w))) if 0 <= cx < W and 0 <= cy < H]
        owner = None; best = 3.5
        for k, (px, py) in TOWN.PLACES.items():
            dd = math.hypot(px - (x + w / 2), py - (y + d / 2))
            if dd < best: best, owner = dd, RENAME.get(k, k)
        cut(poly, Cc, f'ph{i}', block, place=owner, label=places[owner]['name'] if owner else None)
    for i, (x, y, r, kind) in enumerate(sem['trees']):
        if not (-2 < x < W + 2 and -2 < y < H + 2): continue
        bx_, by_ = b.P(x, y); R = 24 * r + 4; top = by_ - (66 if kind == 'palm' else 60) * r - 10
        poly = [(bx_ - R, by_ - 8), (bx_ - R, top + R * .6), (bx_ - R * .6, top), (bx_ + R * .6, top), (bx_ + R, top + R * .6), (bx_ + R, by_ - 8)]
        blk = [(int(x), int(y))] if 0 <= int(x) < W and 0 <= int(y) < H else []
        cut(poly, (bx_, by_ + 2), f'pt{i}', blk, kind='tree')
    for i, (x, y, r) in enumerate(sem['chedis']):
        bx_, by_ = b.P(x, y); poly = [(bx_ - 30 * r, by_ + 4), (bx_ - 30 * r, by_ - 50 * r), (bx_, by_ - 96 * r), (bx_ + 30 * r, by_ - 50 * r), (bx_ + 30 * r, by_ + 4)]
        cut(poly, (bx_, by_ + 4), f'pc{i}', [(int(x), int(y))], place='temple', label='เจดีย์')
    spawns = {'from_farm': free_near(1, 31), 'bus': places['bus_stop']['door'], 'center': free_near(24, 26)}
    exits = [dict(cells=[[0, y] for y in range(29, 33) if not blocked[y][0]] or [[0, 31]], to='farm', spawn='from_town', label='กลับฟาร์มยาย')]
    for c in exits[0]['cells']: blocked[c[1]][c[0]] = 0
    return dict(name='town', W=W, H=H, T=T, bg='town_iso.png', blocked=blocked.tolist(), path=np.zeros((H, W), int).tolist(), water=water.tolist(),
                objects=objs, places=places, exits=exits, spawns=spawns, plot=None,
                iso=dict(K=.75, OX=b.ox, OY=b.oy, SW=paint.size[0], SH=paint.size[1], bg='town_iso.png', rtShadow=False, painted=True))
