// Dream Valley — core: state, items, save slots (ชื่อ + รหัส 6 ตัว), helpers
(() => {
'use strict';
const DV = window.DV = window.DV || {};
DV.T = 32;
DV.DAY_START = 6 * 60; DV.DAY_LEN = 18 * 60; DV.NIGHT = 15 * 60; DV.MAX_E = 100; DV.CAN_MAX = 12;
DV.$ = id => document.getElementById(id);
DV.pick = a => a && a.length ? a[Math.floor(Math.random() * a.length)] : null;
DV.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
DV.fmt = m => { const t = DV.DAY_START + Math.floor(m); return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
DV.hm = s => { if (typeof s === 'number') return s; const [h, m] = String(s).split(':').map(Number); return (h * 60 + (m || 0)) - DV.DAY_START; };
DV.weekday = d => ((d - 1) % 7) + 1;

// ---------- items ----------
const BASE = {
  chili: { name: 'พริก', icon: 'crop_chili', sell: 25 }, basil: { name: 'กะเพรา', icon: 'crop_holy_basil', sell: 15 },
  corn: { name: 'ข้าวโพดหวาน', icon: 'crop_sweet_corn', sell: 30 }, morning_glory: { name: 'ผักบุ้ง', icon: 'crop_water_spinach', sell: 12 },
  mango: { name: 'มะม่วง', icon: 'crop_mango', sell: 10, eat: 12 }, tamarind: { name: 'มะขามฝัก (กำ)', icon: 'item_fruit_basket', sell: 10, eat: 5 },
  wood: { name: 'ไม้ฟืน (มัด)', icon: 'misc_wood', sell: 15 }, stone: { name: 'ก้อนหิน', icon: 'misc_stone', sell: 2 },
  ant_egg: { name: 'ไข่มดแดง (ห่อ)', icon: 'item_red_ant_egg', sell: 60 }, mushroom: { name: 'เห็ดโคนไม้', icon: 'item_het_ranghin', sell: 25 },
  mush2: { name: 'เห็ดระโงก', icon: 'item_het_rakhang', sell: 40 }, marble: { name: 'ลูกแก้วเก่า', icon: 'item_marble', sell: 5 },
  honey: { name: 'น้ำผึ้งป่า (ขวด)', icon: 'item_wild_honey', sell: 150, eat: 20 }, worm: { name: 'ไส้เดือน', icon: 'item_earthworm', sell: 1 },
  khaijiao: { name: 'ข้าวไข่เจียว', icon: 'food_khai_jiao', buy: 35, eat: 30, food: true },
  kaprao: { name: 'ข้าวกะเพราไข่ดาว', icon: 'food_kaprao', buy: 50, eat: 40, food: true },
};
DV.SEEDS = { chili: { name: 'พริก', icon: 'seed_chili', pack: 30 }, basil: { name: 'กะเพรา', icon: 'seed_holy_basil', pack: 20 },
  corn: { name: 'ข้าวโพดหวาน', icon: 'seed_sweet_corn', pack: 90 }, morning_glory: { name: 'ผักบุ้ง', icon: 'seed_water_spinach', pack: 20 } };
DV.item = id => {
  if (BASE[id]) return BASE[id];
  const c = (window.DV_CATALOG || {})[id];
  if (c) {
    const EDIBLE = ['instant_noodle', 'canned_fish', 'snack', 'khanom_chan', 'khanom_pia', 'lodchong', 'nam_khaeng_sai', 'boiled_peanut', 'meatball_fried', 'moo_krob',
      'iced_coffee', 'soy_milk_set', 'energy_drink', 'tangerine', 'somsaiNamPueng', 'egg_chicken', 'egg_duck', 'herbal_tea', 'chinese_tea', 'fish_snakehead_grill', 'fish_tilapia_grill', 'tomyum_frog', 'somtum_poo_plara'];
    const food = /อาหาร/.test(c.where || '') || EDIBLE.includes(id);
    const price = c.buy || c.sell || 20;
    return { name: c.name, icon: c.icon || 'item_trash', sell: c.sell || Math.max(1, Math.round(price * .5)), buy: c.buy || Math.round((c.sell || 20) * 1.4),
      eat: food ? Math.min(45, 8 + Math.round(price / 3)) : 0, food };
  }
  return { name: id, icon: 'item_trash', sell: 1 };
};
DV.icon = name => { const idx = (window.DV_ICONS || {})[name]; return idx == null ? (window.DV_ICONS || {}).item_trash : idx; };

// ---------- state ----------
DV.S = null;
DV.newState = (name, code, gender, dayLen) => ({
  v: 3, name, code, gender, dayLen: dayLen || 10, day: 1, min: 0, energy: DV.MAX_E, money: 500, water: DV.CAN_MAX,
  map: 'farm', px: 16, py: 6, dir: 0, farmV: 2,
  seeds: { chili: 5, basil: 5, corn: 3, morning_glory: 0 }, items: {}, cells: null, trees: {}, gone: {}, spots: {},
  skill: { forage: 0 }, stats: {}, flags: {}, hearts: {}, talked: {}, gifted: {}, convo: {}, convoHeart: {}, reactDay: {},
  q: {}, scenes: {}, line: { read: 0, liked: {}, posted: {}, dmRead: {}, dmAns: {}, bcSeen: {} }, diary: {},
  rain: false, cardsToday: 0, napCount: 0, drinkCount: 0, prayedDay: 0, mailDay: 0, amuletDay: 0, seenCards: {}, savedAt: 0,
});
DV.heart = n => (DV.S.hearts[n] || 0);
DV.addHeart = (n, v) => { DV.S.hearts[n] = DV.clamp((DV.S.hearts[n] || 0) + v, 0, 10); };
DV.addItem = (k, n = 1) => { DV.S.items[k] = (DV.S.items[k] || 0) + n; if (DV.S.items[k] <= 0) delete DV.S.items[k]; };
DV.has = (k, n = 1) => (DV.S.items[k] || 0) >= n;
DV.stat = (k, n = 1) => { DV.S.stats[k] = (DV.S.stats[k] || 0) + n; };
DV.setFlag = f => { if (!f) return; const fresh = !DV.S.flags[f]; DV.S.flags[f] = DV.S.day || 1; if (fresh && DV.onFlag) DV.onFlag(f); };

// ---------- save slots: ชื่อ + รหัส 6 ตัว (เครื่องนี้ + คลาวด์ถ้ามี) ----------
const hex = s => Array.from(new TextEncoder().encode(s)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 60);
DV.slotKey = (name, code) => (String(code).toUpperCase() + '-' + hex(name.trim())).replace(/[^A-Za-z0-9_\-]/g, '');
const LS = 'dv3_save_';
let cloud = null, cloudUid = null, cloudTried = false;
DV.cloudReady = async () => {
  if (cloudTried) return !!cloud;
  cloudTried = true;
  try {
    if (!window.claude || !window.claude.use) return false;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) return false;
    const id = await user.id(); if (!id) return false;
    cloud = db; cloudUid = id; return true;
  } catch (e) { return false; }
};
const cloudDoc = key => cloud.doc('data/users/' + cloudUid + '/dvsave-' + key);
DV.saveLocal = () => {
  const S = DV.S; if (!S) return;
  S.savedAt = Date.now();
  try { localStorage.setItem(LS + DV.slotKey(S.name, S.code), JSON.stringify(S)); localStorage.setItem('dv3_last', JSON.stringify({ name: S.name, code: S.code })); } catch (e) {}
};
let lastCloud = 0, cloudBusy = false;
DV.save = (force) => {
  DV.saveLocal();
  if (!cloud || cloudBusy) return;
  const now = Date.now(); if (!force && now - lastCloud < 45000) return;
  lastCloud = now; cloudBusy = true;
  const S = DV.S;
  cloudDoc(DV.slotKey(S.name, S.code)).set({ json: JSON.stringify(S), savedAt: S.savedAt, day: S.day, name: S.name })
    .catch(() => {}).finally(() => { cloudBusy = false; });
};
DV.loadSlot = async (name, code) => {
  const key = DV.slotKey(name, code);
  let local = null, remote = null;
  try { local = JSON.parse(localStorage.getItem(LS + key)); } catch (e) {}
  if (await DV.cloudReady()) {
    try { const d = await cloudDoc(key).get(); if (d.exists) remote = JSON.parse(d.data().json); } catch (e) {}
  }
  const best = [local, remote].filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
  return best || null;
};
DV.slotExists = async (name, code) => !!(await DV.loadSlot(name, code));
DV.lastLogin = () => { try { return JSON.parse(localStorage.getItem('dv3_last')); } catch (e) { return null; } };
DV.deleteSlot = async (name, code) => {
  const key = DV.slotKey(name, code);
  try { localStorage.removeItem(LS + key); } catch (e) {}
  if (await DV.cloudReady()) { try { await cloudDoc(key).delete(); } catch (e) {} }
};
DV.cloudLabel = () => cloud ? 'เซฟบนคลาวด์ของบัญชีนี้ + เครื่องนี้' : 'เซฟในเครื่องนี้';

// ---------- text helpers ----------
DV.PEERS = ['praew', 'palm', 'toey', 'tam', 'kla', 'nok', 'ball', 'may', 'ann', 'mew', 'oat', 'ton', 'thana'];
DV.say = s => !s ? '' : String(s).replace(/(นะ|สิ|ล่ะ|เหรอ|นี่|ไหม|หรือ|เปล่า)\{k\}/g, '$1{kq}')
  .replace(/\{player\}/g, DV.S ? DV.S.name : 'หลาน').replace(/\{item\}/g, DV._item || '')
  .replace(/\{p\}/g, DV.S && DV.S.gender === 'f' ? (DV.PEERS.includes(DV._talkTo) ? 'ฉัน' : 'หนู') : 'ผม').replace(/\{kq\}/g, DV.S && DV.S.gender === 'f' ? 'คะ' : 'ครับ')
  .replace(/\{k\}/g, DV.S && DV.S.gender === 'f' ? 'ค่ะ' : 'ครับ').replace(/\{festival\}/g, 'งานวัด').replace(/\{season\}/g, 'หน้าฝน').replace(/\{price\}/g, '');

// generic condition check used by convos, quests, scenes, LINE
DV.cond = (w, ctx = {}) => {
  if (!w) return true;
  const S = DV.S, m = S.min, h = ctx.npc ? DV.heart(ctx.npc) : 0;
  if (w.gender && S.gender !== w.gender) return false;
  if (w.day != null && S.day !== w.day) return false;
  if (w.day_min != null && S.day < w.day_min) return false; if (w.day_max != null && S.day > w.day_max) return false;
  if (w.heart_min != null && h < w.heart_min) return false; if (w.heart_max != null && h > w.heart_max) return false;
  if (w.heart && typeof w.heart === 'object') for (const k in w.heart) if (DV.heart(k) < w.heart[k]) return false;
  if (w.time === 'morning' && m >= 300) return false; if (w.time === 'noon' && (m < 300 || m >= 540)) return false;
  if (w.time === 'evening' && (m < 540 || m >= 900)) return false;
  if (w.time === 'night' && m < 900) return false;
  if (w.time_from != null && m < DV.hm(w.time_from)) return false; if (w.time_to != null && m > DV.hm(w.time_to)) return false;
  if (w.rain != null && !!S.rain !== !!w.rain) return false;
  const fl = v => (Array.isArray(v) ? v : [v]);
  if (w.flag && !fl(w.flag).every(f => S.flags[f])) return false;
  if (w.not_flag && fl(w.not_flag).some(f => S.flags[f])) return false;
  if (w.any_flag && !fl(w.any_flag).some(f => S.flags[f])) return false;
  if (w.has_item && !DV.has(w.has_item)) return false;
  if (w.fainted_recent && !(S.flags.faintedDay && S.day - S.flags.faintedDay <= 1)) return false;
  if (w.map && S.map !== w.map) return false;
  if (w.weekday != null && DV.weekday(S.day) !== w.weekday) return false;
  const nd = Object.keys(S.flags).filter(f => f.startsWith('diary_')).length;
  if (w.diary_min != null && nd < w.diary_min) return false; if (w.diary_max != null && nd > w.diary_max) return false;
  if (w.money_min != null && S.money < w.money_min) return false;
  return true;
};

// shared effects (story scenes, cards, quest rewards, convo options)
DV.applyEffect = (e, ctx = {}) => {
  if (!e) return [];
  const S = DV.S, msgs = [];
  if (e.chance) { const p = (S.prayedDay === S.day && e.chance.pIfPrayed) || e.chance.p; e = Math.random() < p ? e.chance.win : e.chance.lose; }
  if (e.money) { S.money = Math.max(0, S.money + e.money); msgs.push(`เงิน ${e.money > 0 ? '+' : ''}${e.money}`); }
  if (e.energy) DV.addEnergy && DV.addEnergy(e.energy);
  if (typeof e.heart === 'number' && ctx.npc) DV.addHeart(ctx.npc, e.heart);
  if (e.heart && typeof e.heart === 'object') for (const k in e.heart) DV.addHeart(k, e.heart[k]);
  if (e.items) for (const k in e.items) DV.addItem(k, e.items[k]);
  if (e.lotto && DV.buyLotto) DV.buyLotto(e.lotto);
  if (e.seeds) for (const k in e.seeds) S.seeds[k] = (S.seeds[k] || 0) + e.seeds[k];
  for (const f of [].concat(e.set_flag || e.setFlag || [])) DV.setFlag(f);
  if (e.clear_flag) for (const f of [].concat(e.clear_flag)) delete S.flags[f];
  if (e.line && DV.postLine) DV.postLine(e.line);
  if (e.start_quest && DV.startQuest) DV.startQuest(e.start_quest);
  if (e.forage && DV.gainForage) DV.gainForage(e.forage);
  if (e.waterAll && DV.waterAll) DV.waterAll();
  if (e.damageCrop && DV.damageCrop) DV.damageCrop();
  if (e.sell && DV.sellCrop) msgs.push(DV.sellCrop(e.sell));
  if (e.goHome && DV.goHome) DV.goHome();
  if (e.text) msgs.unshift(DV.say(e.text));
  if (e.mins && DV.addMins) DV.addMins(e.mins);
  return msgs;
};
})();
