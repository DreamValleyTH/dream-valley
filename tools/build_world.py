# Build farm + town maps for the web game.   python3 build_world.py <out assets dir>
import sys, os, json, shutil
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
        place_tall(w, k, x, y, r.rand() < .5)
        placed += 1
    return placed
def place_tall(w, k, x, y, flip):
        o = w.place(tall_img(k), px(x + 1.0), px(y + .95), block=[(x, y), (x + 1, y)], oid=f'tall_{k}_{x}_{y}', shadow='tree', flip=flip)
        o['label'] = {'sugarcane': 'กออ้อย', 'coconut': 'ต้นมะพร้าว', 'sugarpalm': 'ต้นตาล', 'raintree': 'ต้นจามจุรี', 'bamboo': 'กอไผ่', 'banana': 'กอกล้วย', 'papaya': 'ต้นมะละกอ', 'tamarind_big': 'ต้นมะขามใหญ่'}[k]

atlas = Atlas('sprites')
maps = {}

# =====================================================================  FARM (ฟาร์มยาย)
def build_farm(ov=None, grid=None, tall=None):
    w = World('farm', 32, 24, seed=3)
    if ov: w.ov = ov
    # --- ground surfaces (organic) ---
    if grid is not None: mapdata.add_terrain(w, grid)   # edited in the Map Maker: ground comes from the cell grid
    lane = w.poly([(22.5, 24.5), (22.3, 19), (21.2, 15.5), (17.5, 11.3), (12.5, 10.2), (9.6, 9.4)], 2.3)
    if grid is None: w.add_surface('laterite', w.roughen(lane, 2.5, 7, 1))
    yard = w.ellipse(6.4, 8.6, 5.6, 2.6) | w.ellipse(9.4, 9.0, 2.2, 1.6)
    if grid is None: w.add_surface('yard', w.roughen(yard, 4, 6, 2))
    foot1 = w.poly([(9.8, 10.2), (10.6, 12.3)], 1.0)                 # yard -> pump/plot corner
    foot2 = w.poly([(23.2, 15.0), (24.5, 10.6), (25.4, 9.8)], 1.0)    # lane -> pond bench
    foot3 = w.poly([(16.0, 11.0), (15.6, 6.6)], 0.9)                  # lane -> orchard
    if grid is None: w.add_surface('path', w.roughen(foot1 | foot2 | foot3, 1.6, 4, 3))
    pond = w.ellipse(26.0, 5.0, 3.6, 2.3) | w.ellipse(28.3, 6.8, 2.2, 1.6) | w.ellipse(24.4, 6.4, 1.8, 1.3)
    if grid is None: w.add_surface('water', w.roughen(pond, 2.5, 6, 4))
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
    if tall is not None:   # rebuilding with edits: the same tall plants as the generated layout (positions come from the overlay)
        for oid, fl in tall:
            _, k, x, y = oid.rsplit('_', 3) if oid.count('_') >= 3 else (None,) * 4
            place_tall(w, k, int(x), int(y), fl)
    else:
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

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mapgen'))
import mapdata, farmdata
MAPDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'maps')
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
# ---- farm as editable data: write the generated layout once, then apply Map Maker edits as an overlay ----
fbase, fitems, fimgs = farmdata.record(farm, farm_iso(farm))
fitems = farmdata.save_kit(fitems, fimgs)
FJ = f'{MAPDIR}/farm.json'
json.dump(fbase, open(f'{MAPDIR}/farm_base.json', 'w'), ensure_ascii=False)
if os.path.exists(FJ):
    ov, fnew, fgrid, fdoors = farmdata.diff(fbase, json.load(open(FJ)))
    if ov or fnew or fgrid is not None or fdoors:
        farm = build_farm(ov, fgrid, [(o['id'], o.get('flip')) for o in farm.objects if o['id'].startswith('tall_')])
        extra_art = {}
        for o in fnew: mapdata.place_obj(farm, o, extra_art, extra=fitems)
        for pid, d in fdoors.items():
            farm.places[pid]['door'] = list(d); farm.places[pid]['spots'] = [list(d)]
            if pid == 'home': farm.spawns['home'] = list(d)
        print('farm edits:', len([v for v in ov.values() if v]), 'moved,', len([v for v in ov.values() if v is None]), 'removed,', len(fnew), 'new,',
              'ground edited' if fgrid is not None else 'ground as drawn')
else:
    json.dump(fbase, open(FJ, 'w'), ensure_ascii=False)
farm.objects = [o for o in farm.objects if not o.get('removed')]
for o in farm.objects:
    if o['id'] in ('lotus1', 'lotus2'): o['flat'] = True
farm.mirror_ground = True   # the paddy land around the farm continues seamlessly
farm.rt_shadow = True   # farm objects can be moved in build mode, so their shadows are drawn live
fart = farm_iso(farm)
if os.path.exists(FJ) and 'extra_art' in dir(): fart.update(extra_art)
maps['farm'] = farm.export(OUT, atlas, fart)
print('farm ok', len(farm.objects))

# =====================================================================  TOWN (data: data/maps/town.json)
# ---- v0.9: maps are DATA (data/maps/<name>.json: terrain grid + placed objects) built here into ground + sprites ----
if os.path.exists(f'{MAPDIR}/town.json'):
    tw, tart = mapdata.build_world(json.load(open(f'{MAPDIR}/town.json')), World)
    tw.MG = 120; tw.mirror_ground = True
    maps['town'] = tw.export(OUT, atlas, tart)
    print('town (data) ok', len(tw.objects))
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
print('town ok')

# ---- Map Maker kit (MAPKIT=<dir>): catalog + sprites + every editable map with its bare ground picture ----
KIT = os.environ.get('MAPKIT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mapmaker'))   # the editor ships inside the game repo at /mapmaker/
if KIT:
    os.makedirs(f'{KIT}/mapkit/s', exist_ok=True); os.makedirs(f'{KIT}/maps', exist_ok=True)
    cat = mapdata.catalog_json()
    for k, c in mapdata.CATALOG.items():
        f = f'{KIT}/mapkit/s/{k}.png'
        if not os.path.exists(f): mapdata.load_img(c).save(f)
    for k, it in fitems.items():
        cat[k] = {kk: v for kk, v in it.items() if kk != 'src'}
        Image.open(it['src']).save(f'{KIT}/mapkit/s/{k}.png')
    json.dump(dict(items=cat, terrain=mapdata.TERRAIN), open(f'{KIT}/mapkit/catalog.json', 'w'), ensure_ascii=False)
    for name, wld, src in (('town', tw, f'{MAPDIR}/town.json'), ('farm', farm, FJ)):
        shutil.copy(src, f'{KIT}/maps/{name}.json')
        wld.render_iso(f'{KIT}/maps/{name}_ground.png', [])
    print('map kit ->', KIT)

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
# the game loads the world from data/world.js (works from file:// too) — keep it in step with world.json
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'world.js'), 'w', encoding='utf-8') as f:
    f.write('window.DV_WORLD=' + json.dumps(json.load(open(OUT + '/world.json')), ensure_ascii=False, separators=(',', ':')) + ';\n')
