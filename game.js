// Dream Valley — ฉากฟาร์มยาย (เล่นได้จริง) · vanilla JS + canvas, เปิดจากไฟล์ได้เลย ไม่ต้องติดตั้ง
// ระบบตาม docs/design/22_controls_tap.md + การตัดสินใจล่าสุด:
//  - แตะเดิน (BFS 4 ทิศ) · แตะของ/คน/ต้นไม้/แปลง → เมนู · ไม่มีท่าใช้เครื่องมือ (ไอคอน+เอฟเฟกต์)
//  - นาฬิกาเดินเองตามเวลาจริง (1 วันในเกม = 5/10/15 นาทีจริง เลือกก่อนเริ่มเกม) · การกระทำกินแค่แรง
//  - แรงฟื้นด้วยการนั่งพัก / กินอาหาร / นอน · จุดสุ่มซ่อนตามทาง · การ์ดเหตุการณ์ · ผีกลางคืน = การ์ด
(() => {
'use strict';
const SC = window.DV_SCENE, META = window.DV_META, TAEW = window.DV_TAEW, CARDS = window.DV_CARDS;
const T = 32, MW = SC.W, MH = SC.H, PW = MW * T, PH = MH * T;
const DAY_START = 6 * 60, DAY_LEN = 18 * 60;          // 06:00 – 24:00 (นาทีในเกม)
const NIGHT = 15 * 60;                                 // 21:00 (นาทีนับจาก 06:00)
const MAX_E = 100, CAN_MAX = 12, SAVE_KEY = 'dv_farm_yai_v2', OLD_KEY = 'dv_farm_yai_v1';

// ---------- พืช (ราคาอิง docs/prices/crops.csv ปรับเป็นต่อครั้งเก็บ) ----------
const CROPS = {
  chili:         { name: 'พริก',         row: 0, seedIcon: 0, prodIcon: 4, pack: 30, sell: 25, regrow: 2 },
  basil:         { name: 'กะเพรา',       row: 1, seedIcon: 1, prodIcon: 5, pack: 20, sell: 15, regrow: 2 },
  corn:          { name: 'ข้าวโพดหวาน',  row: 2, seedIcon: 2, prodIcon: 6, pack: 90, sell: 30, regrow: -1 },
  morning_glory: { name: 'ผักบุ้ง',       row: 3, seedIcon: 3, prodIcon: 7, pack: 20, sell: 12, regrow: 2 },
};
const CROP_KEYS = Object.keys(CROPS);
// ของอื่น ๆ (ต้นไม้ จุดซ่อน อาหาร) · ic = ช่องใน assets/icons2.png · ราคาอิงราคาจริงตลาดบ้านนอก
const ITEMS = {
  mango:    { name: 'มะม่วง',          ic: 0,  sell: 10,  eat: 12 },
  tamarind: { name: 'มะขามฝัก (กำ)',   ic: 1,  sell: 10,  eat: 5 },
  wood:     { name: 'ไม้ฟืน (มัด)',     ic: 2,  sell: 15 },
  stone:    { name: 'ก้อนหิน',          ic: 3,  sell: 2 },
  ant_egg:  { name: 'ไข่มดแดง (ห่อ)',   ic: 4,  sell: 60 },
  mushroom: { name: 'เห็ดโคนไม้',       ic: 5,  sell: 25 },
  mush2:    { name: 'เห็ดระโงก',        ic: 6,  sell: 40 },
  marble:   { name: 'ลูกแก้วเก่า',       ic: 7,  sell: 5 },
  honey:    { name: 'น้ำผึ้งป่า (ขวด)',  ic: 8,  sell: 150, eat: 20 },
  worm:     { name: 'ไส้เดือน (เหยื่อตกปลา)', ic: 12, sell: 1 },
  khaijiao: { name: 'ข้าวไข่เจียว',      ic: 10, buy: 35, eat: 30, food: true },
  kaprao:   { name: 'ข้าวกะเพราไข่ดาว',  ic: 13, buy: 50, eat: 40, food: true },
};
// แรงที่ใช้ (22.2 ปรับใหม่: การกระทำกินแค่แรง เวลาเดินเอง)
const COST = { clear: 2, pick: 1, hoe: 2, plant: 1, water: 1, harvest: 1, talk: 1, refill: 1,
  fruit: 3, pods: 2, chop: 6, stump: 8, gather: 1 };
const TOOL = { hoe: 0, can: 1, sickle: 2, hand: 3, bucket: 4, axe: 5, saw: 6, rake: 7 };
const SHEET_N = { tools: 8, icons: 10, icons2: 14 };

// ---------- canvas ----------
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
let dpr = 1, zoom = 2, VW = 0, VH = 0;
function resize() {
  dpr = window.devicePixelRatio || 1;
  const w = innerWidth, h = innerHeight;
  let z = Math.min(w, h) / (10 * T);
  z = Math.max(z, w / PW, h / PH);                     // ห้ามเห็นเกินขอบแผนที่
  let dev = Math.max(1, Math.round(z * dpr));          // พิกเซลจอต่อพิกเซลภาพ = จำนวนเต็ม → คม
  if (dev / dpr < Math.max(w / PW, h / PH)) dev = Math.ceil(Math.max(w / PW, h / PH) * dpr);
  zoom = dev / dpr;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  VW = w / zoom; VH = h / zoom;
}
addEventListener('resize', resize); resize();

// ---------- assets ----------
const IMG = {};
function load(name, src) { return new Promise(r => { const i = new Image(); i.onload = () => { IMG[name] = i; r(); }; i.onerror = () => { console.warn('missing', src); r(); }; i.src = src; }); }
const loads = [['bg', 'assets/bg.png'], ['soil', 'assets/soil_dual.png'], ['wet', 'assets/soil_wet.png'], ['crops', 'assets/crops.png'],
  ['player_m', 'assets/player_m.png'], ['player_f', 'assets/player_f.png'], ['npc', 'assets/npc_taeo.png'], ['tools', 'assets/tools.png'],
  ['icons', 'assets/icons.png'], ['icons2', 'assets/icons2.png'], ['hedge', 'assets/hedge.png']];
SC.objects.forEach(o => loads.push(['o_' + o.img, `assets/obj/${o.img}.png`]));
Object.keys(META.debris).forEach(k => loads.push(['o_' + k, `assets/obj/${k}.png`]));
['tree_mango_0', 'tree_tamarind_5'].forEach(k => loads.push(['o_' + k, `assets/obj/${k}.png`]));

// ---------- แตะได้อะไรบ้าง ----------
// ต้นไม้: มะม่วงที่มีผล/มะขามที่มีฝัก เก็บได้ ผลกลับมาใน 3 วัน · ทุกต้นตัดกิ่งแห้งทำฟืนได้วันละครั้ง
function treeInfo(o) {
  const tam = o.img.startsWith('tree_tamarind');
  const fruit = o.img.includes('fruit_full') ? 5 : o.img.includes('fruit_mid') ? 3 : o.img.includes('fruit_few') ? 2 : o.img.includes('pods') ? 4 : 0;
  return { kind: tam ? 'tamarind' : 'mango', name: tam ? 'ต้นมะขาม' : 'ต้นมะม่วง', fruit, bare: tam ? 'tree_tamarind_5' : 'tree_mango_0' };
}
// ของเล็กบนพื้น: กิ่งไม้/หินก้อนเล็ก เก็บได้ (กลับมาพรุ่งนี้) · ตอไม้ ผ่าทำฟืน (หายถาวร) · หินใหญ่ ต้องมีค้อนปอนด์
const DECO_TAP = { obstacle_00: 'pebble', obstacle_04: 'branch', obstacle_03: 'stump', obstacle_01: 'boulder', obstacle_02: 'boulder' };
const TAP_OVERRIDE = { bench: 'bench' };
const tapOf = o => o.tap || TAP_OVERRIDE[o.id] || DECO_TAP[o.img] || null;

// ---------- state ----------
let S = null;          // saved game state
const blocked = SC.blocked.map(r => r.slice());
const [PX, PY, PWc, PHc] = SC.plot;
const inPlot = (x, y) => x >= PX && x < PX + PWc && y >= PY && y < PY + PHc;
const HOME_DOOR = { x: 7, y: 5 };
const TAEW_SPOT = { x: 23, y: 14 }, TAEW_OFF = { x: 27, y: 14 };

function newState(gender, name, dayLen) {
  const cells = {};
  const DEB = ['debris_05', 'debris_06', 'debris_24', 'debris_25', 'debris_00', 'debris_04'];
  let r = 11;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let y = PY; y < PY + PHc; y++) for (let x = PX; x < PX + PWc; x++) {
    const c = { soil: false, wet: false, crop: null, debris: null };
    if (x < PX + 2 && y < PY + 2) { c.soil = true; c.crop = { k: 'chili', st: 4 }; }           // พริกของยาย พร้อมเก็บ
    else if (x < PX + 4 && y < PY + 2) { c.soil = true; c.crop = { k: 'basil', st: 3 }; }  // กะเพรายาย
    else if (y === PY && x < PX + 8) { c.soil = true; }                                      // ร่องที่ยายพรวนไว้
    else if (rnd() < 0.45) c.debris = DEB[Math.floor(rnd() * DEB.length)];                  // หญ้ารก
    cells[x + ',' + y] = c;
  }
  const s = { v: 2, gender, name: name || 'หลาน', dayLen: dayLen || 10, day: 1, min: 0, energy: MAX_E, money: 500, water: CAN_MAX,
    seeds: { chili: 5, basil: 5, corn: 3, morning_glory: 0 }, prod: { chili: 0, basil: 0, corn: 0, morning_glory: 0 },
    heart: 0, talkedDay: 0, giftDay: 0, napCount: 0, prayedDay: 0, mailDay: 0,
    cardsToday: 0, seenCards: {}, flags: {}, px: HOME_DOOR.x, py: HOME_DOOR.y, dir: 0, cells, rain: false };
  return upgrade(s);
}
function upgrade(s) {           // เซฟเก่า (v1) → v2
  s.v = 2; s.dayLen = s.dayLen || 10; s.items = s.items || {}; s.trees = s.trees || {}; s.gone = s.gone || {};
  s.skill = s.skill || { forage: 0 }; s.stats = s.stats || {}; s.quests = s.quests || {}; s.spots = s.spots || null;
  if (!s.spots) s.spots = makeSpots(s.day);
  return s;
}
const cell = (x, y) => S.cells[x + ',' + y];
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) return s; } catch (e) {}
  try { const s = JSON.parse(localStorage.getItem(OLD_KEY)); if (s && s.v === 1) return upgrade(s); } catch (e) {}
  return null;
}
const stat = (k, n = 1) => { S.stats[k] = (S.stats[k] || 0) + n; };
const addItem = (k, n = 1) => { S.items[k] = (S.items[k] || 0) + n; };

// ---------- entities ----------
const player = { x: 0, y: 0, cx: 0, cy: 0, dir: 0, path: [], moving: false, t: 0, onArrive: null, sheet: 'player_m', tool: -1, prog: 0, sit: false, sitAcc: 0 };
const npc = { x: 0, y: 0, cx: TAEW_SPOT.x, cy: TAEW_SPOT.y, dir: 3, path: [], moving: false, t: 0, present: true, sheet: 'npc', speed: 46 };
// dir: 0=S 1=N 2=E 3=W (แถวใน atlas)
function place(e, cx, cy) { e.cx = cx; e.cy = cy; e.x = cx * T + T / 2; e.y = cy * T + T - 4; e.path = []; e.moving = false; }

// ---------- pathfinding (BFS บนตาราง 32px, 4 ทิศ) ----------
function rebuildBlocked() {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) blocked[y][x] = SC.blocked[y][x];
  SC.objects.forEach(o => { if (isGone(o)) o.block.forEach(([a, b]) => { blocked[b][a] = 0; }); });
}
const isGone = o => S && S.gone[o.id] != null && S.day < S.gone[o.id];
function walkable(x, y, ignoreNpc) {
  if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
  if (blocked[y][x]) return false;
  if (!ignoreNpc && npc.present && npc.cx === x && npc.cy === y) return false;
  return true;
}
function bfs(sx, sy, goalFn) {
  const prev = new Int32Array(MW * MH).fill(-2); const q = [sy * MW + sx]; prev[q[0]] = -1;
  for (let h = 0; h < q.length; h++) {
    const id = q[h], x = id % MW, y = (id / MW) | 0;
    if (goalFn(x, y)) { const out = []; let k = id; while (k !== -1) { out.push([k % MW, (k / MW) | 0]); k = prev[k]; } return out.reverse(); }
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, nid = ny * MW + nx;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || prev[nid] !== -2 || !walkable(nx, ny)) continue;
      prev[nid] = id; q.push(nid);
    }
  }
  return null;
}
function goTo(goalFn, onArrive) {
  standUp();
  const p = bfs(player.cx, player.cy, goalFn);
  if (!p) { toast('ไปตรงนั้นไม่ได้'); return false; }
  player.path = p.slice(1); player.onArrive = onArrive || null; player.walkTiles = 0;
  if (!player.path.length) arrive();
  return true;
}
const adjTo = cells => (x, y) => cells.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1);
function face(tx, ty) {
  const dx = tx - player.cx, dy = ty - player.cy;
  player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
}

// ---------- time (เดินเองตามเวลาจริง) / energy ----------
const fmt = m => { const t = DAY_START + Math.floor(m); return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const gmPerSec = () => DAY_LEN / (S.dayLen * 60);       // นาทีในเกมต่อ 1 วินาทีจริง
let dayOver = false;
function addMins(m) {
  if (dayOver) return false;
  const before = S.min; S.min += m;
  if (before < NIGHT - 30 && S.min >= NIGHT - 30 && S.min < NIGHT) toast('สองทุ่มครึ่งแล้ว หมาเริ่มหอน… รีบกลับบ้านนะ');
  if (before < NIGHT && S.min >= NIGHT) toast(nearHome() ? 'สามทุ่มแล้ว อยู่ใกล้บ้าน ปลอดภัย' : 'สามทุ่มแล้ว! อยู่นอกบ้านอาจเจอผี');
  if (before < DAY_LEN - 60 && S.min >= DAY_LEN - 60) toast('ห้าทุ่มแล้ว ถ้าไม่นอนก่อนเที่ยงคืนจะเป็นลม');
  if (Math.floor(before / 60) !== Math.floor(S.min / 60)) onNewHour();
  updateNpcSchedule();
  if (S.min >= DAY_LEN) {
    S.min = DAY_LEN; dayOver = true; busy = false; player.path = []; standUp();
    if (nearHome()) { toast('เที่ยงคืนแล้ว ง่วงจนตาปิด…'); overlayFade(() => newDay(false)); }
    else faint('เที่ยงคืนแล้ว ร่างกายไม่ไหว ล้มหลับไปกลางลาน…');
    return false;
  }
  return true;
}
function onNewHour() {            // ทุกชั่วโมงในเกม มีโอกาสเกิดเหตุการณ์สุ่ม
  if (!busy && !player.path.length && $('sheet').classList.contains('hidden')) maybeRandomCard(0.18);
  save();
}
function addEnergy(e, quiet) { S.energy = Math.max(0, Math.min(MAX_E, S.energy + e)); if (e < 0 && !quiet) floatText(player.x, player.y - 60, `แรง ${e}`, '#ffd2a8'); }
function checkFaint() { if (S.energy <= 0) { faint('แรงหมด ตาลาย… ล้มลงตรงนั้นเลย'); return true; } return false; }
function paused() {
  return !S || !$('title').classList.contains('hidden') || cardOpen() || !$('talk').classList.contains('hidden')
    || !$('map').classList.contains('hidden') || fadeA > 0 || dayOver || document.hidden;
}

// ---------- นั่งพัก ----------
function sitDown(where, pos) { player.sit = where; player.sitAcc = 0; player.path = []; if (pos) { player.x = pos[0]; player.y = pos[1]; player.dir = 0; } toast(`นั่งพัก${where} แรงค่อย ๆ ฟื้น · แตะที่อื่นเพื่อลุก`); }
function standUp() { if (player.sit) { player.sit = false; player.lift = 0; place(player, player.cx, player.cy); hud(); save(); } }

// ---------- actions with feedback (22.3: ไอคอนเครื่องมือ + เอฟเฟกต์ + แถบเวลา) ----------
let busy = false;
function doAction({ energy = 0, tool = -1, fx = null, targets = [], apply, after }) {
  if (busy) return;
  busy = true; closeSheet(); standUp();
  const n = Math.max(1, targets.length);
  const dur = 450 + Math.min(n, 30) * 180;
  player.tool = tool; player.prog = 0;
  const t0 = performance.now();
  sfx(fx || 'tick');
  let i = 0;
  const step = () => {
    const k = (performance.now() - t0) / dur; player.prog = Math.min(1, k);
    while (i < targets.length && i < k * targets.length) { const [x, y] = targets[i++]; burst(x, y, fx); if (apply) apply(x, y); dirtySoil = true; }
    if (k < 1) return requestAnimationFrame(step);
    while (i < targets.length) { const [x, y] = targets[i++]; burst(x, y, fx); if (apply) apply(x, y); }
    if (!targets.length && apply) apply();
    dirtySoil = true; player.tool = -1; busy = false;
    addEnergy(-energy);
    hud(); save();
    if (dayOver || checkFaint()) return;
    if (after) after(); else maybeRandomCard(0.12);
  };
  requestAnimationFrame(step);
}

// ---------- plot logic ----------
function plotCells(pred) { const out = []; for (let y = PY; y < PY + PHc; y++) for (let x = PX; x < PX + PWc; x++) { const c = cell(x, y); if (pred(c, x, y)) out.push([x, y]); } return out; }
function costLabel(e, n = 1) { return e ? `แรง −${e * n}` : 'ไม่ใช้แรง'; }
function warnCost(e, n = 1) { return e && S.energy - e * n <= 0; }

function openPlot(x, y) {
  const c = cell(x, y); const opts = []; const nW = Math.min(S.water, plotCells(q => q.crop && !q.wet && q.crop.st < 4).length);
  let title = 'แปลงผักยาย', sub = '', icon = null;
  const clear = (a, b) => { cell(a, b).debris = null; stat('cleared'); };
  const hoe = (a, b) => { cell(a, b).soil = true; };
  if (c.debris) {
    const stone = c.debris === 'debris_00' || c.debris === 'debris_04';
    title = stone ? (c.debris === 'debris_00' ? 'ก้อนหิน' : 'กิ่งไม้') : 'หญ้ารก'; sub = 'ต้องเก็บกวาดก่อนพรวนดิน';
    const cc = stone ? COST.pick : COST.clear;
    opts.push({ label: stone ? 'เก็บออก' : 'ถอนหญ้า', icon: ['tools', stone ? TOOL.hand : TOOL.sickle], cost: cc,
      run: () => doAction({ energy: cc, tool: stone ? TOOL.hand : TOOL.sickle, fx: 'grass', targets: [[x, y]], apply: clear }) });
    const all = plotCells(q => q.debris);
    if (all.length > 1) opts.push({ label: `เก็บกวาดทั้งแปลง (${all.length} ช่อง)`, icon: ['tools', TOOL.sickle], cost: COST.clear, n: all.length,
      run: () => doAction({ energy: COST.clear * all.length, tool: TOOL.sickle, fx: 'grass', targets: all, apply: clear }) });
  } else if (!c.soil) {
    title = 'ดินหญ้า'; sub = 'พรวนแล้วถึงจะปลูกได้';
    opts.push({ label: 'พรวนดิน', icon: ['tools', TOOL.hoe], cost: COST.hoe,
      run: () => doAction({ energy: COST.hoe, tool: TOOL.hoe, fx: 'dirt', targets: [[x, y]], apply: hoe }) });
    const all = plotCells(q => !q.debris && !q.soil);
    if (all.length > 1) opts.push({ label: `พรวนทั้งแปลง (${all.length} ช่อง)`, icon: ['tools', TOOL.hoe], cost: COST.hoe, n: all.length,
      run: () => doAction({ energy: COST.hoe * all.length, tool: TOOL.hoe, fx: 'dirt', targets: all, apply: hoe }) });
  } else if (!c.crop) {
    title = 'ดินพรวนแล้ว'; sub = c.wet ? 'ดินชุ่มน้ำ' : 'ดินแห้ง · เลือกเมล็ดที่จะปลูก';
    const empty = plotCells(q => q.soil && !q.crop);
    CROP_KEYS.forEach(k => {
      const has = S.seeds[k];
      const plant = (a, b) => { if (S.seeds[k] <= 0) return; cell(a, b).crop = { k, st: 0 }; S.seeds[k]--; stat('planted'); };
      opts.push({ label: `ปลูก${CROPS[k].name}`, icon: ['icons', CROPS[k].seedIcon], cost: COST.plant, extra: `เหลือ ${has}`, disabled: !has && 'ไม่มีเมล็ด',
        run: () => doAction({ energy: COST.plant, tool: TOOL.hand, fx: 'seed', targets: [[x, y]], apply: plant }) });
      const n = Math.min(has, empty.length);
      if (n > 1) opts.push({ label: `ปลูก${CROPS[k].name}ทุกช่องว่าง (${n} ช่อง)`, icon: ['icons', CROPS[k].seedIcon], cost: COST.plant, n,
        run: () => doAction({ energy: COST.plant * n, tool: TOOL.hand, fx: 'seed', targets: empty.slice(0, n), apply: plant }) });
    });
  } else {
    const cr = CROPS[c.crop.k]; icon = ['icons', cr.prodIcon];
    title = cr.name; sub = c.crop.st >= 4 ? 'โตเต็มที่ เก็บได้แล้ว!' : `ระยะ ${c.crop.st + 1}/5 · ${c.wet ? 'รดน้ำแล้ว รอพรุ่งนี้โต' : 'ดินแห้ง ต้องรดน้ำ'}`;
    if (c.crop.st >= 4) {
      opts.push({ label: 'เก็บเกี่ยว', icon: ['tools', TOOL.sickle], cost: COST.harvest, run: () => harvest([[x, y]]) });
      const all = plotCells(q => q.crop && q.crop.st >= 4);
      if (all.length > 1) opts.push({ label: `เก็บทั้งแปลง (${all.length} ต้น)`, icon: ['tools', TOOL.sickle], cost: COST.harvest, n: all.length, run: () => harvest(all) });
    } else if (!c.wet) {
      opts.push({ label: 'รดน้ำ', icon: ['tools', TOOL.can], cost: COST.water, extra: `น้ำ ${S.water}/${CAN_MAX}`, disabled: !S.water && 'บัวรดน้ำหมด ไปเติมที่ปั๊ม',
        run: () => water([[x, y]]) });
    }
    if (nW > 1) {
      const all = plotCells(q => q.crop && !q.wet && q.crop.st < 4).slice(0, S.water);
      opts.push({ label: `รดน้ำทั้งแปลง (${all.length} ต้น)`, icon: ['tools', TOOL.can], cost: COST.water, n: all.length, run: () => water(all) });
    }
    if (c.crop.st < 4 && c.wet && nW <= 1) opts.push({ info: true, label: 'วันนี้ไม่ต้องทำอะไรแล้ว รอพรุ่งนี้' });
  }
  openSheet(title, sub, icon || ['tools', TOOL.hoe], opts);
}
function water(list) {
  doAction({ energy: COST.water * list.length, tool: TOOL.can, fx: 'water', targets: list,
    apply: (a, b) => { const c = cell(a, b); if (S.water > 0 && !c.wet) { c.wet = true; S.water--; } } });
}
function harvest(list) {
  const got = {};
  doAction({ energy: COST.harvest * list.length, tool: TOOL.sickle, fx: 'spark', targets: list,
    apply: (a, b) => { const c = cell(a, b); if (!c.crop) return; const k = c.crop.k; S.prod[k]++; got[k] = (got[k] || 0) + 1; stat('harvest');
      floatText(a * T + 16, b * T - 10, `+1 ${CROPS[k].name}`, '#fff4b0');
      if (CROPS[k].regrow >= 0) c.crop.st = CROPS[k].regrow; else c.crop = null; },
    after: () => { toast('ได้ ' + Object.entries(got).map(([k, n]) => `${CROPS[k].name} ${n}`).join(', ') + ' — เอาไปขายป้าแต๋วได้'); maybeRandomCard(0.12); } });
}

// ---------- ต้นไม้ (แตะเพื่อเก็บผล / ตัดกิ่ง / นั่งพักใต้ร่ม) ----------
const treeState = o => S.trees[o.id] || (S.trees[o.id] = { fruitDay: -99, cutDay: 0 });
const hasFruit = o => { const ti = treeInfo(o); return ti.fruit > 0 && S.day - treeState(o).fruitDay >= 3; };
const treeImg = o => (tapOf(o) === 'tree' && treeInfo(o).fruit && !hasFruit(o)) ? treeInfo(o).bare : o.img;
function openTree(o) {
  const ti = treeInfo(o), st = treeState(o), opts = [];
  const tc = [[o.block[0][0], o.block[0][1]]];
  const lvl = forageLevel();
  if (ti.fruit) {
    if (hasFruit(o)) {
      const isM = ti.kind === 'mango', n = ti.fruit + (lvl >= 3 ? 1 : 0), key = isM ? 'mango' : 'tamarind';
      opts.push({ label: isM ? `สอยมะม่วง (~${n} ลูก)` : `เก็บฝักมะขาม (~${n} กำ)`, icon: ['icons2', ITEMS[key].ic], cost: isM ? COST.fruit : COST.pods,
        run: () => doAction({ energy: isM ? COST.fruit : COST.pods, tool: TOOL.rake, fx: 'leaf', targets: tc,
          apply: () => { st.fruitDay = S.day; addItem(key, n); stat('fruit', n); gainForage(1); },
          after: () => { floatText(o.x, o.y - 70, `+${n} ${ITEMS[key].name}`, '#fff4b0'); toast(`ได้${ITEMS[key].name} ${n} — กินเพิ่มแรงหรือขายป้าแต๋วก็ได้`); } }) });
    } else opts.push({ info: true, label: `ผลยังไม่ออก อีก ${3 - (S.day - st.fruitDay)} วัน` });
  }
  opts.push({ label: 'ตัดกิ่งแห้งทำฟืน', icon: ['tools', TOOL.axe], cost: COST.chop, disabled: st.cutDay === S.day && 'วันนี้ตัดแล้ว',
    run: () => doAction({ energy: COST.chop, tool: TOOL.axe, fx: 'wood', targets: tc, apply: () => {
      st.cutDay = S.day; const w = 2 + (lvl >= 2 ? 1 : 0); addItem('wood', w); stat('wood', w); gainForage(1);
      const extra = [];
      if (ti.kind === 'mango' && Math.random() < 0.22) { addItem('ant_egg'); extra.push('ไข่มดแดง 1 ห่อ (รังบนกิ่ง!)'); }
      if (Math.random() < 0.06) { addItem('honey'); extra.push('น้ำผึ้งป่า 1 ขวด'); }
      floatText(o.x, o.y - 70, `+${w} ไม้ฟืน`, '#fff4b0');
      setTimeout(() => toast(`ได้ไม้ฟืน ${w} มัด` + (extra.length ? ' · โชคดี! ' + extra.join(', ') : '')), 50);
    } }) });
  opts.push({ label: 'นั่งพักใต้ร่มไม้', icon: ['icons', 8], extra: 'แรงฟื้นช้า ๆ ตามเวลา', run: () => { closeSheet(); sitDown('ใต้ร่ม' + ti.name.replace('ต้น', '')); } });
  openSheet(ti.name, ti.kind === 'mango' ? 'ต้นที่ยายปลูกไว้ตั้งแต่แม่ยังเด็ก' : 'ต้นมะขามแก่ ร่มใหญ่ ลมเย็น', null, opts, 'obj/' + treeImg(o));
}
function openDeco(o, kind) {
  const done = (until, text) => () => { S.gone[o.id] = until; rebuildBlocked(); toast(text); maybeRandomCard(0.08); };
  if (kind === 'pebble') return openSheet('ก้อนหินเล็ก', 'เก็บไว้ทำทางเดินได้', null, [
    { label: 'เก็บหิน', icon: ['icons2', ITEMS.stone.ic], cost: COST.gather, run: () => doAction({ energy: COST.gather, tool: TOOL.hand, fx: 'dirt',
      targets: [cellOf(o)], apply: () => { addItem('stone'); gainForage(1); }, after: done(S.day + 1, 'ได้ก้อนหิน 1 (พรุ่งนี้จะมีหินกลิ้งมาใหม่)') }) }], 'obj/' + o.img);
  if (kind === 'branch') return openSheet('กิ่งไม้หล่น', 'กิ่งแห้งจากลมเมื่อคืน', null, [
    { label: 'เก็บกิ่งไม้', icon: ['icons2', ITEMS.wood.ic], cost: COST.gather, run: () => doAction({ energy: COST.gather, tool: TOOL.hand, fx: 'grass',
      targets: [cellOf(o)], apply: () => { addItem('wood'); stat('wood'); gainForage(1); }, after: done(S.day + 1, 'ได้ไม้ฟืน 1 มัด') }) }], 'obj/' + o.img);
  if (kind === 'stump') return openSheet('ตอไม้เก่า', 'ผุแล้ว ผ่าทำฟืนได้ อาจมีเห็ดขึ้นข้าง ๆ', null, [
    { label: 'ผ่าตอไม้', icon: ['tools', TOOL.axe], cost: COST.stump, run: () => doAction({ energy: COST.stump, tool: TOOL.axe, fx: 'wood',
      targets: [cellOf(o)], apply: () => { addItem('wood', 3); stat('wood', 3); gainForage(2); if (Math.random() < 0.4) { addItem('mushroom', 2); S.flags.stumpMush = true; } },
      after: () => { done(99999, S.flags.stumpMush ? 'ได้ไม้ฟืน 3 มัด + เห็ดโคนไม้ 2 ดอก!' : 'ได้ไม้ฟืน 3 มัด')(); S.flags.stumpMush = false; } }) }], 'obj/' + o.img);
  if (kind === 'boulder') return openSheet('หินก้อนใหญ่', 'ต้องใช้ค้อนปอนด์ (ซื้อได้ที่ร้านในตำบล — ยังไม่เปิด)', null,
    [{ info: true, label: 'มือเปล่ายกไม่ไหว' }], 'obj/' + o.img);
}
const cellOf = o => o.block.length ? o.block[0] : [Math.floor(o.x / T), Math.floor((o.y - 2) / T)];

// ---------- objects ----------
function openObject(o) {
  const t = tapOf(o);
  if (t === 'tree') return openTree(o);
  if (DECO_TAP[o.img]) return openDeco(o, t);
  if (t === 'house') {
    const opts = [
      { label: 'นอน (จบวัน)', icon: ['icons', 9], extra: S.min >= NIGHT ? '' : 'ตื่นมาแรงเต็ม', run: () => { closeSheet(); sleep(); } },
      { label: 'งีบหลับ 1 ชั่วโมง', icon: ['icons', 9], extra: 'ข้ามเวลา 1 ชม. · แรง +20', disabled: S.napCount >= 2 && 'วันนี้งีบพอแล้ว',
        run: () => { closeSheet(); overlayFade(() => { S.napCount++; addEnergy(20); addMins(60); fadeA = 0.999; hud(); save(); toast('งีบไปชั่วโมงหนึ่ง สดชื่นขึ้น'); }); } },
      { label: 'นั่งพักบนชานบ้าน', icon: ['icons', 8], extra: 'แรงฟื้นช้า ๆ ตามเวลา', run: () => { closeSheet(); sitDown('บนชานบ้าน'); } },
    ];
    return openSheet('บ้านยาย', 'บ้านไม้ใต้ถุนสูง กลับมาเงียบกว่าที่จำได้', null, opts, 'obj/house_yai');
  }
  if (t === 'bench') return openSheet('ม้านั่งไม้', 'ที่ยายชอบนั่งดูแปลงผักตอนเย็น', null, [
    { label: 'นั่งพัก', icon: ['icons', 8], extra: 'แรงฟื้นเร็วกว่ายืน', run: () => { closeSheet(); sitDown('บนม้านั่ง', [o.x, o.y + 1]); player.lift = 11; } }], 'obj/bench');
  if (t === 'pump') return openSheet('ปั๊มน้ำโยก', `บัวรดน้ำ ${S.water}/${CAN_MAX}`, null, [
    { label: 'เติมน้ำบัวรดน้ำ', icon: ['tools', TOOL.can], cost: COST.refill, disabled: S.water >= CAN_MAX && 'เต็มแล้ว',
      run: () => doAction({ energy: COST.refill, tool: TOOL.bucket, fx: 'water', targets: [[8, 13]], apply: () => { S.water = CAN_MAX; }, after: () => toast('เติมน้ำเต็มแล้ว (12 ครั้ง)') }) }
  ], 'obj/hand_pump');
  if (t === 'jar') return openSheet('โอ่งน้ำฝน', 'น้ำฝนเย็นชื่นใจ', null, [
    { label: 'ตักน้ำดื่ม', icon: ['icons', 8], extra: 'แรง +6', disabled: (S.drinkCount || 0) >= 3 && 'อิ่มน้ำแล้ว',
      run: () => doAction({ energy: -6, fx: 'water', targets: [[19, 16]], apply: () => { S.drinkCount = (S.drinkCount || 0) + 1; }, after: () => {} }) }
  ], 'obj/water_jar');
  if (t === 'spirit') return openSheet('ศาลพระภูมิ', S.prayedDay === S.day ? 'วันนี้ไหว้แล้ว' : 'ยายไหว้ทุกเช้า', null, [
    { label: 'จุดธูปไหว้', icon: ['icons', 9], cost: 0, extra: 'คืนนี้ใจกล้าขึ้น', disabled: S.prayedDay === S.day && 'ไหว้แล้ว',
      run: () => doAction({ energy: 0, fx: 'spark', targets: [[18, 10]], apply: () => { S.prayedDay = S.day; }, after: () => toast('ควันธูปลอยขึ้นช้า ๆ รู้สึกอุ่นใจ') }) }
  ], 'obj/spirit_house');
  if (t === 'mailbox') return openSheet('ตู้จดหมาย', S.mailDay === S.day ? 'วันนี้เปิดดูแล้ว' : 'มีอะไรมาไหมนะ', null, [
    { label: 'เปิดดู', icon: ['icons', 9], cost: 0, disabled: S.mailDay === S.day && 'เปิดแล้ว',
      run: () => doAction({ energy: 0, fx: 'tick', apply: () => { S.mailDay = S.day; }, after: () => {
        if (S.day === 1) return toast('ตู้ว่าง มีแต่ใบไม้แห้ง');
        const pool = CARDS.filter(c => c.place === 'mailbox'); showCard(pool[(S.day * 7) % pool.length]); } }) }
  ], 'obj/mailbox');
}

// ---------- จุดสุ่มซ่อนตามทาง (22.1b) ----------
// เดินผ่านแล้วมีโอกาสเจอของ/เรื่องไม่ดี · รีเซ็ตทุกวัน · ทักษะหาของป่าสูงขึ้น → เจอง่ายขึ้น + เห็นประกายจาง ๆ
const SPOT_KINDS = [ // [kind, น้ำหนัก]
  ['coin', 20], ['mushroom', 14], ['mush2', 5], ['ant_egg', 8], ['marble', 12], ['worm', 14], ['nail', 9], ['snake', 6], ['wood', 12]];
function makeSpots(day) {
  let r = day * 7919 + 13; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const cand = [];
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (SC.blocked[y][x] || inPlot(x, y) || (SC.pond && SC.pond[y][x])) continue;
    if (Math.abs(x - HOME_DOOR.x) + Math.abs(y - HOME_DOOR.y) < 3) continue;
    cand.push({ x, y, w: SC.path[y][x] ? 3 : 1 });
  }
  const out = [], tot = SPOT_KINDS.reduce((a, b) => a + b[1], 0);
  for (let i = 0; i < 8 && cand.length; i++) {
    let sum = cand.reduce((a, c) => a + c.w, 0), p = rnd() * sum, j = 0;
    while (p > cand[j].w) { p -= cand[j].w; j++; }
    const c = cand.splice(Math.min(j, cand.length - 1), 1)[0];
    let q = rnd() * tot, k = 0; while (q > SPOT_KINDS[k][1]) { q -= SPOT_KINDS[k][1]; k++; }
    out.push({ x: c.x, y: c.y, kind: SPOT_KINDS[k][0], used: false });
  }
  return out;
}
const FORAGE_LV = [0, 3, 8, 15, 25, 38, 55, 75, 100, 130];
const forageLevel = () => { let l = 0; FORAGE_LV.forEach((v, i) => { if (S.skill.forage >= v) l = i; }); return l; };
function gainForage(n) {
  const b = forageLevel(); S.skill.forage += n; const a = forageLevel();
  if (a > b) setTimeout(() => { toast(`ทักษะหาของป่า เลเวล ${a}! ` + (a === 1 ? 'เริ่มเห็นประกายจาง ๆ ตรงจุดที่มีของ' : a === 2 ? 'ตัดกิ่งได้ฟืนเพิ่ม' : a === 3 ? 'เก็บผลไม้ได้มากขึ้น' : 'สายตาไวขึ้น')); sfx('spark'); }, 900);
}
function onStep(x, y) {
  const sp = S.spots.find(s => !s.used && s.x === x && s.y === y); if (!sp) return;
  const chance = 0.5 + forageLevel() * 0.07;
  if (Math.random() > chance) return;           // เดินผ่านไปโดยไม่ทันสังเกต (ลองใหม่ได้)
  sp.used = true;
  const fx = x * T + 16, fy = y * T - 30;
  if (sp.kind === 'nail') { addEnergy(-5); burst(x, y, 'dirt'); sfx('dirt'); toast('โอ๊ย! เหยียบตะปูเก่า ๆ ที่จมดินอยู่ (แรง −5)'); stat('found'); return; }
  if (sp.kind === 'snake') { player.path = []; player.onArrive = null; stat('found'); return showCard(CARDS.find(c => c.id === 'find_snake')); }
  burst(x, y, 'spark'); sfx('spark'); stat('found'); gainForage(2);
  if (sp.kind === 'coin') { const g = 5 + Math.floor(Math.random() * 4) * 5; S.money += g; floatText(fx, fy, `+฿${g}`, '#fff1a0'); toast(`เจอเหรียญตกอยู่ในดิน ฿${g}`); }
  else { addItem(sp.kind); floatText(fx, fy, `+1 ${ITEMS[sp.kind].name}`, '#fff4b0');
    toast({ mushroom: 'เจอเห็ดขึ้นตรงโคนหญ้า!', mush2: 'เห็ดระโงก! ของหายาก ป้าแต๋วให้ราคาดี', ant_egg: 'เจอรังมดแดงต่ำ ๆ เขย่าได้ไข่มดแดงห่อนึง',
      marble: 'เขี่ยดินเจอลูกแก้วเก่า… ของเล่นตอนเด็กของใครนะ', worm: 'ดินชื้นตรงนี้มีไส้เดือนตัวอ้วน (เหยื่อตกปลา)', wood: 'เจอกิ่งไม้แห้งพอดีมัด' }[sp.kind]); }
  hud(); save();
}

// ---------- NPC: ป้าแต๋ว ----------
const pick = a => a[Math.floor(Math.random() * a.length)];
const say = s => s.replace(/(นะ|สิ|ล่ะ|เหรอ|นี่|ไหม|หรือ|เปล่า)\{k\}/g, '$1{kq}').replace(/\{player\}/g, S.name).replace(/\{item\}/g, '')
  .replace(/\{p\}/g, S.gender === 'f' ? 'หนู' : 'ผม').replace(/\{kq\}/g, S.gender === 'f' ? 'คะ' : 'ครับ').replace(/\{k\}/g, S.gender === 'f' ? 'ค่ะ' : 'ครับ');
function greetLine() {
  const h = 6 + S.min / 60, L = TAEW.lines;
  if (S.flags.faintedYesterday && L.player_fainted) { S.flags.faintedYesterday = false; return pick(L.player_fainted); }
  if (S.rain && L.weather_rain && Math.random() < .5) return pick(L.weather_rain);
  if (Math.random() < .05 && L.rare) return pick(L.rare);
  if (Math.random() < .35) return pick(S.heart >= 7 ? L.heart_high : S.heart >= 4 ? L.heart_mid : L.heart_low);
  return pick(h < 11 ? L.greet_morning : h < 15 ? L.greet_noon : h < 20 ? L.greet_evening : L.greet_night);
}
const hearts = () => '♥'.repeat(Math.floor(S.heart / 2)) + (S.heart % 2 ? '♡' : '') + `  (${S.heart}/10)`;
const sellable = () => [...CROP_KEYS.filter(k => S.prod[k]).map(k => ['c', k]), ...Object.keys(ITEMS).filter(k => S.items[k] && !ITEMS[k].food).map(k => ['i', k])];
function openNpc() {
  const opts = [
    { label: 'คุย', icon: ['icons', 9], cost: COST.talk, run: () => doAction({ energy: COST.talk, fx: 'heart', after: () => {
      if (S.talkedDay !== S.day) { S.talkedDay = S.day; S.heart = Math.min(10, S.heart + 1); stat('talkDays'); hud(); }
      const r = S.reactDay !== S.day && pickConvo('react');      // ป้าทักเรื่องที่เพิ่งเกิดก่อน (วันละเรื่อง)
      if (r) { S.reactDay = S.day; runConvo(r); } else talk(greetLine(), true); } }) },
    { label: 'ให้ของ', icon: ['icons', 4], cost: 0, disabled: S.giftDay === S.day ? 'วันนี้ให้แล้ว' : (!sellable().length && 'ยังไม่มีของจะให้'), run: giftMenu },
    { label: 'ขายของ', icon: ['icons', 9], cost: 0, disabled: !sellable().length && 'ยังไม่มีของจะขาย', run: sellMenu },
    { label: 'ซื้อเมล็ด / ข้าว', icon: ['icons', 0], cost: 0, run: buyMenu },
  ];
  openSheet(TAEW.name, hearts(), null, opts, 'portrait_taeo', true);
}
// ---------- บทคุยโต้ตอบ (convos ใน docs/dialogue/taew.yaml) ----------
const TOPICS = [['ถามข่าว', 'news', 'topic_news'], ['ขอคำแนะนำ', 'advice', 'topic_advice'], ['คุยเล่น', 'smalltalk', 'topic_smalltalk'],
  ['ถามเรื่องป้า', 'self', 'topic_about_self'], ['ถามถึงคนอื่น', 'others', 'topic_about_others']];
const CONVOS = [...(TAEW.convos || []),        // บทมีตัวเลือกเดิม (choices) = ป้าชวนคุยเองตามระดับหัวใจ
  ...(TAEW.choices || []).map(c => ({ id: c.id, topic: 'react', once: true, when: { heart_min: c.min_heart || 0 }, npc: c.prompt, options: c.options }))];
function convoOk(c) {
  const w = c.when || {}, h = S.heart, m = S.min;
  S.convo = S.convo || {};
  const seen = S.convo[c.id];
  if (c.once && seen != null) return false;
  if (seen != null && S.day - seen < 7) return false;          // ไม่ซ้ำภายใน 7 วันในเกม
  if (w.heart_min != null && h < w.heart_min) return false; if (w.heart_max != null && h > w.heart_max) return false;
  if (w.day_min != null && S.day < w.day_min) return false;
  if (w.time === 'morning' && m >= 300) return false; if (w.time === 'noon' && (m < 300 || m >= 540)) return false;
  if (w.time === 'evening' && (m < 540 || m >= 900)) return false;
  if (w.rain != null && !!S.rain !== w.rain) return false;
  if (w.flag && !S.flags[w.flag]) return false; if (w.not_flag && S.flags[w.not_flag]) return false;
  if (w.has_item && !(S.items[w.has_item] || S.prod[w.has_item])) return false;
  if (w.fainted_recent && !(S.flags.faintedDay && S.day - S.flags.faintedDay <= 1)) return false;
  return true;
}
function pickConvo(topic) {
  const list = CONVOS.filter(c => c.topic === topic && convoOk(c));
  if (!list.length) return null;
  return topic === 'react' ? list[0] : pick(list);             // react: เรียงตามความสำคัญในไฟล์
}
function convoHeart(n) {                                         // หัวใจจากการคุย: บวกได้วันละไม่เกิน +3
  if (!n) return;
  S.convoHeart = S.convoHeart && S.convoHeart.d === S.day ? S.convoHeart : { d: S.day, got: 0 };
  if (n > 0) { n = Math.min(n, 3 - S.convoHeart.got); if (n <= 0) return; S.convoHeart.got += n; }
  S.heart = Math.max(0, Math.min(10, S.heart + n));
  floatText(npc.x, npc.y - 64, n > 0 ? `♥ +${n}` : `♥ ${n}`, n > 0 ? '#ffb3c1' : '#c9c9d6'); sfx(n > 0 ? 'heart' : 'tick'); hud();
}
function runConvo(c) {
  S.convo = S.convo || {}; S.convo[c.id] = S.day;
  if (c.set_flag) S.flags[c.set_flag] = true;
  showTalk(c.npc, c.options);
}
function showTalk(text, options) {
  closeSheet();
  $('talkPortrait').style.backgroundImage = 'url(assets/portrait_taeo.png)';
  $('talkName').textContent = TAEW.name; $('talkText').textContent = say(text);
  const ch = $('talkChoices'); ch.innerHTML = '';
  (options || []).filter(o => !o.take || Object.keys(o.take).every(k => (S.items[k] || S.prod[k] || 0) >= o.take[k])).forEach(o => {
    const b = document.createElement('button'); b.className = 'say'; b.textContent = say(o.text);
    b.onclick = () => {
      if (o.take) for (const k in o.take) { if (S.items[k]) S.items[k] -= o.take[k]; else S.prod[k] -= o.take[k]; }
      if (o.set_flag) S.flags[o.set_flag] = true;
      convoHeart(o.heart || 0); save();
      if (o.next && o.next.length) showTalk(o.reply, o.next);
      else afterConvo(o.reply);
    };
    ch.appendChild(b);
  });
  $('talk').classList.remove('hidden'); sfx('talk');
}
function afterConvo(text) {
  $('talkText').textContent = say(text);
  const ch = $('talkChoices'); ch.innerHTML = '';
  const add = (lbl, fn) => { const b = document.createElement('button'); b.textContent = lbl; b.onclick = fn; ch.appendChild(b); };
  add('คุยเรื่องอื่น', () => talk(pick(['ว่าไงอีกหลาน', 'มีอะไรจะถามป้าอีกไหมจ๊ะ', 'แล้วไงต่อ… ป้ายังไม่รีบ', 'ถามมาเลย ป้าว่างอีกห้านาที']), true));
  add(say('ไปก่อนนะ{kq}ป้า'), () => { $('talk').classList.add('hidden'); maybeRandomCard(0.12); });
}
function talk(text, topics) {
  closeSheet();
  $('talkPortrait').style.backgroundImage = 'url(assets/portrait_taeo.png)';
  $('talkName').textContent = TAEW.name; $('talkText').textContent = say(text);
  const ch = $('talkChoices'); ch.innerHTML = '';
  const add = (lbl, fn) => { const b = document.createElement('button'); b.textContent = lbl; b.onclick = fn; ch.appendChild(b); };
  if (topics) TOPICS.forEach(([l, t, k]) => {
    const c = pickConvo(t);
    if (c) add(l, () => runConvo(c));
    else if (TAEW.lines[k]) add(l, () => afterConvo(pick(TAEW.lines[k])));   // บทโต้ตอบหมดชั่วคราว → บรรทัดเดี่ยวเดิม
  });
  add(say('ไปก่อนนะ{kq}ป้า'), () => { $('talk').classList.add('hidden'); maybeRandomCard(0.12); });
  $('talk').classList.remove('hidden'); sfx('talk');
}
const nameOf = ([t, k]) => t === 'c' ? CROPS[k].name : ITEMS[k].name;
const iconOf = ([t, k]) => t === 'c' ? ['icons', CROPS[k].prodIcon] : ['icons2', ITEMS[k].ic];
const countOf = ([t, k]) => t === 'c' ? S.prod[k] : S.items[k];
const takeOne = ([t, k]) => { if (t === 'c') S.prod[k]--; else S.items[k]--; };
function giftMenu() {
  const LIKE = ['chili', 'mango', 'ant_egg', 'mush2', 'honey'];
  const opts = sellable().map(it => ({ label: `ให้${nameOf(it)}`, icon: iconOf(it), extra: `มี ${countOf(it)}`,
    run: () => { closeSheet(); takeOne(it); S.giftDay = S.day;
      const liked = LIKE.includes(it[1]); S.heart = Math.min(10, S.heart + (liked ? 2 : 1)); hud(); save();
      talk(pick(liked ? TAEW.lines.gift_like : TAEW.lines.gift_neutral).replace('{item}', nameOf(it)), false); } }));
  openSheet('ให้ของป้าแต๋ว', 'ป้าชอบพริกขี้หนู ไข่มดแดง ของป่า (ได้ยินมา)', null, opts, 'portrait_taeo', true);
}
function sellMenu() {
  const bonus = S.heart >= 6 ? 1.1 : 1;
  const price = ([t, k]) => Math.max(1, Math.round((t === 'c' ? CROPS[k].sell : ITEMS[k].sell) * bonus));
  const opts = sellable().map(it => ({ label: `ขาย${nameOf(it)}ทั้งหมด`, icon: iconOf(it),
    extra: `${countOf(it)} × ฿${price(it)}`, run: () => { const g = countOf(it) * price(it); S.money += g; if (it[0] === 'c') S.prod[it[1]] = 0; else S.items[it[1]] = 0;
      stat('sold'); hud(); save(); sfx('coin'); floatText(player.x, player.y - 60, `+฿${g}`, '#fff1a0'); toast(`ป้าแต๋วรับซื้อ ได้ ฿${g}`); sellMenu(); } }));
  if (!opts.length) { closeSheet(); return toast('ขายหมดแล้ว'); }
  openSheet('ขายของให้ป้าแต๋ว', S.heart >= 6 ? 'ป้าให้ราคาพิเศษ +10% เพราะสนิทกัน' : 'ราคาหน้าร้าน', null, opts, 'portrait_taeo', true);
}
function buyMenu() {
  const opts = CROP_KEYS.map(k => ({ label: `เมล็ด${CROPS[k].name} 1 ซอง (10 เมล็ด)`, icon: ['icons', CROPS[k].seedIcon], extra: `฿${CROPS[k].pack}`,
    disabled: S.money < CROPS[k].pack && 'เงินไม่พอ',
    run: () => { S.money -= CROPS[k].pack; S.seeds[k] += 10; hud(); save(); sfx('coin'); toast(`ได้เมล็ด${CROPS[k].name} 10 เมล็ด`); buyMenu(); } }));
  ['khaijiao', 'kaprao'].forEach(k => opts.push({ label: `${ITEMS[k].name} (ห่อกลับ)`, icon: ['icons2', ITEMS[k].ic], extra: `฿${ITEMS[k].buy} · กินแล้วแรง +${ITEMS[k].eat}`,
    disabled: S.money < ITEMS[k].buy && 'เงินไม่พอ',
    run: () => { S.money -= ITEMS[k].buy; addItem(k); hud(); save(); sfx('coin'); toast(`ได้${ITEMS[k].name} — เปิดกระเป๋าเพื่อกิน`); buyMenu(); } }));
  openSheet('ร้านป้าแต๋ว', `เงิน ฿${S.money}`, null, opts, 'portrait_taeo', true);
}
function updateNpcSchedule() {
  const want = S.min >= 60 && S.min < 12 * 60;     // 07:00–18:00 ป้าแวะมายืนคุยหน้าบ้าน
  if (want && !npc.present) { npc.present = true; place(npc, TAEW_OFF.x, TAEW_OFF.y); npcWalk(TAEW_SPOT, () => { npc.dir = 3; }); }
  if (!want && npc.present && !npc.leaving) { npc.leaving = true; npcWalk(TAEW_OFF, () => { npc.present = false; npc.leaving = false; }); }
}
function npcWalk(goal, done) {
  const keep = npc.present; npc.present = false;
  const p = bfs(npc.cx, npc.cy, (x, y) => x === goal.x && y === goal.y); npc.present = keep;
  npc.path = p ? p.slice(1) : []; npc.onArrive = done; if (!npc.path.length && done) done();
}

// ---------- day cycle ----------
function sleep() { standUp(); overlayFade(() => newDay(false)); }
function faint(msg) {
  busy = false; player.path = []; standUp();
  showCard({ type: 'story', art: 'night', title: 'เป็นลม', text: msg + '\nตื่นมาอีกทีที่ รพ.สต. หมอแอนบ่นเบา ๆ ว่าให้ดูแลตัวเองบ้าง',
    choices: [{ label: 'กลับบ้าน', hint: `แรงพรุ่งนี้ 50% · ค่ารักษา ฿${Math.min(500, Math.floor(S.money * 0.1))}`, effect: { faintDay: true } }] });
}
function newDay(fainted) {
  for (const k in S.cells) { const c = S.cells[k]; if (c.crop && c.wet) c.crop.st = Math.min(4, c.crop.st + 1); c.wet = false; }
  S.day++; S.min = 0; dayOver = false; S.energy = fainted ? MAX_E / 2 : MAX_E; S.napCount = 0; S.drinkCount = 0; S.cardsToday = 0;
  if (fainted) { const fee = Math.min(500, Math.floor(S.money * 0.1)); S.money -= fee; S.flags.faintedYesterday = true; S.flags.faintedDay = S.day; }
  S.rain = Math.random() < 0.22;
  if (S.rain) for (const k in S.cells) if (S.cells[k].soil) S.cells[k].wet = true;
  S.spots = makeSpots(S.day); rebuildBlocked();
  place(player, HOME_DOOR.x, HOME_DOOR.y); player.dir = 0; S.px = player.cx; S.py = player.cy;
  npc.present = false; npc.leaving = false; updateNpcSchedule();
  dirtySoil = true; hud(); save();
  toast(S.rain ? `วันที่ ${S.day} — ฝนตกตอนเช้ามืด แปลงชุ่มน้ำแล้ว` : `วันที่ ${S.day} — อรุณสวัสดิ์`);
}

// ---------- event cards ----------
function eligible(c) {
  const w = c.when || {}; if (c.type !== 'random') return false;
  if (S.seenCards[c.id] && S.day - S.seenCards[c.id] < 2) return false;
  if (w.from != null && S.min < w.from) return false; if (w.to != null && S.min > w.to) return false;
  if (w.minMoney && S.money < w.minMoney) return false;
  if (w.needItem && !(S.prod[w.needItem] || S.items[w.needItem])) return false;
  if (c.id === 'afternoon_rain' && S.rain) return false;
  return true;
}
function maybeRandomCard(p) {
  if (!S || cardOpen() || S.cardsToday >= 3 || Math.random() > p) return;
  const pool = CARDS.filter(eligible); if (!pool.length) return;
  showCard(pick(pool));
}
const cardOpen = () => !document.getElementById('cardWrap').classList.contains('hidden');
function showCard(c) {
  closeSheet(); document.getElementById('talk').classList.add('hidden'); standUp();
  if (c.id) { S.seenCards[c.id] = S.day; if (c.type === 'random') S.cardsToday++; }
  const el = id => document.getElementById(id);
  const tag = el('cardTag'); tag.className = 'card-tag ' + c.type;
  tag.textContent = { story: 'เนื้อเรื่อง', random: 'เหตุการณ์', place: 'ที่นี่', night: 'กลางคืน', find: 'ระหว่างทาง' }[c.type] || 'เหตุการณ์';
  const art = el('cardArt'); art.className = 'card-art'; art.style.cssText = '';
  const arts = { letter: 'assets/card_letter.png', hen: 'assets/card_hen.png', phone: `assets/portrait_${S.gender}.png`, rain: 'assets/bg.png' };
  if (c.art === 'night' || c.art === 'snake') art.classList.add(c.art);
  else if (c.art && c.art.startsWith('icon:')) art.style.backgroundImage = 'url(assets/card_chili.png)';
  else if (arts[c.art]) art.style.backgroundImage = `url(${arts[c.art]})`;
  if (c.art === 'rain') { art.style.backgroundSize = 'cover'; art.style.filter = 'saturate(.6) brightness(.75)'; }
  el('cardTitle').textContent = c.title; el('cardText').textContent = say(c.text);
  const ch = el('cardChoices'); ch.innerHTML = '';
  c.choices.forEach(o => {
    const b = document.createElement('button'); b.className = 'btn';
    b.innerHTML = `${o.label}${o.hint ? `<small>${o.hint}</small>` : ''}`;
    b.onclick = () => resolveChoice(o.effect || {});
    ch.appendChild(b);
  });
  el('cardWrap').classList.remove('hidden'); sfx('card');
}
function resolveChoice(e) {
  if (e.chance) { const p = (S.prayedDay === S.day && e.chance.pIfPrayed) || e.chance.p; e = Math.random() < p ? e.chance.win : e.chance.lose; }
  const msgs = [];
  if (e.money) { S.money = Math.max(0, S.money + e.money); msgs.push(`เงิน ${e.money > 0 ? '+' : ''}${e.money}`); }
  if (e.heart) S.heart = Math.min(10, S.heart + e.heart);
  if (e.seeds) for (const k in e.seeds) S.seeds[k] += e.seeds[k];
  if (e.items) for (const k in e.items) addItem(k, e.items[k]);
  if (e.setFlag) S.flags[e.setFlag] = true;
  if (e.waterAll) { for (const k in S.cells) if (S.cells[k].soil) S.cells[k].wet = true; dirtySoil = true; }
  if (e.damageCrop) { const l = plotCells(q => q.crop && q.crop.st > 0); if (l.length) { const [x, y] = pick(l); cell(x, y).crop.st--; } }
  if (e.sell) { const k = e.sell.crop, g = Math.round(S.prod[k] * CROPS[k].sell * e.sell.mult); S.money += g; S.prod[k] = 0; msgs.push(`ขายได้ ฿${g}`); sfx('coin'); }
  if (e.goHome) { place(player, HOME_DOOR.x, HOME_DOOR.y); }
  if (e.forage) gainForage(e.forage);
  document.getElementById('cardWrap').classList.add('hidden');
  if (e.faintDay) { overlayFade(() => newDay(true)); return; }
  if (e.energy) addEnergy(e.energy);
  if (e.text) msgs.unshift(e.text);
  hud(); save();
  if (e.faint) { faint(e.text || ''); return; }
  if (e.mins && !addMins(e.mins)) return;          // บางตัวเลือกข้ามเวลา เช่น หลบฝน 1 ชม.
  hud(); if (msgs.length) toast(msgs.join(' · '));
  if (checkFaint()) return;
}

// ---------- bottom sheet ----------
function $(id) { return document.getElementById(id); }
function iconStyle(ic, size = 32) {
  if (!ic) return '';
  const [sheet, i] = ic; const n = SHEET_N[sheet] || 10;
  return `background-image:url(assets/${sheet}.png);background-size:${n * size}px ${size}px;background-position:${-i * size}px 0`;
}
function openSheet(title, sub, icon, opts, img, portrait) {
  $('sheetTitle').textContent = title; $('sheetSub').innerHTML = portrait && title === TAEW.name ? `<span class="hearts">${sub}</span>` : sub;
  const si = $('sheetIcon');
  si.style.cssText = img ? `background-image:url(assets/${img}.png);background-size:contain` : iconStyle(icon, 48);
  const body = $('sheetBody'); body.innerHTML = '';
  opts.forEach(o => {
    const b = document.createElement('button'); b.className = 'opt' + (o.info ? ' info' : '');
    const warn = o.cost != null && warnCost(o.cost, o.n || 1);
    const right = o.disabled ? o.disabled : [o.extra, o.cost != null ? costLabel(o.cost, o.n || 1) + (warn ? ' (จะเป็นลม!)' : '') : ''].filter(Boolean).join(' · ');
    b.innerHTML = `<span class="oi" style="${iconStyle(o.icon)}"></span><span class="ol">${o.label}</span><span class="oc${warn ? ' warn' : ''}">${right || ''}</span>`;
    if (o.disabled || o.info) b.disabled = true; else b.onclick = () => { sfx('tick'); o.run(); };
    body.appendChild(b);
  });
  $('sheet').classList.remove('hidden'); $('sheet').scrollTop = 0;
}
function closeSheet() { $('sheet').classList.add('hidden'); }
$('sheetClose').onclick = closeSheet;

// ---------- HUD ----------
let hudT = 0;
function hud() {
  $('dayLabel').textContent = `วันที่ ${S.day}${S.rain ? ' · ฝน' : ''}`; $('clock').textContent = fmt(S.min);
  const h = 6 + S.min / 60; $('clockIcon').className = h >= 19 ? 'moon' : h >= 17 ? 'dusk' : 'sun';
  $('energyNum').textContent = Math.round(S.energy); $('energyBar').style.width = (S.energy / MAX_E * 100) + '%';
  $('energyBar').classList.toggle('low', S.energy < 25);
  $('money').textContent = '฿' + S.money; $('water').textContent = `${S.water}/${CAN_MAX}`;
  $('questBtn').classList.toggle('badge', QUESTS.some(q => !S.quests[q.id] && q.done()));
}
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800); }

// 🎒 กระเป๋า: ดูของ + กินอาหารเพิ่มแรง
function openBag() {
  const opts = [];
  Object.keys(ITEMS).forEach(k => { if (!S.items[k]) return; const it = ITEMS[k];
    if (it.eat) opts.push({ label: `กิน${it.name}`, icon: ['icons2', it.ic], extra: `มี ${S.items[k]} · แรง +${it.eat}`, disabled: S.energy >= MAX_E && 'แรงเต็มแล้ว',
      run: () => { S.items[k]--; addEnergy(it.eat); floatText(player.x, player.y - 60, `แรง +${it.eat}`, '#c8f59a'); sfx('heart'); hud(); save(); openBag(); } });
    else opts.push({ info: true, label: it.name, icon: ['icons2', it.ic], extra: `${S.items[k]}` }); });
  CROP_KEYS.forEach(k => { if (S.prod[k]) opts.push({ info: true, label: CROPS[k].name, icon: ['icons', CROPS[k].prodIcon], extra: `${S.prod[k]}` }); });
  CROP_KEYS.forEach(k => opts.push({ info: true, label: `เมล็ด${CROPS[k].name}`, icon: ['icons', CROPS[k].seedIcon], extra: `${S.seeds[k]} เมล็ด` }));
  const lv = forageLevel(), next = FORAGE_LV[lv + 1];
  openSheet('กระเป๋า', `เงิน ฿${S.money} · น้ำในบัว ${S.water}/${CAN_MAX}<br>ทักษะหาของป่า Lv ${lv}${next ? ` (${S.skill.forage}/${next})` : ''}`, ['tools', TOOL.bucket], opts);
}
// 📜 งาน
const debrisLeft = () => plotCells(q => q.debris).length;
const QUESTS = [
  { ic: ['icons', 4], id: 'q_harvest', name: 'เก็บผักที่ยายปลูกไว้', goal: 'เก็บเกี่ยว 4 ครั้ง', prog: () => Math.min(4, S.stats.harvest || 0) + '/4', done: () => (S.stats.harvest || 0) >= 4, reward: { money: 40 }, rlabel: '฿40' },
  { ic: ['icons2', 11], id: 'q_sell', name: 'ขายของให้ป้าแต๋ว', goal: 'ขายของ 1 ครั้ง', prog: () => Math.min(1, S.stats.sold || 0) + '/1', done: () => (S.stats.sold || 0) >= 1, reward: { money: 30 }, rlabel: '฿30' },
  { ic: ['tools', 2], id: 'q_clear', name: 'เคลียร์แปลงผักยาย', goal: 'ถอนหญ้า/เก็บหินในแปลงให้หมด', prog: () => `เหลือ ${debrisLeft()} ช่อง`, done: () => debrisLeft() === 0, reward: { money: 100 }, rlabel: '฿100' },
  { ic: ['icons', 2], id: 'q_plant', name: 'ลงมือปลูกเอง', goal: 'ปลูกผัก 8 ต้น', prog: () => Math.min(8, S.stats.planted || 0) + '/8', done: () => (S.stats.planted || 0) >= 8, reward: { seeds: { corn: 5 } }, rlabel: 'เมล็ดข้าวโพด 5' },
  { ic: ['icons2', 2], id: 'q_wood', name: 'ฟืนไว้หุงข้าว', goal: 'หาไม้ฟืน 6 มัด (ตัดกิ่ง/เก็บกิ่ง/ผ่าตอ)', prog: () => Math.min(6, S.stats.wood || 0) + '/6', done: () => (S.stats.wood || 0) >= 6, reward: { money: 60 }, rlabel: '฿60' },
  { ic: ['icons2', 7], id: 'q_find', name: 'ตาไว', goal: 'เจอของจากจุดซ่อนตามทาง 3 ครั้ง', prog: () => Math.min(3, S.stats.found || 0) + '/3', done: () => (S.stats.found || 0) >= 3, reward: { money: 50 }, rlabel: '฿50' },
  { ic: ['icons', 9], id: 'q_taew', name: 'เพื่อนบ้านคนแรก', goal: 'สนิทกับป้าแต๋ว ♥3', prog: () => Math.min(3, S.heart) + '/3', done: () => S.heart >= 3, reward: { items: { kaprao: 1 } }, rlabel: 'ข้าวกะเพรา 1 ห่อ' },
];
function openQuests() {
  const opts = QUESTS.map(q => {
    const claimed = S.quests[q.id], ok = q.done();
    return { label: `${claimed ? '✓ ' : ''}${q.name}`, icon: q.ic, extra: claimed ? 'เสร็จแล้ว' : ok ? `รับรางวัล ${q.rlabel}` : `${q.goal} · ${q.prog()}`,
      info: claimed || !ok, run: () => { S.quests[q.id] = true; const r = q.reward;
        if (r.money) S.money += r.money; if (r.seeds) for (const k in r.seeds) S.seeds[k] += r.seeds[k]; if (r.items) for (const k in r.items) addItem(k, r.items[k]);
        sfx('coin'); toast(`ได้รางวัล ${q.rlabel}`); hud(); save(); openQuests(); } };
  });
  openSheet('งาน', 'สิ่งที่ควรทำในฟาร์มยาย · ทำเสร็จแล้วกดรับรางวัล', null, opts, 'card_letter');
}
// ☰ เมนู
function openMenu() {
  openSheet('เมนู', `เซฟอัตโนมัติ · 1 วันในเกม = ${S.dayLen} นาทีจริง`, null, [
    { label: muted ? 'เปิดเสียง' : 'ปิดเสียง', icon: null, run: () => { muted = !muted; closeSheet(); } },
    { label: 'กลับหน้าแรก', icon: null, run: () => { save(); location.reload(); } },
    { label: 'ลบเซฟ เริ่มใหม่หมด', icon: null, run: () => { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(OLD_KEY); } catch (e) {} location.reload(); } },
  ]);
}
// 🗺️ แผนที่ตำบล (ฉากทดลอง: ไปได้แค่ฟาร์มยาย)
const PLACES = [
  { id: 'farm', name: 'ฟาร์มยาย', x: 22, y: 55, here: true },
  { id: 'town', name: 'ใจกลางตำบล', sub: 'ตลาด ร้านค้า อบต. ป้ายรถเมล์', x: 50, y: 55, walk: 30, bike: 12 },
  { id: 'temple', name: 'วัด', sub: 'เช่าเครื่องราง หลบผี', x: 56, y: 26, walk: 40, bike: 15 },
  { id: 'paddy', name: 'ทุ่งนา', sub: 'นาข้าว ลานตาก', x: 34, y: 84, walk: 25, bike: 10 },
  { id: 'forest', name: 'ป่าชุมชน', sub: 'หาของป่า หน่อไม้ เห็ด', x: 20, y: 22, walk: 45, bike: 20 },
  { id: 'res', name: 'อ่างเก็บน้ำ', sub: 'ตกปลา', x: 44, y: 12, walk: 60, bike: 25 },
  { id: 'moo4', name: 'ชุมชนหมู่ 4', sub: 'บ้านเพื่อนบ้าน', x: 80, y: 52, walk: 50, bike: 20 },
  { id: 'company', name: 'ที่ดินบริษัท', sub: 'เนื้อเรื่องภายหลัง', x: 74, y: 84, walk: 55, bike: 22 },
  { id: 'district', name: 'อำเภอ', sub: 'รถเมล์ทุก 3 ชม.', x: 84, y: 20, bus: 60 },
];
const ROADS = [['farm', 'town'], ['farm', 'forest'], ['farm', 'paddy'], ['town', 'temple'], ['town', 'moo4'], ['town', 'paddy'], ['forest', 'res'], ['temple', 'res'], ['paddy', 'company'], ['moo4', 'company'], ['town', 'district']];
function buildMap() {
  const box = $('mapBox'); const by = id => PLACES.find(p => p.id === id);
  let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="roads">';
  ROADS.forEach(([a, b]) => { const p = by(a), q = by(b); svg += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="${b === 'district' ? 'bus' : ''}"/>`; });
  svg += '<path d="M0 70 C 20 66, 30 74, 45 70 S 75 64, 100 68" class="river"/></svg>';
  box.innerHTML = svg + PLACES.map(p => `<button class="pin${p.here ? ' here' : ''}" data-id="${p.id}" style="left:${p.x}%;top:${p.y}%"><span>${p.name}</span></button>`).join('');
  box.querySelectorAll('.pin').forEach(b => b.onclick = () => mapInfo(by(b.dataset.id)));
}
function mapInfo(p) {
  sfx('tick'); $('mapBox').querySelectorAll('.pin').forEach(b => b.classList.toggle('sel', b.dataset.id === p.id));
  const t = p.here ? 'คุณอยู่ที่นี่' : [p.walk && `เดิน ~${p.walk} นาที`, p.bike && `จักรยาน ~${p.bike} นาที`, p.bus && `รถเมล์ ~${p.bus} นาที`].filter(Boolean).join(' · ');
  $('mapInfo').innerHTML = `<b>${p.name}</b>${p.sub ? `<div class="sub">${p.sub}</div>` : ''}<div class="sub">${t}</div>` +
    (p.here ? '' : '<button class="btn" disabled>ออกเดินทาง — ยังไม่เปิดในฉากทดลอง</button>');
}
function openMap() { closeSheet(); standUp(); buildMap(); mapInfo(PLACES[0]); $('map').classList.remove('hidden'); sfx('card'); }
$('mapBtn').onclick = () => S && !uiBlocked() && openMap();
$('bagBtn').onclick = () => S && !uiBlocked() && openBag();
$('questBtn').onclick = () => S && !uiBlocked() && openQuests();
$('menuBtn').onclick = () => S && !uiBlocked() && openMenu();
$('mapClose').onclick = () => $('map').classList.add('hidden');

// ---------- input ----------
let down = null;
cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
cv.addEventListener('pointerup', e => {
  if (!down) return; const d = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (d > 14 || !S) return; tap(e.clientX / zoom + cam.x, e.clientY / zoom + cam.y);
});
function uiBlocked() { return busy || cardOpen() || !$('talk').classList.contains('hidden') || !$('map').classList.contains('hidden') || dayOver || fadeA > 0; }
function hitSprite(wx, wy) {
  // NPC ก่อน แล้วค่อยวัตถุที่แตะได้ (หน้าสุดก่อน)
  if (npc.present && Math.abs(wx - npc.x) < 14 && wy < npc.y + 4 && wy > npc.y - 54) return { npc: true };
  const objs = SC.objects.filter(o => tapOf(o) && !isGone(o)).sort((a, b) => b.y - a.y);
  for (const o of objs) {
    const tree = tapOf(o) === 'tree', small = o.w < 34;
    const w = tree ? o.w * .35 : small ? 16 : o.w * .5, top = tree ? o.y - 40 : o.y - Math.max(o.h, 26);
    if (Math.abs(wx - o.x) < w && wy < o.y + (small ? 10 : 4) && wy > top) return { obj: o };
  }
  return null;
}
function tap(wx, wy) {
  if (uiBlocked()) return;
  closeSheet(); standUp();
  const cx = Math.floor(wx / T), cy = Math.floor(wy / T);
  marker = { x: cx, y: cy, t: 0 };
  const h = hitSprite(wx, wy);
  if (h && h.npc) {
    if (!npc.present || npc.path.length) return toast('ป้าแต๋วกำลังเดินอยู่');
    return goTo(adjTo([[npc.cx, npc.cy]]), () => { face(npc.cx, npc.cy); npc.dir = [1, 0, 3, 2][player.dir]; openNpc(); });
  }
  if (inPlot(cx, cy)) return goTo(adjTo([[cx, cy]]), () => { face(cx, cy); openPlot(cx, cy); });
  if (h && h.obj) {
    const o = h.obj, cells = o.block.length ? o.block : [cellOf(o)];
    const goal = o.block.length ? adjTo(cells) : (x, y) => (x === cells[0][0] && y === cells[0][1]) || adjTo(cells)(x, y);
    return goTo(goal, () => { face(cells[0][0], cells[0][1]); openObject(o); });
  }
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return;
  if (walkable(cx, cy)) goTo((x, y) => x === cx && y === cy);
  else goTo(adjTo([[cx, cy]]));
}
function arrive() {
  const steps = player.walkTiles || 0; player.walkTiles = 0;
  if (steps && S.min >= NIGHT && !nearHome() && !cardOpen()) {         // 22.5 ผีกลางคืน: เดินนอกบ้านหลัง 21:00
    const p = S.prayedDay === S.day ? 0.12 : 0.3;
    if (Math.random() < p) { player.onArrive = null; return showCard(CARDS.find(c => c.id === 'night_eyes')); }
  }
  S.px = player.cx; S.py = player.cy;
  const f = player.onArrive; player.onArrive = null; if (f) f();
}
const nearHome = () => Math.abs(player.cx - HOME_DOOR.x) + Math.abs(player.cy - HOME_DOOR.y) <= 2;
// keyboard (ทางเลือก)
addEventListener('keydown', e => {
  if (!S) return;
  if (e.key === 'Escape') { closeSheet(); $('talk').classList.add('hidden'); $('map').classList.add('hidden'); return; }
  if (e.key === 'm' || e.key === 'M') { if (!uiBlocked()) openMap(); return; }
  if (e.key === 'i' || e.key === 'I') { if (!uiBlocked()) openBag(); return; }
  if (uiBlocked() || player.path.length) return;
  const m = { ArrowDown: [0, 1, 0], s: [0, 1, 0], ArrowUp: [0, -1, 1], w: [0, -1, 1], ArrowRight: [1, 0, 2], d: [1, 0, 2], ArrowLeft: [-1, 0, 3], a: [-1, 0, 3] }[e.key];
  if (m) { closeSheet(); standUp(); player.dir = m[2]; const nx = player.cx + m[0], ny = player.cy + m[1]; if (walkable(nx, ny)) { player.path = [[nx, ny]]; player.walkTiles = 0; } e.preventDefault(); return; }
  if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') {
    const d = [[0, 1], [0, -1], [1, 0], [-1, 0]][player.dir], tx = player.cx + d[0], ty = player.cy + d[1];
    if (npc.present && npc.cx === tx && npc.cy === ty) { npc.dir = [1, 0, 3, 2][player.dir]; return openNpc(); }
    if (inPlot(tx, ty)) return openPlot(tx, ty);
    const o = SC.objects.find(o => tapOf(o) && !isGone(o) && (o.block.length ? o.block : [cellOf(o)]).some(([a, b]) => a === tx && b === ty)); if (o) openObject(o);
    e.preventDefault();
  }
});

// ---------- effects ----------
const parts = [], floats = []; let marker = null;
function burst(cx, cy, kind) {
  const x = cx * T + 16, y = cy * T + 22;
  const col = { dirt: ['#8a5a32', '#a87444', '#5e3b20'], water: ['#9fd8ff', '#5fb4ea', '#e8f7ff'], grass: ['#7fb04c', '#5f8f3a', '#b7d67a'],
    seed: ['#d8b56a', '#8a6a3a'], spark: ['#fff3a0', '#ffd34d', '#ffffff'], heart: ['#ff8fa0', '#ffc2cc'], zzz: ['#ffffff'], tick: ['#ffffff'],
    wood: ['#9a6a3c', '#c79a62', '#6b4626'], leaf: ['#6fa63e', '#9bcf5a', '#f2c94c'] }[kind] || ['#fff'];
  const up = kind === 'leaf' ? 40 : 0;
  for (let i = 0; i < 12; i++) parts.push({ x: x + (Math.random() - .5) * 24, y: y - Math.random() * 8 - up, vx: (Math.random() - .5) * 60,
    vy: -40 - Math.random() * 70 + (kind === 'leaf' ? 50 : 0), life: .6 + Math.random() * .4, c: pick(col), s: kind === 'spark' ? 2 : 3 });
}
function floatText(x, y, t, c) { floats.push({ x, y, t, c, life: 1.2 }); }
let fadeA = 0, fadeCb = null;
function overlayFade(cb) { fadeA = 0.001; fadeCb = cb; }

// ---------- sound (WebAudio เล็ก ๆ ไม่ใช้ไฟล์) ----------
let AC = null, muted = false;
function sfx(kind) {
  if (muted) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const seq = { tick: [[660, .05]], dirt: [[180, .07], [140, .07]], water: [[900, .06], [1200, .05], [1000, .05]], grass: [[300, .05], [380, .05]],
    seed: [[520, .05], [700, .06]], spark: [[880, .06], [1320, .1]], coin: [[1046, .06], [1568, .12]], card: [[392, .08], [523, .1]],
    talk: [[600, .04], [500, .04]], heart: [[700, .06], [900, .08]], zzz: [[220, .2]], wood: [[150, .06], [120, .08], [150, .06]], leaf: [[500, .04], [620, .04], [540, .05]] }[kind] || [[600, .05]];
  let t = AC.currentTime;
  seq.forEach(([f, d]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = kind === 'dirt' || kind === 'wood' ? 'triangle' : 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d); t += d * .9; });
}

// ---------- soil layer (dual grid) ----------
const soilCv = document.createElement('canvas'); soilCv.width = PW; soilCv.height = PH; const sctx = soilCv.getContext('2d');
let dirtySoil = true;
function drawSoil() {
  sctx.clearRect(0, 0, PW, PH);
  const s = (x, y) => { const c = S.cells[x + ',' + y]; return c && c.soil ? 1 : 0; };
  for (let j = PY; j <= PY + PHc; j++) for (let i = PX; i <= PX + PWc; i++) {
    const idx = s(i - 1, j - 1) * 8 + s(i, j - 1) * 4 + s(i - 1, j) * 2 + s(i, j);
    if (idx) sctx.drawImage(IMG.soil, idx * 32, 0, 32, 32, i * T - 16, j * T - 16, 32, 32);
  }
  for (const k in S.cells) { const c = S.cells[k]; if (!c.soil || !c.wet) continue; const [x, y] = k.split(',').map(Number);
    sctx.drawImage(IMG.wet, ((x * 7 + y * 3) % 8) * 32, 0, 32, 32, x * T, y * T, 32, 32); }
  dirtySoil = false;
}

// ---------- render ----------
const cam = { x: 0, y: 0 }; let camLift = 0;
function shadow(x, y, w) { ctx.fillStyle = 'rgba(18,30,8,.32)'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, 4.5, 0, 0, Math.PI * 2); ctx.fill(); }
function drawChar(e, sheet) {
  const feet = META.chars[sheet === 'npc' ? 'npc_taeo' : sheet].feet;
  const col = e.moving ? Math.floor(e.t * 10) % 6 : 6 + Math.floor(e.t * (e.sit ? 2 : 4)) % 4;
  if (!e.lift) shadow(e.x, e.y, 22);
  ctx.drawImage(IMG[sheet], col * 64, e.dir * 64, 64, 64, Math.round(e.x - 32), Math.round(e.y - feet + (e.sit ? 3 : 0) - (e.lift || 0)), 64, 64);
}
function render(dt) {
  if (dirtySoil) drawSoil();
  // camera
  let lift = 0; for (const id of ['sheet', 'talk']) { const el = $(id); if (!el.classList.contains('hidden')) lift = Math.max(lift, el.offsetHeight / zoom / 2); }
  camLift += (lift - camLift) * Math.min(1, dt * 8);
  cam.x = Math.max(0, Math.min(PW - VW, player.x - VW / 2)); cam.y = Math.max(0, Math.min(PH - VH + camLift * 2, player.y - 24 - VH / 2 + camLift));
  if (VW >= PW) cam.x = (PW - VW) / 2; if (VH >= PH) cam.y = (PH - VH) / 2;
  ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, -Math.round(cam.x * zoom * dpr), -Math.round(cam.y * zoom * dpr));
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2b2117'; ctx.fillRect(cam.x - 2, cam.y - 2, VW + 4, VH + 4);
  ctx.drawImage(IMG.bg, 0, 0); ctx.drawImage(soilCv, 0, 0);
  // จุดสุ่มซ่อน: เห็นเป็นประกายจาง ๆ เมื่อทักษะหาของป่า Lv 1 ขึ้นไป
  const lv = forageLevel();
  if (lv >= 1) S.spots.forEach((s, i) => { if (s.used) return;
    const a = Math.min(.7, .18 + lv * .1) * (.45 + .55 * Math.max(0, Math.sin(now / 500 + i * 1.7)));
    const x = s.x * T + 16 + Math.sin(i * 3.1) * 6, y = s.y * T + 18 + Math.cos(i * 2.3) * 5;
    ctx.fillStyle = `rgba(255,246,190,${a})`; ctx.fillRect(x - .5, y - 3, 1.5, 7); ctx.fillRect(x - 3, y - .5, 7, 1.5); });
  // tap marker
  if (marker) { marker.t += dt; const a = Math.max(0, 1 - marker.t / .6); if (a > 0) { ctx.strokeStyle = `rgba(255,248,220,${a})`; ctx.lineWidth = 1.5;
    ctx.strokeRect(marker.x * T + 2 - (1 - a) * 3, marker.y * T + 2 - (1 - a) * 3, 28 + (1 - a) * 6, 28 + (1 - a) * 6); } }
  // y-sorted sprites
  const list = [];
  SC.objects.forEach(o => { if (isGone(o)) return; const im = IMG['o_' + treeImg(o)];
    const behind = tapOf(o) === 'tree' && player.y < o.y - 4 && player.y > o.y - im.height + 20 && Math.abs(player.x - o.x) < im.width * .45;  // ยืนหลังพุ่มไม้ → พุ่มจางแบบ Stardew
    list.push({ y: o.y, d: () => { if (o.shadow) shadow(o.x, o.y - 2, Math.max(12, o.w * .55)); if (behind) ctx.globalAlpha = .55;
      ctx.drawImage(im, Math.round(o.x - im.width / 2), Math.round(o.y - im.height)); ctx.globalAlpha = 1; } }); });
  for (const k in S.cells) {
    const c = S.cells[k]; const [x, y] = k.split(',').map(Number);
    if (c.debris && IMG['o_' + c.debris]) { const im = IMG['o_' + c.debris]; list.push({ y: y * T + 26, d: () => ctx.drawImage(im, x * T + 16 - im.width / 2, y * T + 28 - im.height) }); }
    if (c.crop) {
      const cr = CROPS[c.crop.k], bb = META.crops[cr.row][c.crop.st], w = bb[2] - bb[0], h = bb[3] - bb[1];
      const sway = c.crop.st >= 2 ? Math.sin(now / 700 + x * 1.3 + y) * .6 : 0;
      list.push({ y: y * T + 29, d: () => {
        ctx.drawImage(IMG.crops, c.crop.st * 64 + bb[0], cr.row * 64 + bb[1], w, h, Math.round(x * T + 16 - w / 2 + sway), y * T + 30 - h, w, h);
        if (c.crop.st >= 4) { const b = Math.sin(now / 250 + x) * 1.5; ctx.fillStyle = '#fff3a0'; ctx.fillRect(x * T + 15, y * T + 30 - h - 7 + b, 2, 2); } } });
    }
  }
  if (npc.present) list.push({ y: npc.y, d: () => drawChar(npc, 'npc') });
  list.push({ y: player.y, d: () => drawChar(player, player.sheet) });
  list.sort((a, b) => a.y - b.y).forEach(s => s.d());
  ctx.drawImage(IMG.hedge, 0, PH - 34);
  // tool icon + progress over head
  if (player.tool >= 0 || busy) {
    const hx = player.x, hy = player.y - 72 + Math.sin(now / 120) * 1.5;
    if (player.tool >= 0) { ctx.fillStyle = 'rgba(255,248,230,.92)'; ctx.beginPath(); ctx.arc(hx, hy, 13, 0, 7); ctx.fill(); ctx.drawImage(IMG.tools, player.tool * 32, 0, 32, 32, hx - 12, hy - 12, 24, 24); }
    ctx.fillStyle = 'rgba(40,28,18,.85)'; ctx.fillRect(hx - 16, hy + 15, 32, 5); ctx.fillStyle = '#9ad35e'; ctx.fillRect(hx - 15, hy + 16, 30 * player.prog, 3);
  }
  // นั่งพัก: ฟองพักเหนือหัว
  if (player.sit) { const hx = player.x + 12, hy = player.y - 66 - (player.lift || 0) + Math.sin(now / 400) * 2;
    ctx.fillStyle = 'rgba(255,248,230,.92)'; ctx.beginPath(); ctx.ellipse(hx, hy, 12, 8, 0, 0, 7); ctx.fill();
    ctx.font = '8px Mitr, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#5f8f3a'; ctx.fillText('พัก', hx, hy + 3); }
  // particles & floating text
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  ctx.font = '9px Mitr, sans-serif'; ctx.textAlign = 'center';
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.y -= 16 * dt; if (f.life <= 0) { floats.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = 'rgba(30,20,10,.7)'; ctx.fillText(f.t, f.x + .7, f.y + .7); ctx.fillStyle = f.c; ctx.fillText(f.t, f.x, f.y); }
  ctx.globalAlpha = 1;
  // day/night tint (ตามเวลาในเกม)
  const h = 6 + S.min / 60; let tint = null;
  if (S.rain && h < 10) tint = [60, 80, 110, .18];
  if (h >= 16.5 && h < 18.5) tint = [240, 130, 40, (h - 16.5) / 2 * .22];
  else if (h >= 18.5 && h < 21) tint = [30, 40, 90, .25 + (h - 18.5) / 2.5 * .25];
  else if (h >= 21) tint = [12, 16, 48, .58];
  if (tint) { ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`; ctx.fillRect(cam.x, cam.y, VW, VH); }
  if (h >= 19) { // แสงตะเกียงจากบ้านยาย
    const g = ctx.createRadialGradient(150, 120, 4, 150, 120, 80); g.addColorStop(0, 'rgba(255,200,110,.28)'); g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g; ctx.fillRect(60, 30, 180, 180); }
  // fade (sleep / nap)
  if (fadeA > 0) {
    fadeA += dt * (fadeCb ? 1.6 : -1.2);
    if (fadeA >= 1 && fadeCb) { const f = fadeCb; fadeCb = null; f(); fadeA = 1; }
    fadeA = Math.max(0, fadeA); ctx.fillStyle = `rgba(10,8,14,${Math.min(1, fadeA)})`; ctx.fillRect(cam.x, cam.y, VW, VH);
  }
}
function moveEnt(e, dt, speed, isPlayer) {
  e.t += dt;
  if (!e.path.length) { if (e.moving) { e.moving = false; if (isPlayer) arrive(); else if (e.onArrive) { const f = e.onArrive; e.onArrive = null; f(); } } return; }
  const [nx, ny] = e.path[0]; const tx = nx * T + T / 2, ty = ny * T + T - 4;
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (!e.moving) e.moving = true;
  e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
  const st = speed * dt;
  if (d <= st) { e.x = tx; e.y = ty; e.cx = nx; e.cy = ny; e.path.shift();
    if (isPlayer) { player.walkTiles = (player.walkTiles || 0) + 1; onStep(nx, ny); }
    if (isPlayer && e.path.length && !walkable(e.path[0][0], e.path[0][1])) e.path = []; }
  else { e.x += dx / d * st; e.y += dy / d * st; }
}
// นาฬิกาเดินเอง + แรงฟื้นตอนนั่งพัก
function tick(dt) {
  if (paused()) return;
  const gm = dt * gmPerSec();
  if (player.sit) {                                   // นั่งพัก: แรง +20 ต่อชั่วโมงในเกม (ม้านั่ง ×1.5)
    const gain = gm / 3 * (player.sit === 'บนม้านั่ง' ? 1.5 : 1);
    if (S.energy < MAX_E) { addEnergy(gain, true); player.sitAcc += gain;
      if (player.sitAcc >= 5) { player.sitAcc -= 5; floatText(player.x, player.y - 78, 'แรง +5', '#c8f59a'); } }
  }
  addMins(gm);
  if ((hudT += dt) > .25) { hudT = 0; hud(); }
}
let last = performance.now(), now = 0;
function loop(t) {
  const dt = Math.min(.05, (t - last) / 1000); last = t; now = t;
  if (S) { tick(dt); moveEnt(player, dt, 84, true); moveEnt(npc, dt, npc.speed, false); render(dt); }
  requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange', () => { if (S && document.hidden) save(); });

// ---------- start ----------
let gender = 'm', dayLenPick = 10;
document.querySelectorAll('.who').forEach(b => b.onclick = () => { document.querySelectorAll('.who').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); gender = b.dataset.g; });
document.querySelectorAll('.dl').forEach(b => b.onclick = () => { document.querySelectorAll('.dl').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); dayLenPick = +b.dataset.m; });
const existing = loadSave();
if (existing) { $('contBtn').hidden = false; $('contBtn').textContent = `เล่นต่อ (วันที่ ${existing.day})`; }
function begin(state, fresh) {
  S = state; player.sheet = 'player_' + S.gender; dayOver = false;
  rebuildBlocked();
  place(player, S.px, S.py); player.dir = S.dir || 0;
  npc.present = false; updateNpcSchedule();
  if (npc.present && !fresh) { place(npc, TAEW_SPOT.x, TAEW_SPOT.y); npc.path = []; }
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); $('bar').classList.remove('hidden'); hud(); dirtySoil = true;
  if (fresh) setTimeout(() => showCard(CARDS.find(c => c.id === 'intro')), 500);
}
window.__dv = { tap: (x, y) => tap(x, y), get S() { return S; }, player, npc, get busy() { return busy; }, addMins, openMap, openBag, openQuests };
Promise.all(loads.map(([n, s]) => load(n, s))).then(() => {
  $('startBtn').onclick = () => { sfx('card'); begin(newState(gender, $('pname').value.trim(), dayLenPick), true); };
  $('contBtn').onclick = () => { sfx('card'); begin(existing, false); };
  requestAnimationFrame(loop);
});
})();
