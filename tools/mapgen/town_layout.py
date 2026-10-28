"""Writes data/maps/town.json — ใจกลางตำบลบ้านดงเย็น laid out after the real ต.บางกะพี้ (approved blueprint), now as map DATA.
Coordinates below are the approved blueprint's (56x40 land); they are scaled by S and shifted by the countryside margin M."""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapdata import CATALOG

S, M = 1.35, 6
LW, LH = round(56 * S), round(40 * S)
W, H = LW + 2 * M, LH + 2 * M
def X(v): return v * S + M
rng = np.random.RandomState(7)
grid = np.full((H, W), 'r')
occ = np.zeros((H, W), bool)          # cells taken by objects
objs, places, nid = [], {}, [0]

def cell_dist_poly(pts):
    yy, xx = np.mgrid[0:H, 0:W] + .5
    d = np.full((H, W), 1e9)
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        dx, dy = x1 - x0, y1 - y0; l2 = dx * dx + dy * dy or 1e-9
        t = np.clip(((xx - x0) * dx + (yy - y0) * dy) / l2, 0, 1)
        d = np.minimum(d, np.hypot(xx - (x0 + t * dx), yy - (y0 + t * dy)))
    return d
def smooth(pts, n=6):
    if len(pts) < 3: return pts
    P = [pts[0]] + pts + [pts[-1]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for j in range(n):
            t = j / n; t2, t3 = t * t, t * t * t
            out.append(tuple(.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
    return out + [pts[-1]]
def path(pts, width, code, keep=()):
    sp = smooth([(X(x), X(y)) for x, y in pts]); m = cell_dist_poly(sp) < width * S / 2
    for c in keep: m &= grid != c
    grid[m] = code; return sp
def rect(x0, y0, x1, y1, code):
    a, b, c, d = int(round(X(x0))), int(round(X(y0))), int(round(X(x1))), int(round(X(y1)))
    grid[max(0, b):min(H, d), max(0, a):min(W, c)] = code
def pond(cx, cy, rx, ry):
    yy, xx = np.mgrid[0:H, 0:W] + .5
    grid[((xx - X(cx)) / (rx * S)) ** 2 + ((yy - X(cy)) / (ry * S)) ** 2 < 1] = 'w'

def put(k, x, y, flip=0, place=None, label=None, layer=None, force=False, scaled=False):
    c = CATALOG[k]; fw, fd = c['fp']
    if flip and c['iso']: fw, fd = fd, fw
    bx, by = (int(round(x)), int(round(y))) if scaled else (int(round(X(x))), int(round(X(y))))
    blocks = c['iso'] or c.get('block', True)
    for r in range(0, 4 if not force else 1):
        for dx, dy in [(0, 0), (1, 0), (0, 1), (-1, 0), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)][: 1 if r == 0 else 9]:
            ax, ay = bx + dx * r, by + dy * r
            cells = [(cx, cy) for cy in range(ay, ay + fd) for cx in range(ax, ax + fw)]
            if any(not (0 <= cx < W and 0 <= cy < H) for cx, cy in cells): continue
            if not force and blocks and any(occ[cy, cx] or grid[cy, cx] in 'wa' for cx, cy in cells): continue
            if not force and not blocks and any(occ[cy, cx] for cx, cy in cells): continue
            if blocks:
                for cx, cy in cells: occ[cy, cx] = True
            nid[0] += 1; o = dict(id=f'o{nid[0]}', k=k, x=ax, y=ay, flip=int(bool(flip)))
            if place: o['place'] = place
            if label: o['label'] = label
            if layer: o['layer'] = layer
            objs.append(o); return o
    return None
def door_of(o):
    c = CATALOG[o['k']]; fw, fd = c['fp']
    if o['flip'] and c['iso']: fw, fd = fd, fw
    return [o['x'] + fw // 2, o['y'] + fd] if not o['flip'] else [o['x'] + fw, o['y'] + fd // 2]
def building(k, x, y, pid, name, flip=0, yard='y', pad=1):
    o = put(k, x, y, flip, place=pid, label=name)
    if not o: print('!! could not place', pid); return None
    c = CATALOG[k]; fw, fd = c['fp']
    if flip: fw, fd = fd, fw
    if yard:
        sub = grid[max(0, o['y'] - pad):o['y'] + fd + pad + 1, max(0, o['x'] - pad):o['x'] + fw + pad + 1]
        sub[(sub != 'a') & (sub != 'w') & (sub != 'c')] = yard
    places[pid] = dict(name=name, door=door_of(o)); return o

# ---------- open land: grass where people live, paddies everywhere else ----------
for (x0, y0, x1, y1) in [(-6, -6, 11, 5), (2, 2, 40, 22), (11, 17, 39, 31), (45, -1, 60, 20), (-1, 25, 15, 40), (37, 27, 52, 40), (47, 21, 58, 31)]:
    rect(x0, y0, x1, y1, '.')
# canal N–S in the east (bridge where the highway crosses)
path([(43, -8), (44, 6), (42.5, 14), (44, 22), (45.5, 30), (44, 48)], 2.0, 'w')
# ทางหลวง 205 (asphalt, centre line) — continues off both edges
hw = path([(-8, 33.2), (8, 30.5), (20, 27.5), (30, 25.5), (40, 23.5), (50, 21.5), (64, 19)], 2.4, 'a')
lines = [[[round(x, 2), round(y, 2)] for x, y in hw]]
# village lanes (concrete), laterite and footpaths — winding, a few dead ends, running out into the fields
path([(24, 26.8), (23.5, 22), (24.5, 17), (23, 12), (24, 6), (22, 0), (21, -8)], 1.2, 'c', keep='a')
path([(23.8, 18), (19, 17.5), (14, 15), (9, 15.5), (5, 13), (-2, 12)], 1.0, 'c')
path([(23.4, 12), (28, 10.5), (32, 11.5), (36, 9)], 1.0, 'c')
path([(14, 15), (13.5, 10), (15, 6), (12, 2), (10, -6)], .9, 'l')
path([(32, 11.5), (33, 16), (31, 20), (31.5, 25)], .9, 'l', keep='a')
path([(36, 9), (39, 6), (37, 2), (38, -8)], .9, 'l')
path([(47, 22.2), (47.5, 17), (49, 12), (52, 8), (60, 5)], 1.1, 'c', keep='a')
path([(38, 23.8), (39, 28), (41, 33)], 1.0, 'c', keep='a')
path([(10, 30.2), (9.5, 34), (7, 38), (8, 48)], 1.0, 'l', keep='a')
path([(4, 31.8), (3, 36), (-6, 40)], .7, 'p', keep='a')               # footpath into the fields
path([(52, 21.2), (55, 30), (62, 38)], .7, 'p', keep='a')
for p in [(18, 8.5, 2.0, 1.5), (29, 15.5, 1.5, 1.1), (7.6, 21, 1.8, 1.3), (54.5, 34, 2.2, 1.6), (35.6, 31.4, 1.7, 1.2), (3, 22, 1.4, 1.0)]: pond(*p)

# ---------- the temple (the only one) ----------
rect(12.6, 19, 22, 26.4, 's')
building('ubosot', 15.2, 20.2, 'temple', 'วัดดงเย็น', yard=None)
put('chedi', 13.2, 23.4, label='เจดีย์'); put('temple_sala', 18.6, 22.4, label='ศาลาการเปรียญ'); put('belltower', 13.0, 19.4, label='หอระฆัง')
put('kuti', 19.6, 18.6, label='กุฏิ', flip=1); put('temple_gate', 16.0, 25.0, label='ซุ้มประตูวัด')
put('sacred_tree', 21.6, 25.6); put('incense', 15.4, 24.4, place='temple', label='กระถางธูป'); put('donation', 17.8, 24.6, place='temple', label='ตู้บริจาค')
places['temple']['door'] = [places['temple']['door'][0], places['temple']['door'][1] + 2]   # stand on the courtyard, clear of the ubosot's eaves
# ---------- junction: shophouses on the highway ----------
for pid, k, x, y, name in [('taew_shop', 'taew_shop', 21.4, 22.6, 'ร้านชำป้าแต๋ว'), ('noi_noodle', 'noi_noodle', 24.8, 21.8, 'ร้านก๋วยเตี๋ยวพี่หน่อย'),
                           ('store24', 'store24', 27.6, 21.4, 'ร้าน 24 ชม.'), ('pharmacy', 'pharmacy', 32.4, 20.4, 'ร้านขายยา'), ('coffee', 'coffee', 35.4, 19.6, 'ร้านกาแฟ')]:
    building(k, x, y, pid, name, yard='c', pad=0)
building('bus_stop', 29.6, 27.4, 'bus_stop', 'ป้ายรถเมล์', yard='c', pad=0); put('sign', 29.0, 27.0, label='ป้ายรถเมล์ (ไปอำเภอ)', place='bus_stop')
places['bank'] = dict(name='ป้ายรถเมล์ (ธนาคารอยู่ที่อำเภอ)', door=places['bus_stop']['door'])
rect(24.6, 27.6, 29.2, 32, 'y')
for i, k in enumerate(['stall_fruit', 'stall_veg', 'stall_mango', 'stall_fish', 'stall_grill', 'stall_melon']):
    put(k, 25.0 + (i % 3) * 1.4, 28.2 + (i // 3) * 1.8, place='market', label='ตลาดนัด')
places['market'] = dict(name='ตลาดนัด', door=[int(X(26.4)), int(X(30.8))])
building('sala', 25.4, 17.2, 'sala', 'ศาลาหมู่บ้าน'); put('horn', 28.6, 18.6, place='sala', label='หอกระจายข่าว'); put('noticeboard', 24.8, 19.8, label='บอร์ดประกาศ')
# ---------- east of the canal ----------
building('obt', 47.6, 12.2, 'obt', 'ที่ทำการ อบต.ดงเย็น', yard='c')
building('police', 47.4, 17.6, 'police', 'ป้อมตำรวจ', yard='c', pad=0)
building('water_tower', 53.6, 10.6, 'water_tower', 'หอถังน้ำ')
rect(50, 1, 58.5, 8.4, 'c'); building('company_office', 53.0, 3.0, 'company_office', 'สำนักงานบริษัท', yard=None)
for i in range(4): put('water_tank', 51.0 + i * 1.2, 1.6, label='ถังน้ำบริษัท')
# ---------- south of the highway ----------
building('clinic', 33.0, 24.6, 'clinic', 'รพ.สต.ดงเย็น', yard='c')
rect(38.6, 29.4, 50, 38.6, '.'); building('school', 40.6, 33.0, 'school', 'โรงเรียนบ้านดงเย็น', yard='s'); put('takraw', 44.0, 30.4); put('swing', 47.2, 31.0)
building('heng_shop', 9.2, 31.8, 'heng_shop', 'ร้านปุ๋ยยาเสี่ยเฮง', yard='c', pad=0)
rect(48, 23.6, 56.4, 29.6, 'c'); building('rice_yard', 51.6, 25.6, 'rice_yard', 'ลานรับซื้อพืชไร่เสี่ยเฮง', yard=None)
for i in range(3): put('sacks', 48.6 + i * .9, 27.6, label='กระสอบข้าวโพด')
# ---------- along the highway west ----------
building('garage', 1.0, 27.2, 'garage', 'อู่บอล', yard='c', pad=0); put('tires', 3.8, 29.8)
building('workshop', 5.2, 26.2, 'workshop', 'ร้านช่างเปี๊ยก', yard='y', pad=0)
# ---------- village houses (scattered, facing their lane) ----------
homes = [('kamnan_house', 'kamnan_house', 25.6, 12.0, 0, 'บ้านกำนัน'), ('house_bua', 'house_bua', 9.0, 15.8, 1, 'บ้านยายบัว'),
         ('house_thongbai', 'house_thongbai', 15.4, 15.2, 0, 'บ้านป้าทองใบ'), ('house_sommai', 'house_sommai', 28.0, 6.8, 0, 'บ้านลุงสมหมาย'),
         ('house_chan', 'house_chan', 18.8, 9.0, 1, 'บ้านยายจันทร์'), ('nok_house', 'nok_house', 34.0, 11.6, 0, 'บ้านนก'),
         (None, 'house_a', 10.6, 10.4, 1, None), (None, 'house_b', 25.0, 3.8, 0, None), (None, 'house_a', 16.0, 3.4, 1, None),
         (None, 'house_b', 30.0, 17.0, 0, None), (None, 'house_sommai', 3.8, 14.0, 1, None), (None, 'house_chan', 37.2, 12.0, 1, None),
         (None, 'house_a', 20.0, 13.0, 0, None), (None, 'house_bua', 33.2, 4.4, 1, None)]
for pid, k, x, y, f, name in homes:
    if pid: o = building(k, x, y, pid, name, flip=f, yard='y')
    else:
        o = put(k, x, y, f, label='บ้านชาวบ้าน')
        if o:
            fw, fd = CATALOG[k]['fp'][::-1] if f else CATALOG[k]['fp']
            sub = grid[max(0, o['y'] - 1):o['y'] + fd + 2, max(0, o['x'] - 1):o['x'] + fw + 2]; sub[(sub != 'a') & (sub != 'w') & (sub != 'c')] = 'y'
    if o:
        d = door_of(o)
        put(rng.choice(['jars', 'clothesline', 'firewood', 'bicycle', 'table_low', 'chairs', 'doghouse']), d[0] - 2.2, d[1] + .6, scaled=True)
        put('banana', o['x'] - 2, o['y'] + 1, scaled=True); put(rng.choice(['mango', 'tamarind']), o['x'] + 3.5, o['y'] - 1.5, scaled=True)
# ---------- north fringe ----------
rect(1, 2, 7.4, 8.4, 'g'); building('coop', 6.2, 1.2, 'coop_garden', 'สวนผักอินทรีย์', yard=None)
rect(38, 0, 47, 7.2, '.'); places['pasture'] = dict(name='ทุ่งเลี้ยงควาย', door=[int(X(41)), int(X(7.6))])
put('buffalo', 40.0, 2.6, place='pasture', label='ควายตาเผือก'); put('buffalo', 44.0, 4.0, flip=1); put('trough', 42.6, 5.4)
for i in range(16): put(rng.choice(['mango', 'tamarind', 'raintree', 'bamboo']), -5 + (i % 6) * 2.4 + rng.uniform(-.5, .5), -5.5 + (i // 6) * 2.4 + rng.uniform(-.5, .5))
put('spirit_house', 8.6, -0.6, place='shrine', label='ศาลปู่ตา'); places['shrine'] = dict(name='ศาลปู่ตา', door=[int(X(9.2)), int(X(.6))])
places['forest_edge'] = dict(name='ชายป่าท้ายหมู่บ้าน', door=[int(X(7)), int(X(1.6))])
places['canal'] = dict(name='คลองส่งน้ำ', door=[int(X(41.6)), int(X(10))])
# ---------- trees and plants: shade along lanes, palms on the paddy bunds, a rain tree at the junction ----------
put('raintree', 22.6, 20.6)
for _ in range(220):
    x, y = rng.randint(0, W), rng.randint(0, H)
    if grid[y, x] in 'acwsg' or occ[y, x]: continue
    inside = M <= x < W - M and M <= y < H - M
    if grid[y, x] == 'r':
        if rng.rand() < .7: continue
        k = rng.choice(['sugarpalm', 'sugarpalm', 'coconut', 'banana_s'])
    else:
        k = rng.choice(['mango', 'tamarind', 'banana', 'bamboo', 'coconut', 'papaya', 'bush', 'bush2', 'banana_s', 'bamboo_s'])
    put(k, x, y, scaled=True, flip=int(rng.rand() < .5))
# ---------- power poles along the highway, loudspeakers at the junction ----------
for x in range(-6, 64, 5):
    y = 33.2 - (x + 8) * (14.2 / 72) - 2.0
    put('pole', x, y, layer=None)
for x, y in [(19.4, 26.0), (36.4, 22.4), (46.6, 20.6)]: put('horn', x, y, place='sala' if x < 20 else None, label='ลำโพงหอกระจายข่าว')
put('lamp', 26.4, 25.2); put('lamp', 41.0, 22.6); put('shrine_road', 4.6, 30.6, label='ศาลพระภูมิริมทาง'); put('bin', 28.8, 24.4); put('board', 22.0, 26.4, label='ป้ายหาเสียง')

spawn_from_farm = [M + 1, int(round(X(31.6)))]
for x in range(M, M + 3):   # keep the highway entry open
    occ[spawn_from_farm[1], x] = False
data = dict(name='town', W=W, H=H, play=[M, M, W - M, H - M], seed=7, terrain=[''.join(r) for r in grid], lines=lines, objects=objs, places=places,
            spawns=dict(from_farm=spawn_from_farm, bus=places['bus_stop']['door'], center=[int(X(24)), int(X(25.6))]),
            exits=[dict(cells=[[M, spawn_from_farm[1] + d] for d in (-1, 0, 1)], to='farm', spawn='from_town', label='กลับฟาร์มยาย')])
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data', 'maps', 'town.json')
os.makedirs(os.path.dirname(out), exist_ok=True); json.dump(data, open(out, 'w'), ensure_ascii=False)
print('town', W, H, 'objects', len(objs), 'places', len(places))
