"""ฟาร์มยาย — same layout as the game's farm (house NW, lotus pond NE, vegetable plot south of the pump, lane out the south edge),
redrawn as a blueprint. Paddies and a village lane continue outside the boundary."""
import sys
from blueprint import BP, C

W, H = 32, 24
def build(scale=1.0, objects=True):
    b = BP(W, H, margin=5, scale=scale, seed=3)
    b.base()
    for gx in range(-5, 38, 6):
        for gy in range(-5, 30, 5):
            if -1 < gx + 3 < 33 and -1 < gy + 2.5 < 25: continue
            b.fields(gx, gy, gx + 6, gy + 5, n=1)
    b.path([(-5, 27.5), (10, 26.8), (22, 26.2), (37, 25)], 1.4, C['lane'], edge=C['dirt'])          # village lane outside the farm
    b.path([(22, 26.4), (22.4, 23), (20, 19.6), (15, 12.5), (11, 10), (8.5, 9.4)], 1.3, C['laterite'])   # laterite drive to the house
    b.rect(2, 5.4, 11.6, 11.4, C['yard'])                                                                   # packed-earth yard
    b.pond(26.5, 6.5, 3.6, 2.6)
    b.rect(11, 14, 20.6, 18.8, (122, 84, 54))                                                               # starter vegetable plot
    for i in range(5): b.rect(11.3, 14.3 + i * .95, 20.3, 14.9 + i * .95, (98, 66, 42))
    b.rect(26, 15, 30, 22, (150, 170, 80))                                                                  # sugarcane patch
    if objects:
        b.house(4.8, 5.8, 3.4, 2.6, 1.8, roof=(120, 110, 100), wall=(110, 80, 52), face=0, stilt=True)
        b.wall(10.6, 19.4, 20.8, 19.4, .5, (130, 96, 60)); b.wall(10.4, 14, 10.4, 19.4, .5, (130, 96, 60))
        for t in [(13, 5, 1.6), (16, 3, 1.4), (10, 3, 1.3), (20, 6, 1.2), (27, 11, 1.4), (29, 15, 1.2), (4, 17, 1.3), (28, 21, 1.2)]: b.tree(*t)
        for x in range(0, 33, 2): b.tree(x + .3, .4, .9, 'banana' if x % 6 else 'round')
        for y in range(3, 24, 3): b.tree(.5, y, .9, 'banana'); b.tree(31.4, y, .9, 'banana')
        for p in [(22, 8, 1.1), (25, 9, 1.0)]: b.tree(*p, 'palm')
        b.house(10.6, 7.6, .6, .6, .9, roof=(176, 60, 40), wall=(230, 220, 200))   # spirit house
    b.flush(); return b

if __name__ == '__main__':
    b = build(1.0, objects='-g' not in sys.argv); b.im.save('farm_bp.png'); print(b.im.size)
