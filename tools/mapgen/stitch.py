import json, numpy as np
from PIL import Image
g = json.load(open('chunks/town_grid.json')); W, H, S = g['W'], g['H'], 512
acc = np.zeros((H, W, 3)); wsum = np.zeros((H, W, 1))
ramp = np.minimum(1, (np.arange(S) + 1) / 64.0); ramp = np.minimum(ramp, ramp[::-1]); w2 = np.outer(ramp, ramp)[..., None]
miss = []
for y in g['ys']:
    for x in g['xs']:
        try: im = np.asarray(Image.open(f'chunks/t_{x}_{y}_out.png').convert('RGB')).astype(float)
        except FileNotFoundError: miss.append((x, y)); im = np.asarray(Image.open(f'chunks/t_{x}_{y}_bp.png').convert('RGB')).astype(float)
        acc[y:y + S, x:x + S] += im * w2; wsum[y:y + S, x:x + S] += w2
out = Image.fromarray(np.clip(acc / np.maximum(wsum, 1e-6), 0, 255).astype('uint8'))
out.save('town_painted.png'); out.resize((W // 2, H // 2), Image.LANCZOS).save('town_painted_s.png'); print('missing', miss)
