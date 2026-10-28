# Quantize big opaque PNGs (iso ground, story art) to 256 colours: ~60% smaller, no visible change for pixel art
import sys, os
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f); b = os.path.getsize(f)
    if im.mode == 'P': continue
    rgba = im.convert('RGBA'); opaque = rgba.getextrema()[3][0] == 255
    q = (rgba.convert('RGB') if opaque else rgba).quantize(colors=256, method=Image.Quantize.MEDIANCUT if opaque else Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(f, optimize=True); print(os.path.basename(f), b // 1024, '->', os.path.getsize(f) // 1024, 'KB')
