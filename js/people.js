// Dream Valley — people: schedules, talk (convos), gifts, shops, side quests, ambient chatter
(() => {
'use strict';
const DV = window.DV, $ = DV.$;
const NPCS = window.DV_NPCS;
const S = () => DV.S;
const ic = n => ['icons', DV.icon(n)];

// ---------- schedules (SPEC §3) ----------
const SCHED = {
  taew: [{ map: 'farm', place: 'farm_visit', from: 7, to: 9, days: d => d <= 3 || d % 4 === 0 }, { place: 'taew_shop', from: 6, to: 20 }],
  prasert: [{ place: 'obt', from: 8, to: 12 }, { place: 'kamnan_house', from: 12, to: 18 }],
  praew: [{ place: 'coffee', from: 9, to: 14 }, { place: 'kamnan_house', from: 14, to: 19 }],
  somsak: [{ place: 'sala', from: 6, to: 18 }], wichai: [{ place: 'obt', from: 9, to: 16 }],
  palm: [{ place: 'obt', from: 8, to: 12 }, { place: 'coop_garden', from: 12, to: 17 }],
  sathian: [{ place: 'police', from: 8, to: 11 }, { place: 'taew_shop', from: 11, to: 14 }, { place: 'police', from: 14, to: 20 }],
  ann: [{ place: 'clinic', from: 8, to: 17 }], toey: [{ place: 'school', from: 7, to: 16 }],
  sumet: [{ place: 'temple', from: 6, to: 18 }], jamrat: [{ place: 'temple', from: 6, to: 18 }], ton: [{ place: 'temple', from: 6, to: 18 }],
  heng: [{ place: 'heng_shop', from: 7, to: 12 }, { place: 'rice_yard', from: 12, to: 18 }], hong: [{ place: 'market', from: 6, to: 14 }],
  mod: [{ place: 'pharmacy', from: 8, to: 20 }], tam: [{ place: 'store24', from: 16, to: 24 }], piak: [{ place: 'workshop', from: 8, to: 17 }],
  cherd: [{ place: 'bus_stop', from: 6, to: 19 }], noi: [{ place: 'noi_noodle', from: 7, to: 15 }], kla: [{ place: 'coop_garden', from: 6, to: 18 }],
  bua: [{ place: 'house_bua', from: 6, to: 19 }], phueak: [{ place: 'pasture', from: 7, to: 17 }], daeng: [{ place: 'forest_edge', from: 6, to: 17 }],
  thongbai: [{ place: 'temple', from: 6, to: 10 }, { place: 'house_thongbai', from: 10, to: 18 }],
  sommai: [{ place: 'house_sommai', from: 7, to: 19 }], porn: [{ place: 'taew_shop', from: 8, to: 11 }, { place: 'house_sommai', from: 11, to: 19 }],
  mew: [{ place: 'school', from: 7, to: 15 }, { place: 'sala', from: 15, to: 18 }], oat: [{ place: 'school', from: 7, to: 15 }, { place: 'sala', from: 15, to: 18 }],
  chan: [{ place: 'house_chan', from: 7, to: 18 }], nok: [{ place: 'nok_house', from: 8, to: 20, days: d => [6, 7].includes(DV.weekday(d)) }],
  ball: [{ place: 'garage', from: 8, to: 19 }], thana: [{ place: 'company_office', from: 9, to: 17 }], may: [{ place: 'coffee', from: 9, to: 20 }],
};
DV.SCHED = SCHED;
const PLACE_MAP = p => (DV.MAPS.farm.places[p] ? 'farm' : 'town');
DV.whereIs = id => {
  const s = S(), h = 6 + s.min / 60;
  for (const e of SCHED[id] || []) {
    if (h < e.from || h >= e.to) continue;
    if (e.days && !e.days(s.day)) continue;
    return { map: e.map || PLACE_MAP(e.place), place: e.place };
  }
  return null;
};
DV.npcsWanted = map => Object.keys(NPCS).map(id => ({ id, w: DV.whereIs(id) })).filter(x => x.w && x.w.map === map).map(x => ({ id: x.id, place: x.w.place }));
DV.npcName = id => (NPCS[id] && NPCS[id].name) || ({ mom: 'แม่', dad: 'พ่อ', narrator: '', player: DV.S ? DV.S.name : 'ฉัน', boss: 'หัวหน้า', grandma: 'ยายเพียร', villager: 'ชาวบ้าน' }[id] ?? id);
const EXTRA_POR = ['grandma', 'mom', 'dad', 'boss'];   // story-only speakers (not villagers you can meet)
DV.portrait = id => NPCS[id] || EXTRA_POR.includes(id) ? `assets/portraits/${id}.png` : id === 'player' ? `assets/portraits/player_${DV.S.gender}.png` : null;
const hearts = id => { const h = DV.heart(id); return '♥'.repeat(Math.floor(h / 2)) + (h % 2 ? '♡' : '') + `  (${h}/10)`; };

// ---------- lines ----------
function greetLine(id) {
  const n = NPCS[id], L = n.lines || {}, s = S(), h = 6 + s.min / 60, hh = DV.heart(id);
  const p = k => L[k] && L[k].length ? DV.pick(L[k]) : null;
  if (s.flags.faintedDay && s.day - s.flags.faintedDay <= 1 && p('player_fainted') && Math.random() < .6) return p('player_fainted');
  if (s.rain && Math.random() < .4 && p('weather_rain')) return p('weather_rain');
  if (Math.random() < .05 && p('rare')) return p('rare');
  if (Math.random() < .35) { const k = hh >= 7 ? 'heart_high' : hh >= 4 ? 'heart_mid' : 'heart_low'; if (p(k)) return p(k); }
  return p(h < 11 ? 'greet_morning' : h < 15 ? 'greet_noon' : h < 20 ? 'greet_evening' : 'greet_night') || p('heart_low') || '…';
}

// ---------- convos ----------
const TOPICS = [['ถามข่าว', 'news', 'topic_news'], ['ขอคำแนะนำ', 'advice', 'topic_advice'], ['คุยเล่น', 'smalltalk', 'topic_smalltalk'],
  ['ถามเรื่องเขา', 'self', 'topic_about_self'], ['ถามถึงคนอื่น', 'others', 'topic_about_others']];
const convosOf = id => {
  const n = NPCS[id];
  if (!n._all) n._all = [...(n.convos || []), ...(n.choices || []).map(c => ({ id: c.id, topic: 'react', once: true, when: { heart_min: c.min_heart || 0 }, npc: c.prompt, options: c.options }))];
  return n._all;
};
function convoOk(c, id) {
  const s = S(), seen = s.convo[c.id];
  if (c.once && seen != null) return false;
  if (seen != null && s.day - seen < 7) return false;
  if (seen === s.day) return false;
  return DV.cond(c.when, { npc: id });
}
const pickConvo = (id, topic) => { const l = convosOf(id).filter(c => c.topic === topic && convoOk(c, id)); if (!l.length) return null;
  const g = l.filter(c => c.when && c.when.gender);   // gender-specific talk comes up more often while it's fresh
  if (g.length && Math.random() < .6) return topic === 'react' ? g[0] : DV.pick(g);
  return topic === 'react' ? l[0] : DV.pick(l); };
DV.pickConvo = pickConvo;
function convoHeart(id, n) {
  if (!n) return;
  const s = S(); let ch = s.convoHeart[id]; if (!ch || ch.d !== s.day) ch = s.convoHeart[id] = { d: s.day, got: 0 };
  if (n > 0) { n = Math.min(n, 3 - ch.got); if (n <= 0) return; ch.got += n; }
  DV.addHeart(id, n);
  const e = DV.npcsHere.find(x => x.id === id);
  if (e) DV.floatText(e.x, e.y - 64, n > 0 ? `♥ +${n}` : `♥ ${n}`, n > 0 ? '#ffb3c1' : '#c9c9d6');
  DV.sfx(n > 0 ? 'heart' : 'tick'); DV.hud();
}
let talkId = null;
function showTalk(id, text, options, onDone) {
  DV.closeSheet(); talkId = id; DV._talkTo = id;
  $('talkPortrait').style.backgroundImage = `url(${DV.portrait(id)})`;
  $('talkName').textContent = DV.npcName(id); $('talkText').textContent = DV.say(text);
  const ch = $('talkChoices'); ch.innerHTML = '';
  const ok = (options || []).filter(o => !o.take || Object.keys(o.take).every(k => DV.has(k, o.take[k])));
  ok.forEach(o => {
    const b = document.createElement('button'); b.className = 'say'; b.textContent = DV.say(o.text);
    b.onclick = () => {
      if (o.take) for (const k in o.take) DV.addItem(k, -o.take[k]);
      if (o.set_flag) DV.setFlag(o.set_flag);
      if (o.effect) DV.applyEffect(o.effect, { npc: id });
      convoHeart(id, o.heart || 0); DV.save();
      if (o.next && o.next.length) showTalk(id, o.reply, o.next, onDone);
      else if (onDone) onDone(o); else afterConvo(id, o.reply);
    };
    ch.appendChild(b);
  });
  if (!ok.length) afterConvo(id, text);
  $('talk').classList.remove('hidden'); DV.sfx('talk');
}
DV.showTalk = showTalk;
// a talk box for non-NPCs (the gecko, signs…): name + picture + narration + options with replies
DV.showTalkFree = (name, pic, text, options) => {
  DV.closeSheet(); talkId = null;
  $('talkPortrait').style.backgroundImage = `url(${pic})`; $('talkName').textContent = name; $('talkText').textContent = DV.say(text);
  const ch = $('talkChoices'); ch.innerHTML = '';
  const end = () => { const b = document.createElement('button'); b.textContent = 'ไปก่อนนะ'; b.onclick = () => $('talk').classList.add('hidden'); ch.appendChild(b); };
  (options || []).forEach(o => { const b = document.createElement('button'); b.className = 'say'; b.textContent = DV.say(o.text);
    b.onclick = () => { $('talkText').textContent = DV.say(o.reply || ''); ch.innerHTML = ''; end(); DV.sfx('talk'); }; ch.appendChild(b); });
  if (!options || !options.length) end();
  $('talk').classList.remove('hidden'); DV.sfx('talk');
};
function runConvo(id, c) { S().convo[c.id] = S().day; if (c.set_flag) DV.setFlag(c.set_flag); showTalk(id, c.npc, c.options); }
function afterConvo(id, text) {
  $('talkText').textContent = DV.say(text);
  const ch = $('talkChoices'); ch.innerHTML = '';
  const add = (lbl, fn) => { const b = document.createElement('button'); b.textContent = lbl; b.onclick = fn; ch.appendChild(b); };
  add('คุยเรื่องอื่น', () => topics(id, DV.pick(['ว่าไง มีอะไรอีก', 'แล้วไงต่อ', 'ถามมาเลย', 'อืม… อะไรอีกล่ะ'])));
  add(DV.say('ไปก่อนนะ{kq}'), () => { if (id && DV.maybeGroupInvite && DV.maybeGroupInvite(id)) return; closeTalk(); DV.maybeRandomCard(0.08); });
  $('talk').classList.remove('hidden');
}
function topics(id, text) {
  DV.closeSheet(); talkId = id;
  $('talkPortrait').style.backgroundImage = `url(${DV.portrait(id)})`;
  $('talkName').textContent = DV.npcName(id); $('talkText').textContent = DV.say(text);
  const ch = $('talkChoices'); ch.innerHTML = '';
  const add = (lbl, fn) => { const b = document.createElement('button'); b.textContent = lbl; b.onclick = fn; ch.appendChild(b); };
  const L = NPCS[id].lines || {};
  TOPICS.forEach(([l, t, k]) => {
    const c = pickConvo(id, t);
    if (c) add(l, () => runConvo(id, c));
    else if (L[k] && L[k].length) add(l, () => afterConvo(id, DV.pick(L[k])));
  });
  add(DV.say('ไปก่อนนะ{kq}'), () => { if (id && DV.maybeGroupInvite && DV.maybeGroupInvite(id)) return; closeTalk(); DV.maybeRandomCard(0.08); });
  $('talk').classList.remove('hidden'); DV.sfx('talk');
}
function closeTalk() { $('talk').classList.add('hidden'); talkId = null; DV.afterTalk && DV.afterTalk(); }
DV.closeTalk = closeTalk;
DV.talkTo = id => {
  const s = S();
  DV.doAction({ energy: 1, fx: 'heart', after: () => {
    const first = !s.flags['met_' + id];
    const r = s.reactDay[id] !== s.day && pickConvo(id, 'react');
    DV.setFlag('met_' + id);
    if (s.talked[id] !== s.day) { s.talked[id] = s.day; DV.addHeart(id, first ? 0 : 1); DV.stat('talks'); DV.hud(); }
    if (r) { s.reactDay[id] = s.day; runConvo(id, r); } else topics(id, greetLine(id));
  } });
};

// ---------- gifts ----------
const giftLevel = (id, itemId) => {
  const g = NPCS[id].gifts || {}, nm = DV.item(itemId).name;
  const hit = arr => (arr || []).some(x => nm.includes(x) || x.includes(nm.replace(/\s*\(.*\)/, '')));
  return hit(g.love) ? 'love' : hit(g.like) ? 'like' : hit(g.hate) ? 'hate' : hit(g.dislike) ? 'dislike' : 'neutral';
};
function giftMenu(id) {
  const s = S(), L = NPCS[id].lines || {};
  const opts = Object.keys(s.items).filter(k => s.items[k] > 0).map(k => ({ label: `ให้${DV.item(k).name}`, icon: ic(DV.item(k).icon), extra: `มี ${s.items[k]}`,
    run: () => { DV.closeSheet(); DV.addItem(k, -1); s.gifted[id] = s.day; const lv = giftLevel(id, k);
      const dh = { love: 3, like: 2, neutral: 1, dislike: -1, hate: -2 }[lv]; DV.addHeart(id, dh); DV.stat('gifts'); DV.hud(); DV.save();
      DV._item = DV.item(k).name;
      const line = DV.pick(L['gift_' + lv] || L.gift_neutral || ['ขอบใจนะ']);
      showTalk(id, line, [], null); DV._item = ''; } }));
  if (!opts.length) return DV.toast('ยังไม่มีของในกระเป๋า');
  DV.openSheet(`ให้ของ ${DV.npcName(id)}`, 'ของขวัญที่ถูกใจได้หัวใจมากกว่า · วันละ 1 ชิ้นต่อคน', null, opts, { portrait: id });
}

// ---------- shops ----------
const SHOPS = {
  taew_shop: { owner: 'taew', name: 'ร้านชำป้าแต๋ว', seeds: true, sells: ['khaijiao', 'kaprao', 'instant_noodle', 'canned_fish', 'egg_chicken', 'salted_egg', 'energy_drink', 'iced_coffee', 'khanom_pia', 'snack', 'fish_sauce_good', 'folder', 'lottery_ticket'], buys: 'all', mul: 1 },
  noi_noodle: { owner: 'noi', name: 'ร้านก๋วยเตี๋ยวพี่หน่อย', sells: ['kuay_tiew_ruea', 'kaprao', 'khai_jiao', 'pad_thai', 'tom_jued', 'khao_man_kai', 'tomyum'], eatHere: true },
  store24: { owner: null, name: 'ร้าน 24 ชม.', open: [0, 24], sells: ['instant_noodle', 'meatball_fried', 'soy_milk_set', 'energy_drink', 'iced_coffee', 'snack', 'khanom_chan', 'hand_towel'] },
  pharmacy: { owner: 'mod', name: 'ร้านขายยาภก.มด', sells: ['herbal_tea', 'plai', 'turmeric', 'hand_towel', 'energy_drink', 'herbal_med_set'] },
  heng_shop: { owner: 'heng', name: 'ร้านปุ๋ยยาเสี่ยเฮง', seeds: true, sells: ['chick', 'chicken_feed', 'bio_ferment', 'hay_dry', 'tree_seedling', 'engine_oil'], buys: 'crops', mul: .9 },
  rice_yard: { owner: 'heng', name: 'ลานรับซื้อเสี่ยเฮง', buys: 'all', mul: .85 },
  market: { owner: 'hong', name: 'ตลาดนัด (แผงเจ๊หงษ์)', sells: ['moo_ping', 'khanom_krok', 'somtum', 'kai_yang', 'kluay_buat_chee', 'tangerine', 'boiled_peanut', 'egg_duck', 'lotus_flower', 'rose_mon', 'lottery_ticket'], buys: 'all', mul: 1.1 },
  coffee: { owner: null, name: 'ร้านกาแฟ', open: [7, 20], sells: ['iced_coffee', 'chinese_tea', 'lodchong', 'khanom_chan', 'coconut_smoothie'] },
  coop_garden: { owner: 'kla', name: 'สหกรณ์ผักอินทรีย์', seeds: true, sells: ['organic_veg', 'basil_seedling', 'tree_seedling', 'bio_ferment', 'heirloom_seed'], buys: 'crops', mul: 1.05 },
};
DV.SHOPS = SHOPS;
DV.addShopItem = (place, item) => { const sh = SHOPS[place]; if (sh && sh.sells && !sh.sells.includes(item)) sh.sells.push(item); };
const shopOpen = pid => { const sh = SHOPS[pid]; if (!sh) return false; if (sh.owner) { const w = DV.whereIs(sh.owner); return w && w.place === pid; } const h = 6 + S().min / 60; return h >= sh.open[0] && h < sh.open[1]; };
DV.shopOpen = shopOpen;
function buyMenu(pid) {
  const sh = SHOPS[pid], s = S(), opts = [];
  if (sh.seeds) Object.keys(DV.SEEDS).forEach(k => opts.push({ label: `เมล็ด${DV.SEEDS[k].name} 1 ซอง (10 เมล็ด)`, icon: ic(DV.SEEDS[k].icon), extra: `฿${DV.SEEDS[k].pack}`,
    disabled: s.money < DV.SEEDS[k].pack && 'เงินไม่พอ', run: () => { s.money -= DV.SEEDS[k].pack; s.seeds[k] = (s.seeds[k] || 0) + 10; DV.sfx('coin'); DV.hud(); DV.save(); DV.toast(`ได้เมล็ด${DV.SEEDS[k].name} 10 เมล็ด`); buyMenu(pid); } }));
  (sh.sells || []).forEach(k => { const it = DV.item(k); const price = it.buy || 20;
    opts.push({ label: it.name + (sh.eatHere && it.eat ? ' (กินที่ร้าน)' : ''), icon: ic(it.icon), extra: `฿${price}${it.eat ? ` · แรง +${it.eat}` : ''}`, disabled: s.money < price && 'เงินไม่พอ',
      run: () => { s.money -= price; DV.sfx('coin');
        if (sh.eatHere && it.eat) { DV.addEnergy(it.eat); DV.floatText(DV.player.x, DV.player.y - 60, `แรง +${it.eat}`, '#c8f59a'); DV.stat('meals'); DV.toast(`อร่อย! แรง +${it.eat}`); }
        else if (k === 'lottery_ticket') { DV.addItem(k); DV.buyLotto(1, price); DV.toast(`ได้สลาก 1 ใบ (หน้าตั๋ว ฿80 · ค่าความหวัง ฿${price - 80}) · ออกวันที่ ${DV.nextDraw()} 16:00`); }
        else if (DV.buyHook && DV.buyHook(k)) {}
        else { DV.addItem(k); DV.toast(`ซื้อ${it.name}แล้ว — อยู่ในกระเป๋า`); }
        DV.hud(); DV.save(); buyMenu(pid); } }); });
  DV.openSheet(sh.name, `เงิน ฿${s.money}`, null, opts, sh.owner ? { portrait: sh.owner } : null);
}
function sellMenu(pid) {
  const sh = SHOPS[pid], s = S();
  const bonus = sh.owner && DV.heart(sh.owner) >= 6 ? 1.1 : 1;
  const ok = k => sh.buys === 'all' || (sh.buys === 'crops' && DV.CROPS[k]);
  const opts = Object.keys(s.items).filter(k => s.items[k] > 0 && ok(k) && !DV.item(k).food && k !== 'lottery_ticket').map(k => {
    const price = Math.max(1, Math.round(DV.item(k).sell * (sh.mul || 1) * bonus * (DV.priceMult ? DV.priceMult(k) : 1)));
    return { label: `ขาย${DV.item(k).name}ทั้งหมด`, icon: ic(DV.item(k).icon), extra: `${s.items[k]} × ฿${price}${DV.priceTrend && DV.priceMult(k) !== 1 ? ' ' + DV.priceTrend(k) : ''}`,
      run: () => { const g = s.items[k] * price; s.money += g; delete s.items[k]; DV.stat('sold'); DV.stat('earned', g); DV.sfx('coin'); DV.hud(); DV.save();
        DV.floatText(DV.player.x, DV.player.y - 60, `+฿${g}`, '#fff1a0'); DV.toast(`ขายได้ ฿${g}`); sellMenu(pid); } };
  });
  if (!opts.length) { DV.closeSheet(); return DV.toast('ไม่มีของที่ร้านนี้รับซื้อ'); }
  DV.openSheet(`ขายของ — ${sh.name}`, (bonus > 1 ? 'สนิทกัน ได้ราคาพิเศษ +10% · ' : '') + 'ราคาผัก/ปลา/ไข่ ขึ้นลงทุกวัน ▲▼', null, opts, sh.owner ? { portrait: sh.owner } : null);
}
DV.buyMenu = buyMenu; DV.sellMenu = sellMenu;

// ---------- NPC & place menus ----------
DV.openNpc = id => {
  const s = S(), opts = [];
  opts.push({ label: 'คุย', icon: ic('item_money_envelope'), cost: 1, run: () => DV.talkTo(id) });
  DV.questOptions(id).forEach(o => opts.push(o));
  opts.push({ label: 'ให้ของ', icon: ic('item_gift_hamper_lux'), disabled: s.gifted[id] === s.day ? 'วันนี้ให้แล้ว' : (!Object.keys(s.items).length && 'ยังไม่มีของ'), run: () => giftMenu(id) });
  const shop = Object.keys(SHOPS).find(p => SHOPS[p].owner === id && DV.whereIs(id) && DV.whereIs(id).place === p);
  if (shop && SHOPS[shop].sells || shop && SHOPS[shop].seeds) opts.push({ label: 'ซื้อของ', icon: ic('item_money_envelope'), run: () => buyMenu(shop) });
  if (shop && SHOPS[shop].buys) opts.push({ label: 'ขายของ', icon: ic('crop_chili'), run: () => sellMenu(shop) });
  const n = NPCS[id];
  DV.openSheet(n.name, `<span class="hearts">${hearts(id)}</span><br><small>${n.role || ''}</small>`, null, opts, { portrait: id });
};
DV.openPlace = pid => {
  const s = S(), M = DV.M, pl = M.places[pid]; if (!pl) return;
  const here = DV.npcsHere.filter(n => n.place === pid);
  const opts = here.map(n => ({ label: `คุยกับ${DV.npcName(n.id)}`, icon: null, portrait: n.id, extra: DV.npcMark(n.id) === '!' ? 'มีงาน!' : hearts(n.id).split('  ')[0], run: () => { DV.closeSheet(); DV.face(n.cx, n.cy); DV.openNpc(n.id); } }));
  const sh = SHOPS[pid];
  if (sh) {
    if (shopOpen(pid)) { if (sh.sells || sh.seeds) opts.push({ label: 'ซื้อของ', icon: ic('item_money_envelope'), run: () => buyMenu(pid) }); if (sh.buys) opts.push({ label: 'ขายของ', icon: ic('crop_chili'), run: () => sellMenu(pid) }); }
    else opts.push({ info: true, label: 'ร้านปิดอยู่ตอนนี้' });
  }
  if (pid === 'temple') {
    opts.push({ label: 'เช่าผ้ายันต์ (กันผีคืนนี้)', icon: ic('item_amulet_charoensap'), extra: '฿99', disabled: s.amuletDay === s.day ? 'วันนี้เช่าแล้ว' : (s.money < 99 && 'เงินไม่พอ'),
      run: () => { s.money -= 99; s.amuletDay = s.day; DV.sfx('spark'); DV.hud(); DV.save(); DV.toast('ลุงจำรัสผูกผ้ายันต์ให้ “คืนเดียวนะหลาน พรุ่งนี้มาเช่าใหม่”'); DV.closeSheet(); } });
    opts.push({ label: 'ทำบุญใส่ตู้', icon: ic('item_money_envelope'), extra: '฿20 · ใจสบาย แรง +5', disabled: s.money < 20 && 'เงินไม่พอ',
      run: () => { s.money -= 20; DV.addEnergy(5); DV.stat('merit'); DV.hud(); DV.save(); DV.toast('สาธุ… ใจเบาขึ้น'); DV.closeSheet(); } });
  }
  if (pid === 'clinic' && here.length) opts.push({ label: 'ตรวจสุขภาพ (บัตรทอง)', icon: ic('item_herbal_med_set'), extra: 'ฟรี · แรง +10', disabled: s.flags['checkup' + s.day] && 'วันนี้ตรวจแล้ว',
    run: () => { s.flags['checkup' + s.day] = 1; DV.addEnergy(10); DV.hud(); DV.toast('หมอแอน: “พักผ่อนให้พอ กินข้าวให้ครบนะคะ”'); DV.closeSheet(); } });
  if (pid === 'bus_stop') opts.push({ label: 'ขึ้นรถเมล์ไปอำเภอ', icon: ic('item_folder'), extra: '฿30', run: () => { DV.closeSheet(); DV.toast('ลุงเชิด: “รอบอำเภอยังไม่เปิดนะหลาน ถนนกำลังซ่อม… ซ่อมมาสามปีแล้ว”'); } });
  DV.placeExtras && DV.placeExtras(pid, opts);
  if (!opts.length) opts.push({ info: true, label: s.min > 12 * 60 ? 'ไม่มีใครอยู่ตอนนี้ (ดึกแล้ว)' : 'ตอนนี้ไม่มีใครอยู่' });
  DV.openSheet(pl.name, here.length ? `อยู่ที่นี่: ${here.map(n => DV.npcName(n.id)).join(', ')}` : '', null, opts, null);
  DV.checkVisit && DV.checkVisit();
};

// ---------- side quests (SPEC §7) ----------
const QUESTS = {};
Object.values(NPCS).forEach(n => (n.quests || []).forEach(q => { QUESTS[q.id] = Object.assign({ npc: n.id }, q);
  if (q.sold_at) for (const k in q.sold_at) if (q.sold_at[k]) DV.addShopItem(q.sold_at[k], k); }));
DV.QUESTS = QUESTS;
const qs = id => S().q[id];
const canOffer = q => !qs(q.id) && DV.cond(q.start, { npc: q.npc });
const curStep = q => q.steps[(qs(q.id) || {}).step || 0];
function stepReady(q) {
  const st = qs(q.id); if (!st || st.st !== 'active') return false;
  const g = curStep(q).goal || {}; const s = S();
  if (g.type === 'have') return DV.has(g.item, g.n || 1);
  if (g.type === 'days') return s.day - st.t >= (g.n || 1);
  if (g.type === 'flag') return !!s.flags[g.flag];
  if (g.type === 'visit') return !!st.visited;
  return false;
}
DV.npcMark = id => {
  for (const q of Object.values(QUESTS)) {
    if (q.npc === id && canOffer(q)) return '!';
    const st = qs(q.id);
    if (st && st.st === 'active') { const g = curStep(q).goal || {};
      if ((g.npc || q.npc) === id && ['talk', 'give', 'pay'].includes(g.type)) return '?';
      if (q.npc === id && stepReady(q)) return '?'; }
  }
  return null;
};
DV.questOptions = id => {
  const out = [];
  for (const q of Object.values(QUESTS)) {
    if (q.npc === id && canOffer(q)) out.push({ label: `งาน: ${q.title}`, icon: ic('item_folder'), extra: 'ชวนทำ', hl: true, run: () => offer(q) });
    const st = qs(q.id); if (!st || st.st !== 'active') continue;
    const step = curStep(q), g = step.goal || {}, who = g.npc || q.npc;
    if (who !== id) continue;
    if (g.type === 'talk') out.push({ label: `งาน: ${q.title}`, icon: ic('item_folder'), extra: 'คุยเรื่องนี้', hl: true, run: () => completeStep(q) });
    else if (g.type === 'give') out.push({ label: `งาน: ให้${DV.item(g.item).name} ${g.n || 1}`, icon: ic(DV.item(g.item).icon), extra: `มี ${S().items[g.item] || 0}`, hl: true,
      disabled: !DV.has(g.item, g.n || 1) && 'ของยังไม่ครบ', run: () => { DV.addItem(g.item, -(g.n || 1)); completeStep(q); } });
    else if (g.type === 'pay') out.push({ label: `งาน: จ่าย ฿${g.n}`, icon: ic('item_money_envelope'), hl: true, disabled: S().money < g.n && 'เงินไม่พอ', run: () => { S().money -= g.n; DV.hud(); completeStep(q); } });
    else if (stepReady(q)) out.push({ label: `งาน: ${q.title}`, icon: ic('item_folder'), extra: 'ส่งงาน', hl: true, run: () => completeStep(q) });
  }
  return out;
};
function offer(q) {
  const o = q.offer || { npc: q.desc, options: [{ text: 'ได้เลย{k}', accept: true, reply: 'ขอบใจนะ' }, { text: 'ไว้ก่อน{k}', reply: 'ได้ ๆ' }] };
  showTalk(q.npc, o.npc, o.options, chosen => {
    if (chosen.accept) { startQuest(q.id); afterConvo(q.npc, chosen.reply + '\n\n📜 รับงาน: ' + q.title); }
    else afterConvo(q.npc, chosen.reply);
  });
}
function startQuest(id) {
  const q = QUESTS[id]; if (!q || qs(id)) return;
  S().q[id] = { st: 'active', step: 0, t: S().day };
  DV.sfx('card'); DV.toast(`📜 งานใหม่: ${q.title}`); DV.hud(); DV.save();
  const g = curStep(q).goal || {}; if (g.type === 'visit') S().q[id].visitPlace = g.place;
}
DV.startQuest = startQuest;
function completeStep(q) {
  const st = qs(q.id), step = curStep(q);
  const fin = () => {
    st.step++; st.t = S().day; st.visited = false;
    if (st.step >= q.steps.length) {
      st.st = 'done';
      const msgs = DV.applyEffect(Object.assign({}, q.reward, { heart: undefined }), { npc: q.npc });
      if (q.reward && q.reward.heart) DV.addHeart(q.npc, q.reward.heart);
      DV.stat('quests'); DV.sfx('coin');
      DV.toast(`✓ จบงาน “${q.title}”` + (q.reward && q.reward.money ? ` · ได้ ฿${q.reward.money}` : '') + (msgs.length ? ' · ' + msgs.join(' · ') : ''));
    } else DV.toast(`📜 ${q.title}: ${curStep(q).hint || 'ขั้นต่อไป'}`);
    DV.hud(); DV.save();
  };
  if (step.done && step.done.npc) showTalk(q.npc, step.done.npc, step.done.options || [], chosen => { fin(); afterConvo(q.npc, chosen.reply); });
  else { fin(); if (!$('talk').classList.contains('hidden')) closeTalk(); }
}
DV.checkVisit = () => {   // visit goals: stand at the place's door within the time window
  const s = S(), M = DV.M;
  for (const q of Object.values(QUESTS)) {
    const st = qs(q.id); if (!st || st.st !== 'active' || st.visited) continue;
    const g = curStep(q).goal || {}; if (g.type !== 'visit') continue;
    const pl = M.places[g.place]; if (!pl) continue;
    const d = pl.door; if (Math.abs(DV.player.cx - d[0]) + Math.abs(DV.player.cy - d[1]) > 3) continue;
    if (g.from && s.min < DV.hm(g.from)) continue; if (g.to && s.min > DV.hm(g.to)) continue;
    st.visited = true; const step = curStep(q);
    if (step.done && step.done.npc) { setTimeout(() => completeStep(q), 300); }
    else completeStep(q);
    return true;
  }
  return false;
};
DV.questList = () => {
  const act = [], done = [], offers = [];
  for (const q of Object.values(QUESTS)) {
    const st = qs(q.id);
    if (st && st.st === 'active') act.push({ q, hint: curStep(q).hint, ready: stepReady(q) });
    else if (st && st.st === 'done') done.push({ q });
    else if (canOffer(q)) offers.push({ q });
  }
  return { act, done, offers };
};

// ---------- ambient chatter: barks + banter when walking past ----------
let ambT = 6;
DV.ambientTick = dt => {
  if ((ambT -= dt) > 0 || !DV.npcsHere.length) return;
  ambT = 7 + Math.random() * 9;
  const P = DV.player, near = DV.npcsHere.filter(n => Math.hypot(n.x - P.x, n.y - P.y) < 200 && n.id !== talkId);
  if (!near.length) return;
  const A = (window.DV_STORY || {}).ambient || {};
  const W = l => Array.isArray(l) ? { who: l[0], text: l[1] } : l;
  const okL = l => !l.when || DV.cond(l.when);
  if (near.length >= 2 && Math.random() < .45) {
    const ids = near.map(n => n.id);
    const fits = b => (b.lines || []).length && (b.lines || []).map(W).every(l => ids.includes(l.who) || l.who === 'villager') && okL(b);
    let pool = (A.banter || []).filter(fits);
    if (!pool.length) pool = near.flatMap(n => (NPCS[n.id].banter || []).filter(fits));
    if (pool.length) { const bb = DV.pick(pool); bb.lines.map(W).forEach((l, i) => setTimeout(() => l.who === 'villager' ? DV.toast('💬 ' + DV.say(l.text)) : DV.bubble(l.who, DV.say(l.text), 4.2), i * 3800)); ambT = 6 + bb.lines.length * 4; return; }
  }
  const n = DV.pick(near);
  const pl = ((A.places || {})[n.place] || []).filter(okL);
  const mine = pl.filter(l => l.who === n.id), vill = pl.filter(l => l.who === 'villager');
  const L = NPCS[n.id].lines || {};
  const r = Math.random();
  if (mine.length && r < .55) return DV.bubble(n.id, DV.say(DV.pick(mine).text), 4.2);
  if (vill.length && r < .7) return DV.toast('💬 ชาวบ้าน: ' + DV.say(DV.pick(vill).text));
  const line = DV.pick([...(L.greet_morning || []), ...(L.heart_low || [])]);
  if (line) DV.bubble(n.id, DV.say(typeof line === 'string' ? line : (line.text || '')), 4);
};

// ---------- ไอ้จุก the house gecko ----------
const GK = () => ((window.DV_STORY || {}).gecko) || {};
const okw = x => typeof x === 'string' || !x.when || DV.cond(x.when);
DV.geckoGreet = () => { const g = (GK().greet || []).filter(okw); DV.sfx('talk'); const l = g.length ? DV.pick(g) : 'ตุ๊กแก! ตุ๊กแก! ไอ้จุกร้องทักจากข้างฝา'; DV.toast(DV.say(typeof l === 'string' ? l : l.text)); };
DV.geckoTalk = () => {
  const L = (GK().talk || []).filter(okw), c = L.length ? DV.pick(L) : { text: 'ไอ้จุกเกาะนิ่ง ตาโตมองมาเหมือนรอฟังอะไรสักอย่าง', options: [{ text: 'สวัสดีไอ้จุก', reply: 'ตุ๊กแก! (ร้องครั้งเดียว แปลว่าวันนี้ดี ยายเคยบอก)' }] };
  DV.showTalkFree('ไอ้จุก', 'assets/gecko.png', c.text, c.options || []);
};
})();