"""Cell-grid terrain -> smooth, curved pixel masks (rounded blobs + Chaikin-smoothed centre-line strokes)."""
import numpy as np
from scipy import ndimage
from skimage.morphology import skeletonize
N8=[(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]
def trace(sk):
    """skeleton (bool HxW) -> list of polylines [(x,y),...] in cell coords"""
    pts=set(zip(*np.nonzero(sk.T)))  # (x,y)
    nb=lambda p:[(p[0]+dx,p[1]+dy) for dx,dy in N8 if (p[0]+dx,p[1]+dy) in pts]
    deg={p:len(nb(p)) for p in pts}
    nodes={p for p in pts if deg[p]!=2}
    used=set(); lines=[]
    def walk(a,b):
        line=[a,b]; prev,cur=a,b
        while cur not in nodes:
            nxt=[q for q in nb(cur) if q!=prev and frozenset((cur,q)) not in used]
            if not nxt: break
            # prefer 4-neighbours to avoid diagonal shortcuts
            nxt.sort(key=lambda q:abs(q[0]-cur[0])+abs(q[1]-cur[1]))
            used.add(frozenset((cur,nxt[0]))); prev,cur=cur,nxt[0]; line.append(cur)
        return line
    for n in nodes:
        for q in nb(n):
            e=frozenset((n,q))
            if e in used: continue
            used.add(e); lines.append(walk(n,q))
    # pure loops
    for p in pts:
        for q in nb(p):
            e=frozenset((p,q))
            if e not in used: used.add(e); nodes.add(p); lines.append(walk(p,q)); nodes.discard(p)
    return lines
def chaikin(l,it=3):
    l=np.array(l,float)
    for _ in range(it):
        if len(l)<3: break
        q=.75*l[:-1]+.25*l[1:]; r=.25*l[:-1]+.75*l[1:]
        mid=np.empty((len(q)*2,2)); mid[0::2]=q; mid[1::2]=r
        l=np.vstack([l[:1],mid,l[-1:]])
    return l
def stroke(shape,T,lines_w):
    H,W=shape; m=np.zeros((H*T,W*T),bool)
    for l,wid in lines_w:
        P=(l+.5)*T; r=wid*T/2
        for (x0,y0),(x1,y1) in zip(P[:-1],P[1:]):
            xa,xb=int(max(0,min(x0,x1)-r-1)),int(min(W*T,max(x0,x1)+r+2)); ya,yb=int(max(0,min(y0,y1)-r-1)),int(min(H*T,max(y0,y1)+r+2))
            if xa>=xb or ya>=yb: continue
            yy,xx=np.mgrid[ya:yb,xa:xb]+.5
            dx,dy=x1-x0,y1-y0; l2=dx*dx+dy*dy or 1e-9
            t=np.clip(((xx-x0)*dx+(yy-y0)*dy)/l2,0,1)
            m[ya:yb,xa:xb]|=np.hypot(xx-(x0+t*dx),yy-(y0+t*dy))<r
    return m
def smooth_mask(cm,T,kind):
    pad=np.pad(cm,1,mode='edge')
    din=ndimage.distance_transform_edt(pad); dout=ndimage.distance_transform_edt(~pad)
    sd=np.where(pad,din-.5,-(dout-.5))
    sd=ndimage.gaussian_filter(sd,{'paddy':.6,'water':1.0,'asphalt':1.6}.get(kind,.9))
    blob=ndimage.zoom(sd,T,order=3)[T:-T,T:-T]>-.12
    if kind not in ('asphalt','concrete','laterite','path','water'): return blob
    sk=skeletonize(cm); dist=ndimage.distance_transform_edt(np.pad(cm,1))[1:-1,1:-1]
    lw=[]
    for l in trace(sk):
        if len(l)<2: continue
        ws=[dist[y,x] for x,y in l]; wid=max(.95,2*np.median(ws)-1)*.92
        lw.append((chaikin(l),wid))
    return blob|stroke(cm.shape,T,lw)
