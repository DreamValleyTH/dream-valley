# NPC + player sprite atlases and portraits.  python3 build_chars.py <assets dir>
import sys, os, json
from PIL import Image
PL='/home/claude/artsrc'; OUT=sys.argv[1]
MAP={'kamnan_prasert':'prasert','phuyai_somsak':'somsak','nayok_wichai':'wichai','palm':'palm','dab_sathian':'sathian','mor_ann':'ann',
 'kru_toey':'toey','phra_sumet':'sumet','lung_jamrat':'jamrat','nen_ton':'ton','pa_taeo':'taew','sia_heng':'heng','je_hong':'hong',
 'mod_pharmacist':'mod','tum':'tam','chang_piak':'piak','lung_choed':'cherd','pi_noi':'noi','kla':'kla','yai_bua':'bua','ta_phueak':'phueak',
 'lung_phran_daeng':'daeng','pa_thongbai':'thongbai','lung_sommai':'sommai','pa_phon':'porn','nong_mew':'mew','nong_oat':'oat',
 'yai_chan':'chan','nok':'nok','ball':'ball','khun_thana':'thana','may':'may','praew':'praew'}
DIRS=['south','north','east','west']
def LP(p): return Image.open(os.path.join(PL,p)).convert('RGBA')
COLS=21  # 0-5 walk · 6-20 idle (up to 15 frames) ; row 4 = sit (south)
def offset(first, ref):
    """offset that puts a larger PixelLab canvas onto the 64px grid: its frame 0 (the reference pose) lands on ref's pose"""
    if first.size==(64,64): return (0,0)
    a=first.getbbox(); r=ref.getbbox()
    return (int(round((r[0]+r[2])/2-(a[0]+a[2])/2)), r[3]-a[3])
def put(at, im, off, x, y):
    cell=Image.new('RGBA',(64,64)); cell.paste(im,off,im); at.alpha_composite(cell,(x,y))
def seq(base,anim,d):
    out=[]; i=0
    while os.path.exists(os.path.join(PL,f'{base}/Idle/animations/{anim}/{d}/frame_{i:03d}.png')):
        out.append(LP(f'{base}/Idle/animations/{anim}/{d}/frame_{i:03d}.png')); i+=1
    return out
def atlas(base,key):
    at=Image.new('RGBA',(COLS*64,5*64)); m={'idle':[], 'sit':0}
    for r,d in enumerate(DIRS):
        ref=LP(f'{base}/Idle/rotations/{d}.png')
        walk=seq(base,'walking',d) or [ref]*6
        br=seq(base,'breathing_idle',d) or [ref]
        idle=[]  # breathing only (user: idle should be a subtle breath)
        if idle: off=offset(idle[0],br[0]); idle=idle[1:]+idle[:1]
        else: idle=br; off=(0,0)
        for c,im in enumerate(walk[:6]): put(at,im,offset(walk[0],br[0]),c*64,r*64)
        for c,im in enumerate(idle[:15]): put(at,im,off,(6+c)*64,r*64)
        m['idle'].append(len(idle[:15]))
        if r==0: feet=br[0].getbbox()[3]; br0=br[0]
    sit=seq(base,'sit_rest','south')
    if sit:
        off=offset(sit[0],br0)
        for c,im in enumerate(sit[1:COLS+1]): put(at,im,off,c*64,4*64)
        m['sit']=len(sit[1:COLS+1])
    at.save(f'{OUT}/chars/{key}.png')
    m['feet']=feet; meta[key]=m
    im=LP(f'{base}/Idle/rotations/south.png'); bb=im.getbbox(); cx=(bb[0]+bb[2])//2
    if key not in KEEP_PORTRAIT:
        head=im.crop((cx-16,bb[1]-2,cx+16,bb[1]+30)); head.resize((128,128),Image.NEAREST).save(f'{OUT}/portraits/{key}.png')
import glob as _g
KEEP_PORTRAIT={os.path.basename(f)[:-4] for f in _g.glob('/home/claude/art_work/portraits/*.png')}  # PixelLab portraits
os.makedirs(OUT+'/chars',exist_ok=True); os.makedirs(OUT+'/portraits',exist_ok=True)
meta={}
for folder,key in MAP.items(): atlas(f'npc_all/{folder}',key)
atlas('p1_player_frames/m_A_anim','player_m'); atlas('p1_player_frames/f_A_anim','player_f')
json.dump(meta,open(OUT+'/chars/meta.json','w'))
print(len(meta))
