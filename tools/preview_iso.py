import json, sys
from PIL import Image
A='assets'; w=json.load(open(f'{A}/world.json')); name=sys.argv[1]; M=w['maps'][name]; I=M['iso']
bg=Image.open(f"{A}/{I['bg']}").convert('RGBA'); sheets=[Image.open(f'{A}/'+s).convert('RGBA') for s in w['atlas']['sheets']]
out=Image.new('RGBA',bg.size,(43,33,23,255)); out.alpha_composite(bg)
for o in sorted([o for o in M['objects'] if o['si']],key=lambda o:(1e9 if o['front'] else o['dep'])):
    sh,sx,sy,ww,hh=w['atlas']['rects'][o['si']]; im=sheets[sh].crop((sx,sy,sx+ww,sy+hh))
    out.alpha_composite(im,(int(o['ix']-ww/2),int(o['iy']-hh)))
crop=sys.argv[2:] and list(map(int,sys.argv[2:])) or None
if crop: out=out.crop(crop)
out.save(f'/tmp/claude-0/shots/iso_{name}.png'); print(out.size)
