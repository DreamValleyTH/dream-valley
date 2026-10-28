# Compile all writing (YAML) + catalogs into JS data files the game loads without fetch (works from file:// and hosted).
#   python3 compile_data.py <work dir> <game dir>
import sys, os, json, glob, yaml, re
WORK, GAME = sys.argv[1], sys.argv[2]
REF = f'{WORK}/ref'

def ly(p):
    try: return yaml.safe_load(open(p, encoding='utf-8')) or {}
    except Exception as e:
        print('YAML ERROR', p, str(e)[:200]); return {}

NPC_IDS = ['taew', 'prasert', 'praew', 'somsak', 'wichai', 'palm', 'sathian', 'ann', 'toey', 'sumet', 'jamrat', 'ton', 'heng', 'hong', 'mod',
           'tam', 'piak', 'cherd', 'noi', 'kla', 'bua', 'phueak', 'daeng', 'thongbai', 'sommai', 'porn', 'mew', 'oat', 'chan', 'nok', 'ball', 'thana', 'may']
KEEP = None  # keep all line categories
npcs = {}
stats = {}
for nid in NPC_IDS:
    base = ly(f'{REF}/{nid}.yaml')
    new = ly(f'{WORK}/dialogue/{nid}.yaml') if os.path.exists(f'{WORK}/dialogue/{nid}.yaml') else {}
    convos = list(new.get('convos') or [])
    if nid == 'taew':
        convos = list(base.get('convos') or []) + convos
    fpath = f'{WORK}/dialogue_f/{nid}.yaml'
    if os.path.exists(fpath):
        fc = [c for c in (ly(fpath).get('convos') or []) if isinstance(c, dict)]
        for c in fc: c.setdefault('when', {}); c['when'] = c['when'] or {}; c['when']['gender'] = 'f'
        convos += fc
    # keep only well-formed convos
    def ok(c): return isinstance(c, dict) and c.get('id') and c.get('npc') and isinstance(c.get('options'), list) and c['options']
    convos = [c for c in convos if ok(c)]
    quests = [q for q in (new.get('quests') or []) if isinstance(q, dict) and q.get('id') and q.get('steps')]
    npcs[nid] = dict(id=nid, name=base.get('name', nid), role=base.get('role', ''), romance=bool(base.get('romanceable')),
                     lines=base.get('lines') or {}, gifts=base.get('gifts') or {}, choices=base.get('choices') or [],
                     banter=base.get('banter') or [], convos=convos, quests=quests)
    stats[nid] = (len(convos), len(quests))

story = ly(f'{WORK}/story/story.yaml') if os.path.exists(f'{WORK}/story/story.yaml') else {}
line = ly(f'{WORK}/story/line.yaml') if os.path.exists(f'{WORK}/story/line.yaml') else {}
amb = ly(f'{WORK}/story/ambient.yaml') if os.path.exists(f'{WORK}/story/ambient.yaml') else {}
groups = (ly(f'{WORK}/story/line_groups.yaml') or {}).get('groups') or [] if os.path.exists(f'{WORK}/story/line_groups.yaml') else []
gecko = ly(f'{WORK}/story/gecko.yaml') if os.path.exists(f'{WORK}/story/gecko.yaml') else {}
parents = ly(f'{REF}/parents.yaml'); villager = ly(f'{REF}/villager.yaml')

cat = json.load(open(f'{REF}/items_catalog.json', encoding='utf-8'))
os.makedirs(f'{GAME}/data', exist_ok=True)
def w(name, var, obj):
    with open(f'{GAME}/data/{name}', 'w', encoding='utf-8') as f:
        f.write(f'window.{var}=' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n')
w('npcs.js', 'DV_NPCS', npcs)
w('story.js', 'DV_STORY', dict(scenes=story.get('scenes') or [], outline=story.get('outline'),
                              line=line, groups=groups, gecko=gecko, ambient=amb, parents=parents.get('lines') or {}, villager=dict(lines=villager.get('lines') or {},
                              ambient=villager.get('ambient') or {}, line_group=villager.get('line_group') or [])))
w('catalog.js', 'DV_CATALOG', cat)
tot = sum(a for a, b in stats.values()); totq = sum(b for a, b in stats.values())
print('npcs', len(npcs), 'convos', tot, 'quests', totq, 'scenes', len(story.get('scenes') or []),
      'posts', len((line or {}).get('posts') or []))
for k, v in stats.items():
    if v[0] < 10: print('  thin:', k, v)

A = f'{GAME}/assets'
w('world.js', 'DV_WORLD', json.load(open(f'{A}/world.json')))
w('meta.js', 'DV_CMETA', json.load(open(f'{A}/chars/meta.json')))
with open(f'{GAME}/data/meta.js', 'a', encoding='utf-8') as f:
    f.write('window.DV_CROPMETA=' + json.dumps(json.load(open(f'{A}/crops_meta.json'))) + ';\n')
    f.write('window.DV_ICONS=' + json.dumps(json.load(open(f'{A}/icons_index.json'))) + ';\n')
print('world/meta ok')
SA = sorted(f[:-4] for f in os.listdir(f'{A}/story') if f.endswith('.png')) if os.path.isdir(f'{A}/story') else []
with open(f'{GAME}/data/meta.js', 'a', encoding='utf-8') as f: f.write('window.DV_STORYART=' + json.dumps(SA) + ';\n')
print('story art', len(SA))
