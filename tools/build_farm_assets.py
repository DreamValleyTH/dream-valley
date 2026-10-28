# Dream Valley — build assets for the playable "ฟาร์มยาย" web scene.
# Uses ONLY existing art (art_b + art_pl zips). No PixelLab credits.
#   python build_farm_assets.py <Dream_Valley root> <unzipped art_pl dir> <out web/farm_yai dir>
# The unzipped dir must contain p1_world_all/, p1_player_frames/, npc_all/, tools_64/, icons_all/
import sys, os, glob, json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT, PL, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
A = os.path.join(OUT, 'assets'); os.makedirs(A + '/obj', exist_ok=True)
T = 32; W, H = 28, 20; PW, PH = W * T, H * T
rng = np.random.RandomState(7)
def L(p): return Image.open(os.path.join(ROOT, p)).convert('RGBA')
def LP(p): return Image.open(os.path.join(PL, p)).convert('RGBA')
def tex(p, w, h):
    t = np.asarray(L(p))[..., :3]
    return np.tile(t, ((h + t.shape[0] - 1) // t.shape[0], (w + t.shape[1] - 1) // t.shape[1], 1))[:h, :w].astype(float)

# ---------------- map layout (cells) ----------------
path = np.zeros((H, W), bool)
path[0:8, 19:21] = True; path[8:20, 20:22] = True   # main lane north-south
path[4:6, 10:21] = True           # lane to the house yard
path[11:13, 9:21] = True          # lane above the vegetable plot
pond = np.zeros((H, W), bool)
pond[13:18, 1:7] = True; pond[12, 2:5] = True; pond[16:18, 7:9] = True
PLOT = (10, 13, 8, 5)             # x, y, w, h  -> cols 10..17, rows 13..17
plot = np.zeros((H, W), bool); plot[13:18, 10:18] = True

# ---------------- ground ----------------
g1 = tex('art_b/tiles/grass_1.png', PW, PH)
ground = g1.copy()
for i, (v, th) in enumerate(zip(['grass_2_light', 'grass_3_shade', 'grass_4_dry'], (0.62, 0.66, 0.72))):
    vv = tex(f'art_b/tiles/{v}.png', PW, PH)
    n = ndimage.gaussian_filter(np.random.RandomState(20 + i).rand(PH // 2, PW // 2), 9, mode='wrap'); n = (n - n.min()) / np.ptp(n)
    m = np.kron((n + np.random.RandomState(40 + i).rand(PH // 2, PW // 2) * 0.03) > th, np.ones((2, 2), bool))
    ground[m] = vv[m]
G = Image.fromarray(ground.astype('uint8')).convert('RGBA')

def loadset(prefix):
    S = {}
    for f in glob.glob(os.path.join(ROOT, prefix + '_*_mask.png')):
        k = tuple(int(c) for c in os.path.basename(f).split('_')[-2])
        S[k] = (np.asarray(Image.open(f).convert('L')) > 127, np.asarray(Image.open(f.replace('_mask', '_rim')).convert('RGBA')))
    S[(1, 1, 1, 1)] = (np.ones((32, 32), bool), np.zeros((32, 32, 4), 'uint8'))
    for k, p in {(1, 0, 0, 1): [(1, 0, 0, 0), (0, 0, 0, 1)], (0, 1, 1, 0): [(0, 1, 0, 0), (0, 0, 1, 0)]}.items():
        if k not in S: S[k] = (S[p[0]][0] | S[p[1]][0], np.maximum(S[p[0]][1], S[p[1]][1]))
    return S
def render(cells, S, fillp):
    fill = tex(fillp, PW + 64, PH + 64).astype('uint8')
    out = np.zeros((PH + 32, PW + 32, 4), 'uint8')
    c = lambda y, x: int(0 <= y < H and 0 <= x < W and cells[y, x])
    for j in range(H + 1):
        for i in range(W + 1):
            k = (c(j - 1, i - 1), c(j - 1, i), c(j, i - 1), c(j, i))
            if k == (0, 0, 0, 0) or k not in S: continue
            m, ov = S[k]; blk = out[j*32:j*32+32, i*32:i*32+32]; f = fill[j*32:j*32+32, i*32:i*32+32]
            blk[m, :3] = f[m]; blk[m, 3] = 255; al = ov[..., 3] > 0; blk[al] = ov[al]
    return Image.fromarray(out[16:16+PH, 16:16+PW])

back = G.copy()
dec = {os.path.basename(f)[4:-4]: Image.open(f).convert('RGBA') for f in glob.glob(os.path.join(ROOT, 'art_b/decals/dec_*.png'))}
wts = {'tuft_s': 6, 'tuft_m': 4, 'tuft_l': 1, 'clover': 2, 'flowers_white': 2, 'flowers_yellow': 1.5, 'flowers_blue': 1, 'pebbles': 2,
       'stone_flat': 1, 'leaves_dry': .6, 'leaves_green': 1, 'mushrooms': .4, 'sprout': 1, 'wildflowers': 1}
names = [n for n in wts if n in dec]; pr = np.array([wts[n] for n in names]); pr /= pr.sum()
occ = ndimage.binary_dilation(path | plot | pond)
pts = []
for _ in range(5000):
    x, y = rng.randint(0, PW - 24), rng.randint(0, PH - 24)
    if occ[min(H-1, (y+12)//32), min(W-1, (x+12)//32)]: continue
    if any((x-a)**2 + (y-b)**2 < 38**2 for a, b in pts): continue
    pts.append((x, y)); im = dec[names[rng.choice(len(names), p=pr)]]
    back.alpha_composite(im.transpose(Image.FLIP_LEFT_RIGHT) if rng.rand() < .5 else im, (x, y))
    if len(pts) > 150: break
back.alpha_composite(render(path, loadset('art_b/tiles/path_laterite/path'), 'art_b/tiles/dirt_laterite.png'))
back.alpha_composite(render(pond, loadset('art_b/tiles/pond/pond'), 'art_b/tiles/pond/water_fill.png'))
# faint plot border so the player sees where the garden is
pm = Image.new('RGBA', (PW, PH)); pa = np.zeros((PH, PW, 4), 'uint8')
x0, y0, pw, ph = [v * 32 for v in PLOT]
pa[y0:y0+ph, x0:x0+pw] = (70, 50, 20, 26)
back.alpha_composite(Image.fromarray(pa))
back.save(A + '/bg.png')

# ---------------- soil dual-grid atlas (index = NW*8+NE*4+SW*2+SE) ----------------
def soil_atlas(fillp, outp):
    S = loadset('art_b/tiles/soil_hoed/soil'); fill = np.asarray(L(fillp))
    fill = np.tile(fill, (2, 2, 1))[16:48, 16:48]  # half-tile offset so fill lines up with the cell grid
    at = np.zeros((32, 32 * 16, 4), 'uint8')
    for idx in range(1, 16):
        k = ((idx >> 3) & 1, (idx >> 2) & 1, (idx >> 1) & 1, idx & 1)
        if k not in S: continue
        m, ov = S[k]; blk = at[:, idx*32:idx*32+32]
        blk[m] = fill[m]; blk[m, 3] = 255; al = ov[..., 3] > 0; blk[al] = ov[al]
    Image.fromarray(at).save(outp)
soil_atlas('art_b/tiles/soil_hoed/soil_dry_fill.png', A + '/soil_dual.png')
wet = Image.new('RGBA', (32 * 8, 32))
for i in range(8): wet.alpha_composite(L(f'art_b/tiles/soil_hoed/soil_wet_v{i+1}.png'), (i * 32, 0))
wet.save(A + '/soil_wet.png')

# ---------------- crops (soil mound removed, like overview_scene3) ----------------
def nosoil(im):
    a = np.asarray(im).copy(); r, g, b = [a[..., i].astype(int) for i in range(3)]
    h = a.shape[0]; yy = np.mgrid[0:h, 0:a.shape[1]][0]
    m = (yy > h * 0.55) & (a[..., 3] > 0) & (r < 120) & (g < 90) & (b < 80) & (np.abs(r - g) < 45) & ~(g > r + 5)
    a2 = a.copy(); a2[m, 3] = 0
    lab, n = ndimage.label(a2[..., 3] > 0)
    if n > 1:
        s = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); keep = np.argmax(s) + 1; a2[(lab != keep) & (lab > 0), 3] = 0
    if (a2[..., 3] > 0).sum() < 20: return im
    return Image.fromarray(a2)
CROPS = ['chili', 'basil', 'corn', 'morning_glory']
cr = Image.new('RGBA', (64 * 6, 64 * len(CROPS)))
for r, k in enumerate(CROPS):
    for s in range(6):
        im = LP(f'p1_world_all/crop_{k}/{s:02d}.png')
        if s < 5: im = nosoil(im)
        cr.alpha_composite(im, (s * 64, r * 64))
cr.save(A + '/crops.png')

# ---------------- characters: atlas rows S,N,E,W ; cols walk0-5, idle0-3 ----------------
DIRS = ['south', 'north', 'east', 'west']
def char_atlas(base, outp):
    frames = []
    for d in DIRS:
        row = [LP(f'{base}/Idle/animations/walking/{d}/frame_{i:03d}.png') for i in range(6)]
        row += [LP(f'{base}/Idle/animations/breathing_idle/{d}/frame_{i:03d}.png') for i in range(4)]
        frames.append(row)
    at = Image.new('RGBA', (64 * 10, 64 * 4))
    for r, row in enumerate(frames):
        for c, im in enumerate(row): at.alpha_composite(im, (c * 64, r * 64))
    at.save(outp)
char_atlas('p1_player_frames/m_A_anim', A + '/player_m.png')
char_atlas('p1_player_frames/f_A_anim', A + '/player_f.png')
char_atlas('npc_all/pa_taeo', A + '/npc_taeo.png')
# portrait: zoomed head of the NPC sprite (same style as the world)
def portrait(base, outp):
    im = LP(f'{base}/Idle/rotations/south.png'); bb = im.getbbox()
    cx = (bb[0] + bb[2]) // 2; head = im.crop((cx - 16, bb[1], cx + 16, bb[1] + 32))
    head.resize((128, 128), Image.NEAREST).save(outp)
portrait('npc_all/pa_taeo', A + '/portrait_taeo.png')
portrait('p1_player_frames/m_A_anim', A + '/portrait_m.png')
portrait('p1_player_frames/f_A_anim', A + '/portrait_f.png')

# ---------------- tool icons (no swing animation, per 22.3) ----------------
tl = Image.new('RGBA', (32 * 5, 32))
for i, n in enumerate([0, 1, 4, 7, 37]):   # hoe, watering can, sickle, hand trowel(plant), bucket
    tl.alpha_composite(LP(f'tools_64/{n:02d}.png'), (i * 32, 0))
tl.save(A + '/tools.png')
ICONS = ['seed_chili', 'seed_holy_basil', 'seed_sweet_corn', 'seed_water_spinach',
         'crop_chili', 'crop_holy_basil', 'crop_sweet_corn', 'crop_water_spinach', 'food_water', 'item_money_envelope']
ic = Image.new('RGBA', (32 * len(ICONS), 32))
for i, n in enumerate(ICONS): ic.alpha_composite(LP(f'icons_all/{n}.png').resize((32, 32), Image.NEAREST), (i * 32, 0))
ic.save(A + '/icons.png')

# ---------------- world objects ----------------
def save_obj(name, im):
    im = im.crop(im.getbbox()); im.save(f'{A}/obj/{name}.png'); return im.size
objs = []   # (id, file, base x, base y (art px), shadow, block cells, tap kind)
def add(oid, name, im, x, y, shadow=True, block=(), tap=None, flip=False):
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = save_obj(name, im)
    objs.append(dict(id=oid, img=name, x=x, y=y, w=w, h=h, shadow=shadow, block=[list(c) for c in block], tap=tap))
tm = {f: L(f'art_b/trees/{f}.png') for f in ['tree_mango', 'tree_mango_fruit_full', 'tree_mango_fruit_mid', 'tree_mango_fruit_few', 'tree_tamarind', 'tree_tamarind_pods']}
trees = [('tree_mango', 470, 122), ('tree_mango_fruit_mid', 560, 95), ('tree_mango', 760, 140), ('tree_mango_fruit_few', 845, 70),
         ('tree_tamarind_pods', 360, 60), ('tree_tamarind', 740, 400), ('tree_mango_fruit_full', 830, 430), ('tree_mango', 90, 360)]
for i, (f, x, y) in enumerate(trees):
    add(f'tree{i}', f'{f}_{i}', tm[f], x, y, block=[(x // 32, (y - 4) // 32)], tap='tree', flip=bool(i % 2))
house = LP('p1_world_all/house/00.png')
add('house', 'house_yai', house, 150, 150, block=[(cx, cy) for cx in range(2, 8) for cy in range(2, 5)], tap='house')
P = lambda i: LP(f'p1_world_all/props/{i:02d}.png')
add('spirit', 'spirit_house', P(0), 600, 345, block=[(18, 10)], tap='spirit')
add('jar', 'water_jar', P(1), 625, 520, block=[(625 // 32, 519 // 32)], tap='jar')
add('bench', 'bench', P(2), 770, 345, block=[(23, 10), (24, 10)], tap=None)
add('haystack', 'haystack', P(4), 870, 530, block=[(27, 16)], tap=None)
add('firewood', 'firewood', P(6), 265, 150, block=[(8, 4)], tap=None)
add('mailbox', 'mailbox', P(7), 722, 290, block=[(22, 9)], tap='mailbox')
add('pump', 'hand_pump', P(11), 285, 445, block=[(8, 13)], tap='pump')
add('cart', 'cart', P(14), 300, 150, block=[(9, 4)], tap=None)
add('bike', 'bicycle', P(10), 560, 300, block=[(17, 9)], tap=None)
add('scarecrow', 'scarecrow', P(3), 592, 470, shadow=True, block=[(18, 14)], tap=None)
O = lambda i: LP(f'p1_world_all/obstacles/{i:02d}.png')
for (i, x, y) in [(0, 60, 600), (1, 880, 300), (2, 470, 70), (3, 620, 40), (4, 140, 255), (5, 40, 450), (6, 860, 600), (3, 900, 250), (1, 520, 620), (5, 450, 330), (0, 300, 250)]:
    add(f'deco{len(objs)}', f'obstacle_{i:02d}', O(i), x, y, block=[] if i in (4, 5, 6) else [(min(W-1, x // 32), min(H-1, (y - 2) // 32))])
# plot debris (clearable): weeds / stones / twigs — saved separately, placed by the game
for i in [5, 6, 24, 25, 0, 4]: save_obj(f'debris_{i:02d}', O(i))
fence = LP('p1_world_all/fence/00.png'); post = LP('p1_world_all/fence/01.png')
for k in range(8): add(f'fence{k}', 'fence_h', fence, 320 + 16 + k * 32, 600, shadow=False, block=[(10 + k, 18)])
add('fpostL', 'fence_post', post, 304, 600, shadow=False, block=[(9, 18)])
add('fpostR', 'fence_post', post, 336 + 8 * 32, 600, shadow=False, block=[(18, 18)])
# hedge strip along the bottom edge (front layer)
cn = tm['tree_mango'].crop((0, 0, 96, 70)); hedge = Image.new('RGBA', (PW + 100, 70))
for x in range(-20, PW, 80): hedge.alpha_composite(cn.transpose(Image.FLIP_LEFT_RIGHT) if (x // 80) % 2 else cn, (x + 20, 0))
hedge.crop((20, 0, PW + 20, 70)).save(A + '/hedge.png')

blocked = np.zeros((H, W), int)
blocked[pond] = 1
for o in objs:
    for (cx, cy) in o['block']:
        if 0 <= cx < W and 0 <= cy < H: blocked[cy, cx] = 1
blocked[H - 1, :] = 1  # hedge row
scene = dict(W=W, H=H, T=T, plot=PLOT, blocked=blocked.tolist(), path=path.astype(int).tolist(), pond=pond.astype(int).tolist(), objects=objs)
json.dump(scene, open(OUT + '/tools/scene.json', 'w'), ensure_ascii=False)
print('objects', len(objs), 'blocked', blocked.sum())

# ---------------- sprite metadata for the game ----------------
meta = {'crops': [], 'chars': {}}
cra = Image.open(A + '/crops.png')
for r in range(len(CROPS)):
    meta['crops'].append([list(cra.crop((s*64, r*64, s*64+64, r*64+64)).getbbox() or (0, 0, 1, 1)) for s in range(6)])
for n in ['player_m', 'player_f', 'npc_taeo']:
    at = Image.open(f'{A}/{n}.png'); bots = []
    for r in range(4):
        for c in range(10):
            bb = at.crop((c*64, r*64, c*64+64, r*64+64)).getbbox()
            if bb: bots.append(bb[3])
    meta['chars'][n] = {'feet': int(np.median(bots))}
meta['debris'] = {}
for i in [5, 6, 24, 25, 0, 4]:
    meta['debris'][f'debris_{i:02d}'] = list(Image.open(f'{A}/obj/debris_{i:02d}.png').size)
json.dump(meta, open(OUT + '/tools/meta.json', 'w'))

# ---------------- card art (existing sprites only) ----------------
LP('animals_all/chicken_native/Idle/rotations/south.png').save(A + '/card_hen.png')
LP('icons_all/crop_chili.png').save(A + '/card_chili.png')
LP('icons_all/item_color_paper.png').save(A + '/card_letter.png')
