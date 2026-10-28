"""ใจกลางตำบล — laid out after ต.บางกะพี้: ทางหลวง 205 (ถ.สุรนารายณ์) cuts across WSW→ENE, the village sits north of it along
winding lanes, one temple at the village's road edge, a canal crossing north–south in the east with อบต./ป้อมตำรวจ beside it,
school south of the road, rice fields everywhere in between. No bank (moved to อำเภอ)."""
import sys
from PIL import ImageDraw, ImageFont
from blueprint import BP, C

W, H = 56, 40
PLACES = {}
def build(scale=1.0, labels=False):
    b = BP(W, H, margin=4, scale=scale, seed=7)
    b.base()
    # rice paddies fill the open land
    # paddies everywhere except the village, compounds and forest (ต.บางกะพี้ is mostly rice land)
    keep = [(-5, -5, 10, 4), (3, 3, 39, 21), (12, 18, 38, 30), (46, 0, 59, 19), (0, 26, 14, 39), (38, 28, 51, 39), (49, 0, 59, 9)]
    for gx in range(-4, 60, 6):
        for gy in range(-4, 44, 5):
            if any(x0 <= gx + 3 <= x1 and y0 <= gy + 2.5 <= y1 for x0, y0, x1, y1 in keep): continue
            b.fields(gx, gy, gx + 6, gy + 5, n=1)
    # canal N–S in the east, with a bridge where the highway crosses
    canal = b.path([(43, -4), (44, 6), (42.5, 14), (44, 22), (45.5, 30), (44, 44)], 2.2, C['water'], edge=C['shoulder'])
    # ทางหลวง 205
    road = b.path([(-4, 32.5), (8, 30.5), (20, 27.5), (30, 25.5), (40, 23.5), (50, 21.5), (60, 20)], 2.6, C['asphalt'], edge=C['shoulder'], center=C['line'])
    # village lanes (concrete) branching off the highway at the junction, organic, a few dead-ends
    b.path([(24, 26.8), (23.5, 22), (24.5, 17), (23, 12), (24, 6), (22, 0), (21, -4)], 1.2, C['lane'], edge=C['dirt'])
    b.path([(23.8, 18), (19, 17.5), (14, 15), (9, 15.5), (5, 13)], 1.0, C['lane'], edge=C['dirt'])
    b.path([(23.4, 12), (28, 10.5), (32, 11.5), (36, 9)], 1.0, C['lane'], edge=C['dirt'])
    b.path([(14, 15), (13.5, 10), (15, 6), (12, 2)], .9, C['laterite'])
    b.path([(32, 11.5), (33, 16), (31, 20), (31.5, 25)], .9, C['laterite'])
    b.path([(36, 9), (39, 6), (37, 2), (38, -4)], .9, C['laterite'])
    # east side lane to อบต. across the canal
    b.path([(47, 22.2), (47.5, 17), (49, 12), (52, 8)], 1.1, C['lane'], edge=C['dirt'])
    # south lanes: school, rice yard
    b.path([(38, 23.8), (39, 28), (41, 33)], 1.0, C['lane'], edge=C['dirt'])
    b.path([(10, 30.2), (9.5, 34), (7, 38), (8, 44)], 1.0, C['laterite'])
    # ponds
    for p in [(18, 9, 2.2, 1.6), (29, 15.5, 1.6, 1.2), (8, 21, 2, 1.4), (54, 33, 2.2, 1.6), (36, 31, 1.8, 1.3)]: b.pond(*p)
    # yards (packed earth) under each place
    def yard(x0, y0, x1, y1, col=C['yard']): b.rect(x0, y0, x1, y1, col)
    # --- temple (the only one): wall, ubosot, sala, big trees
    yard(13, 19.5, 21.5, 26, C['temple']); b.wall(13, 26, 21.5, 26); b.wall(21.5, 19.5, 21.5, 26)
    b.house(15, 21, 4, 2.4, 2.6, roof=(196, 70, 36), wall=(240, 234, 220), face=0); b.house(15.6, 21.3, 2.8, 1.8, 3.6, roof=(40, 110, 70), wall=(240, 234, 220), face=0); PLACES['temple'] = (17, 22)   # ubosot: two-tier roof
    b.chedi(14.4, 24.6, 1.2)
    b.house(19, 23.6, 2, 1.6, 1.2, roof=(176, 70, 44), wall=(220, 210, 190)); b.tree(14, 20, 1.5); b.tree(20.6, 20.4, 1.3); b.tree(20.8, 25, 1.1)
    # --- junction strip along the highway (shophouses facing the road)
    shops = [('taew_shop', 22, 23.6, (166, 68, 48)), ('noi_noodle', 25.6, 22.8, (150, 96, 60)), ('cvs', 27.6, 22.4, (210, 210, 206)),
             ('pharmacy', 33.6, 21.6, (120, 140, 150)), ('coffee', 36, 20.8, (130, 90, 60))]
    for pid, x, y, roof in shops: yard(x - .3, y - .3, x + 2.3, y + 2.3); b.house(x, y, 2, 1.8, 1.5, roof=roof, wall=(214, 196, 160), face=0); PLACES[pid] = (x + 1, y + 2.5)
    b.house(29.8, 28, 3, 2, .8, roof=(180, 70, 50), wall=(200, 180, 140)); PLACES['bus_stop'] = (30, 27.6)   # bus shelter south side
    yard(25, 28, 29.5, 32, C['dirt']); PLACES['market'] = (27, 29)
    for i in range(3): b.house(25.4 + i * 1.4, 28.6 + (i % 2) * 1.4, 1, 1, .7, roof=[(60, 120, 170), (200, 70, 60), (230, 180, 60)][i], wall=(200, 190, 170))
    b.house(26, 18.6, 3, 2.2, 1.0, roof=(160, 70, 46), wall=(210, 196, 170)); PLACES['sala'] = (27, 21)
    # --- east of the canal: อบต. office, police box, water tower, company compound
    yard(47.5, 12, 53, 17); b.house(48, 13, 4, 2.6, 2.0, roof=(200, 120, 70), wall=(236, 226, 200)); PLACES['obt'] = (50, 16.5)
    b.house(47.6, 18.4, 1.4, 1.4, 1.3, roof=(60, 80, 140), wall=(220, 220, 220)); PLACES['police'] = (48, 20)
    b.house(54, 10, 1.2, 1.2, 4.0, roof=(120, 160, 190), wall=(140, 150, 156)); PLACES['water_tower'] = (54.5, 12)
    yard(50, 1, 58, 8, (190, 186, 176)); b.wall(50, 1, 58, 1); b.wall(50, 1, 50, 8); b.house(53, 3, 3, 2, 1.6, roof=(70, 110, 170), wall=(230, 230, 230)); PLACES['company_office'] = (54, 6)
    for i in range(4): b.house(56, 1.6 + i * 1.5, .9, .9, 1.4, roof=(60, 140, 210), wall=(60, 140, 210))
    # --- south of the highway: รพ.สต., school + field, fertiliser shop and rice-buying yard
    yard(33, 25, 37.5, 28.5); b.house(33.5, 25.4, 3.4, 2, 1.6, roof=(60, 130, 120), wall=(236, 236, 228)); PLACES['clinic'] = (35, 28)
    yard(39, 29, 50, 38, (150, 160, 90)); b.house(40, 33.5, 6, 2.2, 2.0, roof=(170, 80, 50), wall=(230, 214, 170)); b.house(46.6, 30.5, 2.2, 3.6, 1.8, roof=(170, 80, 50), wall=(230, 214, 170)); PLACES['school'] = (42, 32)
    yard(7.5, 31, 13, 35.5, (196, 184, 140)); b.house(9.6, 32, 2.6, 1.8, 1.6, roof=(170, 60, 50), wall=(220, 200, 160)); PLACES['heng_shop'] = (10.5, 34)
    # ลานรับซื้อพืชไร่ — across the highway from อบต. (as in the real ต.บางกะพี้): concrete drying yard, truck scale, big shed
    yard(48, 23.6, 56, 29.5, (206, 200, 186)); b.house(51.5, 26.4, 4, 2.6, 2.2, roof=(150, 150, 150), wall=(180, 170, 150))
    b.rect(48.6, 24.4, 51, 28.8, (226, 196, 120)); b.rect(52, 24.2, 55, 25.4, (120, 120, 120)); PLACES['rice_yard'] = (50, 26.5)
    # --- along the highway west: garage, workshop
    yard(1, 27.6, 4.6, 31); b.house(1.4, 28, 2.8, 2, 1.5, roof=(110, 110, 120), wall=(170, 160, 150)); PLACES['garage'] = (3, 30.5)
    yard(5.2, 26.8, 8.4, 30); b.house(5.6, 27, 2.2, 1.8, 1.4, roof=(140, 90, 60), wall=(190, 160, 120)); PLACES['workshop'] = (6.5, 29.5)
    # --- village houses north of the road: scattered, facing their lane, on stilts or ground, with trees and yards
    homes = [('kamnan', 26, 12.6, 3, 2.2, 0, True), ('house_bua', 9.5, 16.4, 2.2, 1.8, 1, True), ('house_thongbai', 16, 15.8, 2, 1.8, 0, True),
             ('house_sommai', 28.5, 7.4, 2.4, 1.8, 0, False), ('house_chan', 19.2, 9.6, 2, 1.6, 1, True), ('house_nok', 34.4, 12.2, 2, 1.6, 0, False),
             (None, 11, 11, 2, 1.6, 1, True), (None, 25.6, 4.4, 1.8, 1.6, 0, True), (None, 16.6, 4, 2, 1.6, 1, False), (None, 30.6, 17.6, 1.8, 1.6, 0, True),
             (None, 4.4, 14.6, 1.8, 1.4, 1, True), (None, 37.6, 12.6, 1.8, 1.6, 1, False), (None, 20.4, 13.4, 1.6, 1.4, 0, True), (None, 33.6, 5, 1.8, 1.6, 1, True)]
    roofs = [(150, 80, 50), (120, 110, 100), (176, 120, 70), (140, 70, 50), (100, 100, 110)]
    for i, (pid, x, y, w, d, f, st) in enumerate(homes):
        yard(x - .6, y - .6, x + w + .6, y + d + .8, C['yard'] if i % 2 else (160, 136, 96))
        b.house(x, y, w, d, 1.5, roof=roofs[i % 5], wall=(120, 86, 56) if st else (190, 170, 140), face=f, stilt=st)
        if pid: PLACES[pid] = (x + w / 2, y + d + .9)
        b.tree(x - 1.2, y + .4, 1.0, 'banana'); b.tree(x + w + 1, y - .6, 1.1)
    # organic garden, buffalo pasture, forest edge with ศาลปู่ตา
    yard(1, 2, 7, 8, (120, 96, 60)); [b.rect(1.6 + i * 1.1, 2.6, 2.3 + i * 1.1, 7.4, (96, 140, 56)) for i in range(5)]; PLACES['coop_garden'] = (4, 8.6)
    b.rect(38, 0, 47, 7, (128, 158, 70)); b.wall(38, 7, 47, 7, .4, (150, 120, 80)); PLACES['pasture'] = (42, 4)
    for i in range(14): b.tree(-3 + (i % 5) * 2.2 + b.rnd.uniform(-.5, .5), -3 + (i // 5) * 2.1 + b.rnd.uniform(-.5, .5), b.rnd.uniform(1.1, 1.6))
    b.house(8.6, -1.4, .9, .9, 1.0, roof=(170, 50, 40), wall=(230, 220, 200)); PLACES['forest_edge'] = (8, 0.8); PLACES['spirit'] = (9, 0)
    # trees: shade along lanes, palms along paddies, a big rain tree at the junction
    b.tree(23, 21, 2.0)
    for _ in range(46):
        x, y = b.rnd.uniform(-3, 58), b.rnd.uniform(-3, 43)
        if 20 < x + y * .9 < 36 and 12 < y < 28: continue
        b.tree(x, y, b.rnd.uniform(.8, 1.3), b.rnd.choice(['round', 'round', 'palm', 'banana']))
    # power poles along the highway, loudspeakers at the junction
    for i, x in enumerate(range(0, 58, 5)):
        y = 32.5 - x * .222 - 1.8; b.pole(x, y, horn=x in (20, 25, 45))
    b.flush()
    if labels:
        d = ImageDraw.Draw(b.im)
        try: f = ImageFont.truetype('/usr/share/fonts/truetype/tlwg/Loma.ttf', int(15 * scale) + 4)
        except Exception: f = ImageFont.load_default()
        for k, (x, y) in PLACES.items():
            px, py = b.P(x, y); d.text((px, py), k, fill=(255, 255, 255), font=f, stroke_width=2, stroke_fill=(0, 0, 0), anchor='mm')
    return b

if __name__ == '__main__':
    b = build(1.0, labels='-l' in sys.argv)
    b.im.save('town_bp.png'); print(b.im.size)
