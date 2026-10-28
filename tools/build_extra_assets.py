# Extra sprite sheets for the tap-control scene (trees, foraging, food). Uses ONLY existing art — no PixelLab credits.
#   python build_extra_assets.py <unzipped art_pl dir (has icons_all/, tools_64/)> <web/farm_yai dir>
import sys
from PIL import Image
SRC, OUT = sys.argv[1], sys.argv[2]
A = OUT + '/assets'
# tools.png: hoe, watering can, sickle, hand trowel, bucket, axe, pruning saw, rake  (index = TOOL in game.js)
TOOLS = [0, 1, 4, 7, 37, 2, 28, 10]
tl = Image.new('RGBA', (32 * len(TOOLS), 32))
for i, n in enumerate(TOOLS):
    tl.alpha_composite(Image.open(f'{SRC}/tools_64/{n:02d}.png').convert('RGBA').resize((32, 32), Image.NEAREST), (i * 32, 0))
tl.save(A + '/tools.png')
# icons2.png: goods from trees / hidden spots / food  (index = ITEMS[*].ic in game.js)
ICONS2 = ['crop_mango', 'item_fruit_basket', 'misc_wood', 'misc_stone', 'item_red_ant_egg', 'item_het_ranghin',
          'item_het_rakhang', 'item_marble', 'item_wild_honey', 'item_rusty_nail', 'food_khai_jiao', 'item_money_envelope',
          'item_earthworm', 'food_kaprao']
ic = Image.new('RGBA', (32 * len(ICONS2), 32))
for i, n in enumerate(ICONS2):
    ic.alpha_composite(Image.open(f'{SRC}/icons_all/{n}.png').convert('RGBA').resize((32, 32), Image.NEAREST), (i * 32, 0))
ic.save(A + '/icons2.png')
print('ok', len(TOOLS), 'tools,', len(ICONS2), 'icons')
