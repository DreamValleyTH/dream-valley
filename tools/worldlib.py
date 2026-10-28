# Dream Valley — world builder library: organic ground, grounded objects, baked shadows, sprite atlas.
# Uses only existing art (art_b ground + art_pl sprites). Output per map: bg png + map json.
import os, glob, json, math
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

T = 32
ART_B = os.environ.get('ART_B', '/mnt/user-data/uploads/Dream_Valley/art_b')
PL = os.environ.get('PL', '/home/claude/artsrc')
EXTRA = os.environ.get('EXTRA', '/home/claude/game/tools/extra_art')

def L(p): return Image.open(p).convert('RGBA')
def tex(path, w, h, ox=0, oy=0):
    t = np.asarray(Image.open(path).convert('RGB')).astype(float)
    reps = ((h + oy + t.shape[0]) // t.shape[0] + 1, (w + ox + t.shape[1]) // t.shape[1] + 1, 1)
    return np.tile(t, reps)[oy:oy + h, ox:ox + w]

def noise(h, w, scale, seed):
    r = np.random.RandomState(seed)
    n = ndimage.gaussian_filter(r.rand(h // 2 + 2, w // 2 + 2), scale / 2, mode='wrap')
    n = np.kron(n, np.ones((2, 2)))[:h, :w]
    return (n - n.mean()) / (n.std() + 1e-9)

# colour grading toward the owner's reference (greener grass, redder laterite)
def grade(img, mul, add=(0, 0, 0)):
    a = img * np.array(mul) + np.array(add)
    return np.clip(a, 0, 255)

def paddy_rgb(xx, yy, seed, din=None):
    """rice paddies in logical px: parcels with raised bunds, each at its own stage (works for any coords, so the countryside outside the map continues seamlessly)"""
    T_ = 32
    jx = np.sin(yy / 97.0 + seed) * 9 + np.sin(xx / 61.0) * 4; jy = np.sin(xx / 83.0 + seed * 2) * 7
    PXp, PYp = 6 * T_, 4 * T_
    fxr = np.floor((xx + jx) / PXp); yy2 = yy + jy + fxr * 37
    fx, fy = fxr, np.floor(yy2 / PYp)
    h = (np.sin(fx * 12.9898 + fy * 78.233 + seed) * 43758.5453) % 1
    lx = np.mod(xx + jx, PXp); ly = np.mod(yy2, PYp)
    young = np.array([118, 170, 64.]); ripe = np.array([206, 178, 84.]); flood = np.array([104, 150, 136.]); stub = np.array([164, 146, 92.]); mid = np.array([150, 176, 70.])
    col = np.where((h < .38)[..., None], young, np.where((h < .58)[..., None], mid, np.where((h < .78)[..., None], ripe, np.where((h < .86)[..., None], flood, stub))))
    rows = (np.floor(xx / 5) % 2 == 0) & (h < .9)
    gr = np.sin(xx * 1.7 + yy * 2.3) * np.sin(xx * .37 - yy * .91)
    col = col * np.where(rows, 1.04, .80)[..., None] * (1 + gr[..., None] * .05)
    sprout = (h >= .78) & (h < .86) & (np.mod(xx, 10) < 3) & (np.mod(yy, 10) < 3)
    col = np.where(sprout[..., None], young * .95, col)
    bund = (lx < 5) | (ly < 5)
    if din is not None: bund = bund | (din <= 5)
    col = np.where(bund[..., None], np.array([132, 160, 70.]) * (1 + gr[..., None] * .06), col)
    edge = ((lx >= 5) & (lx < 6)) | ((ly >= 5) & (ly < 6))
    if din is not None: edge = edge | ((din > 5) & (din <= 6))
    return np.where((edge & ~bund)[..., None], col * .62, col)

class World:
    def __init__(self, name, W, H, seed=1):
        self.name, self.W, self.H = name, W, H
        self.PW, self.PH = W * T, H * T
        self.seed = seed
        self.rng = np.random.RandomState(seed)
        self.blocked = np.zeros((H, W), np.uint8)
        self.walk_bonus = np.zeros((H, W), np.uint8)   # 1 = path (spots prefer)
        self.water = np.zeros((H, W), bool)
        self.objects = []
        self.places = {}
        self.exits = []
        self.spawns = {}
        self.surfaces = []      # (kind, pixel mask)
        self.no_decal = np.zeros((self.PH, self.PW), bool)
        self.shadow = np.zeros((self.PH, self.PW), float)   # 0..1 darkness
        self.plot = None

    # ---------- shape rasterising (tile coords, float) ----------
    def px_mask(self, fn):
        yy, xx = np.mgrid[0:self.PH, 0:self.PW]
        return fn((xx + .5) / T, (yy + .5) / T)

    def poly(self, pts, width):
        """thick polyline through tile-centre points, width in tiles"""
        def f(x, y):
            m = np.zeros(x.shape, bool)
            for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
                dx, dy = x1 - x0, y1 - y0; l2 = dx * dx + dy * dy or 1e-9
                t = np.clip(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1)
                d = np.hypot(x - (x0 + t * dx), y - (y0 + t * dy))
                m |= d < width / 2
            return m
        return self.px_mask(f)

    def ellipse(self, cx, cy, rx, ry):
        return self.px_mask(lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1)

    def rect(self, x0, y0, x1, y1, r=0.0):
        def f(x, y):
            dx = np.maximum(np.maximum(x0 + r - x, x - (x1 - r)), 0); dy = np.maximum(np.maximum(y0 + r - y, y - (y1 - r)), 0)
            return np.hypot(dx, dy) <= r if r else (x >= x0) & (x < x1) & (y >= y0) & (y < y1)
        return self.px_mask(f)

    def roughen(self, m, amp=3.0, scale=6, seed=0):
        """organic edge: signed distance + noise, quantised to 2px"""
        din = ndimage.distance_transform_edt(m); dout = ndimage.distance_transform_edt(~m)
        sd = din - dout
        n = noise(self.PH, self.PW, scale, self.seed * 31 + seed)
        out = (sd + n * amp) > 0
        # quantise to 2x2 blocks so edges read as chunky pixel art
        b = out.reshape(self.PH // 2, 2, self.PW // 2, 2).mean((1, 3)) > .5
        return np.kron(b, np.ones((2, 2), bool))

    def cells_of(self, m, frac=.5):
        c = m.reshape(self.H, T, self.W, T).mean((1, 3))
        return c > frac

    def add_surface(self, kind, m, walk=True):
        self.surfaces.append((kind, m))
        if kind in ('laterite', 'asphalt', 'path'):
            self.road_mask = (getattr(self, 'road_mask', None) if getattr(self, 'road_mask', None) is not None else np.zeros_like(m)) | m
        self.no_decal |= ndimage.binary_dilation(m, iterations=6)
        if kind in ('laterite', 'path', 'asphalt', 'concrete', 'sand', 'yard', 'gravel'):
            self.walk_bonus[self.cells_of(m, .4)] = 1
        if kind == 'water':
            c = self.cells_of(m, .35); self.water |= c; self.blocked[c] = 1

    # ---------- objects ----------
    def place(self, img, x, y, block=None, tap=None, place=None, oid=None, shadow='auto', flip=False, front=False, label=None, decal_clear=True):
        """img: path or Image; (x, y) = base centre in PIXELS (feet line). block: list of (cx,cy) cells or 'auto' rows"""
        ov = getattr(self, 'ov', None)
        if ov is not None and oid in ov:   # map-editor overrides (data/maps/<name>.json): moved / flipped / removed
            e = ov[oid]
            if e is None: return dict(id=oid, block=[], im=None, x=x, y=y, removed=True)
            x += e[0] * T; y += e[1] * T; flip = bool(flip) ^ bool(e[2])
            if isinstance(block, list): block = [(c + e[0], r + e[1]) for c, r in block]
        im = img if isinstance(img, Image.Image) else L(img)
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        bb = im.getbbox(); im = im.crop(bb)
        w, h = im.size
        key = oid or f'o{len(self.objects)}'
        if block == 'auto':
            c0 = int((x - w * .42) // T); c1 = int((x + w * .42 - 1) // T); r = int((y - 2) // T)
            block = [(c, rr) for c in range(c0, c1 + 1) for rr in (r,)]
        block = block or []
        for (c, r) in block:
            if 0 <= c < self.W and 0 <= r < self.H: self.blocked[r, c] = 1
        o = dict(src=img if isinstance(img, str) else None, flip=flip, id=key, im=im, x=int(x), y=int(y), w=w, h=h, block=[list(b) for b in block], tap=tap, place=place, front=front, label=label)
        self.objects.append(o)
        if decal_clear:
            x0, x1 = max(0, int(x - w * .5)), min(self.PW, int(x + w * .5)); y0, y1 = max(0, int(y - min(h, 40))), min(self.PH, int(y + 6))
            self.no_decal[y0:y1, x0:x1] = True
        if shadow:
            self.bake_shadow(o, shadow)
        return o

    def bake_shadow(self, o, kind):
        im, x, y, w, h = o['im'], o['x'], o['y'], o['w'], o['h']
        if kind == 'auto':
            kind = 'tree' if h > 80 and w > 80 and h < 140 else ('building' if w > 110 else 'prop')
        yy, xx = np.mgrid[0:self.PH, 0:self.PW]
        if kind == 'tree':
            rx, ry = w * .36, w * .15
            m = ((xx - x) / rx) ** 2 + ((yy - (y - 3)) / ry) ** 2
            self.shadow = np.maximum(self.shadow, np.where(m < 1, .5, np.where(m < 1.35, .25, 0)))
        elif kind == 'building':
            # silhouette squashed onto the ground just below the base, plus dark under-floor band
            a = (np.asarray(im)[..., 3] > 0)
            cols = np.where(a.any(0))[0]
            band_h = 10
            m = np.zeros((self.PH, self.PW), float)
            x0 = int(x - w / 2) + cols.min(); x1 = int(x - w / 2) + cols.max()
            y0 = int(y - 6); y1 = min(self.PH, int(y + 5))
            m[max(0, y0):y1, max(0, x0 + 4):min(self.PW, x1 + 4)] = .30
            m[max(0, y0):min(self.PH, int(y + 2)), max(0, x0 + 4):min(self.PW, x1 + 4)] = .40
            self.shadow = np.maximum(self.shadow, m)
        elif kind == 'prop':
            rx, ry = max(7, w * .42), max(3, min(8, w * .16))
            m = ((xx - x) / rx) ** 2 + ((yy - (y - 1)) / ry) ** 2
            self.shadow = np.maximum(self.shadow, np.where(m < 1, .38, np.where(m < 1.5, .16, 0)))
        elif kind == 'flat':
            pass

    def add_place(self, pid, name, door, spots=None, kind='place'):
        self.places[pid] = dict(name=name, door=list(door), spots=[list(s) for s in (spots or [door])], kind=kind)

    # ---------- render ----------
    def render(self, out_png):
        PW, PH = self.PW, self.PH
        g1 = tex(f'{ART_B}/tiles/grass_1.png', PW, PH)
        ground = g1.copy()
        for i, (v, th) in enumerate(zip(['grass_2_light', 'grass_3_shade', 'grass_4_dry'], (0.55, 0.45, 1.25))):
            vv = tex(f'{ART_B}/tiles/{v}.png', PW, PH, 13 * i, 7 * i)
            n = noise(PH, PW, 18, self.seed * 7 + i)
            m = n > th
            ground[m] = vv[m]
        # reference grade: greener, slightly darker grass
        ground = grade(ground, (0.84, 0.92, 0.80), (0, 2, -2))
        # big soft mottling (darker / lighter patches like the reference)
        mot = noise(PH, PW, 26, self.seed + 99)
        mq = np.clip(np.round(mot * 1.4) / 1.4, -1.5, 1.5)
        ground = np.clip(ground * (1 + mq[..., None] * .045), 0, 255)
        img = ground.copy(); self.grass_np = ground.copy()

        def edge_dark(mask, amount, width):
            d = ndimage.distance_transform_edt(~mask)
            band = (d > 0) & (d <= width)
            return band, amount

        TL = getattr(self, 'tile_layers', None)
        for kind, m in self.surfaces:
            if TL is not None and kind == 'water':   # tile mode: open water is ours (no repeats), the tile set adds the banks
                wf = tex(f'{ART_B}/tiles/pond/water_fill.png', PW, PH).astype(float)
                import tiles as _tl
                tone = _tl.water_tone(); wf = (wf - wf.reshape(-1, 3).mean(0)) * 0.9 + tone
                n = noise(PH, PW, 14, self.seed + 77); wf *= (1 + n[..., None] * .05)   # slow light/dark drift across the pond
                din = ndimage.distance_transform_edt(m); wf[din <= 10] *= (0.82 + 0.018 * din[din <= 10])[:, None]
                img[m] = wf[m]; continue
            if TL is not None and kind != 'paddy': continue   # tile mode: the tile sets draw every surface except paddies
            if kind in ('laterite', 'path'):
                base = tex(f'{ART_B}/tiles/dirt_laterite.png', PW, PH, 5 if kind == 'laterite' else 40, 3)
                fill = grade(base, (1.02, .80, .72), (6, 0, -6)) if kind == 'laterite' else grade(base, (.66, .62, .58), (40, 30, 16))
                sp = noise(PH, PW, .6, self.seed + (21 if kind == 'laterite' else 23))
                fill[sp > 1.6] *= .86; fill[sp < -1.8] = fill[sp < -1.8] * .7 + 60
                img[m] = fill[m]
                din = ndimage.distance_transform_edt(m)
                img[m & (din <= 3)] *= .9
                img[m & (din <= 1)] *= .78
                d = ndimage.distance_transform_edt(~m); img[(d > 0) & (d <= 4)] *= .9
                if kind == 'path':   # worn footpath: grass pokes through in the middle
                    gp = noise(PH, PW, 1.5, self.seed + 29) > 1.3
                    img[m & gp & (din > 3)] = ground[m & gp & (din > 3)] * .95
            elif kind == 'yard':
                fill = grade(tex(f'{ART_B}/tiles/dirt_laterite.png', PW, PH, 61, 9), (.74, .70, .62), (40, 36, 22))
                n = noise(PH, PW, 3, self.seed + 5)
                din = ndimage.distance_transform_edt(m)
                keep = m & ((din > 10) | (n > (1.5 - din / 6)))
                img[keep] = fill[keep]
                gp = (noise(PH, PW, 2, self.seed + 31) > 1.6) & m & (din > 10)
                img[gp] = ground[gp] * .9
                d = ndimage.distance_transform_edt(~keep); img[(d > 0) & (d <= 2) & m] *= .9
            elif kind == 'plotbed':
                fill = grade(tex(f'{ART_B}/tiles/dirt_laterite.png', PW, PH, 17, 41), (.62, .56, .48), (48, 44, 26))
                img[m] = fill[m]
                din = ndimage.distance_transform_edt(m); img[m & (din <= 2)] *= .82
                d = ndimage.distance_transform_edt(~m); img[(d > 0) & (d <= 3)] *= .88
            elif kind == 'asphalt':
                n = noise(PH, PW, 1.2, self.seed + 11)
                base = np.array([92, 88, 86.]) + n[..., None] * 5
                img[m] = base[m]
                din = ndimage.distance_transform_edt(m)
                img[m & (din <= 2)] = np.array([168, 160, 146.])
                for pts in getattr(self, 'dash_lines', []):   # centre line along any road polyline (tile coords)
                    acc = 0.0
                    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
                        L_ = max(1e-6, np.hypot(x1 - x0, y1 - y0) * T); n_ = int(L_ / 2)
                        for i in range(n_):
                            t = i / n_; px_, py_ = int((x0 + (x1 - x0) * t) * T), int((y0 + (y1 - y0) * t) * T); acc += 2
                            if acc % 26 < 13 and 1 <= px_ < PW - 2 and 1 <= py_ < PH - 2 and m[py_, px_]: img[py_ - 1:py_ + 2, px_ - 1:px_ + 2] = np.array([226, 190, 80.])
                if getattr(self, 'dash_rows', None):
                    for (y0, x0, x1) in self.dash_rows:
                        for x in range(x0, x1, 24):
                            img[y0:y0 + 3, x:x + 12] = np.array([226, 190, 80.])
                d = ndimage.distance_transform_edt(~m); img[(d > 0) & (d <= 2)] *= .82
            elif kind == 'concrete':
                yy, xx = np.mgrid[0:PH, 0:PW]
                n = noise(PH, PW, 1.5, self.seed + 13)
                base = np.array([196, 190, 176.]) + n[..., None] * 4
                seam = ((xx % 32) == 0) | ((yy % 32) == 0)
                base[seam] *= .86
                img[m] = base[m]
                din = ndimage.distance_transform_edt(m); img[m & (din <= 1)] *= .78
                d = ndimage.distance_transform_edt(~m); img[(d > 0) & (d <= 2)] *= .86
            elif kind == 'sand':
                n = noise(PH, PW, 1.0, self.seed + 17)
                base = np.array([228, 206, 160.]) + n[..., None] * 6
                img[m] = base[m]
                d = ndimage.distance_transform_edt(~m); img[(d > 0) & (d <= 2)] *= .9
            elif kind == 'paddy':
                yy, xx = np.mgrid[0:PH, 0:PW].astype(float)
                din = ndimage.distance_transform_edt(m)
                col = paddy_rgb(xx, yy, self.seed, din)
                img[m] = col[m]
            elif kind == 'water':
                wf = tex(f'{ART_B}/tiles/pond/water_fill.png', PW, PH)
                wf = grade(wf, (.92, 1.0, 1.0))
                din = ndimage.distance_transform_edt(m); dout = ndimage.distance_transform_edt(~m)
                img[m] = wf[m]
                img[m & (din <= 5)] *= .80                       # deeper shade under the bank
                img[m & (din > 5) & (din <= 6)] = img[m & (din > 5) & (din <= 6)] * .5 + np.array([150, 200, 200]) * .5
                bank = (~m) & (dout <= 4)
                img[bank] = np.array([104, 78, 48.])
                img[(~m) & (dout > 4) & (dout <= 5)] = np.array([70, 52, 32.])
                img[m & (din <= 1)] = np.array([54, 42, 28.])
        if TL is not None:
            a = TL[..., 3:4].astype(float) / 255
            img = img * (1 - a) + TL[..., :3].astype(float) * a
            am = [m for k, m in self.surfaces if k == 'asphalt']
            if am and getattr(self, 'dash_lines', None):   # yellow centre dashes along the road polylines
                m = am[0]; acc = 0.0
                for pts in self.dash_lines:
                    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
                        L_ = max(1e-6, np.hypot(x1 - x0, y1 - y0) * T); n_ = int(L_ / 2)
                        for i in range(n_):
                            t = i / n_; px_, py_ = int((x0 + (x1 - x0) * t) * T), int((y0 + (y1 - y0) * t) * T); acc += 2
                            if acc % 26 < 13 and 1 <= px_ < PW - 2 and 1 <= py_ < PH - 2 and m[py_, px_]: img[py_ - 1:py_ + 2, px_ - 1:px_ + 2] = np.array([226, 190, 80.])
        self.ground_np = img.copy()
        # baked shadows (multiply toward the reference's deep green-brown)
        s = np.clip(self.shadow * 1.6, 0, 1)[..., None]
        shade_col = np.array([40, 46, 20.])
        target = img * .4 + shade_col * .35
        img = img * (1 - s) + target * s
        out = Image.fromarray(np.clip(img, 0, 255).astype('uint8')).convert('RGBA')
        if out_png:   # the front-view picture is only needed for maps without an iso view
            self.decals(out); out.save(out_png)
        return out

    def decals(self, out):
        dec = {os.path.basename(f)[4:-4]: L(f) for f in glob.glob(f'{ART_B}/decals/dec_*.png')}
        wts = {'tuft_s': 7, 'tuft_m': 4, 'tuft_l': 1.2, 'clover': 2, 'flowers_white': 1.6, 'flowers_yellow': 1.4, 'flowers_blue': .8,
               'pebbles': .8, 'leaves_green': .7, 'sprout': .8, 'wildflowers': .9}
        names = [n for n in wts if n in dec]; pr = np.array([wts[n] for n in names]); pr /= pr.sum()
        # density: more near edges of things (fences, trees, paths), little on open lawn
        nd = self.no_decal
        near = ndimage.binary_dilation(nd, iterations=20) & ~nd
        r = self.rng; pts = []
        tries = int(self.PW * self.PH / 2200)
        for _ in range(tries * 6):
            x, y = r.randint(0, self.PW - 20), r.randint(0, self.PH - 20)
            cx, cy = min(self.PW - 1, x + 10), min(self.PH - 1, y + 14)
            if nd[cy, cx]: continue
            p = .8 if near[cy, cx] else .1
            if r.rand() > p: continue
            if any((x - a) ** 2 + (y - b) ** 2 < 30 ** 2 for a, b in pts[-200:]): continue
            pts.append((x, y))
            im = dec[names[r.choice(len(names), p=pr)]]
            if r.rand() < .5: im = im.transpose(Image.FLIP_LEFT_RIGHT)
            out.alpha_composite(im, (x, y))
            if len(pts) > tries: break

    # ---------- isometric ----------
    K = 0.75   # 1 logical px -> K screen px along each iso axis (32px tile -> 48x24 diamond)
    MG = 360   # countryside margin drawn around the playable diamond (seen when zoomed out / at the edges)
    def iso_geom(self):
        K = self.K; SW = int((self.PW + self.PH) * K) + 2 + 2 * self.MG; SH = int((self.PW + self.PH) * K / 2) + 18 + 2 * self.MG
        return K, self.PH * K + self.MG, SW, SH
    def to_iso(self, x, y):
        K, OX, _, _ = self.iso_geom(); return (x - y) * K + OX, (x + y) * K / 2 + self.MG
    def render_iso(self, out_png, iso_objs):
        """ground warped to 2:1 isometric; shadows + decals redrawn in screen space"""
        K, OX, SW, SH = self.iso_geom()
        g = self.ground_np
        vv, uu = np.mgrid[0:SH, 0:SW].astype(float)
        a = (uu + .5 - OX) / K; b = 2 * (vv + .5 - self.MG) / K
        x = (a + b) / 2; y = (b - a) / 2
        inside = (x >= 0) & (y >= 0) & (x < self.PW) & (y < self.PH)
        def mirror(v, n):
            v = np.mod(v, 2 * n); return np.where(v < n, v, 2 * n - 1 - v)
        xi = mirror(np.floor(x).astype(int), self.PW); yi = mirror(np.floor(y).astype(int), self.PH)
        out = np.zeros((SH, SW, 4), np.uint8)
        dist = np.maximum(np.maximum(-x, x - self.PW), np.maximum(-y, y - self.PH)).clip(0)
        dim = (1 - np.clip(dist / 700, 0, .32 if not getattr(self, 'mirror_ground', False) else .12))[..., None]
        xc = np.clip(np.floor(x).astype(int), 0, self.PW - 1); yc = np.clip(np.floor(y).astype(int), 0, self.PH - 1)
        if getattr(self, 'mirror_ground', False):   # data maps: the countryside beyond is the same paddy land, continuing
            src = np.where(inside[..., None], g[yc, xc], paddy_rgb(x, y, self.seed))
        else:
            src = np.where(inside[..., None], g[yc, xc], self.grass_np[yi, xi])
        # ---- countryside outside the playable land: rice paddies with dikes, roads that keep going, tree lines ----
        outside = ~inside
        road = getattr(self, 'road_mask', np.zeros((self.PH, self.PW), bool))
        ext = outside & road[yc, xc]                                   # roads leaving the map continue straight on
        src = np.where(ext[..., None], g[yc, xc], src)
        PX_, PY_ = 224, 160                                             # paddy plot size (logical px)
        fx, fy = np.floor(x / PX_), np.floor(y / PY_)
        h = (np.sin(fx * 12.9898 + fy * 78.233) * 43758.5453) % 1
        lx, ly = np.mod(x, PX_), np.mod(y, PY_)
        dike = (lx < 7) | (ly < 7)
        rows = (np.floor(lx / 6) % 2 == 0)
        young = np.array([126, 178, 70.]); ripe = np.array([214, 186, 92.]); flood = np.array([110, 160, 140.]); stub = np.array([168, 150, 96.])
        col = np.where((h < .45)[..., None], young, np.where((h < .7)[..., None], ripe, np.where((h < .85)[..., None], flood, stub)))
        col = col * np.where(rows, 1.0, .93)[..., None]
        col = col * (0.95 + 0.1 * np.random.RandomState(self.seed + 3).rand(*x.shape))[..., None]   # grain, like the land texture
        col = np.where(dike[..., None], np.array([118, 140, 66.]), col)
        near = dist < 56                                                # keep a grass verge right next to the land
        # (paddies switched off: the edge now continues the same grass and earth as the map, just not walkable)
        dirt = outside & ~ext & (noise(SH, SW, 14, self.seed + 41) > 1.9) & (not getattr(self, 'mirror_ground', False))
        src = np.where(dirt[..., None], src * .55 + np.array([150, 112, 70.]) * .45, src)   # a few worn earth patches, softly blended
        out[..., :3] = np.clip(src * dim, 0, 255).astype(np.uint8); out[..., 3] = 255
        self._iso_outside = (outside, x, y, dist, ext, near)
        # map edge: darken last few px so the diamond reads as a raised island of land

        # shadows in screen space
        sh = np.zeros((SH, SW), float)
        for o in ([] if getattr(self, 'rt_shadow', False) else iso_objs):
            ax, ay, w, h, kind = o['ix'], o['iy'], o['iw'], o['ih'], o['shadow']
            if kind == 'tree':
                rx, ry = w * .34, w * .16
                m = ((uu - ax - 4) / rx) ** 2 + ((vv - ay + 2) / ry) ** 2
                sh = np.maximum(sh, np.where(m < 1, .5, np.where(m < 1.35, .22, 0)))
            elif kind == 'building':
                fp = o.get('fp')
                if fp:   # footprint diamond pushed a little to the right (fixed light from upper-left)
                    (x0, y0, x1, y1) = fp
                    m = (x >= x0 - 2) & (x <= x1 + 10) & (y >= y0 - 2) & (y <= y1 + 6) & ~((x <= x1) & (y <= y1) & (x >= x0) & (y >= y0))
                    sh = np.maximum(sh, np.where(m, .42, 0))
            elif kind == 'prop':
                rx, ry = max(6, w * .4), max(3, min(7, w * .18))
                m = ((uu - ax - 1) / rx) ** 2 + ((vv - ay + 1) / ry) ** 2
                sh = np.maximum(sh, np.where(m < 1, .36, np.where(m < 1.5, .14, 0)))
        s = np.clip(sh * 1.6, 0, 1)[..., None]
        col = out[..., :3].astype(float); target = col * .4 + np.array([40, 46, 20.]) * .35
        out[..., :3] = np.clip(col * (1 - s) + target * s, 0, 255).astype(np.uint8)
        im = Image.fromarray(out, 'RGBA')
        self._outside_trees(im)
        # decals: sample logical no-decal mask at the decal foot
        dec = {os.path.basename(f)[4:-4]: L(f) for f in glob.glob(f'{ART_B}/decals/dec_*.png')}
        wts = {'tuft_s': 7, 'tuft_m': 4, 'tuft_l': 1.2, 'clover': 2, 'flowers_white': 1.6, 'flowers_yellow': 1.4, 'flowers_blue': .8,
               'pebbles': .8, 'leaves_green': .7, 'sprout': .8, 'wildflowers': .9}
        names = [n for n in wts if n in dec]; pr = np.array([wts[n] for n in names]); pr /= pr.sum()
        nd = self.no_decal; near = ndimage.binary_dilation(nd, iterations=20) & ~nd
        r = np.random.RandomState(self.seed + 5); pts = []; tries = int(SW * SH / 1500)
        for _ in range(tries * 8):
            u, v = r.randint(0, SW - 20), r.randint(0, SH - 20)
            fu, fv = u + 10, v + 14
            if not inside[fv, fu]: continue
            lx, ly = int(x[fv, fu]), int(y[fv, fu])
            if lx < 6 or ly < 6 or lx > self.PW - 7 or ly > self.PH - 7 or nd[ly, lx]: continue
            if r.rand() > (.8 if near[ly, lx] else .1): continue
            if any((u - a) ** 2 + (v - b) ** 2 < 26 ** 2 for a, b in pts[-200:]): continue
            pts.append((u, v)); d = dec[names[r.choice(len(names), p=pr)]]
            if r.rand() < .5: d = d.transpose(Image.FLIP_LEFT_RIGHT)
            im.alpha_composite(d, (u, v))
            if len(pts) > tries: break
        im.save(out_png)

    def _outside_trees(self, im):
        outside, x, y, dist, ext, near = self._iso_outside
        SH, SW = outside.shape
        TR2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mapgen', 'art2', 'trees')
        trees = [L(f'{TR2}/{n}.png') for n in ('mango', 'tamarind', 'raintree', 'mango', 'tamarind') if os.path.exists(f'{TR2}/{n}.png')]
        extra = [L(f'{TR2}/{n}.png') for n in ('bamboo_s', 'banana_s', 'bush', 'bush2') if os.path.exists(f'{TR2}/{n}.png')]
        pdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets_src', 'plants')
        extra += [L(f'{TR2}/{n}.png') for n in ('sugarcane', 'coconut', 'sugarpalm', 'raintree', 'bamboo', 'banana', 'papaya', 'tamarind') if os.path.exists(f'{TR2}/{n}.png')] * 2
        pool = trees + extra
        r = np.random.RandomState(self.seed + 77); pts = []
        for _ in range(5000):
            u, v = r.randint(0, SW), r.randint(0, SH)
            if not outside[v, u] or ext[v, u] or near[v, u]: continue
            if r.rand() > .22: continue
            if any((u - a) ** 2 + ((v - b) * 2) ** 2 < 46 ** 2 for a, b in pts): continue
            pts.append((u, v))
            if len(pts) > 70: break
        for (u, v) in sorted(pts, key=lambda p: p[1]):
            t = pool[r.randint(len(pool))]
            if r.rand() < .5: t = t.transpose(Image.FLIP_LEFT_RIGHT)
            d = dist[v, u]; k = 1 - min(.45 if not getattr(self, 'mirror_ground', False) else .15, d / 520)
            t2 = t.copy(); a = t2.getchannel('A'); t2 = Image.eval(t2.convert('RGB'), lambda c: int(c * k)).convert('RGBA'); t2.putalpha(a)
            # soft ground shadow
            sh = Image.new('RGBA', (int(t.width * .7), 10), (0, 0, 0, 0))
            from PIL import ImageDraw
            ImageDraw.Draw(sh).ellipse((0, 0, sh.width - 1, 9), fill=(20, 30, 10, 70))
            im.alpha_composite(sh, (int(u - sh.width / 2), int(v - 6)))
            im.alpha_composite(t2, (int(u - t.width / 2), int(v - t.height)))

    def export(self, out_dir, atlas, iso_art=None):
        """atlas: shared Atlas object; returns map json dict"""
        os.makedirs(out_dir, exist_ok=True)
        iso_art = iso_art or {}
        self.render(None)
        objs = []; isoo = []
        # flat things (bridges, lily pads) lie on the ground: bake them into the ground before the iso warp
        gimg = Image.fromarray(np.clip(self.ground_np, 0, 255).astype('uint8')).convert('RGBA')
        for o in self.objects:
            if o.get('flat'): gimg.alpha_composite(o['im'], (int(o['x'] - o['w'] / 2), int(o['y'] - o['h'])))
        self.ground_np = np.asarray(gimg)[..., :3].astype(float)
        for o in self.objects:
            ia = iso_art.get(o['id'])
            if o.get('flat'): key = None
            elif ia is not None and o['block']: key = atlas.add(ia['im'])   # iso art replaces the old front-view sprite entirely
            else: key = atlas.add(o['im'])
            d = dict(id=o['id'], s=key, x=o['x'], y=o['y'], w=o['w'], h=o['h'], block=o['block'], tap=o['tap'],
                     place=o['place'], front=o['front'], label=o['label'])
            # iso: replacement art (anchored at the footprint's front corner) or the original sprite stood at its foot point
            if o.get('flat'):
                d.update(ix=0, iy=0, si=None, iw=0, ih=0, dep=0, shadow=None); objs.append(d); continue
            if ia is not None and o['block']:
                xs = [b[0] for b in o['block']]; ys = [b[1] for b in o['block']]
                x0, y0, x1, y1 = min(xs) * T, min(ys) * T, (max(xs) + 1) * T, (max(ys) + 1) * T
                ax, ay = self.to_iso(x1, y1); im2 = ia['im']
                if ia.get('center'): ax = self.to_iso((x0 + x1) / 2, (y0 + y1) / 2)[0]
                d.update(ix=round(ax + ia.get('dx', 0)), iy=round(ay + ia.get('dy', 0)), si=atlas.add(im2), iw=im2.size[0], ih=im2.size[1],
                         dep=(x0 + x1) / 2 + (y0 + y1) / 2, shadow='building', fp=[x0, y0, x1, y1])
            else:
                ax, ay = self.to_iso(o['x'], o['y'])
                kind = 'tree' if o['h'] > 80 and o['w'] > 80 and o['h'] < 140 else ('building' if o['w'] > 110 else 'prop')
                d.update(ix=round(ax), iy=round(ay), si=key, iw=o['w'], ih=o['h'], dep=o['x'] + o['y'], shadow=kind if kind != 'building' else 'prop')
            objs.append(d); isoo.append(d)
        K, OX, SW, SH = self.iso_geom()
        self.render_iso(f'{out_dir}/{self.name}_iso.png', isoo)
        return dict(name=self.name, W=self.W, H=self.H, T=T, bg=None, blocked=self.blocked.tolist(),
                    path=self.walk_bonus.tolist(), water=self.water.astype(int).tolist(), objects=objs, places=self.places,
                    exits=self.exits, spawns=self.spawns, plot=self.plot,
                    iso=dict(K=K, OX=OX, OY=self.MG, SW=SW, SH=SH, bg=f'{self.name}_iso.png', rtShadow=bool(getattr(self, 'rt_shadow', False))))

class Atlas:
    def __init__(self, name, width=1024):
        self.name, self.width = name, width
        self.items = {}; self.order = []
    def add(self, im):
        import hashlib
        k = hashlib.md5(im.tobytes() + bytes(str(im.size), 'ascii')).hexdigest()[:10]
        if k not in self.items: self.items[k] = im; self.order.append(k)
        return k
    def save(self, out_dir):
        # shelf packing by height
        ks = sorted(self.order, key=lambda k: -self.items[k].size[1])
        rects = {}; x = y = 0; rowh = 0; sheets = []; sheet = 0; maxh = 2048
        for k in ks:
            w, h = self.items[k].size
            if x + w > self.width: x = 0; y += rowh + 1; rowh = 0
            if y + h > maxh: sheet += 1; x = y = rowh = 0
            rects[k] = [sheet, x, y, w, h]; x += w + 1; rowh = max(rowh, h)
        n = sheet + 1
        for si in range(n):
            hh = max([r[2] + r[4] for r in rects.values() if r[0] == si] + [1])
            im = Image.new('RGBA', (self.width, hh))
            for k, r in rects.items():
                if r[0] == si: im.alpha_composite(self.items[k], (r[1], r[2]))
            im.save(f'{out_dir}/{self.name}_{si}.png')
        return dict(sheets=[f'{self.name}_{i}.png' for i in range(n)], rects=rects)
