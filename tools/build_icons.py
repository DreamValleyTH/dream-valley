import sys, os, json
from PIL import Image
SRC='/home/claude/artsrc/icons_all'; OUT=sys.argv[1]
names=sorted(n[:-4] for n in os.listdir(SRC) if n.endswith('.png') and not n.startswith('c4_extra'))
cols=32; rows=(len(names)+cols-1)//cols
im=Image.new('RGBA',(cols*32,rows*32))
for i,n in enumerate(names): im.alpha_composite(Image.open(f'{SRC}/{n}.png').convert('RGBA').resize((32,32),Image.NEAREST),((i%cols)*32,(i//cols)*32))
im.save(OUT+'/icons_all.png'); json.dump({n:i for i,n in enumerate(names)},open(OUT+'/icons_index.json','w'))
print(len(names), im.size)
