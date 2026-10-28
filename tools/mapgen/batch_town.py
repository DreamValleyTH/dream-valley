import os, sys, json, concurrent.futures as cf
from PIL import Image
from town import build
os.environ['REF'] = 'ref_mix.png'
import paint
b = build(1.0); b.im.save('town_full_bp.png'); W, H = b.im.size
S, STEP = 512, 448
xs = list(range(0, W - S + 1, STEP)); xs = [x for x in xs if x < W - S - 64] + [W - S]
ys = list(range(0, H - S + 1, STEP)); ys = [y for y in ys if y < H - S - 64] + [H - S]
os.makedirs('chunks', exist_ok=True); jobs = []
for y in ys:
    for x in xs:
        n = f'chunks/t_{x}_{y}'
        if not os.path.exists(n + '_out.png'): b.im.crop((x, y, x + S, y + S)).save(n + '_bp.png'); jobs.append((n, x, y))
json.dump(dict(W=W, H=H, xs=xs, ys=ys), open('chunks/town_grid.json', 'w'))
print(len(jobs), 'chunks', xs, ys, flush=True)
def go(j):
    n = j[0]
    for t in range(2):
        try: paint.paint(n + '_bp.png', n + '_out.png'); return n
        except Exception as e: print('retry', n, e, flush=True)
with cf.ThreadPoolExecutor(6) as ex:
    for r in ex.map(go, jobs): print('done', r, flush=True)
