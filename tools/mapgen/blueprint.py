"""Dream Valley — new map layouts (based on ต.บางกะพี้ อ.บ้านหมี่ ลพบุรี) drawn as rough isometric blueprints.
World coords are tiles; projected 2:1 isometric (48x24 per tile) like the game. The blueprint is what PixelLab paints over,
and later also the source of the walk mask, so roads / houses in the painting land where the game expects them."""
import math, random
from PIL import Image, ImageDraw

TW, TH = 48, 24
C = dict(grass=(108, 150, 62), grass2=(96, 138, 56), field=(170, 176, 82), field2=(140, 168, 70), field3=(196, 178, 98),
         bund=(120, 132, 64), water=(70, 120, 150), water2=(92, 146, 168), asphalt=(92, 92, 96), line=(228, 196, 70),
         shoulder=(150, 128, 96), laterite=(186, 112, 62), lane=(176, 170, 160), dirt=(158, 120, 82), yard=(170, 140, 100),
         temple=(222, 214, 196), wall=(214, 206, 188))

class BP:
    def __init__(s, W, H, margin=3, scale=1.0, seed=1):
        s.W, s.H, s.m, s.k = W, H, margin, scale
        s.ox = (H + margin) * TH * scale + margin * TH * scale
        s.oy = 140 * scale
        w = int((W + H + 2 * margin) * TW / 2 * scale + 2 * margin * TH * scale)
        h = int((W + H + 2 * margin) * TH / 2 * scale + 180 * scale)
        s.im = Image.new('RGB', (w, h), C['grass']); s.d = ImageDraw.Draw(s.im); s.rnd = random.Random(seed)
        s.items = []      # depth-sorted solids drawn after the ground
        s.sem = dict(houses=[], trees=[], walls=[], water=[], ponds=[], chedis=[])   # semantic record for the walk mask / occluders
    def P(s, x, y): return (s.ox + (x - y) * TW / 2 * s.k, s.oy + (x + y) * TH / 2 * s.k)
    def poly(s, pts, col, outline=None): s.d.polygon([s.P(*p) for p in pts], fill=col, outline=outline)
    def rect(s, x0, y0, x1, y1, col, outline=None): s.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], col, outline)
    # ground
    def base(s):
        m = s.m; s.rect(-m, -m, s.W + m, s.H + m, C['grass'])
        for _ in range(int(s.W * s.H / 3)):   # grass mottling
            x, y = s.rnd.uniform(-m, s.W + m), s.rnd.uniform(-m, s.H + m); r = s.rnd.uniform(.3, .9)
            s.rect(x, y, x + r, y + r, C['grass2'])
    def fields(s, x0, y0, x1, y1, n=3):
        xs = sorted([x0, x1] + [s.rnd.uniform(x0, x1) for _ in range(n)]); ys = sorted([y0, y1] + [s.rnd.uniform(y0, y1) for _ in range(n - 1)])
        for i in range(len(xs) - 1):
            for j in range(len(ys) - 1):
                col = s.rnd.choice([C['field'], C['field2'], C['field3'], C['field']])
                s.rect(xs[i] + .15, ys[j] + .15, xs[i + 1] - .15, ys[j + 1] - .15, col)
                for k in range(int((xs[i + 1] - xs[i]) * 1.5)):   # crop rows
                    xx = xs[i] + .4 + k * .66
                    if xx < xs[i + 1] - .3: s.poly([(xx, ys[j] + .3), (xx + .12, ys[j] + .3), (xx + .12, ys[j + 1] - .3), (xx, ys[j + 1] - .3)], tuple(max(0, c - 18) for c in col))
    def path(s, pts, width, col, edge=None, center=None, smooth=True):
        if smooth: pts = s.spline(pts)
        if col == C['water']: s.sem['water'].append((pts, width))
        def ribbon(w, c):
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1; nx, ny = -dy / L * w / 2, dx / L * w / 2
                s.poly([(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)], c)
            for (ax, ay) in pts: s.poly([(ax - w / 2, ay), (ax, ay - w / 2), (ax + w / 2, ay), (ax, ay + w / 2)], c)
        if edge: ribbon(width + .7, edge)
        ribbon(width, col)
        if center:
            for i, ((ax, ay), (bx, by)) in enumerate(zip(pts, pts[1:])):
                if i % 2 == 0: s.d.line([s.P(ax, ay), s.P(bx, by)], fill=center, width=max(1, int(2 * s.k)))
        return pts
    def spline(s, pts, n=8):
        if len(pts) < 3: return pts
        out = []
        P = [pts[0]] + pts + [pts[-1]]
        for i in range(1, len(P) - 2):
            p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
            for t in [j / n for j in range(n)]:
                t2, t3 = t * t, t * t * t
                out.append(tuple(.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
        out.append(pts[-1]); return out
    def pond(s, cx, cy, rx, ry):
        s.sem['ponds'].append((cx, cy, rx, ry))
        pts = [(cx + rx * math.cos(a) * (1 + .15 * math.sin(3 * a + cx)), cy + ry * math.sin(a) * (1 + .12 * math.cos(2 * a + cy))) for a in [i / 24 * 2 * math.pi for i in range(24)]]
        s.poly([(x + .3, y + .3) for x, y in pts], C['shoulder']); s.poly(pts, C['water'])
        s.poly([(cx + (x - cx) * .6, cy + (y - cy) * .6 - .2) for x, y in pts], C['water2'])
    # solids (depth sorted)
    def house(s, x, y, w, d, h=1.6, roof=(150, 80, 50), wall=(150, 112, 74), face=0, stilt=False, label=None):
        s.items.append((x + y + w + d, 'house', (x, y, w, d, h, roof, wall, face, stilt))); s.sem['houses'].append(dict(x=x, y=y, w=w, d=d, h=h, stilt=stilt))
    def tree(s, x, y, r=1.0, kind='round'):
        s.items.append((x + y, 'tree', (x, y, r, kind))); s.sem['trees'].append((x, y, r, kind))
    def chedi(s, x, y, r=1.0): s.sem['chedis'].append((x, y, r)); s.items.append((x + y, 'chedi', (x, y, r)))
    def _chedi(s, x, y, r):
        bx, by = s.P(x, y); k = s.k * r
        s.d.polygon([(bx - 26 * k, by), (bx + 26 * k, by), (bx + 20 * k, by - 12 * k), (bx - 20 * k, by - 12 * k)], fill=(236, 232, 220), outline=(120, 110, 100))
        s.d.ellipse([bx - 18 * k, by - 40 * k, bx + 18 * k, by - 8 * k], fill=(244, 240, 230), outline=(120, 110, 100))
        s.d.polygon([(bx - 6 * k, by - 36 * k), (bx + 6 * k, by - 36 * k), (bx, by - 90 * k)], fill=(214, 176, 70), outline=(120, 100, 50))
    def pole(s, x, y, horn=False): s.items.append((x + y, 'pole', (x, y, horn)))
    def wall(s, x0, y0, x1, y1, h=.6, col=C['wall']): s.sem['walls'].append((x0, y0, x1, y1)); s.items.append((max(x0, x1) + max(y0, y1), 'wall', (x0, y0, x1, y1, h, col)))
    def flush(s):
        for _, kind, a in sorted(s.items, key=lambda t: t[0]):
            getattr(s, '_' + kind)(*a)
        s.items = []
    def _wall(s, x0, y0, x1, y1, h, col):
        z = h * TH * s.k
        a, b = s.P(x0, y0), s.P(x1, y1)
        s.d.polygon([a, b, (b[0], b[1] - z), (a[0], a[1] - z)], fill=col, outline=tuple(c - 40 for c in col))
    def _house(s, x, y, w, d, h, roof, wall, face, stilt):
        z = h * TH * s.k; lift = (.7 * TH * s.k) if stilt else 0
        A, B, Cc, D = s.P(x, y), s.P(x + w, y), s.P(x + w, y + d), s.P(x, y + d)
        up = lambda p, dz: (p[0], p[1] - dz)
        sh = tuple(int(c * .55) for c in C['grass']); s.d.polygon([s.P(x + .4, y + .4), s.P(x + w + .6, y + .4), s.P(x + w + .6, y + d + .6), s.P(x + .4, y + d + .6)], fill=sh)
        if stilt:
            for p in (B, Cc, D): s.d.line([p, up(p, lift)], fill=(70, 50, 34), width=max(1, int(3 * s.k)))
        wl, wr = tuple(int(c * .8) for c in wall), wall
        s.d.polygon([up(D, lift), up(Cc, lift), up(Cc, lift + z), up(D, lift + z)], fill=wl, outline=(60, 40, 28))
        s.d.polygon([up(B, lift), up(Cc, lift), up(Cc, lift + z), up(B, lift + z)], fill=wr, outline=(60, 40, 28))
        # door on the facing side
        if face == 0: m = ((D[0] + Cc[0]) / 2, (D[1] + Cc[1]) / 2)
        else: m = ((B[0] + Cc[0]) / 2, (B[1] + Cc[1]) / 2)
        dw = 5 * s.k; s.d.rectangle([m[0] - dw, m[1] - lift - z * .75, m[0] + dw, m[1] - lift], fill=(54, 36, 24))
        # gable roof along the long axis
        rz = z + lift; ridge = z * .9
        if w >= d:
            r0, r1 = s.P(x - .2, y + d / 2), s.P(x + w + .2, y + d / 2)
            s.d.polygon([up(s.P(x - .2, y + d + .2), rz), up(s.P(x + w + .2, y + d + .2), rz), up(r1, rz + ridge), up(r0, rz + ridge)], fill=tuple(int(c * .8) for c in roof), outline=(50, 30, 20))
            s.d.polygon([up(s.P(x - .2, y - .2), rz), up(s.P(x + w + .2, y - .2), rz), up(r1, rz + ridge), up(r0, rz + ridge)], fill=roof, outline=(50, 30, 20))
            s.d.polygon([up(s.P(x + w + .2, y - .2), rz), up(s.P(x + w + .2, y + d + .2), rz), up(r1, rz + ridge)], fill=tuple(int(c * .9) for c in wall))
        else:
            r0, r1 = s.P(x + w / 2, y - .2), s.P(x + w / 2, y + d + .2)
            s.d.polygon([up(s.P(x + w + .2, y - .2), rz), up(s.P(x + w + .2, y + d + .2), rz), up(r1, rz + ridge), up(r0, rz + ridge)], fill=roof, outline=(50, 30, 20))
            s.d.polygon([up(s.P(x - .2, y - .2), rz), up(s.P(x - .2, y + d + .2), rz), up(r1, rz + ridge), up(r0, rz + ridge)], fill=tuple(int(c * .8) for c in roof), outline=(50, 30, 20))
            s.d.polygon([up(s.P(x - .2, y + d + .2), rz), up(s.P(x + w + .2, y + d + .2), rz), up(r1, rz + ridge)], fill=tuple(int(c * .8) for c in wall))
    def _tree(s, x, y, r, kind):
        bx, by = s.P(x, y); k = s.k
        s.d.ellipse([bx - 20 * r * k, by - 6 * r * k, bx + 20 * r * k, by + 8 * r * k], fill=tuple(int(c * .6) for c in C['grass']))
        if kind == 'palm':
            s.d.line([(bx, by), (bx + 4 * k, by - 60 * r * k)], fill=(110, 84, 54), width=int(4 * k) or 1)
            tx, ty = bx + 4 * k, by - 60 * r * k
            for a in range(0, 360, 45):
                s.d.line([(tx, ty), (tx + math.cos(math.radians(a)) * 22 * r * k, ty + math.sin(math.radians(a)) * 10 * r * k + 6 * k)], fill=(70, 120, 50), width=int(4 * k) or 1)
            return
        if kind == 'banana':
            for a in (-60, -20, 20, 60, 100, 140): s.d.line([(bx, by - 6 * k), (bx + math.cos(math.radians(a)) * 18 * r * k, by - 26 * r * k + math.sin(math.radians(a)) * 8 * k)], fill=(96, 150, 60), width=int(6 * k) or 1)
            return
        s.d.rectangle([bx - 3 * k, by - 22 * r * k, bx + 3 * k, by], fill=(96, 70, 44))
        g = [(54, 94, 40), (66, 112, 46), (84, 132, 54)]
        for i, (dx, dy, rr) in enumerate([(0, -34, 22), (-12, -28, 15), (12, -26, 16), (-4, -44, 15), (8, -40, 13)]):
            c = g[min(2, i // 2)]
            s.d.ellipse([bx + (dx - rr) * r * k, by + (dy - rr * .8) * r * k, bx + (dx + rr) * r * k, by + (dy + rr * .8) * r * k], fill=c)
    def _pole(s, x, y, horn):
        bx, by = s.P(x, y); k = s.k
        s.d.line([(bx, by), (bx, by - 70 * k)], fill=(120, 110, 100), width=int(3 * k) or 1)
        s.d.line([(bx - 10 * k, by - 64 * k), (bx + 10 * k, by - 64 * k)], fill=(90, 80, 70), width=int(2 * k) or 1)
        if horn:
            for dx in (-8, 8): s.d.polygon([(bx, by - 74 * k), (bx + dx * 1.6 * k, by - 80 * k), (bx + dx * 1.6 * k, by - 68 * k)], fill=(200, 200, 196))
        s.d.rectangle([bx - 4 * k, by - 40 * k, bx + 4 * k, by - 30 * k], fill=(236, 230, 214))   # campaign poster
