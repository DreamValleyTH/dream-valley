"""Writes data/maps/farm.json — grandma's farm v1.0, laid out like a real 1-rai mixed farm (เกษตรผสมผสาน):
house at the back with its packed-earth yard, a gravel walk straight from the gate to the porch, a long pond on the
left with fish cages and lotus, fruit trees between pond and walk, the vegetable plot right of the walk, and a broken
chicken coop in the overgrown back corner. Ground uses the PixelLab tile sets (tiles: true).

Grid: x runs to the lower-right on screen, y to the lower-left; the house faces +y (towards the gate)."""
import json, os, math
import numpy as np

W, H = 32, 24
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'data', 'maps', 'farm.json')
g = np.full((H, W), '.')

def blob(cx, cy, rx, ry, code):
    for y in range(H):
        for x in range(W):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: g[y, x] = code
def rect(x0, y0, x1, y1, code):
    g[max(0, y0):min(H, y1 + 1), max(0, x0):min(W, x1 + 1)] = code

# ---- ground ----
blob(17.5, 4.5, 7.2, 4.2, 'y')                      # packed-earth yard round the house
rect(16, 6, 17, 23, 'v')                            # gravel walk: gate -> porch
rect(18, 12, 18, 12, 'p'); rect(10, 14, 15, 14, 'p')  # little dirt paths to the plot and the pond bench
rect(19, 16, 25, 21, 'p'); blob(22.5, 18.5, 4.2, 3.2, 'p')   # bare chicken-run earth round the coop
blob(5.6, 9.0, 3.1, 4.3, 'w'); blob(5.0, 15.5, 3.3, 4.2, 'w'); blob(6.2, 12.4, 2.2, 1.6, 'w')   # long pond, pinched in the middle
g[22:24, 15:19] = 'v'                               # gravel spreads at the gate

objs = []
def put(oid, k, x, y, **kw): objs.append(dict(id=oid, k=k, x=x, y=y, flip=kw.pop('flip', 0), **kw))

# ---- house + yard life ----
put('house', 'f_house', 14, 1, tap='house', label='บ้านยาย')
put('jar', 'f_jar', 20, 4, tap='jar')
put('jars', 'f_jars', 12, 2)
put('firewood', 'f_firewood', 12, 4)
put('stove', 'f_stove', 13, 5)
put('clothesline', 'f_clothesline', 21, 6)
put('bike', 'f_bike', 15, 5)
put('spirit', 'f_spirit', 22, 3, tap='spirit')
put('doghouse', 'f_doghouse', 11, 6)
put('cart', 'f_cart', 23, 7)
put('tank', 'water_tank', 21, 2)
# ---- pond ----
put('cage1', 'fish_cage', 4, 8)
put('cage2', 'fish_cage', 4, 15)
put('lotus1', 'f_lotus', 7, 10); put('lotus2', 'f_lotus_2', 3, 13); put('lotus3', 'f_lotus', 6, 18, flip=1)
put('reeds1', 'f_reeds', 3, 5); put('reeds2', 'f_reeds_2', 8, 17); put('stake', 'f_stake', 7, 7)
put('bench', 'f_bench', 10, 13, tap='bench')
# ---- fruit trees between pond and walk; orchard corners ----
put('tree0', 'f_tree_mango', 12, 9, tap='tree', label='tree_mango')
put('tree1', 'f_tree_mango_fruit_mid', 14, 12, tap='tree', label='tree_mango_fruit_mid')
put('tree2', 'f_tree_mango_fruit_few', 12, 17, tap='tree', label='tree_mango_fruit_few')
put('tree3', 'f_tree_mango', 14, 20, tap='tree', label='tree_mango')
put('tree4', 'f_tree_tamarind_pods', 27, 4, tap='tree', label='tree_tamarind_pods')
put('tree5', 'f_tree_tamarind', 3, 21, tap='tree', label='tree_tamarind')
put('tree6', 'f_tree_mango_fruit_full', 29, 13, tap='tree', label='tree_mango_fruit_full')
put('tree7', 'f_tree_mango', 9, 2, tap='tree', label='tree_mango')
# ---- vegetable plot (soil is live; see plot below) + its tools ----
PX, PY, PW, PH = 19, 9, 8, 6
put('pump', 'f_pump', 18, 9, tap='pump'); put('hose', 'f_hose', 18, 10)
put('scarecrow', 'f_scarecrow', 27, 10); put('haystack', 'f_haystack', 28, 8); put('sacks', 'f_sacks', 28, 9)
put('compost', 'f_compost', 27, 14)
# ---- broken chicken coop in the overgrown back corner ----
put('coop', 'coop_broken', 21, 17, tap='coop', label='เล้าไก่')
# ---- gate, mailbox, hedge along the lane ----
put('gate', 'farm_gate', 16, 22)
put('mailbox', 'f_mailbox', 15, 21, tap='mailbox')
for x in list(range(0, 15, 2)) + list(range(19, 31, 2)): put(f'hedge{x}', 'f_hedge', x, 23)
# ---- living borders: bamboo at the back, bananas and coconuts down the sides ----
for i, x in enumerate([2, 6, 24, 28]): put(f'tall_bamboo_{x}_0', 'f_tall_bamboo' if i % 2 == 0 else 'f_tall_bamboo_2', x, 0)
for i, y in enumerate([4, 9, 14, 19]): put(f'tall_banana_0_{y}', 'f_tall_banana', 0, y, flip=i % 2)
for y in [2, 7, 17, 21]: put(f'tall_coconut_30_{y}', 'f_tall_coconut', 30, y, flip=y % 2)
put('tall_papaya_9_5', 'f_tall_papaya', 9, 5)
put('tall_sugarcane_27_18', 'f_tall_sugarcane', 27, 18); put('tall_sugarcane_29_20', 'f_tall_sugarcane_2', 29, 20)
# ---- overgrowth: clumps of weeds, stumps, stones and fallen branches to clear with energy ----
rng = np.random.RandomState(7); taken = set()
def foot(o):
    from mapdata import CATALOG
    c = CATALOG[o['k']]; fw, fd = c['fp']
    return {(o['x'] + i, o['y'] + j) for i in range(fw) for j in range(fd)}
import sys; sys.path.insert(0, HERE)
for o in objs: taken |= foot(o)
zones = [(19, 15, 30, 22, 26), (1, 19, 13, 22, 12), (23, 9, 30, 15, 6), (8, 6, 14, 8, 4)]
n = 0
for (x0, y0, x1, y1, cnt) in zones:
    k = 0
    while k < cnt:
        x, y = rng.randint(x0, x1 + 1), rng.randint(y0, y1 + 1)
        if (x, y) in taken or g[y, x] in 'wv' or (PX <= x < PX + PW and PY <= y < PY + PH): continue
        taken.add((x, y)); put(f'weed{n}', f'weeds_{rng.randint(8)}', x, y, tap='weeds', flip=int(rng.rand() < .5)); n += 1; k += 1
for oid, k, x, y, tap in [('stump1', 'f_stump', 25, 13, 'stump'), ('stump2', 'f_stump', 2, 18, 'stump'), ('rock1', 'f_rock', 9, 21, 'boulder'),
                          ('rock2', 'f_rock_2', 29, 22, 'boulder'), ('br1', 'f_br', 15, 15, 'branch'), ('br2', 'f_br_2', 24, 22, 'branch'),
                          ('peb1', 'f_peb', 11, 19, 'pebble'), ('peb2', 'f_peb', 26, 16, 'pebble')]:
    put(oid, k, x, y, tap=tap)

data = dict(name='farm', rev=2, W=W, H=H, play=[0, 0, W, H], seed=3, tiles=True, mg=360,
            terrain=[''.join(r) for r in g], objects=objs, plot=[PX, PY, PW, PH],
            places={'home': dict(name='บ้านยาย', door=[16, 6], kind='home'), 'farm_visit': dict(name='หน้าบ้านยาย', door=[17, 8])},
            spawns={'home': [16, 6], 'from_town': [17, 21]},
            exits=[dict(cells=[[16, 23], [17, 23]], to='town', spawn='from_farm', label='ไปใจกลางตำบล')])
json.dump(data, open(OUT, 'w'), ensure_ascii=False, indent=0)
print('farm', W, H, 'objects', len(objs), 'weeds', n)
print('\n'.join(data['terrain']))
