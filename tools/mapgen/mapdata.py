"""Dream Valley map system (v0.9): a map is DATA — a terrain grid + a list of placed objects — and everything visual is built from it.

  data/maps/<name>.json
    W, H            whole map in cells, including the countryside margin around the playable land
    play            [x0, y0, x1, y1]  playable rectangle (cells outside are scenery: same ground, not walkable)
    terrain         H strings of W chars  (see TERRAIN)
    lines           road centre lines (tile coords) for the yellow dashes
    objects         [{id, k, x, y, flip, place?, label?, layer?}]   k = catalog key, (x, y) = footprint top-left cell
    places          {pid: {name, door:[x,y]}}      spots are added automatically
    spawns, exits

Layers (the 5-layer idea, Stardew style):
  Back      ground texture: grass, paddy, water, yard            (baked image)
  Paths     roads, lanes, laterite, footpaths drawn over Back     (baked image)
  Buildings houses, trees, props, people — depth sorted           (sprites)
  Front     things that always cover people (eaves, canopies)    (sprites with layer:'front')
  AlwaysFront wires, bunting, birds, fog                          (overlay drawn last, layer:'top')
"""
import json, os, math
import numpy as np
from PIL import Image

ISO = '/home/claude/art_work/iso'
PROPS = '/home/claude/artsrc/props_all'
ART_B = os.environ.get('ART_B', '/mnt/user-data/uploads/Dream_Valley/art_b')
PLANTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets_src', 'plants')
ANIMALS = '/home/claude/artsrc/animals_all'

TERRAIN = {'.': 'grass', 'a': 'asphalt', 'c': 'concrete', 'l': 'laterite', 'p': 'path', 'y': 'yard', 's': 'sand', 'v': 'gravel', 'w': 'water', 'r': 'paddy', 'g': 'plotbed'}
WALK_BLOCK = {'w'}            # terrain that blocks walking (paddies are walkable along the bunds — kept open on purpose)
ORDER = ['paddy', 'plotbed', 'yard', 'sand', 'path', 'laterite', 'concrete', 'asphalt', 'water']   # Back first, Paths later

def _b(k, name, fp=(3, 3), cat='building'): return dict(k=k, name=name, cat=cat, src=f'{ISO}/{k}_0.png', iso=True, fp=list(fp))
def _p(k, name, path, fp=(1, 1), cat='prop', block=True, shadow='prop'): return dict(k=k, name=name, cat=cat, src=path, iso=False, fp=list(fp), block=block, shadow=shadow)
def _pr(d, i): return f'{PROPS}/{d}/{i:02d}.png'

CATALOG = {c['k']: c for c in [
    # ---- buildings (PixelLab isometric set) ----
    _b('taew_shop', 'ร้านชำ'), _b('noi_noodle', 'ร้านก๋วยเตี๋ยว'), _b('store24', 'ร้าน 24 ชม.'), _b('pharmacy', 'ร้านขายยา'), _b('coffee', 'ร้านกาแฟ'),
    _b('heng_shop', 'ร้านปุ๋ย'), _b('rice_yard', 'โกดังลานรับซื้อ', (4, 3)), _b('garage', 'อู่ซ่อมรถ'), _b('workshop', 'ร้านช่าง'),
    _b('obt', 'ที่ทำการ อบต.', (4, 3)), _b('police', 'ป้อมตำรวจ', (2, 2)), _b('clinic', 'รพ.สต.'), _b('school', 'โรงเรียน', (4, 3)), _b('sala', 'ศาลา'),
    _b('bus_stop', 'ศาลาที่พักรถเมล์', (2, 2)), _b('water_tower', 'หอถังน้ำ', (2, 2)), _b('company_office', 'สำนักงานบริษัท'), _b('coop', 'โรงเรือนสหกรณ์'),
    _b('ubosot', 'โบสถ์', (4, 3)), _b('chedi', 'เจดีย์', (2, 2)), _b('temple_gate', 'ซุ้มประตูวัด', (2, 2)), _b('temple_sala', 'ศาลาการเปรียญ'),
    _b('belltower', 'หอระฆัง', (2, 2)), _b('kuti', 'กุฏิ'), _b('kamnan_house', 'บ้านไม้สองชั้น'),
    _b('house_bua', 'บ้านใต้ถุนสูง ก'), _b('house_chan', 'บ้านใต้ถุนสูง ข'), _b('house_sommai', 'บ้านใต้ถุนสูง ค'), _b('house_thongbai', 'บ้านทรงไทยแดง'),
    _b('nok_house', 'บ้านปูนเขียว'), _b('house_a', 'บ้านไม้เล็ก'), _b('house_b', 'บ้านไม้หลังคาสังกะสี'),
    # ---- trees & plants ----
    _p('mango', 'ต้นมะม่วง', f'{ART_B}/trees/tree_mango.png', cat='tree', shadow='tree'),
    _p('tamarind', 'ต้นมะขาม', f'{ART_B}/trees/tree_tamarind.png', cat='tree', shadow='tree'),
    _p('coconut', 'มะพร้าว', f'{PLANTS}/plants0_1.png', (2, 1), cat='tree', shadow='tree'),
    _p('sugarpalm', 'ต้นตาล', f'{PLANTS}/plants0_2.png', (2, 1), cat='tree', shadow='tree'),
    _p('raintree', 'จามจุรี', f'{PLANTS}/plants0_3.png', (2, 1), cat='tree', shadow='tree'),
    _p('sugarcane', 'กออ้อย', f'{PLANTS}/plants0_0.png', (2, 1), cat='tree', shadow='tree'),
    _p('bamboo', 'กอไผ่', f'{PLANTS}/plants1_0.png', (2, 1), cat='tree', shadow='tree'),
    _p('banana', 'กอกล้วย', f'{PLANTS}/plants1_1.png', (2, 1), cat='tree', shadow='tree'),
    _p('papaya', 'มะละกอ', f'{PLANTS}/plants1_2.png', (2, 1), cat='tree', shadow='tree'),
    _p('bamboo_s', 'ไผ่กอเล็ก', _pr('06_forest_a', 5), cat='tree', shadow='tree'),
    _p('banana_s', 'กล้วยต้นเล็ก', _pr('06_forest_a', 6), cat='tree', shadow='tree'),
    _p('bush', 'พุ่มไม้', _pr('06_forest_b', 6), block=False), _p('bush2', 'พุ่มเฟิร์น', _pr('06_forest_b', 7), block=False),
    # ---- street & village props ----
    _p('pole', 'เสาไฟ', _pr('02_street_a', 0), block=False, shadow=None), _p('lamp', 'เสาไฟถนน', _pr('02_street_a', 1)), _p('horn', 'ลำโพงหอกระจายข่าว', _pr('02_street_a', 2)),
    _p('sign', 'ป้ายรถเมล์', _pr('02_street_a', 3)), _p('signpost', 'ป้ายบอกทาง', _pr('02_street_a', 4)), _p('bin', 'ถังขยะ', _pr('02_street_a', 6)),
    _p('mailbox', 'ตู้ไปรษณีย์', _pr('02_street_a', 7)), _p('pump', 'ปั๊มโยก', _pr('02_street_a', 8)), _p('bench_long', 'แคร่ยาว', _pr('02_street_a', 9)),
    _p('well', 'บ่อน้ำ', _pr('02_street_a', 10)), _p('shrine_road', 'ศาลพระภูมิริมทาง', _pr('02_street_b', 4)), _p('noticeboard', 'บอร์ดประกาศ', _pr('02_street_b', 5)),
    _p('drum', 'ถังน้ำมัน', _pr('02_street_b', 7)), _p('tires', 'กองยาง', _pr('02_street_b', 10)), _p('gas', 'ถังแก๊ส', _pr('02_street_b', 11)),
    _p('stall_fruit', 'แผงผลไม้', _pr('03_market_a', 0)), _p('stall_cart', 'รถเข็นขายของ', _pr('03_market_a', 1)), _p('stall_mango', 'แผงมะม่วง', _pr('03_market_a', 2)),
    _p('stall_grill', 'ร้านปิ้งย่าง', _pr('03_market_a', 3)), _p('stall_table', 'โต๊ะพับ', _pr('03_market_a', 4)), _p('stall_veg', 'แผงผัก', _pr('03_market_b', 0)),
    _p('stall_fish', 'แผงปลา', _pr('03_market_b', 2)), _p('stall_melon', 'แผงแตงโม', _pr('03_market_b', 4)),
    _p('spirit_house', 'ศาลพระภูมิ', _pr('04_spiritual', 0)), _p('sacred_tree', 'ต้นไม้ผูกผ้า', _pr('04_spiritual', 4)), _p('incense', 'กระถางธูป', _pr('04_spiritual', 2)),
    _p('donation', 'ตู้บริจาค', _pr('04_spiritual', 5)), _p('bell', 'ระฆัง', _pr('04_spiritual', 6)),
    _p('jars', 'โอ่งน้ำ', _pr('01_yard_a', 2)), _p('clothesline', 'ราวตากผ้า', _pr('01_yard_a', 0)), _p('water_tank', 'แท็งก์น้ำ', _pr('01_yard_a', 1)),
    _p('compost', 'กองปุ๋ยหมัก', _pr('01_yard_a', 4)), _p('sacks', 'กระสอบข้าว', _pr('01_yard_a', 5)), _p('trough', 'รางน้ำวัว', _pr('01_yard_a', 6)),
    _p('doghouse', 'บ้านหมา', _pr('01_yard_a', 7)), _p('table_low', 'แคร่ไม้', _pr('01_yard_a', 8)), _p('bicycle', 'จักรยาน', _pr('01_yard_a', 9)),
    _p('firewood', 'กองฟืน', _pr('01_yard_a', 12)), _p('cart', 'เกวียน', _pr('01_yard_a', 13)), _p('banana_pot', 'กล้วยในกระถาง', _pr('01_yard_a', 14)),
    _p('chairs', 'เก้าอี้พลาสติก', _pr('01_yard_b', 3)), _p('hose', 'สายยาง', _pr('01_yard_b', 4)), _p('stove', 'เตาถ่าน', _pr('01_yard_b', 7)),
    _p('takraw', 'เสาตะกร้อ', _pr('07_community', 2)), _p('swing', 'ชิงช้า', _pr('07_community', 4)), _p('exercise', 'เครื่องออกกำลังกาย', _pr('07_community', 0)),
    _p('board', 'ป้ายประชาสัมพันธ์', _pr('07_community', 7)),
    _p('buffalo', 'ควาย', f'{ANIMALS}/buffalo/Idle/rotations/south-east.png', (2, 1), cat='animal'),
]}

# ---- grandma's farm kit (sprites cut from the hand-built farm) + the v1.0 farm art (PixelLab, same style) ----
_HERE = os.path.dirname(os.path.abspath(__file__))
try:
    for _k, _c in json.load(open(os.path.join(_HERE, 'farmkit', 'catalog.json'))).items():
        CATALOG[_k] = dict(_c, k=_k, src=os.path.join(_HERE, 'farmkit', _k + '.png'))
except FileNotFoundError: pass
_A2 = os.path.join(_HERE, 'art2')
for _k, _n, _fp, _iso, _blk in [('coop_broken', 'เล้าไก่ (พัง)', (3, 3), True, True), ('fish_cage', 'กระชังปลา', (2, 2), True, False),
                                ('farm_gate', 'ประตูรั้วไม้', (2, 1), True, False), ('bamboo_fence', 'รั้วไม้ไผ่', (1, 1), True, True),
                                ('bamboo_fence_b', 'รั้วไม้ไผ่ (ลำเล็ก)', (1, 1), True, True), ('bamboo_fence_vine', 'รั้วไม้ไผ่มีเถาวัลย์', (1, 1), True, True)] + [(f'weeds_{i}', 'กอหญ้ารก', (1, 1), False, True) for i in range(8)]:
    CATALOG[_k] = dict(k=_k, name=_n, cat='farm', src=os.path.join(_A2, _k + '.png'), iso=_iso, fp=list(_fp), block=_blk, shadow='prop', dy=2)

# ---- v1.5 farm decor sold by ช่างเปี๊ยก (templates hidden on the farm; the game clones one per purchase) ----
DECO = [('arch', 'ซุ้มไม้ไผ่ดอกไม้', (2, 1), 72, 380), ('banana_pot', 'กระถางกล้วยประดับ', (1, 1), 40, 150), ('bird', 'กรงนกเขา', (1, 1), 60, 260),
        ('dragonjar', 'โอ่งมังกร', (1, 1), 34, 280), ('flowerbed', 'แปลงดอกทานตะวัน', (2, 1), 36, 220), ('hammock', 'เปลญวน', (2, 1), 40, 350),
        ('lamp', 'เสาตะเกียงเจ้าพายุ', (1, 1), 58, 180), ('pots', 'กระถางเฟื่องฟ้า-ดาวเรือง', (1, 1), 28, 120), ('sala', 'ศาลาไม้หลังเล็ก', (2, 2), 92, 1500),
        ('swing', 'ชิงช้าไม้', (2, 1), 58, 450), ('box_s', 'กล่องไม้เล็ก', (1, 1), 26, 150), ('box_m', 'หีบไม้สัก', (1, 1), 34, 450), ('box_l', 'ตู้เก็บของใหญ่', (1, 1), 52, 900)]
for _k, _n, _fp, _h, _p in DECO:
    CATALOG['deco_' + _k] = dict(k='deco_' + _k, name=_n, cat='farm', src=os.path.join(_A2, 'deco', f'deco_{_k}.png'), iso=False, fp=list(_fp), block=True, shadow='prop', dy=2, h=_h, price=_p)

# ---- v1.0 trees & plants (PixelLab, drawn in the tile sets' style, roots and soil patch so they sit on the ground) ----
_TR = os.path.join(_A2, 'trees')
NEW_TREES = {'mango': 'mango', 'tamarind': 'tamarind', 'coconut': 'coconut', 'sugarpalm': 'sugarpalm', 'raintree': 'raintree', 'sugarcane': 'sugarcane',
             'bamboo': 'bamboo', 'banana': 'banana', 'papaya': 'papaya', 'bamboo_s': 'bamboo_s', 'banana_s': 'banana_s', 'bush': 'bush', 'bush2': 'bush2',
             'f_tree_mango': 'mango', 'f_tree_mango_fruit_few': 'mango_few', 'f_tree_mango_fruit_mid': 'mango_mid', 'f_tree_mango_fruit_full': 'mango_full',
             'f_tree_tamarind': 'tamarind', 'f_tree_tamarind_pods': 'tamarind_pods', 'f_bam': 'bamboo_s', 'f_bam_2': 'bamboo_s_b', 'f_ban': 'banana_s',
             'f_ban_2': 'banana_s_b', 'f_tall_sugarcane': 'sugarcane', 'f_tall_sugarcane_2': 'sugarcane_b', 'f_tall_banana': 'banana',
             'f_tall_coconut': 'coconut', 'f_tall_papaya': 'papaya', 'f_tall_bamboo': 'bamboo', 'f_tall_bamboo_2': 'bamboo_b'}
for _k, _n in NEW_TREES.items():
    if _k in CATALOG and os.path.exists(os.path.join(_TR, _n + '.png')):
        CATALOG[_k] = dict(CATALOG[_k], src=os.path.join(_TR, _n + '.png'))
        if CATALOG[_k].get('ax') is not None and CATALOG[_k]['fp'] == [1, 1]: CATALOG[_k].update(ax=16, ay=29)   # trunk on the cell centre, a little in front
        if CATALOG[_k].get('ax') is not None and CATALOG[_k]['fp'] == [2, 1]: CATALOG[_k].update(ax=32, ay=29)

# ---- v1.1 proportions: everyday things scaled against the 57px-tall player (a charcoal stove is knee high, etc.) ----
HEIGHT = {'stove': 24, 'f_stove': 24, 'firewood': 26, 'f_firewood': 26, 'jars': 24, 'f_jars': 24, 'f_jar': 30, 'bicycle': 34, 'f_bike': 34,
          'bin': 30, 'drum': 32, 'gas': 20, 'bench_long': 26, 'f_bench': 26, 'table_low': 24, 'chairs': 32, 'doghouse': 34, 'f_doghouse': 34,
          'compost': 30, 'f_compost': 30, 'sacks': 30, 'f_sacks': 30, 'f_haystack': 40, 'hose': 20, 'f_hose': 20, 'pump': 38, 'f_pump': 38,
          'trough': 24, 'tires': 28, 'well': 40, 'cart': 38, 'f_cart': 38, 'bush': 36, 'bush2': 28, 'banana_pot': 40, 'incense': 28,
          'donation': 34, 'bell': 44, 'f_peb': 10, 'f_rock': 20, 'f_rock_2': 20, 'f_stump': 22, 'f_br': 18, 'f_br_2': 18,
          **{f'weeds_{i}': 40 for i in range(8)}, 'bamboo_fence': 50, 'bamboo_fence_b': 50, 'bamboo_fence_vine': 50}
for _k, _n, _fp, _h, _p in DECO: HEIGHT['deco_' + _k] = _h
for _k, _h in HEIGHT.items():
    if _k in CATALOG: CATALOG[_k]['h'] = _h

def load_img(c, flip=False):
    im = Image.open(c['src']).convert('RGBA'); bb = im.getbbox(); im = im.crop(bb) if bb else im
    if c.get('h') and im.height > c['h']:   # area-average down, then hard alpha so the pixel art stays crisp
        f = c['h'] / im.height; im = im.resize((max(1, round(im.width * f)), c['h']), Image.BOX)
        a = np.asarray(im).copy(); a[..., 3] = np.where(a[..., 3] > 110, 255, 0); im = Image.fromarray(a)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im

def catalog_json():
    keep = ('name', 'cat', 'fp', 'iso', 'block', 'dy', 'corner', 'ax', 'ay', 'shadow')
    return {k: {kk: v for kk, v in c.items() if kk in keep} for k, c in CATALOG.items()}

KIND2CODE = {k: c for c, k in TERRAIN.items()}

def add_terrain(w, grid, T=32):
    """cell grid (numpy array of terrain chars) -> smooth organic ground surfaces on World w"""
    from smoothmask import smooth_mask
    for kind in ORDER:
        codes = [c for c, k in TERRAIN.items() if k == kind]
        cm = np.isin(grid, codes)
        if not cm.any(): continue
        # smooth curved edges like the hand-drawn farm lane: rounded SDF blobs + smoothed centre-line strokes
        m = smooth_mask(cm, T, kind)
        amp = {'asphalt': 0, 'concrete': .5, 'paddy': 0, 'water': 1.6, 'laterite': 1.2, 'path': 1.0}.get(kind, 1.6)
        if amp: m = w.roughen(m, amp, 6, ORDER.index(kind) + 3)
        w.add_surface(kind, m)

def place_obj(w, o, iso_art, T=32, extra=None):
    """one map object {id,k,x,y,flip,...} -> sprite on World w. extra: additional catalog (e.g. the farm kit)"""
    c = CATALOG.get(o['k']) or (extra or {}).get(o['k'])
    if not c: print('unknown asset', o['k']); return None
    W, H = w.W, w.H
    fw, fd = c['fp']; ox, oy = o['x'], o['y']
    if o.get('flip') and c['iso']: fw, fd = fd, fw      # a flipped iso building swaps its footprint axes
    cells = [(cx, cy) for cy in range(oy, oy + fd) for cx in range(ox, ox + fw) if 0 <= cx < W and 0 <= cy < H]
    block = cells if (c['iso'] or c.get('block', True)) else []
    im = load_img(c, o.get('flip'))
    tap = o.get('tap') or ('place' if o.get('place') else None)
    if c['iso']:
        ob = w.place(im, int((ox + fw / 2) * T), int((oy + fd) * T) - 2, block=block, tap=tap, place=o.get('place'),
                     oid=o['id'], label=o.get('label') or c['name'], shadow='building')
        iso_art[o['id']] = dict(im=im, center=True, dy=c.get('dy', 4))
    else:
        sh = c.get('shadow', 'prop')
        ax, ay = o.get('ax', c.get('ax')), o.get('ay', c.get('ay'))
        x = ox * T + ax if ax is not None else int((ox + fw / 2) * T); y = oy * T + ay if ay is not None else int((oy + fd) * T) - 3
        ob = w.place(im, x, y, block=block, tap=tap, place=o.get('place'), oid=o['id'], label=o.get('label') or c['name'], shadow=sh if sh else None)
        if c.get('corner'): iso_art[o['id']] = dict(im=im, dx=c['corner'][0], dy=c['corner'][1])
    if o.get('layer') == 'front': ob['front'] = True
    if o.get('layer') == 'top': ob['top'] = True; ob['front'] = True
    if o.get('layer') == 'flat': ob['flat'] = True   # lies on the ground: baked into the ground picture
    ob['k'] = o['k']
    return ob

def build_world(data, World, T=32):
    """data (map json) -> worldlib.World with surfaces, objects (and iso art dict), places, spawns, exits"""
    W, H = data['W'], data['H']
    w = World(data['name'], W, H, seed=data.get('seed', 7))
    grid = np.array([list(r.ljust(W, '.')[:W]) for r in data['terrain']])
    if data.get('mg'): w.MG = data['mg']
    if data.get('plot'): w.plot = list(data['plot'])
    if data.get('tiles'):   # v1.0: ground from PixelLab Wang tile sets on a dual grid (see tiles.py)
        import tiles
        w.tile_layers = tiles.compose(grid)
        for code, kind in TERRAIN.items():   # cell masks still drive walking / water / decal rules
            cm = grid == code
            if cm.any() and kind != 'grass': w.add_surface(kind, tiles.water_area(grid) if code == 'w' else np.kron(cm, np.ones((T, T), bool)))
    else:
        add_terrain(w, grid, T)
    w.dash_lines = data.get('lines', [])
    # walk mask: water + everything outside the playable rectangle
    x0, y0, x1, y1 = data['play']
    for y in range(H):
        for x in range(W):
            if grid[y][x] in WALK_BLOCK: w.blocked[y, x] = 1
            if not (x0 <= x < x1 and y0 <= y < y1): w.blocked[y, x] = 1
    iso_art = {}
    for o in data['objects']: place_obj(w, o, iso_art, T)
    # places: door + spots in front of the door
    def free(x, y):
        best = None
        for r in range(0, 5):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    cx, cy = x + dx, y + dy
                    if x0 <= cx < x1 and y0 <= cy < y1 and not w.blocked[cy, cx]:
                        d = abs(dx) + abs(dy) + (1.5 if dx + dy < 0 else 0)
                        if best is None or d < best[0]: best = (d, cx, cy)
            if best: return (best[1], best[2])
        return (x, y)
    for pid, pl in data['places'].items():
        dx_, dy_ = free(*pl['door']); spots = [(dx_, dy_)]
        for ax, ay in ((1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1)):
            s = free(dx_ + ax, dy_ + ay)
            if s not in spots: spots.append(s)
        w.add_place(pid, pl['name'], (dx_, dy_), spots=spots[:5], kind=pl.get('kind', 'place'))
    w.spawns = {k: list(v) for k, v in data['spawns'].items()}
    w.exits = data['exits']
    for e in w.exits:
        for (cx, cy) in e['cells']: w.blocked[cy, cx] = 0
    return w, iso_art
