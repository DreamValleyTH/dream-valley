import sys, json, time
sys.path.insert(0, '/mnt/user-data/uploads/Dream_Valley/art_tools_pl'); import pl
from PIL import Image
def paint(src, out, method='edit_with_reference', desc=None, seed=None):
    im = Image.open(src).convert('RGB'); w, h = im.size
    ref = Image.open(__import__('os').environ.get('REF','ref_sample.jpg')).convert('RGB'); ref = ref.resize((512, int(512 * ref.height / ref.width)), Image.LANCZOS)
    body = dict(method=method, edit_images=[dict(image=pl.b64img(im), width=w, height=h)], image_size=dict(width=w, height=h))
    if method == 'edit_with_reference': body['reference_image'] = dict(image=pl.b64img(ref), width=ref.width, height=ref.height)
    else: body['description'] = desc
    if seed is not None: body['seed'] = seed
    b0 = pl.balance(); r = pl.call('POST', '/edit-images-v2', body); js = pl.wait_jobs(r)
    j = js[0]; lr = j.get('last_response') or {}
    imgs = lr.get('images') or lr.get('edited_images') or []
    if not imgs: print(json.dumps(j)[:800]); return
    pl.to_img(imgs[0]).save(out); b1 = pl.balance(); print(out, 'balance', b0, '->', b1)
if __name__ == '__main__':
    paint(sys.argv[1], sys.argv[2], *(sys.argv[3:4] or ['edit_with_reference']), desc=(sys.argv[4] if len(sys.argv) > 4 else None))
