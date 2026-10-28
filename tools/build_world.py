# Build farm + town maps for the web game.   python3 build_world.py <out assets dir>
import sys, os, json
import numpy as np
from PIL import Image
from worldlib import World, Atlas, L, T, ART_B, PL

OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/game/assets'
OBJ = '/home/claude/fy/assets/obj'          # sprites already cut from p1_world (approved)
P = PL + '/props_all'
B = PL + '/buildings_all'
TREES = ART_B + '/trees'
def prop(d, i): return f'{P}/{d}/{i:02d}.png'
def bld(d, i): return f'{B}/{d}/{i:02d}.png'
def px(tx): return int(tx * T)


# ---- tall plants that take two tiles (PixelLab iso set): อ้อย มะพร้าว ตาล จามจุรี ไผ่ กล้วย มะละกอ มะขามใหญ่ ----
PLANTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets_src', 'plants')
TALL = {'sugarcane': 'plants0_0', 'coconut': 'plants0_1', 'sugarpalm': 'plants0_2', 'raintree': 'plants0_3', 'bamboo': 'plants1_0', 'banana': 'plants1_1', 'papaya': 'plants1_2', 'tamarind_big': 'plants1_3'}
def tall_img(k):
    im = Image.open(os.path.join(PLANTS, TALL[k] + '.png')).convert('RGBA'); return im.crop(im.getbbox())
def plant_tall(w, kinds, n, area, seed, avoid=()):
    """drop n two-tile plants on free grass inside area=(x0,y0,x1,y1) (cells)"""
    r = np.random.RandomState(seed); placed = 0
    for _ in range(600):
        if placed >= n: break
        x = r.randint(area[0], area[2]); y = r.randint(area[1], area[3])
        cells = [(x, y), (x + 1, y)]
        if any(not (1 <= a < w.W - 1 and 1 <= b < w.H - 1) for a, b in cells): continue
        if any(w.blocked[b, a] or w.walk_bonus[b, a] or w.water[b, a] for a, b in cells): continue
        if any(abs(a - ax) + abs(b - ay) < 2 for a, b in cells for ax, ay in avoid): continue
        k = kinds[r.randint(len(kinds))]
        o = w.place(tall_img(k), px(x + 1.0), px(y + .95), block=cells, oid=f'tall_{k}_{x}_{y}', shadow='tree', flip=r.rand() < .5)
        o['label'] = {'sugarcane': 'กออ้อย', 'coconut': 'ต้นมะพร้าว', 'sugarpalm': 'ต้นตาล', 'raintree': 'ต้นจามจุรี', 'bamboo': 'กอไผ่', 'banana': 'กอกล้วย', 'papaya': 'ต้นมะละกอ', 'tamarind_big': 'ต้นมะขามใหญ่'}[k]
        placed += 1
    return placed

atlas = Atlas('sprites')
maps = {}

# =====================================================================  FARM (ฟาร์มยาย)
def build_farm():
    w = World('farm', 32, 24, seed=3)
    # --- ground surfaces (organic) ---
    lane = w.poly([(22.5, 24.5), (22.3, 19), (21.2, 15.5), (17.5, 11.3), (12.5, 10.2), (9.6, 9.4)], 2.3)
    w.add_surface('laterite', w.roughen(lane, 2.5, 7, 1))
    yard = w.ellipse(6.4, 8.6, 5.6, 2.6) | w.ellipse(9.4, 9.0, 2.2, 1.6)
    w.add_surface('yard', w.roughen(yard, 4, 6, 2))
    foot1 = w.poly([(9.8, 10.2), (10.6, 12.3)], 1.0)                 # yard -> pump/plot corner
    foot2 = w.poly([(23.2, 15.0), (24.5, 10.6), (25.4, 9.8)], 1.0)    # lane -> pond bench
    foot3 = w.poly([(16.0, 11.0), (15.6, 6.6)], 0.9)                  # lane -> orchard
    w.add_surface('path', w.roughen(foot1 | foot2 | foot3, 1.6, 4, 3))
    pond = w.ellipse(26.0, 5.0, 3.6, 2.3) | w.ellipse(28.3, 6.8, 2.2, 1.6) | w.ellipse(24.4, 6.4, 1.8, 1.3)
    w.add_surface('water', w.roughen(pond, 2.5, 6, 4))
    # vegetable plot bed (game draws tilled soil on top)
    PX, PY, PWc, PHc = 11, 13, 8, 5
    w.plot = [PX, PY, PWc, PHc]
    # (no baked bed any more: beds are drawn live from the soil layer so they can be dug / filled anywhere)

    # --- house + yard life ---
    house = w.place(bld('08_houses_a', 0), px(5.6), px(7.0), block=[(c, r) for c in range(3, 9) for r in (4, 5, 6)], tap='house', oid='house', shadow='building', label='บ้านยาย')
    w.place(f'{OBJ}/water_jar.png', px(8.9), px(7.1), block=[(8, 6)], tap='jar', oid='jar', shadow='prop')
    w.place(f'{OBJ}/firewood.png', px(2.3), px(7.2), block=[(2, 6)], oid='firewood')
    w.place(prop('01_yard_a', 2), px(2.4), px(5.6), block=[(2, 5)], oid='jars')
    w.place(prop('01_yard_a', 0), px(4.4), px(10.1), block=[(4, 9)], oid='clothesline')
    w.place(f'{OBJ}/bicycle.png', px(7.6), px(8.2), block=[(7, 7)], oid='bike')
    w.place(f'{OBJ}/cart.png', px(1.8), px(9.6), block=[(1, 9)], oid='cart')
    w.place(prop('01_yard_b', 7), px(3.2), px(7.4), block=[(3, 7)], oid='stove')
    w.place(f'{OBJ}/spirit_house.png', px(11.2), px(7.9), block=[(11, 7)], tap='spirit', oid='spirit', shadow='prop')
    w.place(prop('01_yard_a', 7), px(1.6), px(12.0), block=[(1, 11)], oid='doghouse')
    w.place(prop('01_yard_a', 4), px(9.0), px(17.4), block=[(8, 16)], oid='compost')

    # --- plot surroundings ---
    w.place(f'{OBJ}/hand_pump.png', px(10.1), px(12.6), block=[(10, 12)], tap='pump', oid='pump', shadow='prop')
    w.place(prop('01_yard_b', 4), px(9.2), px(12.9), block=[], oid='hose', shadow=None)
    for i, c in enumerate(range(PX - 1, PX + PWc + 1)):       # bamboo fence along bottom of the plot
        w.place(f'{OBJ}/fence_h.png', px(c + .5), px(PY + PHc + 1.0), block=[(c, PY + PHc)], oid=f'fb{i}', shadow=None)
    for r in range(PY, PY + PHc):                              # left side
        w.place(f'{OBJ}/fence_post.png', px(PX - .55), px(r + 1.0), block=[(PX - 1, r)], oid=f'fl{r}', shadow=None)
    w.place(f'{OBJ}/scarecrow.png', px(PX + PWc + .55), px(PY + 1.0), block=[(PX + PWc, PY)], oid='scarecrow', shadow='prop')
    w.place(f'{OBJ}/haystack.png', px(PX + PWc + 1.6), px(PY + 4.0), block=[(PX + PWc + 1, PY + 3)], oid='haystack', shadow='prop')
    w.place(prop('01_yard_a', 5), px(PX + PWc + .6), px(PY + 4.6), block=[(PX + PWc, PY + 4)], oid='sacks')

    # --- grandma's orchard + trees ---
    def tree(img, tx, ty, oid):
        o = w.place(f'{TREES}/{img}.png', px(tx), px(ty), block=[(int(tx), int(ty) - 1)], tap='tree', oid=oid, shadow='tree'); o['label'] = img; return o
    tree('tree_mango_fruit_mid', 12.6, 4.8, 'tree1')
    tree('tree_mango', 16.4, 3.4, 'tree0')
    tree('tree_mango_fruit_few', 19.8, 5.6, 'tree3')
    tree('tree_mango', 9.8, 3.2, 'tree2')
    tree('tree_tamarind_pods', 26.6, 11.0, 'tree4')
    tree('tree_mango_fruit_full', 29.0, 15.2, 'tree6')
    tree('tree_tamarind', 4.0, 16.8, 'tree5')
    tree('tree_mango', 27.6, 21.0, 'tree7')
    w.place(f'{OBJ}/bench.png', px(25.6), px(10.1), block=[(25, 9), (26, 9)], tap='bench', oid='bench', shadow='prop')
    w.place(f'{OBJ}/mailbox.png', px(24.2), px(21.4), block=[(24, 20)], tap='mailbox', oid='mailbox', shadow='prop')
    # pond life
    w.place(prop('05_water_small', 0), px(26.4), px(5.6), block=[], oid='lotus1', shadow=None)
    w.place(prop('05_water_small', 0), px(28.4), px(7.2), block=[], oid='lotus2', shadow=None, flip=True)
    w.place(prop('05_water_small', 1), px(23.4), px(6.6), block=[], oid='reeds1', shadow=None)
    w.place(prop('05_water_small', 1), px(29.3), px(5.0), block=[], oid='reeds2', shadow=None, flip=True)
    w.place(prop('05_water_small', 5), px(25.0), px(3.4), block=[], oid='stake', shadow=None)

    # --- natural borders: bamboo + banana + trees, hedge at bottom with a gap for the lane ---
    rng = np.random.RandomState(5)
    for x in [0.7, 2.6, 4.9, 7.2, 13.8, 21.6, 23.9, 30.9]:
        w.place(prop('06_forest_a', 5), px(x), px(1.3 + rng.rand() * .4), block=[(int(x), 0)], oid=f'bam{x}', flip=rng.rand() < .5)
    for y in [3.2, 6.8, 14.3, 19.4, 22.6]:
        w.place(prop('06_forest_a', 6), px(.8), px(y), block=[(0, int(y) - 1)], oid=f'ban{y}', flip=rng.rand() < .5)
    for y in [9.0, 12.4, 18.2]:
        w.place(prop('06_forest_a', 6), px(31.2), px(y), block=[(31, int(y) - 1)], oid=f'banr{y}', flip=True)
    hedge = L(f'/home/claude/fy/assets/hedge.png')
    for i, x0 in enumerate(range(0, 32 * T, 64)):
        if 20 * T <= x0 < 24 * T: continue
        w.place(hedge.crop((x0 % hedge.width, 0, x0 % hedge.width + 64, hedge.height)), x0 + 32, 24 * T, block=[(x0 // T, 23), (x0 // T + 1, 23)], oid=f'hedge{i}', shadow=None, front=True)
    # small natural clutter where it belongs: stones near trees, a stump at the orchard edge, branch under a tree
    w.place(f'{OBJ}/obstacle_03.png', px(18.2), px(2.2), block=[(18, 1)], tap=None, oid='stump1')   # stump
    w.place(f'{OBJ}/obstacle_00.png', px(14.6), px(5.9), block=[], oid='peb1')
    w.place(f'{OBJ}/obstacle_04.png', px(11.2), px(5.6), block=[], oid='br1')
    w.place(f'{OBJ}/obstacle_04.png', px(27.8), px(12.2), block=[], oid='br2', flip=True)
    w.place(f'{OBJ}/obstacle_00.png', px(30.0), px(9.8), block=[], oid='peb2')
    w.place(f'{OBJ}/obstacle_01.png', px(6.5), px(14.6), block=[(6, 14)], oid='rock1')
    w.place(f'{OBJ}/obstacle_02.png', px(29.4), px(18.6), block=[(29, 18)], oid='rock2')
    w.place(f'{OBJ}/obstacle_03.png', px(2.6), px(20.0), block=[(2, 19)], oid='stump2')
    # tap kinds for small forage
    for o in w.objects:
        if o['id'].startswith(('peb',)): o['tap'] = 'pebble'
        if o['id'].startswith(('br',)): o['tap'] = 'branch'
        if o['id'].startswith(('stump',)): o['tap'] = 'stump'
        if o['id'].startswith(('rock',)): o['tap'] = 'boulder'
    # tall plants: sugarcane by the lane, coconuts and banana near the pond, papaya by the yard
    pl = [(7, 8), (13, 10), (22, 22)]
    plant_tall(w, ['sugarcane'], 3, (18, 16, 29, 22), 11, pl)
    plant_tall(w, ['coconut', 'banana'], 3, (21, 2, 30, 10), 12, pl)
    plant_tall(w, ['papaya', 'banana'], 2, (1, 12, 9, 20), 13, pl)
    plant_tall(w, ['bamboo', 'sugarpalm'], 2, (1, 1, 9, 4), 14, pl)
    # places / spawns / exits
    w.add_place('home', 'บ้านยาย', (7, 8), kind='home')
    w.add_place('farm_visit', 'หน้าบ้านยาย', (13, 10), spots=[(13, 10), (14, 10), (12, 11)])
    w.spawns = {'home': [7, 8], 'from_town': [22, 22]}
    w.exits = [dict(cells=[[21, 23], [22, 23], [23, 23]], to='town', spawn='from_farm', label='ไปใจกลางตำบล')]
    return w

farm = build_farm()
ISO = '/home/claude/art_work/iso'
def isoim(f, flip=False):
    im = Image.open(f'{ISO}/{f}').convert('RGBA'); im = im.crop(im.getbbox())
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
def farm_iso(w):
    a = {'house': dict(im=isoim('house_b_0.png'), center=True, dy=4)}
    if os.path.exists(f'{ISO}/hedge_0.png'):
        from PIL import ImageEnhance
        hz = isoim('hedge_0.png', True); a_ = hz.getchannel('A')
        hz = ImageEnhance.Color(ImageEnhance.Brightness(hz.convert('RGB')).enhance(1.55)).enhance(1.25).convert('RGBA'); hz.putalpha(a_)
        for o in w.objects:
            if o['id'].startswith('hedge'): a[o['id']] = dict(im=hz, center=True, dy=2)
    fx, fy = isoim('fence_0.png', True), isoim('fence_0.png')
    for o in w.objects:
        if o['id'].startswith('fb'): a[o['id']] = dict(im=fx, dx=-12, dy=-2)
        if o['id'].startswith('fl'): a[o['id']] = dict(im=fy, dx=-36, dy=-2)
    return a
for o in farm.objects:
    if o['id'] in ('lotus1', 'lotus2'): o['flat'] = True
farm.rt_shadow = True   # farm objects can be moved in build mode, so their shadows are drawn live
maps['farm'] = farm.export(OUT, atlas, farm_iso(farm))
print('farm ok', len(farm.objects))

# =====================================================================  TOWN (ใจกลางตำบลบ้านดงเย็น)
def build_town():
    w = World('town', 56, 40, seed=11)
    RY = 20                                    # main asphalt road rows 20-21
    road = w.rect(0, RY - .1, 56, RY + 2.1)
    w.add_surface('asphalt', road)
    w.dash_rows = [(int((RY + 1) * T) - 1, 0, 56 * T)]
    # canal on the west with a concrete bridge
    canal = w.rect(3.2, -1, 5.8, 41, .0)
    canal = w.roughen(canal, 1.5, 6, 7) & ~w.rect(0, RY - .6, 9, RY + 2.6)
    w.add_surface('water', canal)
    # back lane (laterite) behind the shop row + alleys + south lanes
    laneB = w.poly([(6.5, 13.0), (55.5, 13.0)], 1.8)
    alleys = None
    for x in (13.5, 25.5, 37.5, 49.5):
        a = w.poly([(x, 13.0), (x, RY - .2)], 1.2); alleys = a if alleys is None else (alleys | a)
    laneS = w.poly([(7.0, RY + 2), (7.0, 30.0), (35.0, 30.0)], 1.8) | w.poly([(21.0, RY + 2), (21.0, 30)], 1.4)
    toTemple = w.poly([(45.5, RY + 2), (45.5, 25.0)], 2.0)
    toFields = w.poly([(30.5, 13.0), (30.5, 6.2), (40.0, 4.6)], 1.3) | w.poly([(12.0, 13.0), (12.0, 7.0)], 1.2)
    w.add_surface('laterite', w.roughen(laneB | laneS | toTemple, 2.0, 7, 2))
    w.add_surface('path', w.roughen(alleys | toFields, 1.4, 5, 3))
    # concrete fronts of the shop row + market plaza
    w.add_surface('concrete', w.rect(6.6, RY - 1.6, 55.4, RY - .05) | w.rect(8.2, RY + 2.05, 19.8, 27.6, .3))
    # temple yard (sand) + school field
    w.add_surface('sand', w.roughen(w.rect(36.5, 24.5, 55.5, 39.5, 1.0), 2, 8, 5))
    w.add_surface('sand', w.roughen(w.rect(27.0, 2.0, 33.0, 6.0, .8), 1.5, 6, 6))
    # coop organic beds (kla)
    w.add_surface('plotbed', w.rect(9.0, 2.0, 21.0, 6.0, .4))

    def B(img, tx0, base, oid, tap=None, place=None, label=None, depth=2, shadow='building'):
        im = L(img); bb = im.getbbox(); wpx = bb[2] - bb[0]
        cx = px(tx0) + wpx // 2
        c0 = int(px(tx0) // T); c1 = int((px(tx0) + wpx - 1) // T)
        blk = [(c, r) for c in range(c0, c1 + 1) for r in range(base - depth, base)]
        return w.place(img, cx, px(base) - 2, block=blk, tap=tap, place=place, oid=oid, label=label, shadow=shadow)
    # ---- north shop row facing the road (doors on row RY-1) ----
    row = [('taew_shop', bld('02_shops_a', 1), 'ร้านชำป้าแต๋ว'), ('noi_noodle', bld('02_shops_a', 3), 'ร้านก๋วยเตี๋ยวพี่หน่อย'),
           ('store24', bld('02_shops_a', 2), 'ร้าน 24 ชม.'), ('pharmacy', bld('03_shops_b', 0), 'ร้านขายยา'),
           ('heng_shop', bld('03_shops_b', 3), 'ร้านปุ๋ยยาเสี่ยเฮง'), ('rice_yard', bld('04_shops_c', 2), 'ลานรับซื้อข้าวเสี่ยเฮง'),
           ('garage', bld('03_shops_b', 1), 'อู่บอล'), ('workshop', bld('03_shops_b', 2), 'ร้านช่างเปี๊ยก')]
    xs = [7.6, 14.2, 19.8, 26.2, 31.8, 38.2, 43.8, 50.2]
    for (pid, img, name), x in zip(row, xs):
        o = B(img, x, RY - 1, pid, tap='place', place=pid, label=name, depth=3)
        dc = int(o['x'] // T)
        w.add_place(pid, name, (dc, RY - 1), spots=[(dc, RY - 1), (dc + 1, RY - 1), (dc - 1, RY - 1)])
    # ---- second row (doors on the back lane, row 14) ----
    row2 = [('obt', bld('01_gov', 0), 'ที่ทำการ อบต.ดงเย็น'), ('police', bld('01_gov', 1), 'ป้อมตำรวจ'), ('clinic', bld('01_gov', 2), 'รพ.สต.ดงเย็น'),
            ('school', bld('01_gov', 3), 'โรงเรียนบ้านดงเย็น'), ('bank', bld('02_shops_a', 0), 'ธนาคารเกษตร'), ('coffee', bld('04_shops_c', 3), 'ร้านกาแฟ'),
            ('kamnan_house', bld('10_houses_c', 1), 'บ้านกำนัน'), ('company_office', bld('14_district2', 3), 'สำนักงานบริษัท')]
    xs2 = [7.4, 14.0, 19.6, 25.6, 31.6, 37.4, 42.6, 49.4]
    for (pid, img, name), x in zip(row2, xs2):
        o = B(img, x, 12, pid, tap='place', place=pid, label=name, depth=3)
        dc = int(o['x'] // T)
        w.add_place(pid, name, (dc, 12), spots=[(dc, 12), (dc + 1, 12), (dc - 1, 12)])
    # ---- south: market plaza, sala + broadcast tower, bus stop, water tower ----
    for i, (x, y, img) in enumerate([(9.6, 23.4, prop('03_market_a', 0)), (12.2, 23.4, prop('03_market_a', 2)), (14.8, 23.4, prop('03_market_b', 0)),
                                     (17.4, 23.4, prop('03_market_a', 3)), (9.6, 26.4, prop('03_market_b', 1)), (12.2, 26.4, prop('03_market_b', 2)),
                                     (14.8, 26.4, prop('03_market_b', 5)), (17.4, 26.4, prop('03_market_a', 4))]):
        w.place(img, px(x), px(y), block=[(int(x), int(y) - 1)], oid=f'stall{i}', tap='place', place='market', label='ตลาดนัด')
    w.add_place('market', 'ตลาดนัด', (13, 24), spots=[(13, 24), (11, 24), (16, 25), (10, 25)])
    o = B(bld('05_village', 1), 22.6, 27, 'sala', tap='place', place='sala', label='ศาลาหมู่บ้าน', depth=2)
    w.add_place('sala', 'ศาลาหมู่บ้าน', (24, 27), spots=[(24, 27), (25, 27), (23, 27), (26, 28), (22, 28), (24, 28)])
    w.place(prop('02_street_a', 2), px(28.4), px(26.6), block=[(28, 25)], oid='loudspeaker', tap='place', place='sala', label='หอกระจายข่าว')
    o = B(bld('05_village', 3), 26.4, RY + 3, 'bus_stop', tap='place', place='bus_stop', label='ป้ายรถเมล์', depth=1)
    w.add_place('bus_stop', 'ป้ายรถเมล์', (28, RY + 3), spots=[(28, RY + 3), (29, RY + 3)])
    w.place(bld('05_village', 0), px(33.0), px(28.0), block=[(32, 27), (33, 27)], oid='water_tower', tap='place', place='water_tower', label='หอถังน้ำ')
    w.add_place('water_tower', 'หอถังน้ำ', (33, 28))
    # ---- temple compound (south-east) ----
    B(bld('07_temple2', 0), 42.6, 25, 'temple_gate', tap='place', place='temple', label='ประตูวัดดงเย็น', depth=1)
    B(bld('06_temple', 0), 41.0, 32, 'ubosot', tap='place', place='temple', label='อุโบสถ', depth=3)
    B(bld('06_temple', 1), 48.6, 31, 'chedi', depth=2)
    B(bld('06_temple', 2), 36.8, 37, 'temple_sala', tap='place', place='temple', label='ศาลาการเปรียญ', depth=2)
    B(bld('06_temple', 3), 49.0, 38, 'kuti', depth=2)
    w.place(bld('07_temple2', 1), px(53.4), px(36.0), block=[(53, 35)], oid='belltower')
    w.place(prop('04_spiritual', 2), px(45.6), px(33.6), block=[(45, 33)], oid='incense')
    w.place(prop('04_spiritual', 4), px(37.6), px(27.8), block=[(37, 27)], oid='sacredtree')
    w.add_place('temple', 'วัดดงเย็น', (45, 33), spots=[(45, 34), (44, 34), (46, 34), (41, 35), (42, 35)])
    # ---- houses (south-west lane) ----
    houses = [('house_bua', bld('09_houses_b', 0), 'บ้านยายบัว', 8.0), ('house_thongbai', bld('08_houses_a', 3), 'บ้านป้าทองใบ', 13.4),
              ('house_sommai', bld('09_houses_b', 1), 'บ้านลุงสมหมาย', 18.8), ('house_chan', bld('08_houses_a', 2), 'บ้านยายจันทร์', 24.2),
              ('nok_house', bld('09_houses_b', 2), 'บ้านนก', 29.6)]
    for pid, img, name, x in houses:
        o = B(img, x, 37, pid, tap='place', place=pid, label=name, depth=3)
        dc = int(o['x'] // T)
        w.add_place(pid, name, (dc, 37), spots=[(dc, 37), (dc + 1, 37), (dc - 1, 37)])
        lane = w.poly([(dc + .5, 30.6), (dc + .5, 37.4)], 1.0)
        w.add_surface('path', w.roughen(lane, 1.2, 4, int(x)))
    # ---- north fringe: kla's organic beds, pasture, forest edge ----
    w.place(bld('04_shops_c', 0), px(22.6), px(6.6), block=[(22, 5), (23, 5), (24, 5), (25, 5)], oid='coop', tap='place', place='coop_garden', label='สหกรณ์ผักอินทรีย์กล้า', shadow='building')
    w.add_place('coop_garden', 'สวนผักอินทรีย์', (15, 6), spots=[(15, 6), (16, 6), (14, 7)])
    crops = [L(f'{PL}/p1_world_all/crop_{k}/{s:02d}.png') for k in ('chili', 'basil', 'morning_glory', 'corn') for s in (3, 4)]
    r = np.random.RandomState(3)
    for yy in (3, 5):
        for xx in range(10, 21):
            if xx == 15: continue
            im = crops[r.randint(len(crops))]
            w.place(im, px(xx + .5), px(yy + .9), block=[(xx, yy)], oid=f'kc{xx}_{yy}', shadow=None)
    for xx in range(41, 55, 1):
        w.place(f'{OBJ}/fence_h.png', px(xx + .5), px(7.0), block=[(xx, 6)], oid=f'pf{xx}', shadow=None)
    bufpath = f'{PL}/animals_all/buffalo/Idle/rotations/south-east.png'
    if os.path.exists(bufpath):
        w.place(bufpath, px(46.0), px(4.4), block=[(45, 3), (46, 3)], oid='buffalo1', tap='place', place='pasture', label='ควายตาเผือก')
        w.place(bufpath, px(51.0), px(3.2), block=[(50, 2), (51, 2)], oid='buffalo2', flip=True)
    w.place(prop('01_yard_a', 6), px(43.4), px(5.0), block=[(43, 4)], oid='trough')
    w.add_place('pasture', 'ทุ่งเลี้ยงควาย', (41, 8), spots=[(41, 8), (42, 8)])
    rng = np.random.RandomState(9)
    for (x, y) in [(1.0, 2.0), (2.6, 4.6), (1.2, 7.4), (6.4, 1.6), (1.8, 11.0), (1.4, 26.0), (2.2, 31.5), (1.0, 36.5), (2.6, 39.2)]:
        w.place(prop('06_forest_a', 5 if rng.rand() < .6 else 6), px(x), px(y), block=[(int(x), int(y) - 1)], oid=f'fe{x}_{y}', flip=rng.rand() < .5)
    w.add_place('forest_edge', 'ชายป่าท้ายหมู่บ้าน', (7, 4), spots=[(7, 4), (8, 4)])
    def tree(img, tx, ty, oid):
        return w.place(f'{TREES}/{img}.png', px(tx), px(ty), block=[(int(tx), int(ty) - 1)], oid=oid, shadow='tree')
    for i, (img, x, y) in enumerate([('tree_tamarind', 3.0, 15.6), ('tree_mango', 26.0, 1.6), ('tree_tamarind', 36.0, 2.6), ('tree_mango', 54.0, 9.6),
                                     ('tree_tamarind', 52.6, 27.8), ('tree_mango', 38.6, 24.0), ('tree_tamarind', 54.4, 39.0), ('tree_mango', 35.6, 34.6),
                                     ('tree_mango', 10.6, 33.8), ('tree_tamarind', 30.8, 33.0), ('tree_mango_fruit_mid', 20.0, 33.8), ('tree_mango', 8.4, 29.0)]):
        tree(img, x, y, f'tt{i}')
    # street furniture
    for i, x in enumerate([10.4, 22.4, 34.4, 46.4]):
        w.place(prop('02_street_a', 0), px(x), px(RY - .05), block=[], oid=f'pole{i}', shadow=None)
    for i, x in enumerate([16.4, 40.4]):
        w.place(prop('02_street_a', 1), px(x), px(RY + 2.9), block=[(int(x), RY + 2)], oid=f'lamp{i}')
    w.place(prop('02_street_b', 4), px(5.8), px(RY - 1.3), block=[(5, RY - 2)], oid='roadshrine')
    w.place(prop('04_spiritual', 0), px(7.0), px(9.6), block=[(6, 8), (7, 8)], oid='shrine', tap='place', place='shrine', label='ศาลปู่ตา')
    w.add_place('shrine', 'ศาลปู่ตา', (7, 10))
    w.place(prop('07_community', 2), px(28.8), px(4.6), block=[(28, 3), (29, 3)], oid='takraw')
    w.place(prop('07_community', 4), px(31.6), px(4.0), block=[(31, 3)], oid='swing')
    bridge = f'{PL}/props_big_v2/05_water_big_v2/01.png'
    w.place(bridge, px(4.5), px(RY + 2.6), block=[], oid='bridge', shadow=None)
    w.add_place('canal', 'คลองส่งน้ำ', (6, 24))

    # ---- life details: yards, canal plants, street bits ----
    r2 = np.random.RandomState(21)
    for i, (pid, img, name, x) in enumerate(houses):
        bx = px(x)
        w.place(prop('01_yard_a', [0, 2, 4, 7, 3][i]), bx - 10, px(38.9), block=[(int((bx - 10) // T), 38)], oid=f'hy{i}')
        w.place(prop('01_yard_b', [5, 7, 6, 0, 3][i]), bx + 150, px(36.2), block=[(int((bx + 150) // T), 35)], oid=f'hz{i}')
    for i, y in enumerate([3.4, 8.2, 12.6, 27.4, 33.8, 38.6]):
        w.place(prop('05_water_small', [0, 1, 3, 0, 1, 4][i]), px(4.5 + (r2.rand() - .5) * .8), px(y), block=[], oid=f'cw{i}', shadow=None, flip=r2.rand() < .5)
    w.place(prop('07_community', 7), px(13.2), px(13.0), block=[(13, 12)], oid='noticeboard')
    w.place(prop('02_street_a', 6), px(20.2), px(18.9), block=[(20, 18)], oid='bin1')
    w.place(prop('02_street_b', 0), px(36.6), px(18.9), block=[(36, 18)], oid='watercooler')
    w.place(prop('02_street_b', 1), px(30.4), px(23.2), block=[(30, 22)], oid='bench_bus')
    w.place(prop('01_yard_b', 3), px(18.6), px(24.6), block=[(18, 23)], oid='chairs')
    w.place(prop('03_market_a', 5), px(19.2), px(26.6), block=[(19, 25)], oid='cooler')
    w.place(prop('02_street_b', 7), px(46.5), px(18.9), block=[(46, 18)], oid='drum')
    w.place(prop('01_yard_a', 1), px(52.6), px(18.9), block=[(52, 18)], oid='tank')
    w.place(prop('08_company', 0), px(51.0), px(14.9), block=[], oid='wire1', shadow=None)
    w.place(prop('08_company', 2), px(53.6), px(14.9), block=[(53, 14)], oid='keepout')
    w.place(prop('04_spiritual', 3), px(47.6), px(33.9), block=[(47, 33)], oid='candles')
    w.place(prop('04_spiritual', 5), px(44.0), px(26.6), block=[(44, 26)], oid='donation')
    w.place(prop('06_forest_a', 5), px(55.2), px(23.6), block=[(55, 22)], oid='bam_e1')
    w.place(prop('06_forest_a', 6), px(55.3), px(31.2), block=[(55, 30)], oid='ban_e1')
    for i, (x, y) in enumerate([(21.4, 29.0), (26.8, 29.0), (32.2, 28.8), (11.0, 29.0)]):
        w.place(prop('06_forest_b', 6 if i % 2 else 7), px(x), px(y), block=[], oid=f'bush{i}', shadow='prop')
    avoid = [tuple(pl['door']) for pl in w.places.values()] + [tuple(c) for pl in w.places.values() for c in pl['spots']]
    plant_tall(w, ['sugarpalm', 'coconut'], 5, (1, 23, 20, 38), 21, avoid)      # houses side
    plant_tall(w, ['raintree'], 2, (8, 2, 50, 10), 22, avoid)                     # behind the second row
    plant_tall(w, ['sugarcane', 'banana', 'bamboo'], 5, (36, 24, 54, 38), 23, avoid)
    plant_tall(w, ['coconut', 'sugarpalm'], 3, (1, 1, 12, 18), 24, avoid)
    w.spawns = {'from_farm': [1, RY], 'bus': [28, RY + 3], 'center': [24, RY + 2]}
    w.exits = [dict(cells=[[0, RY], [0, RY + 1]], to='farm', spawn='from_town', label='กลับฟาร์มยาย')]
    return w

town = build_town()
def town_iso(w):
    a = {}
    for o in w.objects:
        f = f'{ISO}/{o["id"]}_0.png'
        if o['block'] and os.path.exists(f): a[o['id']] = dict(im=isoim(f'{o["id"]}_0.png'), center=True, dy=4)
    return a
for o in town.objects:
    if o['id'] == 'bridge' or (o['id'].startswith('cw') and o['im'].size[1] < 30): o['flat'] = True
maps['town'] = town.export(OUT, atlas, town_iso(town))
# ---- grandma's house interior: one PixelLab isometric room, logical 6x6 floor fitted onto it ----
W6 = H6 = 6
blk = [[0] * W6 for _ in range(H6)]
for (x, y) in [(4, 0), (5, 0), (5, 1), (0, 2), (1, 4), (2, 4), (3, 0)]: blk[y][x] = 1
hot = [('bed', 'ที่นอนเสื่อกับมุ้ง', [[1, 0], [1, 1], [2, 1]]), ('altar', 'หิ้งพระกับรูปยาย', [[3, 0]]), ('stove', 'เตาถ่านกับหม้อ', [[4, 0]]),
       ('jar_in', 'โอ่งน้ำในครัว', [[5, 0], [5, 1]]), ('table', 'โต๊ะเตี้ยกับปิ่นโต', [[1, 4], [2, 4]]), ('bundle', 'ห่อผ้าเก่าคลุมไว้', [[0, 2]])]
objs = [dict(id='h_' + k, s=None, si=None, x=0, y=0, w=0, h=0, iw=0, ih=0, ix=0, iy=0, dep=0, block=c, tap=k, place=None, front=False, label=n, shadow=None) for k, n, c in hot]
maps['house'] = dict(name='house', W=W6, H=H6, T=32, bg='house_room.png', blocked=blk, path=[[0] * W6 for _ in range(H6)], water=[[0] * W6 for _ in range(H6)],
                     objects=objs, places={'home_in': dict(name='ในบ้านยาย', door=[3, 5], spots=[[3, 5]], kind='home')},
                     exits=[dict(cells=[[3, 5], [4, 5]], to='farm', spawn='home', label='ออกนอกบ้าน', mins=1)],
                     spawns={'in': [3, 4]}, plot=None, iso=dict(K=.75, KY=.44, OX=190, OY=108, SW=384, SH=320, bg='house_room.png'))
print('town ok', len(town.objects))

json.dump(maps, open(OUT + '/maps_tmp.json', 'w'))
extra = {}
for k in ['debris_05', 'debris_06', 'debris_24', 'debris_25', 'debris_00', 'debris_04']:
    extra[k] = atlas.add(L(f'{OBJ}/{k}.png').crop(L(f'{OBJ}/{k}.png').getbbox()))
alt = {}
for k in ['tree_mango', 'tree_tamarind']:
    im = L(f'{TREES}/{k}.png'); alt[k] = atlas.add(im.crop(im.getbbox()))
meta = atlas.save(OUT)
meta['debris'] = extra; meta['alt'] = alt
json.dump(dict(maps=maps, atlas=meta), open(OUT + '/world.json', 'w'), ensure_ascii=False)
# smaller downloads for phones
import subprocess; subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'shrink_png.py'), f'{OUT}/farm_iso.png', f'{OUT}/town_iso.png'])
