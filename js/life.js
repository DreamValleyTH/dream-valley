// Dream Valley — farm life (v1.5): skills, daily prices, chickens, fishing, cooking, cleaning jobs, farm decor,
// minigames, a visiting friend's actions (help on the plot / sneak into the house), fines → court summons → village gossip.
(() => {
'use strict';
const DV = window.DV, $ = DV.$, S = () => DV.S;
const ic = n => ['icons', DV.icon(n)];
const strh = t => { let h = 7; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) | 0; return h >>> 0; };
const rnd01 = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const hour = () => 6 + S().min / 60;
const cat = window.DV_CATALOG = window.DV_CATALOG || {};
// items this update brings (DV.item reads the catalog)
Object.assign(cat, {
  chicken_feed: { name: 'อาหารไก่ (ถุง 5 มื้อ)', buy: 45, sell: 20, where: 'ร้านเสี่ยเฮง', icon: 'misc_chicken_feed' },
  chick: { name: 'ลูกไก่', buy: 60, sell: null, where: 'ร้านเสี่ยเฮง', icon: 'misc_chicken_feather' },
  fish_perch: { name: 'ปลาหมอ', buy: null, sell: 35, where: 'ตกปลา', icon: 'misc_fish_climbing_perch' },
  fish_barb: { name: 'ปลาตะเพียน', buy: null, sell: 45, where: 'ตกปลา', icon: 'misc_fish_silver_barb' },
  fish_catfish: { name: 'ปลาดุก', buy: null, sell: 60, where: 'ตกปลา', icon: 'misc_fish_catfish' },
  fish_golden: { name: 'ปลาทองคำ (หายาก)', buy: null, sell: 600, where: 'ตกปลา (หายากมาก)', icon: 'misc_fish_golden' },
  pad_pakbung_home: { name: 'ผัดผักบุ้งฝีมือเรา', buy: null, sell: 40, where: 'อาหาร', icon: 'food_pak_bung' },
  kaprao_home: { name: 'กะเพราไข่ดาวฝีมือเรา', buy: null, sell: 55, where: 'อาหาร', icon: 'food_kaprao' },
  khaijiao_home: { name: 'ไข่เจียวฝีมือเรา', buy: null, sell: 25, where: 'อาหาร', icon: 'food_khai_jiao' },
  corn_boiled: { name: 'ข้าวโพดต้ม', buy: null, sell: 30, where: 'อาหาร', icon: 'crop_sweet_corn' },
  larb_home: { name: 'ลาบปลาดุกฝีมือเรา', buy: null, sell: 70, where: 'อาหาร', icon: 'food_larb_pladuk' },
  tomyum_fish: { name: 'ต้มยำปลาตะเพียน', buy: null, sell: 65, where: 'อาหาร', icon: 'food_khao_tom_pla' },
});

// ================= minigames: js/minigames.js (12 kinds); each activity draws a random one from its own pool =================
window.MG.sfx = k => DV.sfx(k);
DV.mgOpen = () => window.MG.open();
const TPL = id => /^deco_[a-z_]+$/.test(id);   // shop templates hidden on the farm
const tier = sc => sc >= .9 ? 3 : sc >= .6 ? 2 : sc >= .3 ? 1 : 0;   // score 0..1 → 0..3 (how well it went)

// ================= skills =================
const SK = { farm: ['ทำไร่', 'crop_chili', 'เก็บผักได้เพิ่ม'], fish: ['ตกปลา', 'item_fish_tilapia_fresh', 'ช่องเขียวกว้างขึ้น ปลาใหญ่ขึ้น'], cook: ['ทำอาหาร', 'food_khai_jiao', 'คุมไฟง่ายขึ้น อาหารให้แรงมากขึ้น'],
  clean: ['งานทำความสะอาด', 'item_trash', 'ค่าจ้างสูงขึ้น'], chicken: ['เลี้ยงไก่', 'item_egg_chicken', 'ไข่ออกบ่อยขึ้น มีโอกาสไข่แฝด'] };
const LVX = [0, 10, 28, 55, 95, 150, 225, 320, 440, 600];
DV.skLv = k => { const x = ((S().sxp || {})[k]) || 0; let l = 1; LVX.forEach((v, i) => { if (x >= v) l = i + 1; }); return l; };
DV.xp = (k, n = 1) => { const s = S(); s.sxp = s.sxp || {}; const b = DV.skLv(k); s.sxp[k] = (s.sxp[k] || 0) + n; const a = DV.skLv(k); if (a > b) { DV.sfx('spark'); DV.notify(`⭐ ทักษะ${SK[k][0]} ขึ้นเป็น Lv ${a}!`); } };
DV.openSkills = () => {
  const s = S(), opts = Object.keys(SK).map(k => { const l = DV.skLv(k), x = (s.sxp || {})[k] || 0, nx = LVX[l];
    return { info: true, label: `${SK[k][0]} · Lv ${l}`, icon: ic(SK[k][1]), extra: nx != null ? `${x}/${nx} · ${SK[k][2]}` : `สูงสุด · ${SK[k][2]}` }; });
  opts.unshift({ info: true, label: `หาของป่า · Lv ${DV.forageLevel()}`, icon: ic('item_het_ranghin'), extra: 'ค้นพุ่มไม้ได้ของดีขึ้น' });
  DV.openSheet('ทักษะของฉัน', 'ทำบ่อย ๆ แล้วจะเก่งขึ้น', ['ui', DV.UIIC ? 'star' : 'star'], opts);
};

// ================= daily crop prices =================
const PRICED = k => DV.CROPS[k] || /^fish_|^egg_/.test(k);
DV.priceMult = k => { if (!PRICED(k)) return 1; const d = S().day, h = strh(k), r = rnd01(d, h), wave = Math.sin((d + h % 11) / 2.3);
  return Math.round(Math.max(.6, Math.min(1.45, .82 + r * .35 + wave * .14)) * 100) / 100; };
DV.priceTrend = k => { const a = DV.priceMult(k); S().day--; const b = DV.priceMult(k); S().day++; return a > b + .04 ? '▲' : a < b - .04 ? '▼' : '•'; };
const priceLine = () => Object.keys(DV.CROPS).map(k => `${DV.CROPS[k].name} ฿${Math.round(DV.item(k).sell * DV.priceMult(k))}${DV.priceTrend(k)}`).join(' · ');
DV.openPrices = () => DV.openSheet('ราคาพืชผลวันนี้', `วันที่ ${S().day} · ราคาขึ้นลงทุกวัน ▲ แพงขึ้น ▼ ถูกลง`, ic('crop_chili'),
  [...Object.keys(DV.CROPS), 'fish_tilapia_fresh', 'fish_barb', 'egg_chicken'].map(k => ({ info: true, label: DV.item(k).name, icon: ic(DV.item(k).icon), extra: `฿${Math.round(DV.item(k).sell * DV.priceMult(k))} ${DV.priceTrend(k)} (×${DV.priceMult(k).toFixed(2)})` })));

// ================= chickens (only once the coop is repaired) =================
const MAXH = 6, GROW = 5;
DV.openCoop = o => {
  const s = S(), H = s.hens = s.hens || [], adults = H.filter(h => h.age >= GROW).length, chicks = H.length - adults, feed = s.items.chicken_feed || 0, fed = s.henFed === s.day;
  const eggs = s.coopEggs || 0;
  const sub = H.length ? `ไก่ ${adults} ตัว · ลูกไก่ ${chicks} ตัว · อาหารไก่ ${feed} มื้อ${fed ? ' · วันนี้ให้อาหารแล้ว' : ' · ยังไม่ได้ให้อาหาร'}` : 'เล้าว่าง · ซื้อลูกไก่ได้ที่ร้านเสี่ยเฮง (ส่งถึงเล้า)';
  const opts = [];
  if (eggs) opts.push({ label: `เก็บไข่ (${eggs} ฟอง${s.coopTwin ? ` · ไข่แฝด ${s.coopTwin}` : ''})`, icon: ic('item_egg_chicken'), cost: 1, hl: true,
    run: () => DV.doAction({ energy: 1, tool: DV.TOOL.hand, fx: 'seed', targets: [o.block[0]], apply: () => {}, after: () => { DV.addItem('egg_chicken', eggs); if (s.coopTwin) DV.addItem('egg_twin', s.coopTwin);
      DV.toast(`เก็บไข่ได้ ${eggs} ฟอง${s.coopTwin ? ` + ไข่แฝด ${s.coopTwin}!` : ''}`); s.coopEggs = 0; s.coopTwin = 0; DV.xp('chicken', 1); DV.save(); } }) });
  if (H.length) opts.push({ label: `ให้อาหารไก่ (${H.length} ตัว)`, icon: ic('misc_chicken_feed'), cost: 2,
    extra: feed >= 1 ? 'ใช้อาหารไก่ 1 มื้อ' : (s.items.corn ? 'ใช้ข้าวโพดแทน 1 ฝัก' : ''),
    disabled: fed ? 'วันนี้ให้แล้ว' : (!feed && !s.items.corn && 'ไม่มีอาหารไก่ (ร้านเสี่ยเฮง) หรือข้าวโพด'),
    run: () => DV.doAction({ energy: 2, tool: DV.TOOL.hand, fx: 'seed', targets: [o.block[0]], apply: () => {}, after: () => { if (feed) DV.addItem('chicken_feed', -1); else DV.addItem('corn', -1);
      s.henFed = s.day; DV.xp('chicken', 1); DV.toast(DV.pick(['ไก่วิ่งกรูกันมา จิกกินเสียงดังป๊อก ๆ', 'ลูกไก่ตัวเล็กสุดแย่งกินเก่งที่สุด', 'ไก่ส่งเสียงกุ๊ก ๆ อย่างพอใจ'])); DV.save(); } }) });
  opts.push({ info: true, label: H.length ? H.map(h => (h.age >= GROW ? '🐔' : '🐣')).join(' ') : 'ยังไม่มีไก่', extra: H.length < MAXH ? `รับได้อีก ${MAXH - H.length} ตัว` : 'เต็มเล้าแล้ว' });
  opts.push({ info: true, label: 'ลูกไก่โตเป็นแม่ไก่ใน 5 วัน · แม่ไก่ที่ได้กินจะออกไข่ทุกเช้า' });
  DV.openSheet('เล้าไก่', sub, null, opts, { spr: DV.objSprite(o) });
};
const buyChick = () => { const s = S(), p = DV.item('chick').buy; if (!s.coopFixed) { s.money += p; DV.toast('เสี่ยเฮง: “เล้ายังพังอยู่ไม่ใช่เหรอ ซ่อมก่อนนะ เดี๋ยวหมาคาบไป”'); return true; }
  s.hens = s.hens || []; if (s.hens.length >= MAXH) { s.money += p; DV.toast('เล้าเต็มแล้ว (6 ตัว)'); return true; }
  s.hens.push({ age: 0, d: s.day }); DV.sfx('coin'); DV.toast('ลูกไก่ 1 ตัว ส่งถึงเล้าแล้ว จิ๊บ ๆ'); return true; };
const chickensMorning = s => {
  const H = s.hens || []; if (!H.length) return;
  const fedY = s.henFed === s.day - 1; let eggs = 0, twin = 0; const lv = DV.skLv('chicken');
  H.forEach(h => { h.age++; if (h.age > GROW && fedY && Math.random() < .7 + lv * .03) { if (Math.random() < .02 + lv * .006) twin++; else eggs++; } });
  s.coopEggs = Math.min(30, (s.coopEggs || 0) + eggs); s.coopTwin = (s.coopTwin || 0) + twin;
  const grown = H.filter(h => h.age === GROW).length; if (grown) DV.notify(`🐔 ลูกไก่โตเป็นแม่ไก่แล้ว ${grown} ตัว`);
  if (eggs + twin) setTimeout(() => DV.notify(`🥚 มีไข่ในเล้า ${s.coopEggs} ฟอง`), 3200);
  else if (!fedY && H.some(h => h.age > GROW)) setTimeout(() => DV.notify('🐔 เมื่อวานไม่ได้ให้อาหาร ไก่เลยไม่ออกไข่'), 3200);
};

// once the coop is fixed, someone from the village brings a hen to start with; the rest you buy little by little
DV.coopGift = () => { const s = S(); if (s.flags.henGift) return; s.flags.henGift = s.day; s.hens = s.hens || []; s.hens.push({ age: GROW + 1, d: s.day, gift: 1 });
  const who = DV.pick(['taew', 'hong', 'sommai', 'bua', 'cherd', 'heng'].filter(id => (window.DV_NPCS || {})[id])) || 'taew';
  const line = DV.pick(['ได้ยินว่าซ่อมเล้าแล้ว เอาแม่ไก่ไปเลี้ยงตัวนึง ไข่ดกนะ ยายเพียรเคยให้ข้าวเปลือกบ้านป้าตอนแล้งตั้งหลายกระสอบ',
    'แม่ไก่ตัวนี้ชื่อ “ลายจุด” เลี้ยงดี ๆ นะ ทีนี้ก็ค่อย ๆ เก็บเงินซื้อลูกไก่ที่ร้านเสี่ยเฮงเพิ่มเอา', 'เห็นเล้าใหม่แล้วชื่นใจ เอาไก่ไปตัวนึง ถือว่าขึ้นบ้านใหม่ให้เล้า']);
  if (DV.showTalk) DV.showTalk(who, line, [{ text: 'ขอบคุณมาก{k}', reply: 'ให้อาหารทุกวันนะ เช้ามาจะมีไข่', heart: 1 }], o => DV.showTalk(who, o.reply, []));
  DV.notify(`🐔 ${DV.npcName(who)} ให้แม่ไก่มา 1 ตัว`); DV.save(); };
DV.buyHook = k => k === 'chick' ? buyChick() : false;

// ================= fishing =================
const FISH = [['fish_perch', 30], ['fish_barb', 26], ['fish_tilapia_fresh', 24], ['fish_catfish', 12], ['fish_snakehead', 7], ['fish_golden', 1]];
const pickFish = (big, lv) => { const pool = FISH.map(([k, w], i) => [k, w * (big ? 1 + i * .5 : 1) * (1 + (i >= 3 ? lv * .08 : 0))]); let t = pool.reduce((a, b) => a + b[1], 0) * Math.random();
  for (const [k, w] of pool) { if ((t -= w) <= 0) return k; } return 'fish_perch'; };
DV.fishAt = (cx, cy) => {
  const s = S(), cost = 4;
  if (DV.isVisiting && DV.isVisiting() && s.map === 'farm') { /* fishing in a friend's pond is fine */ }
  const worm = DV.has('worm'), lv = DV.skLv('fish');
  DV.openSheet('ริมน้ำ', `ทักษะตกปลา Lv ${lv}${worm ? ' · มีไส้เดือนเป็นเหยื่อ (ปลาฉกง่ายขึ้น)' : ''}`, ic('misc_fishing_line'), [
    { label: 'ตักน้ำเติมบัวรดน้ำ', icon: ['ui', 'water'], cost: 1, extra: `บัว ${s.water}/${DV.CAN_MAX}`, disabled: s.water >= DV.CAN_MAX && 'เต็มแล้ว',
      run: () => DV.doAction({ energy: 1, tool: DV.TOOL.bucket, fx: 'water', targets: [[cx, cy]], apply: () => { s.water = DV.CAN_MAX; }, after: () => DV.toast(`เติมน้ำเต็มแล้ว (${DV.CAN_MAX} ครั้ง)`) }) },
    { label: 'เหวี่ยงเบ็ด', icon: ic('misc_fishing_line'), cost, disabled: (hour() >= 21 || hour() < 6) && 'มืดแล้ว ระวังผีพราย…', extra: worm ? 'ใช้ไส้เดือน 1 ตัว' : 'ไม่มีเหยื่อ (ขุดหาไส้เดือนได้ตามพุ่มไม้)',
      run: () => { DV.closeSheet(); DV.addEnergy(-cost); if (worm) DV.addItem('worm', -1); DV.addMins(20); DV.sfx('water');
        MG.pick(['timing', 'tension', 'hold'], { key: 'fish', title: '🎣 ปลากินเบ็ด!', per: { timing: { rounds: 3, zone: .2 + lv * .012 + (worm ? .06 : 0), speed: 1.05, shrink: .85, btn: 'ดึง!' },
            tension: { bar: .24 + lv * .012 + (worm ? .05 : 0), time: 14, icon: '🐟' }, hold: { rounds: 3, zone: .15 + lv * .01 + (worm ? .04 : 0), btn: 'กดค้าง = รอกสาย แล้วปล่อย' } },
          onEnd: sc => { const h = tier(sc); let msg; if (h === 0) { msg = DV.pick(['ปลาสะบัดหลุดไป เหลือแต่เบ็ดเปล่า', 'ได้รองเท้าแตะข้างเดียว… ทิ้งดีกว่า']); }
            else { const k = h === 1 ? (Math.random() < .5 ? 'fish_perch' : null) : pickFish(h === 3, lv);
              if (k) { DV.addItem(k); DV.xp('fish', h + (k === 'fish_golden' ? 10 : 0)); DV.stat('fish'); msg = `ได้${DV.item(k).name}! ${k === 'fish_golden' ? '✨ หายากมาก!' : ''}`; } else msg = 'ปลาตัวเล็กเกินไป ปล่อยคืนบ่อ'; }
            DV.toast(msg); DV.hud(); DV.save(); DV.checkFaint && DV.checkFaint(); } }); } }]);
};

// ================= cooking =================
const RECIPES = [
  { out: 'khaijiao_home', need: { egg_chicken: 2 }, alt: { egg_duck: 2 }, eat: 30, name: 'ไข่เจียว' },
  { out: 'kaprao_home', need: { basil: 1, chili: 1, egg_chicken: 1 }, eat: 45, name: 'กะเพราไข่ดาว' },
  { out: 'pad_pakbung_home', need: { morning_glory: 2, chili: 1 }, eat: 35, name: 'ผัดผักบุ้งไฟแดง' },
  { out: 'corn_boiled', need: { corn: 2 }, eat: 25, name: 'ข้าวโพดต้ม' },
  { out: 'fish_tilapia_grill', need: { fish_tilapia_fresh: 1 }, eat: 40, name: 'ปลานิลเผา' },
  { out: 'fish_snakehead_grill', need: { fish_snakehead: 1 }, eat: 50, name: 'ปลาช่อนเผา' },
  { out: 'larb_home', need: { fish_catfish: 1, chili: 1 }, eat: 50, name: 'ลาบปลาดุก' },
  { out: 'tomyum_fish', need: { fish_barb: 1, chili: 1 }, eat: 45, name: 'ต้มยำปลาตะเพียน' },
];
const hasAll = need => Object.entries(need).every(([k, n]) => DV.has(k, n));
DV.openCook = () => {
  const s = S(), lv = DV.skLv('cook');
  const opts = RECIPES.map(r => { const need = hasAll(r.need) ? r.need : r.alt && hasAll(r.alt) ? r.alt : null;
    const list = Object.entries(r.need).map(([k, n]) => `${DV.item(k).name}${n > 1 ? '×' + n : ''}`).join(' + ');
    return { label: r.name, icon: ic(DV.item(r.out).icon), cost: 3, extra: list, disabled: !need && `ต้องมี ${list}`,
      run: () => { DV.closeSheet(); DV.addEnergy(-3); DV.addMins(30); DV.sfx('spark');
        const ING = Object.keys(need).map(k => ({ egg_chicken: '🥚', egg_duck: '🥚', basil: '🌿', chili: '🌶️', morning_glory: '🥬', corn: '🌽', fish_tilapia_fresh: '🐟', fish_snakehead: '🐟', fish_catfish: '🐟', fish_barb: '🐟' }[k] || '🧂'));
        MG.pick(['timing', 'stir', 'sequence', 'hold'], { key: 'cook', title: `🍳 ${r.name}`, per: { timing: { rounds: 3, zone: .24 + lv * .015, speed: 1.2, shrink: .88, btn: 'กลับด้าน!', sub: 'คุมไฟ! แตะตอนเข็มอยู่ในช่องเขียว' },
            stir: { need: 7 - Math.min(3, Math.floor(lv / 3)), time: 9, icon: '🍳' }, sequence: { symbols: [...new Set([...ING, '🧄', '🧂', '🍋', '🫙'])].slice(0, 4), len: 4 + (lv >= 5 ? 0 : 0), prompt: 'ใส่เครื่องตามลำดับ!' },
            hold: { rounds: 3, zone: .17 + lv * .01, btn: 'กดค้าง = เทน้ำปลา แล้วปล่อย' } },
          onEnd: sc => { const h = tier(sc); Object.entries(need).forEach(([k, n]) => DV.addItem(k, -n));
            if (h === 0) { DV.addItem('trash'); DV.toast('ไหม้เป็นถ่าน… กลิ่นลอยไปถึงบ้านป้าแต๋ว'); }
            else { const q = [0, .7, 1, 1.35][h]; DV.addItem(r.out); s.cookQ = s.cookQ || {}; s.cookQ[r.out] = Math.max(s.cookQ[r.out] || 0, q);
              DV.xp('cook', h + 1); DV.stat('cooked'); DV.toast(h === 3 ? `${r.name} อร่อยเหมือนฝีมือยาย! ⭐ (กินแล้วแรงเพิ่มขึ้น)` : h === 2 ? `ได้${r.name} หน้าตาดีใช้ได้` : `${r.name} ไหม้นิดหน่อย แต่ยังกินได้`); }
            DV.hud(); DV.save(); } }); } };
  });
  DV.openSheet('ทำอาหาร', `ทักษะทำอาหาร Lv ${lv} · ทำจากผักในแปลง ไข่จากเล้า ปลาจากบ่อ`, ['ui', 'cook'], opts);
};
// home cooking gives more energy than the menu says when you nail it
const eatOrig = DV.item;
DV.item = id => { const it = eatOrig(id); const r = RECIPES.find(x => x.out === id);
  if (r) { const q = (S() && S().cookQ && S().cookQ[id]) || 1; return Object.assign({}, it, { eat: Math.round(r.eat * Math.max(1, q) * (1 + DV.skLv('cook') * .02)), food: true }); }
  return it; };

// ================= cleaning jobs =================
const JOBS = { temple: ['กวาดลานวัด', ['🍂', '🍃', '🍂', '🪶'], 90, 'jamrat'], school: ['ทำความสะอาดโรงเรียน', ['🧻', '🥤', '✏️', '🍬'], 100, null], obt: ['เก็บขยะหน้า อบต.', ['🥤', '🧃', '🧻', '📰'], 110, 'somsak'],
  market: ['ล้างแผงตลาดนัด', ['🐟', '🥬', '🥤', '🧻'], 120, 'hong'], sala: ['ปัดกวาดศาลากลางบ้าน', ['🍂', '🕸️', '🥤', '🍃'], 80, null] };
DV.placeExtras = (pid, opts) => {
  const s = S(), j = JOBS[pid];
  if (j) { const h = hour(), done = s.jobDay && s.jobDay[pid] === s.day, lv = DV.skLv('clean'), pay = Math.round(j[2] * (1 + (lv - 1) * .08));
    opts.push({ label: `รับจ้าง${j[0]}`, icon: ic('item_trash'), cost: 15, extra: `ค่าจ้าง ~฿${pay}+ · 1 ชม.`, disabled: done ? 'วันนี้ทำแล้ว' : (h < 7 || h >= 17) && 'รับงาน 07:00–17:00',
      run: () => { DV.closeSheet(); if (s.energy <= 15) return DV.toast('เหนื่อยเกินไป พักก่อนนะ'); s.jobDay = s.jobDay || {}; s.jobDay[pid] = s.day; DV.addEnergy(-15); DV.addMins(60);
        MG.pick(['taps', 'sweep', 'catch', 'pairs'], { key: 'clean', title: `🧹 ${j[0]}`, per: { taps: { items: j[1], bad: ['🐝'], need: 22 }, sweep: { items: j[1], n: 24, time: 11 },
            catch: { good: j[1], bad: ['🐍', '🪨'], basket: '🗑️', need: 14, bg: '#d9c79c', sub: 'ลากถังขยะไปรับ หลบงูกับก้อนหิน' }, pairs: { symbols: ['🧹', '🪣', '🧽', '🧴', '🗑️', '🧤'], time: 28, sub: 'จัดของเข้าที่: เปิดจับคู่ให้ครบ' } },
          onEnd: sc => { const got = Math.round(sc * 22);
          const g = Math.round(pay * Math.min(1.6, .5 + got / 22)); s.money += g; DV.xp('clean', 2 + Math.floor(got / 6)); DV.stat('jobs');
          if (j[3] && got >= 14) DV.addHeart(j[3], .5);
          DV.toast(`ผลงาน ${sc >= .9 ? '⭐⭐⭐' : sc >= .6 ? '⭐⭐' : sc >= .3 ? '⭐' : 'ยังไม่เรียบร้อย'} · ได้ค่าจ้าง ฿${g}${got >= 18 ? ' · “ขยันจริง พรุ่งนี้มาอีกนะ”' : ''}`); DV.sfx('coin'); DV.hud(); DV.save(); } }); } });
  }
  if (pid === 'police' && s.fine) opts.push({ label: `จ่ายค่าปรับ ฿${s.fine.amt}`, icon: ic('item_money_envelope'), hl: true, extra: s.fine.summons ? 'มีหมายศาลแล้ว รีบจ่าย!' : `ค้างมา ${s.day - s.fine.day} วัน`,
    disabled: s.money < s.fine.amt && `เงินไม่พอ (มี ฿${s.money})`, run: () => { s.money -= s.fine.amt; DV.toast(`จ่ายค่าปรับ ฿${s.fine.amt} แล้ว ดาบเสถียร: “ครั้งหน้าอย่าทำอีกนะ”`); s.fine = null; delete s.flags.gossip_thief; DV.sfx('coin'); DV.closeSheet(); DV.hud(); DV.save(); } });
  if (pid === 'workshop') opts.push({ label: 'ร้านของแต่งฟาร์ม (ช่างเปี๊ยก)', icon: ic('item_artificial_flower'), extra: `${DECO.length} แบบ`, run: () => DV.openDecoShop() });
  if (pid === 'heng_shop' || pid === 'rice_yard') opts.push({ label: 'ดูราคาพืชผลวันนี้', icon: ic('crop_chili'), run: () => DV.openPrices() });
};

// ================= farm decor (bought → storage → placed with the "คลังของ" tools) =================
// templates are hidden objects in the farm map (deco_* ids); each purchase clones one under a new id
const DECO = [];
DV.openDecoShop = () => {
  const s = S(), opts = DECO.map(d => ({ label: d.name, icon: null, extra: `฿${d.price}`, disabled: s.money < d.price && 'เงินไม่พอ',
    run: () => { s.money -= d.price; s.deco = s.deco || []; const id = `${d.tpl}#${Date.now().toString(36)}`; s.deco.push({ id, tpl: d.tpl });
      DV.ensureDeco(); s.stored = s.stored || {}; (s.stored.farm = s.stored.farm || {})[id] = 1; DV.rebuildBlocked && S().map === 'farm' && DV.rebuildBlocked();
      DV.sfx('coin'); DV.hud(); DV.save(); DV.toast(`ซื้อ${d.name}แล้ว — อยู่ใน "คลังของ" (โหมดจัดฟาร์ม) ลากไปวางได้เลย`); DV.openDecoShop(); } }));
  if (!opts.length) opts.push({ info: true, label: 'ของกำลังมาส่ง… (รอรุ่นถัดไป)' });
  DV.openSheet('ร้านของแต่งฟาร์ม', `ช่างเปี๊ยกทำเองทุกชิ้น · เงิน ฿${s.money}`, ['ui', 'shop'], opts, { portrait: 'piak' });
  // show each item's real picture as the option icon
  const WORLD = window.DV_WORLD; $('sheetBody').querySelectorAll('.opt').forEach((b, i) => { const d = DECO[i]; if (!d) return; const o = DV.MAPS.farm.objects.find(x => x.id === d.tpl); const r = o && WORLD.atlas.rects[o.s]; if (!r) return;
    const [sh, x, y, w, h] = r, sc = Math.min(32 / w, 32 / h); const el = b.querySelector('.oi'); el.style.cssText = `background-image:url(assets/${WORLD.atlas.sheets[sh]});background-size:${Math.round(1024 * sc)}px auto;background-position:${-x * sc}px ${-y * sc}px;width:${Math.round(w * sc)}px;height:${Math.round(h * sc)}px`; });
};
DV.ensureDeco = () => {
  const s = S(); if (!s) return; const M = DV.MAPS.farm, have = new Set(M.objects.map(o => o.id));
  for (const d of s.deco || []) { if (have.has(d.id)) continue; const t = M.objects.find(o => o.id === d.tpl); if (!t) continue;
    const c = JSON.parse(JSON.stringify(Object.assign({}, t, { _b0: undefined, _p0: undefined }))); c.id = d.id; c.block = (t._b0 || t.block).map(b => b.slice()); M.objects.push(c); have.add(c.id); }
  // the shop templates themselves never show on the farm
  s.stored = s.stored || {}; const st = s.stored.farm = s.stored.farm || {}; DECO.forEach(d => { st[d.tpl] = 1; });
};
const initDeco = () => { const M = DV.MAPS.farm; window.DV_DECOT = M.objects.filter(o => TPL(o.id)).map(o => o.id); M.objects.filter(o => /^deco_/.test(o.id) && !o.id.includes('#')).forEach(o => { const p = { deco_arch: 380, deco_banana_pot: 150, deco_bird: 260, deco_dragonjar: 280, deco_flowerbed: 220, deco_hammock: 350, deco_lamp: 180, deco_pots: 120, deco_sala: 1500, deco_swing: 450, deco_box_s: 150, deco_box_m: 450, deco_box_l: 900 }[o.id];
  DECO.push({ tpl: o.id, name: o.label || o.id, price: p || 250 }); }); };
initDeco();

// ================= storage boxes (3 sizes, bought from ช่างเปี๊ยก; grandma's chest stands by the house) =================
const BOXCAP = { deco_box_s: 9, deco_box_m: 18, deco_box_l: 30 };
DV.openBox = o => {
  const s = S(), tpl = o.id.split('#')[0], cap = BOXCAP[tpl] || 12; s.boxes = s.boxes || {}; const bx = s.boxes[o.id] = s.boxes[o.id] || { items: {} };
  const used = Object.keys(bx.items).length, friend = !!own;
  const opts = Object.entries(bx.items).map(([k, n]) => ({ label: `เอาออก: ${DV.item(k).name}`, icon: ic(DV.item(k).icon), extra: `×${n}`, disabled: friend && 'กล่องของเพื่อน (ใส่ได้อย่างเดียว)',
    run: () => { DV.addItem(k, n); delete bx.items[k]; DV.sfx('tick'); DV.save(); DV.openBox(o); } }));
  Object.keys(s.items).filter(k => s.items[k] > 0 && k !== 'lottery_ticket').forEach(k => opts.push({ label: `ใส่: ${DV.item(k).name}`, icon: ic(DV.item(k).icon), extra: `×${s.items[k]}`,
    disabled: !bx.items[k] && used >= cap && 'กล่องเต็ม',
    run: () => DV.worldEdit(() => { const n = s.items[k]; const b2 = S().boxes[o.id] = S().boxes[o.id] || { items: {} }; b2.items[k] = (b2.items[k] || 0) + n; delete s.items[k]; DV.sfx('seed'); DV.save(); DV.openBox(o); }) }));
  if (!opts.length) opts.push({ info: true, label: 'กล่องว่าง และกระเป๋าก็ว่าง' });
  DV.openSheet(DV.objName(o), `${friend ? 'กล่องในฟาร์มเพื่อน · ' : ''}ใช้ไป ${Object.keys(bx.items).length}/${cap} ช่อง`, null, opts, { spr: o.s });
};
const placeYaiBox = DV.placeYaiBox = () => { const s = S(); if (!s || s.flags.yaiBox || s.map !== 'farm' || own) return; const M = DV.M;
  s.deco = s.deco || []; const id = 'deco_box_m#yai'; if (!s.deco.some(d => d.id === id)) s.deco.push({ id, tpl: 'deco_box_m' }); DV.ensureDeco(); DV.rebuildBlocked();
  const o = M.objects.find(q => q.id === id); if (!o) return; const b0 = (o._b0 || o.block)[0];
  const d = (M.places.home || {}).door || M.spawns.home, cand = []; for (let r = 2; r <= 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) cand.push([d[0] + dx, d[1] + dy]);
  for (const [x, y] of cand) {
    if (!DV.walkable(x, y, true) || (s.cells && s.cells[x + ',' + y]) || (x === DV.player.cx && y === DV.player.cy)) continue;
    s.moved = s.moved || {}; (s.moved.farm = s.moved.farm || {})[id] = { dx: x - b0[0], dy: y - b0[1] }; s.flags.yaiBox = s.day; DV.rebuildBlocked(); DV.save(); return; } };
const em = DV.onEnterMap; DV.onEnterMap = m => { em && em(m); setTimeout(placeYaiBox, 300); };
const sb = DV.startBuild; DV.startBuild = (...a) => own ? DV.toast('นี่ฟาร์มของเพื่อน ย้ายของไม่ได้นะ') : sb && sb(...a);

// ================= fines, court summons, gossip =================
DV.giveFine = (amt, why) => { const s = S(); if (s.fine) s.fine.amt += amt; else s.fine = { amt, day: s.day, why }; DV.setFlag('fined_once'); DV.save(); };
const finesMorning = s => {
  const f = s.fine; if (!f) return;
  const d = s.day - f.day;
  if (d >= 3 && !f.summons) { f.summons = s.day; DV.setFlag('gossip_thief');
    setTimeout(() => DV.showCard({ id: 'court_summons', type: 'story', art: 'letter', title: 'หมายเรียกจากศาล', text: `ดาบเสถียรเอาซองสีน้ำตาลมาเสียบไว้ที่ตู้จดหมาย\n“ค่าปรับ ฿${f.amt} ค้างมา ${d} วันแล้วนะ จ่ายที่ป้อมตำรวจภายใน 4 วัน ไม่งั้นเรื่องถึงศาลจริง ๆ”\nแล้วก็… ทั้งหมู่บ้านรู้กันหมดแล้ว`,
      choices: [{ label: 'รับทราบ', hint: 'จ่ายได้ที่ป้อมตำรวจ (ดาบเสถียร)', effect: {} }] }), 1600);
    DV.postLine && setTimeout(() => DV.postLine({ id: 'gs' + s.day, from: DV.pick(['taew', 'hong', 'porn']), text: `ได้ยินไหม หลานยายเพียรโดนหมายศาล! ไปค้นบ้านเพื่อนเขา… เฮ้อ ยายเพียรคงไม่สบายใจ` }), 5000);
  } else if (f.summons && d >= 7) {
    const take = Math.min(s.money, f.amt * 2); s.money -= take; s.fine = null; DV.setFlag('court_done');
    setTimeout(() => DV.showCard({ id: 'court_day', type: 'story', art: 'village', title: 'ขึ้นศาล', text: `ศาลสั่งชำระค่าปรับสองเท่า ฿${take} …นั่งรถลุงเชิดกลับบ้านเงียบ ๆ ลุงไม่พูดอะไรเลยทั้งทาง`,
      choices: [{ label: 'จะไม่ทำอีกแล้ว', effect: {} }] }), 1600);
  } else if (f.summons) DV.ticker && setTimeout(() => DV.ticker('🗣️ ' + DV.pick(['เขาว่ากันว่า หลานยายเพียรยังไม่จ่ายค่าปรับนะ', 'ป้าแต๋วกระซิบ: “ระวังกระเป๋าตังค์ไว้นะ”', 'ที่ตลาดคุยกันเรื่องหมายศาลทั้งเช้า'])), 2600);
};
DV.gossipNote = () => S() && S().fine && S().fine.summons ? DV.pick(['…ได้ยินเรื่องหมายศาลแล้วนะ', '(มองแปลก ๆ แล้วเงียบไป)', 'ไปจ่ายค่าปรับหรือยังล่ะ']) : null;

// ================= visiting a friend: help on their plot, or sneak into the house =================
DV.netEvSend = e => { const N = DV.net; if (!N) return; N.ev = (N.ev || []).concat([Object.assign({ i: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }, e)]).slice(-4); while (N.ev.length > 1 && JSON.stringify(N.ev).length > 1300) N.ev.shift(); DV.netPush && DV.netPush(); };
const seen = new Set();
setInterval(() => {   // host: apply what visitors did
  const N = DV.net, s = S(); if (!s || !N || !N.own || N.mode === 'guest') return;
  N.own.peers().filter(p => !p.isMe && N.accepted[p.peer] && p.presence && p.presence.ev).forEach(p => p.presence.ev.forEach(e => {
    const key = p.peer + e.i; if (seen.has(key)) return; seen.add(key); s.evSeen = s.evSeen || []; if (s.evSeen.includes(key)) return; s.evSeen = s.evSeen.concat([key]).slice(-80);
    const who = p.presence.name || 'เพื่อน';
    if (e.k === 'cells' && e.c) { for (const k in e.c) { const c = s.cells[k]; if (!c) continue; const v = e.c[k]; c.soil = !!v.soil; c.wet = !!v.wet; c.crop = v.crop || null; if (v.soil) c.debris = null; } DV.dirtySoil && DV.dirtySoil(); DV.save(); }
    if (e.k === 'world' && e.d) { DV.applyWorldDiff(e.d); DV.notify && Math.random() < .3 && DV.notify(`🤝 ${who} ช่วยงานในฟาร์ม`); }
    if (e.k === 'steal') { const a = Math.min(s.money, e.amt | 0); s.money -= a; DV.hud(); DV.save(); DV.sfx('dirt'); DV.notify(`😱 เงินในลิ้นชักหายไป ฿${a}! (${who} เพิ่งเข้าไปในบ้าน…)`); }
    if (e.k === 'caught') { DV.sfx('line'); DV.notify(`🚨 จับได้! ${who} แอบค้นลิ้นชักในบ้าน — โดนปรับ ฿${e.fine}`); }
  }));
}, 600);
// visitor: farm plot actions are sent to the host
// ---- visiting = working in the friend's world: their farm state is swapped in while you're there, and what you change is sent back ----
const WK = ['gone', 'trees', 'coopFixed', 'hens', 'henFed', 'coopEggs', 'coopTwin', 'moved', 'stored', 'flip', 'deco', 'boxes'];
const WDEF = { gone: {}, trees: {}, hens: [], moved: {}, stored: {}, flip: {}, deco: [], boxes: {} };
const OBJK = ['gone', 'trees', 'moved', 'stored', 'flip', 'boxes'];
// presence carries a compact copy (Firebase rules keep it under 4 KB): only the farm's parts, only what is still active
DV.worldOf = () => { const s = S(), farm = o => (o || {}).farm || {}, g = {};
  for (const k in s.gone || {}) if (s.gone[k] > s.day) g[k] = s.gone[k] >= 99999 ? 1 : s.gone[k];
  const st = {}; for (const k in farm(s.stored)) if (!TPL(k)) st[k] = 1;
  return { g, t: s.trees || {}, c: s.coopFixed || 0, h: s.hens || [], hf: s.henFed || 0, ce: s.coopEggs || 0, ct: s.coopTwin || 0, m: farm(s.moved), s: st, f: farm(s.flip), dc: s.deco || [], b: s.boxes || {} }; };
const unpack = w => { const g = {}; for (const k in w.g || {}) g[k] = w.g[k] === 1 ? 99999 : w.g[k]; const st = Object.assign({}, w.s || {}); (window.DV_DECOT || []).forEach(k => { st[k] = 1; });
  return { gone: g, trees: w.t || {}, coopFixed: w.c || 0, hens: w.h || [], henFed: w.hf || 0, coopEggs: w.ce || 0, coopTwin: w.ct || 0, moved: { farm: w.m || {} }, stored: { farm: st }, flip: { farm: w.f || {} }, deco: w.dc || [], boxes: w.b || {} }; };
let own = null, hostW = '';
DV.ownState = () => { if (!own) return S(); const c = Object.assign({}, S()); WK.forEach(k => { c[k] = own[k]; }); return c; };   // saving never writes the friend's farm into your save
DV.inSandbox = () => !!own;
const swapIn = w => { const s = S(); if (!own) { own = {}; WK.forEach(k => { own[k] = s[k]; }); } const u = unpack(w); WK.forEach(k => { s[k] = u[k]; }); refresh(); };
const swapOut = () => { const s = S(); WK.forEach(k => { s[k] = own[k]; }); own = null; hostW = ''; refresh(); };
const refresh = () => { if (S().map === 'farm') { DV.rebuildBlocked && DV.rebuildBlocked(); DV.dirtySoil && DV.dirtySoil(); } };
setInterval(() => { const s = S(); if (!s) return;
  if (DV.isVisiting && DV.isVisiting()) { const h = DV.visitHost && DV.visitHost(); if (h && h.w && h.w !== hostW && !(DV.isBusy && DV.isBusy()) && !DV.lift) { try { const w = JSON.parse(h.w); hostW = h.w; swapIn(w); } catch (_) {} } }
  else if (own) swapOut();
  if (!own && !s.flags.yaiBox && s.map === 'farm' && DV.M && DV.placeYaiBox) DV.placeYaiBox(); }, 500);
// guest: what changed — objects only by the sub-keys that changed, so each event stays small
const snap = () => { const b = {}; WK.forEach(k => { b[k] = JSON.stringify(S()[k]); }); return b; };
const diffSince = b => { const s = S(), d = {}; WK.forEach(k => { const v = JSON.stringify(s[k]); if (v === b[k]) return;
    if (OBJK.includes(k) && s[k] && typeof s[k] === 'object') { const old = JSON.parse(b[k] || '{}') || {}, dd = {}; for (const sk in s[k]) if (JSON.stringify(s[k][sk]) !== JSON.stringify(old[sk])) dd[sk] = s[k][sk]; if (Object.keys(dd).length) d[k] = dd; }
    else d[k] = s[k]; }); return d; };
const sendDiff = b => { const d = diffSince(b); if (Object.keys(d).length) DV.netEvSend({ k: 'world', d }); };
DV.worldEdit = fn => { if (!own) return fn(); const b = snap(); const r = fn(); sendDiff(b); return r; };
DV.applyWorldDiff = d => { const s = S(); for (const k in d) { if (!WK.includes(k)) continue;
    if (OBJK.includes(k) && d[k] && typeof d[k] === 'object') { s[k] = s[k] || {}; for (const sk in d[k]) { if (['moved', 'stored', 'flip'].includes(k)) s[k][sk] = Object.assign({}, s[k][sk] || {}, d[k][sk]); else s[k][sk] = d[k][sk]; } }
    else s[k] = d[k]; } refresh(); DV.save(); };
const doA = DV.doAction;
DV.doAction = a => {
  if (own) { const b = snap(), af0 = a.after; a.after = () => { af0 && af0(); setTimeout(() => sendDiff(b), 60); }; }
  if (DV.isVisiting && DV.isVisiting() && S().map === 'farm' && a.apply && a.targets && a.targets.length && DV.visitCells && DV.visitCells()) {
    const ap = a.apply, ch = {};
    a.apply = (x, y) => { ap(x, y); const c = DV.cell(x, y); if (c) ch[x + ',' + y] = { soil: c.soil, wet: c.wet, crop: c.crop }; };
    const af = a.after; a.after = () => { if (Object.keys(ch).length) DV.netEvSend({ k: 'cells', c: ch }); af && af(); };
  }
  return doA(a);
};
DV.stealMenu = o => {
  const s = S(), host = DV.visitHost ? DV.visitHost() : null, hm = host && host.mny || 0;
  if (s.stealDay === s.day) return DV.toast('วันนี้เสี่ยงไปแล้ว อย่าเลย…');
  DV.openSheet('ลิ้นชักโต๊ะ', 'ไม่มีใครเห็น… หรือเปล่า?', null, [
    { label: 'แอบค้นลิ้นชัก (มินิเกม)', icon: ic('item_money_envelope'), extra: 'สำเร็จ = ได้เงิน 3–8% ของเพื่อน · พลาด = โดนปรับ', run: () => { DV.closeSheet(); s.stealDay = s.day;
      MG.pick(['lockpick', 'hold', 'sequence', 'reaction'], { key: 'steal', title: '🤫 แอบค้นลิ้นชักเงียบ ๆ', per: {
          lockpick: { pins: 4, noise: 1, speed: 2.8, tol: .2, btn: 'งัด!', sub: 'แงะกุญแจลิ้นชัก 4 ชั้น · พลาดได้ครั้งเดียว ครั้งที่สองเพื่อนได้ยิน!' },
          hold: { rounds: 4, zone: .13, btn: 'ค่อย ๆ ดึงลิ้นชัก', sub: 'ดึงช้า ๆ ปล่อยตอนอยู่ในช่องเขียว ไม่งั้นเอี๊ยด!' },
          sequence: { symbols: ['1️⃣', '2️⃣', '3️⃣', '4️⃣'], len: 5, prompt: 'หมุนรหัสกุญแจตามที่แอบเห็น', sub: 'แอบดูรหัสกุญแจ แล้วหมุนให้ถูก' },
          reaction: { need: 10, time: 13, away: '😴', watch: '👀', goal: '💰', btn: 'ย่องเข้าไป', sub: 'ย่องตอนเพื่อนเผลอ ถ้าเพื่อนหันมาห้ามขยับ!' } },
        onEnd: sc => { const h = sc >= .99 ? 4 : sc >= .7 ? 3 : 0; if (h >= 3) { const pct = h === 4 ? .08 : .03 + Math.random() * .02, amt = Math.max(0, Math.min(3000, Math.round(hm * pct)));
            if (!amt) return DV.toast('ลิ้นชักว่างเปล่า… เพื่อนจนกว่าที่คิด');
            s.money += amt; DV.netEvSend({ k: 'steal', amt }); DV.setFlag('stole_once'); DV.sfx('coin'); DV.toast(`ได้เงินมา ฿${amt} …หัวใจเต้นแรงมาก`); }
          else { const fine = Math.max(200, Math.round(s.money * .12 / 10) * 10); DV.giveFine(fine, 'ลักทรัพย์'); DV.netEvSend({ k: 'caught', fine }); DV.sfx('line');
            DV.showCard({ id: 'caught', type: 'night', art: 'night', title: 'ลิ้นชักดังเอี๊ยด!', text: `เพื่อนหันมาเห็นพอดี ดาบเสถียรผ่านมาหน้าบ้านพอดีอีก…\nโดนปรับ ฿${fine} จ่ายที่ป้อมตำรวจ ถ้าไม่จ่ายใน 3 วันจะมีหมายศาล และทั้งหมู่บ้านจะรู้`,
              choices: [{ label: 'ก้มหน้ารับผิด', hint: 'จ่ายที่ป้อมตำรวจในตำบล', effect: {} }] }); }
          DV.hud(); DV.save(); } }); } },
    { label: 'ปิดลิ้นชักไว้เหมือนเดิม', icon: ['ui', 'close'], run: () => { DV.closeSheet(); DV.toast('ดีแล้ว เพื่อนกันนะ'); } }]);
};

// ================= ghosts: run-away card becomes a minigame =================
DV.runFromGhost = (name, emo) => MG.pick(['mash', 'dodge', 'arrows'], { key: 'ghostrun', dark: true, title: `👻 ${name || 'ผี'}ไล่ตาม!`,
  per: { mash: { need: 24, time: 5.5, chaser: emo || '👻', sub: 'สลับกดซ้าย–ขวา วิ่งให้ถึงบ้าน!' }, dodge: { time: 8, lives: 3, chaser: emo || '👻', obstacles: ['🌳', '🪨', '🐍', '🕸️', '🎋'], sub: 'วิ่งหนีในความมืด! แตะซ้าย/ขวา หลบสิ่งกีดขวาง' },
    arrows: { n: 8, limit: 1050, sub: 'เลี้ยวหลบให้ทัน! กดลูกศรตามที่ขึ้น' } },
  onEnd: sc => { const ok = sc >= .7; if (ok) { DV.addEnergy(-6); DV.toast('วิ่งถึงบันไดบ้านทัน! หอบนิดหน่อย (แรง −6)'); DV.goHome && DV.goHome(); }
    else { DV.addEnergy(-35); DV.toast('ขาพันกันล้มกลางทาง… กว่าจะคลานถึงบ้านแรงหมด (แรง −35)'); DV.goHome && DV.goHome(); }
    DV.hud(); DV.save(); DV.checkFaint && DV.checkFaint(); } });

// ================= ghost encounter (js/ghosts.js): darkness → place → the ghost comes out of the screen → choose, each choice a minigame =================
DV.scareLevel = () => { try { return localStorage.getItem('dv_scare') || 'mid'; } catch (_) { return 'mid'; } };
const _nearWater = () => { const M = DV.M, p = DV.player; if (!M.water) return false; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if ((M.water[p.cy + dy] || [])[p.cx + dx]) return true; return false; };
DV.ghostScare = () => {
  const s = S(), pool = window.GS.LIST.filter(g => g.id !== s.lastGhost), G = DV.pick(pool); s.lastGhost = G.id;   // never the same ghost two nights running
  DV.closeAll(); DV.setBusy && DV.setBusy(false); DV.player.path = []; DV.stat('ghosts');
  const luck = (s.amuletDay === s.day ? .4 : 0) + (s.prayedDay === s.day ? .2 : 0);
  window.GS.encounter({ id: G.id, level: DV.scareLevel(), luck, onDone: (ok, text, cost) => {
    DV.addEnergy(-cost); DV.toast(`${text} (แรง −${cost})`); DV.goHome && DV.goHome(); DV.hud(); DV.save(); DV.checkFaint && DV.checkFaint(); } });
};

// ================= daily hooks =================
const morning = DV.onMorning;
DV.onMorning = () => { const s = S(); morning && morning(); if (!own) chickensMorning(s); finesMorning(s); setTimeout(placeYaiBox, 300);
  setTimeout(() => DV.ticker && DV.ticker('📢 ราคาพืชผลวันนี้: ' + priceLine()), 6000); };
})();
