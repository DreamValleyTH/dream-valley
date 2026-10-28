"""Grandma's farm as editable map data (v0.9.1).

The farm is still built by build_farm() (hand-placed organic lane, pond, yard…), but its result is written out as
data/maps/farm.json in the same shape as town.json so the Map Maker can edit it. On the next build the edits come
back as an overlay:
  * objects with a base id that moved / flipped           -> World.ov[id] = (dx, dy, flip)
  * base objects missing from the json                    -> World.ov[id] = None  (removed)
  * objects with new ids                                  -> placed from the catalog or the farm kit
  * terrain grid different from the generated one         -> ground rebuilt from the grid (smooth curves)
  * place doors that moved                                -> door + spots updated
The kit (farm-only sprites) lives in tools/mapgen/farmkit/<key>.png so new copies can be placed too.
"""
import os, re, json, hashlib
import numpy as np
from PIL import Image
import mapdata

HERE = os.path.dirname(os.path.abspath(__file__))
KITDIR = os.path.join(HERE, 'farmkit')
NAMES = [('house', 'บ้านยาย'), ('jars', 'โอ่งดิน'), ('jar', 'โอ่งน้ำ'), ('firewood', 'กองฟืน'), ('clothesline', 'ราวตากผ้า'), ('bike', 'จักรยาน'), ('cart', 'เกวียน'),
         ('stove', 'เตาถ่าน'), ('spirit', 'ศาลพระภูมิ'), ('doghouse', 'บ้านหมา'), ('compost', 'กองปุ๋ยหมัก'), ('pump', 'ปั๊มน้ำมือโยก'), ('hose', 'สายยาง'),
         ('fb', 'รั้วไผ่ (แนวนอน)'), ('fl', 'เสารั้ว'), ('scarecrow', 'หุ่นไล่กา'), ('haystack', 'กองฟาง'), ('sacks', 'กระสอบ'), ('bench', 'ม้านั่ง'),
         ('mailbox', 'ตู้จดหมาย'), ('lotus', 'กอบัว'), ('reeds', 'กอกก'), ('stake', 'หลักไม้'), ('bam', 'กอไผ่'), ('banr', 'กอกล้วย'), ('ban', 'กอกล้วย'),
         ('hedge', 'พุ่มรั้ว'), ('stump', 'ตอไม้'), ('peb', 'ก้อนกรวด'), ('br', 'กิ่งไม้'), ('rock', 'ก้อนหิน'), ('tall_sugarcane', 'กออ้อย'),
         ('tall_coconut', 'มะพร้าว'), ('tall_banana', 'กล้วย'), ('tall_papaya', 'มะละกอ'), ('tall_bamboo', 'ไผ่'), ('tall_sugarpalm', 'ต้นตาล')]
TREE_NAMES = {'tree_mango': 'มะม่วง', 'tree_mango_fruit_mid': 'มะม่วง (ลูกปานกลาง)', 'tree_mango_fruit_few': 'มะม่วง (ลูกน้อย)',
              'tree_mango_fruit_full': 'มะม่วง (ลูกดก)', 'tree_tamarind': 'มะขาม', 'tree_tamarind_pods': 'มะขาม (มีฝัก)'}

def _name(o):
    if o['id'].startswith('tree'): return 'ต้น' + TREE_NAMES.get(o.get('label') or '', 'ไม้')
    for k, n in NAMES:
        if o['id'].startswith(k): return n
    return o.get('label') or o['id']

def record(w, iso_art, T=32):
    """World (built without overlay) -> (map json, kit catalog {key: item}, kit images {key: Image})"""
    grid = np.full((w.H, w.W), '.')
    for kind, m in w.surfaces:
        code = mapdata.KIND2CODE.get(kind)
        if code: grid[w.cells_of(m, .45)] = code
    items, imgs, seen = {}, {}, {}
    objs = []
    for o in w.objects:
        if o.get('removed'): continue
        ia = iso_art.get(o['id']); blk = o['block']
        if blk:
            xs = [b[0] for b in blk]; ys = [b[1] for b in blk]; x, y = min(xs), min(ys); fp = [max(xs) - x + 1, max(ys) - y + 1]
        else:
            x, y = int(o['x'] // T), int((o['y'] - 2) // T); fp = [1, 1]
        im = ia['im'] if (ia is not None and blk) else o['im']
        h = hashlib.md5(im.tobytes() + str(im.size).encode()).hexdigest()[:8]
        if h in seen: key = seen[h]
        else:
            base = 'f_' + re.sub(r'[\d.]+$', '', o['id']).rstrip('_')
            if o['id'].startswith('tree'): base = 'f_' + (o.get('label') or 'tree')
            if o['id'].startswith('tall_'): base = 'f_' + '_'.join(o['id'].split('_')[:2])
            key = base; n = 2
            while key in items: key = f'{base}_{n}'; n += 1
            seen[h] = key; imgs[key] = im
            it = dict(name=_name(o), cat='farm', fp=fp, iso=False, block=bool(blk), shadow='tree' if o['id'].startswith(('tree', 'tall_')) else ('prop' if blk else None))
            if ia is not None and blk:
                if ia.get('center'): it.update(iso=True, dy=ia.get('dy', 4))
                else: it.update(corner=[ia.get('dx', 0), ia.get('dy', 0)])
            else: it.update(ax=o['x'] - x * T, ay=o['y'] - y * T)
            items[key] = it
        rec = dict(id=o['id'], k=key, x=x, y=y, flip=0)
        it = items[key]
        if not it['iso'] and not it.get('corner'):
            ax, ay = o['x'] - x * T, o['y'] - y * T
            if (ax, ay) != (it.get('ax'), it.get('ay')): rec.update(ax=ax, ay=ay)
        if o.get('label') and not o['id'].startswith('tree'): rec['label'] = o['label']
        objs.append(rec)
    data = dict(name=w.name, W=w.W, H=w.H, play=[0, 0, w.W, w.H], seed=w.seed, kit='farm',
                terrain=[''.join(r) for r in grid], objects=objs,
                places={k: dict(name=v['name'], door=list(v['door'])) for k, v in w.places.items()},
                spawns=w.spawns, exits=w.exits, mg=getattr(w, 'MG', 120))
    return data, items, imgs

def save_kit(items, imgs):
    os.makedirs(KITDIR, exist_ok=True)
    for k, im in imgs.items():
        p = os.path.join(KITDIR, k + '.png')
        if not os.path.exists(p): im.save(p)
    for k, it in items.items(): it['src'] = os.path.join(KITDIR, k + '.png')
    return items

def diff(base, data):
    """base json (generated) vs edited json -> (ov, new_objects, grid_or_None, door changes)"""
    B = {o['id']: o for o in base['objects']}; D = {o['id']: o for o in data['objects']}
    ov = {}
    for oid, b in B.items():
        d = D.get(oid)
        if d is None: ov[oid] = None; continue
        dx, dy, fl = d['x'] - b['x'], d['y'] - b['y'], (d.get('flip', 0) ^ b.get('flip', 0))
        if dx or dy or fl: ov[oid] = (dx, dy, fl)
    new = [o for oid, o in D.items() if oid not in B]
    grid = None
    if data.get('terrain') != base['terrain']:
        grid = np.array([list(r.ljust(data['W'], '.')[:data['W']]) for r in data['terrain']])
    doors = {k: v['door'] for k, v in data.get('places', {}).items() if k in base['places'] and v['door'] != base['places'][k]['door']}
    return ov, new, grid, doors
