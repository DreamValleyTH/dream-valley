"""Import a map file saved from the Map Maker into data/maps/<name>.json.   python3 import_map.py <file.json>
The Map Maker keeps only id/k/x/y/flip/layer for objects, so the game's tap behaviour (house, coop, trees, weeds …) is put back here
from the object kind, and the vegetable beds become every 'g' (garden) cell that no object stands on."""
import sys, json, os, collections
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mapgen'))
from mapdata import CATALOG
src = json.load(open(sys.argv[1])); name = src['name']
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'maps', name + '.json')
old = json.load(open(OUT)) if os.path.exists(OUT) else {}
TAP = [('f_house', 'house', 'บ้านยาย', 'house'), ('coop_broken', 'coop', 'เล้าไก่', 'coop'), ('f_jar', 'jar', None, 'jar'), ('f_spirit', 'spirit', None, 'spirit'),
       ('f_mailbox', 'mailbox', None, 'mailbox'), ('f_pump', 'pump', None, 'pump'), ('f_bench', 'bench', None, 'bench')]
n = collections.Counter(); seen = set()
for o in src['objects']:
    k = o['k']
    for kk, tap, label, oid in TAP:
        if k == kk:
            o['tap'] = tap
            if label: o['label'] = label
            if oid not in seen: o['id'] = oid; seen.add(oid)
    if k.startswith('f_tree_'): o['tap'] = 'tree'; o['label'] = k[2:]; o['id'] = f'tree{n["tree"]}'; n['tree'] += 1
    elif k.startswith('weeds_'): o['tap'] = 'weeds'; o['id'] = f'weed{n["weed"]}'; n['weed'] += 1
    elif k == 'f_stump': o['tap'] = 'stump'; o['id'] = f'stump{n["stump"]}'; n['stump'] += 1
    elif k in ('f_rock', 'f_rock_2'): o['tap'] = 'boulder'; o['id'] = f'rock{n["rock"]}'; n['rock'] += 1
    elif k in ('f_br', 'f_br_2'): o['tap'] = 'branch'; o['id'] = f'br{n["br"]}'; n['br'] += 1
    elif k == 'f_peb': o['tap'] = 'pebble'; o['id'] = f'peb{n["peb"]}'; n['peb'] += 1
ids = collections.Counter(o['id'] for o in src['objects'])
for o in src['objects']:
    if ids[o['id']] > 1: o['id'] = o['id'] + '_' + str(o['x']) + '_' + str(o['y'])
if name == 'farm':
    taken = set()
    for o in src['objects']:
        c = CATALOG.get(o['k'])
        if not c or not (c.get('iso') or c.get('block', True)) or o.get('tap') in ('weeds', 'pebble', 'branch', 'stump'): continue   # overgrowth on a bed: clear it, then plant
        fw, fd = c['fp']
        if o.get('flip') and c.get('iso'): fw, fd = fd, fw
        taken |= {(o['x'] + i, o['y'] + j) for i in range(fw) for j in range(fd)}
    src['plot_cells'] = [[x, y] for y, row in enumerate(src['terrain']) for x, ch in enumerate(row) if ch == 'g' and (x, y) not in taken]
    print('vegetable bed cells', len(src['plot_cells']))
json.dump(src, open(OUT, 'w'), ensure_ascii=False, indent=0)
print(name, 'objects', len(src['objects']), dict(n))
