import json, sys
from PIL import Image
A=sys.argv[1]; name=sys.argv[2]; out=sys.argv[3]
W=json.load(open(A+'/world.json')); m=W['maps'][name]; at=W['atlas']
sheets=[Image.open(A+'/'+s) for s in at['sheets']]
bg=Image.open(A+'/'+m['bg']).convert('RGBA')
for o in sorted(m['objects'], key=lambda o:o['y']):
    sh,x,y,w,h=at['rects'][o['s']]; im=sheets[sh].crop((x,y,x+w,y+h))
    bg.alpha_composite(im,(o['x']-w//2,o['y']-h))
bg.save(out)
