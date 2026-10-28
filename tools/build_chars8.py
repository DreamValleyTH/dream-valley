"""Player sheets with 8 facing directions (v1.0).  python3 build_chars8.py player_m [player_f]

Input: a PixelLab 8-direction character export (Idle/rotations/<dir>.png + Idle/animations/walking/<dir>/frame_NNN.png, 88px).
Output: assets/chars/<who>.png in the game's 64px frame grid:
  rows 0-7 = south, south-east, east, north-east, north, north-west, west, south-west
  cols 0-5 = walk cycle, cols 6-9 = idle;   row 8 = the old sit animation (kept from the previous sheet)
and assets/chars/meta.json[<who>] = {dirs: 8, idle: [...], sit, feet}.
"""
import sys, os, json, glob
from PIL import Image
GAME = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = '/home/claude/art_work/chars8'
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
F = 64
def crop(im):   # 88px PixelLab canvas -> 64px game frame, feet line kept at y = 59
    return im.convert('RGBA').crop((12, 12, 76, 76))
meta = json.load(open(f'{GAME}/assets/chars/meta.json'))
for who in sys.argv[1:]:
    base = f'{SRC}/{who}/Idle'
    old = Image.open(f'{GAME}/assets/chars/{who}.png').convert('RGBA')
    old_meta = meta.get(who, {})
    if old_meta.get('dirs') == 8: sit_row = 8
    else: sit_row = 4
    sit_n = old_meta.get('sit', 8)
    sheet = Image.new('RGBA', (F * 10, F * 9), (0, 0, 0, 0))
    for r, d in enumerate(DIRS):
        frames = sorted(glob.glob(f'{base}/animations/walking/{d}/frame_*.png'))
        for c, f in enumerate(frames[:6]): sheet.paste(crop(Image.open(f)), (c * F, r * F))
        rot = crop(Image.open(f'{base}/rotations/{d}.png'))
        for c in range(6, 10): sheet.paste(rot, (c * F, r * F))
    sheet.paste(old.crop((0, sit_row * F, F * 10, sit_row * F + F)), (0, 8 * F))
    sheet.save(f'{GAME}/assets/chars/{who}.png')
    meta[who] = dict(dirs=8, idle=[1] * 8, sit=sit_n, feet=59)
    print(who, 'ok')
json.dump(meta, open(f'{GAME}/assets/chars/meta.json', 'w'))
