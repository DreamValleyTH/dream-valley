import json, yaml, glob, os, re, collections
W='/home/claude/work'; G='/home/claude/game'
world=json.load(open(f'{G}/assets/world.json'))
places=set(world['maps']['town']['places'])|set(world['maps']['farm']['places'])
cat=json.load(open(f'{W}/ref/items_catalog.json'))
BASE={'chili','basil','corn','morning_glory','mango','tamarind','wood','stone','ant_egg','mushroom','mush2','marble','honey','worm','khaijiao','kaprao'}
items=BASE|{k for k,v in cat.items() if v.get('icon')}
npcs=set(json.load(open(f'{G}/assets/chars/meta.json')))-{'player_m','player_f'}
probs=collections.Counter(); notes=[]
def chk_opts(opts, where):
    for o in opts or []:
        if not isinstance(o,dict) or 'text' not in o: probs['bad_option']+=1; continue
        for k in (o.get('take') or {}):
            if k not in items: notes.append(f'{where}: take unknown item {k}')
        chk_opts(o.get('next'), where)
for f in sorted(glob.glob(f'{W}/dialogue/*.yaml')):
    nid=os.path.basename(f)[:-5]
    try: y=yaml.safe_load(open(f))
    except Exception as e: notes.append(f'YAML {nid}: {e}'); continue
    for c in y.get('convos') or []:
        chk_opts(c.get('options'), c.get('id'))
        w=c.get('when') or {}
        if w.get('has_item') and w['has_item'] not in items: notes.append(f"{c['id']}: has_item {w['has_item']}")
    for q in y.get('quests') or []:
        for i,s in enumerate(q.get('steps') or []):
            g=s.get('goal') or {}; t=g.get('type')
            if t not in ('talk','give','have','pay','visit','days','flag'): notes.append(f"{q['id']}#{i}: goal type {t}")
            if g.get('npc') and g['npc'] not in npcs: notes.append(f"{q['id']}#{i}: npc {g['npc']}")
            if g.get('item') and g['item'] not in items: notes.append(f"{q['id']}#{i}: item {g['item']}")
            if t=='visit' and g.get('place') not in places: notes.append(f"{q['id']}#{i}: place {g.get('place')}")
        r=q.get('reward') or {}
        for k in (r.get('items') or {}):
            if k not in items: notes.append(f"{q['id']}: reward item {k}")
        for k,v in (q.get('sold_at') or {}).items():
            if v and v not in places: notes.append(f"{q['id']}: sold_at place {v}")
print(dict(probs)); print('\n'.join(notes[:200])); print(len(notes),'notes')
