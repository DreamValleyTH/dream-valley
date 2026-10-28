# Build farm + town maps for the web game.   python3 build_world.py <out assets dir>
import sys, os, json, shutil, glob
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

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mapgen'))
import mapdata
MAPDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'maps')
FJ = f'{MAPDIR}/farm.json'
fdata = json.load(open(FJ))
farm, fart = mapdata.build_world(fdata, World)   # v1.0: grandma's farm is pure map data (tools/mapgen/farm_layout.py / Map Maker)
for _i, (_k, _n, _fp, _h, _p) in enumerate(mapdata.DECO):   # v1.5 decor-shop templates, hidden in the game until bought
    _o = mapdata.place_obj(farm, dict(id='deco_' + _k, k='deco_' + _k, x=1 + (_i % 5) * 2, y=1 + (_i // 5) * 2, flip=0, tap='box' if _k.startswith('box') else None), fart)
    if _o: _o['label'] = _n
for o in farm.objects:
    if o['id'].startswith(('lotus', 'reeds')): o['flat'] = True
farm.mirror_ground = True   # the paddy land around the farm continues seamlessly
farm.rt_shadow = True   # farm objects can be moved in build mode, so their shadows are drawn live
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
        mapdata.load_img(c).save(f)
    json.dump(dict(items=cat, terrain=mapdata.TERRAIN), open(f'{KIT}/mapkit/catalog.json', 'w'), ensure_ascii=False)
    for name, wld, src in (('town', tw, f'{MAPDIR}/town.json'), ('farm', farm, FJ)):
        shutil.copy(src, f'{KIT}/maps/{name}.json')
        wld.render_iso(f'{KIT}/maps/{name}_ground.png', [])
    import tiles as TL   # tile sets for the Map Maker's live ground preview (grass already cut away)
    os.makedirs(f'{KIT}/mapkit/tiles', exist_ok=True); tj = dict(order=TL.ORDER, sets=TL.SETS, tiles={})
    for name in sorted({n for v in TL.SETS.values() for n in v}):
        ts = TL.load_set(name); sheet = Image.new('RGBA', (16 * 32, 32)); keys = []
        for i, (key, arr) in enumerate(sorted(ts.items())):
            sheet.paste(Image.fromarray(arr), (i * 32, 0)); keys.append(''.join('1' if b else '0' for b in key))
        sheet.save(f'{KIT}/mapkit/tiles/{name}.png'); tj['tiles'][name] = keys
        if name in TL._area:   # water: the pond shape, tinted by the Map Maker with the game's water colour
            am = Image.new('RGBA', (16 * 32, 32))
            for i, (key, arr) in enumerate(sorted(ts.items())):
                a = TL._area[name][key]; tile = np.zeros((32, 32, 4), np.uint8); tile[a] = (255, 255, 255, 255); am.paste(Image.fromarray(tile), (i * 32, 0))
            am.save(f'{KIT}/mapkit/tiles/{name}_area.png'); tj.setdefault('area', {})[name] = 1
    tj['water'] = '#%02x%02x%02x' % tuple(int(v) for v in TL.water_tone()); tj['paths'] = TL.PATHS
    from worldlib import tex as _tex, grade as _grade   # the game's own grass, for the Map Maker's painted cells
    Image.fromarray(np.clip(_grade(_tex(f'{ART_B}/tiles/grass_1.png', 128, 128), (0.84, 0.92, 0.80), (0, 2, -2)), 0, 255).astype('uint8')).save(f'{KIT}/mapkit/tiles/grass_tex.png')
    Image.open(os.path.join(TL.TSDIR, 'ref_grass.png')).save(f'{KIT}/mapkit/tiles/grass.png')
    json.dump(tj, open(f'{KIT}/mapkit/tiles.json', 'w'))
    for f in glob.glob(f'{KIT}/mapkit/s/*.png'):   # pictures no longer in the catalog are removed from the kit
        if os.path.basename(f)[:-4] not in cat: os.remove(f)
    import time as _t; json.dump(dict(v=int(_t.time())), open(f'{KIT}/mapkit/version.json', 'w'))   # cache stamp for the Map Maker
    print('map kit ->', KIT)

extra = {}
for k in ['debris_05', 'debris_06', 'debris_24', 'debris_25', 'debris_00', 'debris_04']:
    extra[k] = atlas.add(L(f'{OBJ}/{k}.png').crop(L(f'{OBJ}/{k}.png').getbbox()))
alt = {}
for k, n in [('tree_mango', 'mango'), ('tree_tamarind', 'tamarind')]:   # bare trees after picking (v1.0 art)
    im = L(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mapgen', 'art2', 'trees', n + '.png')); alt[k] = atlas.add(im.crop(im.getbbox()))
im = L(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mapgen', 'art2', 'coop_fixed.png')); alt['coop_fixed'] = atlas.add(im.crop(im.getbbox()))
meta = atlas.save(OUT)
meta['debris'] = extra; meta['alt'] = alt
json.dump(dict(maps=maps, atlas=meta), open(OUT + '/world.json', 'w'), ensure_ascii=False)
# smaller downloads for phones
import subprocess; subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'shrink_png.py'), f'{OUT}/farm_iso.png', f'{OUT}/town_iso.png'])
# the game loads the world from data/world.js (works from file:// too) — keep it in step with world.json
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'world.js'), 'w', encoding='utf-8') as f:
    f.write('window.DV_WORLD=' + json.dumps(json.load(open(OUT + '/world.json')), ensure_ascii=False, separators=(',', ':')) + ';\n')
