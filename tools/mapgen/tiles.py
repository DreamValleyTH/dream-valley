"""Dream Valley ground tiles (v1.0): PixelLab Wang tilesets laid out on a dual grid.

Every tileset is a 16-tile 'grass <-> X' corner set (32x32 px, top-down). The grass part of each tile is an exact copy of
the shared reference grass, so it is cut away (made transparent): the game's own non-repeating grass shows through and
the sets stack on top of each other in layer order without seams.

Dual grid: a display tile sits on every cell CORNER; its four quadrants come from the four cells that meet there, so
the borders between terrains fall in the middle of cells and round off on their own (no hand-made curve pieces).
Variants: each set may come in several seeds (dir_a, dir_b …); the pick is a fixed hash of the position, so the same
spot always shows the same variant (in the game and in the Map Maker alike).
"""
import os, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TSDIR = os.path.join(HERE, 'tilesets')
T = 32
# terrain code -> tileset variant folders (drawn in this order: back first)
SETS = {
    'y': ['yard'],
    's': ['gravel'],
    'v': ['gravel'],
    'p': ['dirt_a', 'dirt_b'],
    'l': ['lat_a', 'lat_b'],
    'c': ['conc'],
    'a': ['asph'],
    'w': ['water_a'],   # water_b came out a different (cyan) colour
}
ORDER = ['y', 's', 'v', 'p', 'l', 'c', 'a', 'w']
_cache = {}

def load_set(name):
    """-> {(nw, ne, sw, se) as bools 'is X': RGBA np array with the grass cut away}"""
    if name in _cache: return _cache[name]
    d = os.path.join(TSDIR, name); meta = json.load(open(os.path.join(d, 'meta.json')))
    ref = np.asarray(Image.open(os.path.join(TSDIR, 'ref_grass.png')).convert('RGB')).astype(int)
    out = {}
    for t in meta:
        im = np.asarray(Image.open(os.path.join(d, f"{t['i']:02d}.png")).convert('RGBA')).copy()
        grass = np.abs(im[..., :3].astype(int) - ref).sum(2) <= 12
        im[grass, 3] = 0
        c = t['corners']; key = tuple(c[k] == 'lower' for k in ('NW', 'NE', 'SW', 'SE'))
        out[key] = im
    _cache[name] = out; return out

def _hash(x, y, salt):   # small integers only, so the Map Maker (JavaScript) gets exactly the same picks
    h = x * 31 + y * 17 + salt * 7
    return (h * h + x * y) % 9973

def compose(grid):
    """grid: HxW array of terrain chars -> RGBA uint8 array (H*T, W*T, 4): all tile layers, grass transparent"""
    H, W = grid.shape
    out = Image.new('RGBA', (W * T, H * T), (0, 0, 0, 0))
    pad = np.pad(grid, 1, mode='edge')      # the map edge continues outward
    for si, code in enumerate(ORDER):
        if code not in SETS: continue
        cm = pad == code
        if not cm.any(): continue
        sets = [load_set(n) for n in SETS[code]]
        layer = Image.new('RGBA', out.size, (0, 0, 0, 0))
        for vy in range(H + 1):            # corner (vx, vy) is shared by cells (vx-1..vx, vy-1..vy)
            for vx in range(W + 1):
                nw, ne, sw, se = cm[vy, vx], cm[vy, vx + 1], cm[vy + 1, vx], cm[vy + 1, vx + 1]
                if not (nw or ne or sw or se): continue
                ts = sets[_hash(vx, vy, si) % len(sets)]
                tile = ts.get((bool(nw), bool(ne), bool(sw), bool(se)))
                if tile is None: continue
                layer.alpha_composite(Image.fromarray(tile), (vx * T - T // 2, vy * T - T // 2))
        out.alpha_composite(layer)
    return np.asarray(out)
