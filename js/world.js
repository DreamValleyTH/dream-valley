// Dream Valley — world: maps, rendering, movement, farm plot, trees, forage, NPC placement, time
(() => {
'use strict';
const DV = window.DV, T = DV.T, $ = DV.$;
const WORLD = window.DV_WORLD, CMETA = window.DV_CMETA, CROPMETA = window.DV_CROPMETA;
let S = null;

// ---------- isometric projection (logical top-down px  ->  screen px) ----------
DV.isoOn = true;
const ISO = () => DV.isoOn && DV.M && DV.M.iso;
function P(x, y) { const I = ISO(); return I ? [(x - y) * I.K + I.OX, (x + y) * (I.KY || I.K / 2) + (I.OY || 0)] : [x, y]; }
function unP(sx, sy) { const I = ISO(); if (!I) return [sx, sy]; const a = (sx - I.OX) / I.K, b = (sy - (I.OY || 0)) / (I.KY || I.K / 2); return [(a + b) / 2, (b - a) / 2]; }
const depth = (x, y) => ISO() ? x + y : y;
DV.P = P; DV.unP = unP;
// ---------- canvas ----------
const cv = $('game'), ctx = cv.getContext('2d');
let dpr = 1, zoom = 2, VW = 0, VH = 0, uz = 1;   // uz = player pinch zoom
const camOff = { x: 0, y: 0 };                  // one-finger look-around offset (screen px)
DV.camOff = camOff;
function resize() {
  dpr = window.devicePixelRatio || 1;
  const w = innerWidth, h = innerHeight, M = DV.M;
  const I = ISO(), PW = M ? (I ? I.SW : M.W * T) : 900, PH = M ? (I ? I.SH : M.H * T) : 640;
  let z = Math.min(w, h) / (10 * T);
  const room = M && M.name === 'house';   // the interior stays at world scale and floats centred
  if (!room) z = Math.max(z, w / PW, h / PH); else z = Math.max(z, w / PW * 1.5);
  let dev = Math.max(1, Math.round(z * dpr));
  if (!room && dev / dpr < Math.max(w / PW, h / PH)) dev = Math.ceil(Math.max(w / PW, h / PH) * dpr);
  zoomBase = dev / dpr; zoomMin = room ? .5 : Math.max(w / PW, h / PH);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  applyZoom();
}
// continuous zoom (no snapping) so pinching feels as smooth as panning; keeps the point under the fingers still
let zoomBase = 2, zoomMin = .5, uzT = 1, zFocus = null;
function applyZoom(fx, fy) {
  const w = innerWidth, h = innerHeight, nz = Math.max(zoomMin, .5, zoomBase * uz);
  if (fx != null && zoom) { camOff.x += (fx - w / 2) * (1 / zoom - 1 / nz); camOff.y += (fy - h / 2) * (1 / zoom - 1 / nz); }
  zoom = nz; VW = w / zoom; VH = h / zoom;
}
addEventListener('resize', resize);
DV.resize = resize;

// ---------- images ----------
const IMG = {};
DV.IMG = IMG;
function load(name, src) { return new Promise(r => { const i = new Image(); i.onload = () => { IMG[name] = i; r(); }; i.onerror = () => { console.warn('missing', src); r(); }; i.src = src; }); }
DV.loadAssets = (onProgress) => {
  const L = [['gecko', 'assets/gecko.png'], ['soil', 'assets/soil_dual.png'], ['wet', 'assets/soil_wet.png'], ['crops', 'assets/crops.png'], ['tools', 'assets/tools.png'], ['icons', 'assets/icons_all.png']];
  WORLD.atlas.sheets.forEach((s, i) => L.push(['sheet' + i, 'assets/' + s]));
  for (const k in WORLD.maps) { if (WORLD.maps[k].iso) L.push(['iso_' + k, 'assets/' + WORLD.maps[k].iso.bg]); else L.push(['bg_' + k, 'assets/' + WORLD.maps[k].bg]); }
  ['player_m', 'player_f', ...Object.keys(window.DV_NPCS)].forEach(k => L.push(['ch_' + k, 'assets/chars/' + k + '.png']));
  let done = 0;
  return Promise.all(L.map(([n, s]) => load(n, s).then(() => onProgress && onProgress(++done / L.length))));
};

// ---------- map state ----------
let blocked = null;
const MAPS = WORLD.maps;
DV.MAPS = MAPS;
// ---- build mode: farm objects can be moved; S.moved[id] = {dx, dy} in cells, applied on top of the pristine layout ----
function applyMoves() {
  const M = DV.M, mv = (S.moved && S.moved[S.map]) || {}, I = M.iso;
  M.objects.forEach(o => {
    if (!o._b0) { o._b0 = o.block.map(b => b.slice()); o._p0 = { x: o.x, y: o.y, ix: o.ix, iy: o.iy, dep: o.dep, fp: o.fp && o.fp.slice() }; }
    const m0 = mv[o.id] || { dx: 0, dy: 0 }, L = DV.lift && DV.lift.o === o ? DV.lift : null;
    const m = L ? { dx: m0.dx + L.dx, dy: m0.dy + L.dy } : m0, dx = m.dx * T, dy = m.dy * T, p = o._p0;
    o.block = o._b0.map(([a, b]) => [a + m.dx, b + m.dy]);
    o.flip = !!((S.flip && S.flip[S.map] && S.flip[S.map][o.id]) ^ (L && L.flip ? 1 : 0));
    o.x = p.x + dx; o.y = p.y + dy; o.dep = p.dep + dx + dy;
    if (I) { o.ix = p.ix + (dx - dy) * I.K; o.iy = p.iy + (dx + dy) * (I.KY || I.K / 2); }
    if (p.fp) o.fp = [p.fp[0] + dx, p.fp[1] + dy, p.fp[2] + dx, p.fp[3] + dy];
    if (o.id === 'house' && M.places.home) { M.places.home._d0 = M.places.home._d0 || M.places.home.door.slice(); M.places.home.door = [M.places.home._d0[0] + m.dx, M.places.home._d0[1] + m.dy]; }
  });
}
DV.applyMoves = applyMoves;
function rebuildBlocked() {
  const M = DV.M;
  applyMoves();
  blocked = M.blocked.map(r => r.slice());
  M.objects.forEach(o => { if (o._b0) o._b0.forEach(([a, b]) => { if (blocked[b]) blocked[b][a] = 0; }); });
  M.objects.forEach(o => o.block.forEach(([a, b]) => { if (blocked[b] && b >= 0 && a >= 0 && a < M.W) blocked[b][a] = 1; }));
  M.objects.forEach(o => { if (isGone(o)) o.block.forEach(([a, b]) => { if (blocked[b]) blocked[b][a] = 0; }); });
}
DV.rebuildBlocked = rebuildBlocked;
const isGone = o => S && ((S.gone[o.id] != null && S.day < S.gone[o.id]) || (S.stored && S.stored[S.map] && S.stored[S.map][o.id] && !(DV.lift && DV.lift.o === o)));
DV.isGone = isGone;
// any farm cell that is (or was laid out as) a vegetable bed — beds can be dug anywhere and filled back in
const inPlot = (x, y) => S && S.map === 'farm' && !!(S.cells && S.cells[x + ',' + y]);
DV.inPlot = inPlot;

// ---------- entities ----------
const player = { x: 0, y: 0, cx: 0, cy: 0, dir: 0, path: [], moving: false, t: 0, onArrive: null, tool: -1, prog: 0, sit: false, sitAcc: 0, lift: 0 };
DV.player = player;
DV.npcsHere = [];   // {id, x,y,cx,cy,dir,t,path,moving,place}
function place(e, cx, cy) { e.cx = cx; e.cy = cy; e.x = cx * T + T / 2; e.y = cy * T + T - 4; e.path = []; e.moving = false; }
DV.placeEnt = place;
function npcAt(x, y) { return DV.npcsHere.find(n => n.cx === x && n.cy === y); }
DV.npcAt = npcAt;
function walkable(x, y, ignoreNpc) {
  const M = DV.M;
  if (x < 0 || y < 0 || x >= M.W || y >= M.H) return false;
  if (blocked[y][x]) return false;
  if (!ignoreNpc && npcAt(x, y)) return false;
  return true;
}
DV.walkable = walkable;
const STEPS8 = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
// facing on screen for an 8-direction sheet (rows: S, SE, E, NE, N, NW, W, SW); grid x runs to the lower-right, y to the lower-left
const D8 = { '1,0': 1, '0,1': 7, '-1,0': 5, '0,-1': 3, '1,1': 0, '-1,-1': 4, '1,-1': 2, '-1,1': 6 }, DIR4TO8 = [7, 3, 1, 5];
function bfs(sx, sy, goalFn, ignoreNpc) {
  const M = DV.M, W = M.W, H = M.H;
  const prev = new Int32Array(W * H).fill(-2); const q = [sy * W + sx]; prev[q[0]] = -1;
  for (let h = 0; h < q.length; h++) {
    const id = q[h], x = id % W, y = (id / W) | 0;
    if (goalFn(x, y)) { const out = []; let k = id; while (k !== -1) { out.push([k % W, (k / W) | 0]); k = prev[k]; } return out.reverse(); }
    for (const [dx, dy] of STEPS8) {   // 8 directions; a diagonal step needs both side cells free (no corner cutting)
      const nx = x + dx, ny = y + dy, nid = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev[nid] !== -2 || !walkable(nx, ny, ignoreNpc)) continue;
      if (dx && dy && (!walkable(x + dx, y, ignoreNpc) || !walkable(x, y + dy, ignoreNpc))) continue;
      prev[nid] = id; q.push(nid);
    }
  }
  return null;
}
DV.bfs = bfs;
// ---------- free movement (RTS style): walk straight at the target, go round anything in the way, re-plan when blocked ----------
const cellOfPx = (x, y) => [Math.floor(x / T), Math.floor(y / T)];
function clearLine(x0, y0, x1, y1) {   // can a walker (body radius ~6px) go straight from (x0,y0) to (x1,y1)?
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 5)), [sc, sr] = cellOfPx(x0, y0);
  for (let i = 1; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    for (const [ox, oy] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) {
      const [cx, cy] = cellOfPx(x + ox, y + oy);
      if ((cx !== sc || cy !== sr) && !walkable(cx, cy)) return false;
    }
  }
  return true;
}
function planWalk(goalFn, exact) {   // grid search for the route, then pull it tight into straight legs
  const p = bfs(player.cx, player.cy, goalFn); if (!p) return null;
  const last = p[p.length - 1];
  const pts = p.slice(1).map(([x, y]) => [x * T + T / 2, y * T + T / 2]);
  const end = exact && exact[0] === last[0] && exact[1] === last[1] ? [exact[2], exact[3]] : [last[0] * T + T / 2, last[1] * T + T - 4];
  if (pts.length) pts[pts.length - 1] = end; else if (Math.hypot(end[0] - player.x, end[1] - player.y) > 2) pts.push(end);
  const out = []; let cur = [player.x, player.y], i = 0;
  while (i < pts.length) {
    let j = pts.length - 1; while (j > i && !clearLine(cur[0], cur[1], pts[j][0], pts[j][1])) j--;
    out.push(pts[j]); cur = pts[j]; i = j + 1;
  }
  return out;
}
DV.goTo = (goalFn, onArrive, exact) => {
  DV.standUp();
  const w = planWalk(goalFn, exact);
  if (!w) { DV.toast('ไปตรงนั้นไม่ได้'); return false; }
  player.path = w; player.goal = goalFn; player.goalExact = exact || null; player.onArrive = onArrive || null; player.walkTiles = 0; player.replans = 0;
  if (!player.path.length) arrive();
  return true;
};
DV.adjTo = cells => (x, y) => cells.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1);
DV.face = (tx, ty) => { const dx = tx - player.cx, dy = ty - player.cy; player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1); };

// ---------- time / energy ----------
const gmPerSec = () => DV.DAY_LEN / (S.dayLen * 60);
let dayOver = false;
DV.isDayOver = () => dayOver;
DV.addMins = m => {
  if (dayOver) return false;
  const before = S.min; S.min += m;
  if (before < DV.NIGHT - 30 && S.min >= DV.NIGHT - 30 && S.min < DV.NIGHT) DV.toast('สองทุ่มครึ่งแล้ว หมาเริ่มหอน… รีบกลับบ้านนะ');
  if (before < DV.NIGHT && S.min >= DV.NIGHT) DV.toast(safeSpot() ? 'สามทุ่มแล้ว อยู่ในที่ปลอดภัย' : 'สามทุ่มแล้ว! อยู่ข้างนอกอาจเจอผี');
  if (before < DV.DAY_LEN - 60 && S.min >= DV.DAY_LEN - 60) DV.toast('ห้าทุ่มแล้ว ถ้าไม่นอนก่อนเที่ยงคืนจะเป็นลม');
  if (Math.floor(before / 60) !== Math.floor(S.min / 60)) DV.onHour && DV.onHour(Math.floor(S.min / 60));
  if (Math.floor(before / 10) !== Math.floor(S.min / 10)) { DV.updateNpcs(); DV.onTick && DV.onTick(); }
  if (S.min >= DV.DAY_LEN) {
    S.min = DV.DAY_LEN; dayOver = true; DV.setBusy(false); player.path = []; DV.standUp();
    if (S.map === 'farm' && nearHome()) { DV.toast('เที่ยงคืนแล้ว ง่วงจนตาปิด…'); DV.fade(() => DV.newDay(false)); }
    else DV.faint('เที่ยงคืนแล้ว ร่างกายไม่ไหว ล้มหลับไปกลางทาง…');
    return false;
  }
  return true;
};
DV.addEnergy = (e, quiet) => { S.energy = DV.clamp(S.energy + e, 0, DV.MAX_E); if (e < 0 && !quiet) DV.floatText(player.x, player.y - 60, `แรง ${Math.round(e)}`, '#ffd2a8'); };
DV.checkFaint = () => { if (S.energy <= 0) { DV.faint('แรงหมด ตาลาย… ล้มลงตรงนั้นเลย'); return true; } return false; };
const nearHome = () => { if (S.map === 'house') return true; if (S.map !== 'farm') return false; const d = MAPS.farm.places.home.door; return Math.abs(player.cx - d[0]) + Math.abs(player.cy - d[1]) <= 3; };
DV.nearHome = nearHome;
const safeSpot = () => nearHome() || (S.map === 'town' && ['store24', 'temple'].some(p => { const d = DV.M.places[p].door; return Math.abs(player.cx - d[0]) + Math.abs(player.cy - d[1]) <= 3; }));
DV.safeSpot = safeSpot;
DV.paused = () => !S || DV.uiOpen() || fadeA > 0 || dayOver || document.hidden;

// ---------- sitting ----------
DV.sitDown = (where, pos, lift) => { player.sit = where; player.sitAcc = 0; player.path = []; if (pos) { player.x = pos[0]; player.y = pos[1]; player.dir = 0; } player.lift = lift || 0; DV.toast(`นั่งพัก${where} แรงค่อย ๆ ฟื้น · แตะที่อื่นเพื่อลุก`); };
DV.standUp = () => { if (player.sit) { player.sit = false; player.lift = 0; place(player, player.cx, player.cy); DV.hud(); DV.save(); } };

// ---------- busy action with feedback (no tool animation: icon + effects) ----------
let busy = false;
DV.isBusy = () => busy;
DV.setBusy = b => { busy = b; };
DV.doAction = ({ energy = 0, tool = -1, fx = null, targets = [], apply, after }) => {
  if (busy) return;
  busy = true; DV.closeSheet(); DV.standUp();
  const n = Math.max(1, targets.length), dur = 450 + Math.min(n, 30) * 160;
  player.tool = tool; player.prog = 0;
  const t0 = performance.now(); DV.sfx(fx || 'tick');
  let i = 0;
  const step = () => {
    const k = (performance.now() - t0) / dur; player.prog = Math.min(1, k);
    while (i < targets.length && i < k * targets.length) { const [x, y] = targets[i++]; burst(x, y, fx === 'hoe' ? 'dirt' : fx); if (i > 1) DV.sfx(fx || 'tick'); if (apply) apply(x, y); dirtySoil = true; }
    if (k < 1) return requestAnimationFrame(step);
    while (i < targets.length) { const [x, y] = targets[i++]; burst(x, y, fx === 'hoe' ? 'dirt' : fx); if (apply) apply(x, y); }
    if (!targets.length && apply) apply();
    dirtySoil = true; player.tool = -1; busy = false;
    DV.addEnergy(-energy); DV.hud(); DV.save();
    if (dayOver || DV.checkFaint()) return;
    if (after) after(); else DV.maybeRandomCard(0.10);
  };
  requestAnimationFrame(step);
};

// ---------- map switching ----------
DV.enterMap = (name, spawn, silent) => {
  S.map = name; DV.M = MAPS[name]; rebuildBlocked();
  if (!S.spots[name] || S.spots[name].day !== S.day) S.spots[name] = { day: S.day, list: makeSpots(S.day, name) };
  const sp = Array.isArray(spawn) ? spawn : (DV.M.spawns[spawn] || DV.M.spawns[Object.keys(DV.M.spawns)[0]]);
  place(player, sp[0], sp[1]); S.px = sp[0]; S.py = sp[1];
  if (name === 'farm' && !S.cells) S.cells = DV.newPlot();
  if (!S.groundDay || S.groundDay[name] !== S.day) { S.groundDay = S.groundDay || {}; S.groundDay[name] = S.day; freshGround(name); }
  dirtySoil = true; resize(); DV.updateNpcs(true); DV.hud();
  if (!silent) DV.onEnterMap && DV.onEnterMap(name);
};
// travelling costs energy, never clock time
DV.TRAVEL_E = { 'farm>town': 6, 'town>farm': 6 };
DV.travel = (to, spawn) => {
  if (S.map === to) return;
  DV.closeSheet(); DV.standUp();
  const from = S.map, e = DV.TRAVEL_E[from + '>' + to] || 0;
  DV.fade(() => { DV.enterMap(to, spawn); if (e) DV.addEnergy(-e, true); DV.hud(); DV.save();
    DV.toast((to === 'town' ? 'มาถึงใจกลางตำบลบ้านดงเย็น' : to === 'house' ? 'ในบ้านยาย กลิ่นไม้เก่ากับธูปจาง ๆ' : from === 'house' ? 'ออกมาที่ลานหน้าบ้าน' : 'กลับถึงฟาร์มยาย') + (e ? ` · แรง −${e}` : ''));
    if (to === 'house' && DV.geckoGreet) setTimeout(DV.geckoGreet, 700);
    DV.checkFaint(); });
};
DV.goHome = () => { if (S.map !== 'farm') DV.enterMap('farm', 'home', true); else place(player, ...DV.M.spawns.home); };

// ---------- NPC placement by schedule ----------
DV.updateNpcs = (snap) => {
  if (!S || !DV.M) return;
  const want = DV.npcsWanted(S.map);   // [{id, place}]
  const keep = [], used = {};
  const hidden = (cx, cy) => snap || !onScreen(cx, cy);   // people only "teleport" where the player can't see
  for (const w of want) {
    const pl = DV.M.places[w.place]; if (!pl) continue;
    used[w.place] = used[w.place] || 0;
    const sp = pl.spots[used[w.place] % pl.spots.length]; used[w.place]++;
    let e = DV.npcsHere.find(n => n.id === w.id);
    if (!e) { if (!hidden(sp[0], sp[1])) continue; e = { id: w.id, x: 0, y: 0, cx: 0, cy: 0, dir: 0, t: Math.random() * 5, path: [], moving: false }; place(e, sp[0], sp[1]); }
    else if (e.place !== w.place) { if (!(hidden(e.cx, e.cy) && hidden(sp[0], sp[1]))) { keep.push(e); continue; } place(e, sp[0], sp[1]); }
    if (player.cx === e.cx && player.cy === e.cy) { const alt = [[1, 0], [-1, 0], [0, 1]].map(([a, b]) => [e.cx + a, e.cy + b]).find(([a, b]) => walkable(a, b, true)); if (alt) place(e, alt[0], alt[1]); }
    e.place = w.place; e.home = sp; keep.push(e);
  }
  if (!snap) DV.npcsHere.forEach(e => { if (!keep.includes(e) && !hidden(e.cx, e.cy)) keep.push(e); });   // leaving: wait until out of sight
  DV.npcsHere = keep;
};

// ---------- items placed on the ground (from the bag) ----------
DV.dropped = () => { S.dropped = S.dropped || {}; return S.dropped[S.map] || (S.dropped[S.map] = []); };
DV.placeItem = k => {
  const L = DV.dropped(), x = player.cx, y = player.cy;
  if (L.some(d => d.x === x && d.y === y)) { DV.toast('ตรงนี้มีของวางอยู่แล้ว ขยับไปที่อื่นก่อน'); return false; }
  if (S.map === 'farm' && inPlot(x, y)) { DV.toast('วางในแปลงผักไม่ได้'); return false; }
  L.push({ x, y, k, t: absMin() }); return true;
};
const absMin = () => S.day * DV.DAY_LEN + S.min;
// placed things stay a full day; things that grow/fall on the ground by themselves are new every morning
const groundLive = d => d.nat ? d.day === S.day : absMin() - (d.t || 0) < DV.DAY_LEN;
const GROUND = { farm: [['wood', 3], ['stone', 3], ['mushroom', 2], ['mango', 1], ['worm', 1]], town: [['wood', 2], ['stone', 2], ['marble', 1], ['mushroom', 1]] };
function freshGround(name) {
  S.dropped = S.dropped || {}; const L = (S.dropped[name] = (S.dropped[name] || []).filter(d => !d.nat && groundLive(d)));
  const pool = GROUND[name]; if (!pool) return;
  const M = MAPS[name], tot = pool.reduce((a, b) => a + b[1], 0); let r = S.day * 977 + name.length * 31;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const n = name === 'farm' ? 6 : 5;
  for (let i = 0, tries = 0; i < n && tries < 400; tries++) {
    const x = 1 + Math.floor(rnd() * (M.W - 2)), y = 1 + Math.floor(rnd() * (M.H - 2));
    if (M.blocked[y][x] || (name === 'farm' && S.cells && S.cells[x + ',' + y]) || L.some(d => d.x === x && d.y === y)) continue;
    let q = rnd() * tot, k = 0; while (q > pool[k][1]) { q -= pool[k][1]; k++; }
    L.push({ x, y, k: pool[k][0], nat: 1, day: S.day }); i++;
  }
}
const droppedAt = (x, y) => S && (S.dropped && S.dropped[S.map] || []).find(d => d.x === x && d.y === y && groundLive(d));
function pickUp(d) { const L = DV.dropped(), i = L.indexOf(d); if (i < 0) return; L.splice(i, 1); DV.addItem(d.k); DV.sfx('spark'); DV.burst(d.x, d.y, 'spark'); DV.toast(d.nat ? `เก็บ${DV.item(d.k).name}ได้ 1 ชิ้น` : `เก็บ${DV.item(d.k).name}คืนเข้ากระเป๋า`); if (d.nat) DV.gainForage(1); DV.hud(); DV.save(); }

// ---------- farm plot ----------
DV.newPlot = () => {
  const [PX, PY, PWc, PHc] = MAPS.farm.plot, cells = {};
  const DEB = ['debris_05', 'debris_06', 'debris_24', 'debris_25', 'debris_00', 'debris_04'];
  let r = 11; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let y = PY; y < PY + PHc; y++) for (let x = PX; x < PX + PWc; x++) {
    const c = { soil: false, wet: false, crop: null, debris: null };
    if (x < PX + 2 && y < PY + 2) { c.soil = true; c.crop = { k: 'chili', st: 4 }; }
    else if (x < PX + 4 && y < PY + 2) { c.soil = true; c.crop = { k: 'basil', st: 3 }; }
    else if (y === PY && x < PX + 8) { c.soil = true; }
    else if (rnd() < 0.45) c.debris = DEB[Math.floor(rnd() * DEB.length)];
    cells[x + ',' + y] = c;
  }
  return cells;
};
DV.cell = (x, y) => S.cells[x + ',' + y];
DV.plotCells = pred => Object.keys(S.cells || {}).map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]).filter(([x, y]) => pred(DV.cell(x, y), x, y));
DV.waterAll = () => { if (!S.cells) return; for (const k in S.cells) if (S.cells[k].soil) S.cells[k].wet = true; dirtySoil = true; };
DV.damageCrop = () => { const l = DV.plotCells(q => q.crop && q.crop.st > 0); if (l.length) { const [x, y] = DV.pick(l); DV.cell(x, y).crop.st--; } };

// ---------- hidden forage spots (22.1b) ----------
const SPOT_KINDS = [['coin', 20], ['mushroom', 14], ['mush2', 5], ['ant_egg', 8], ['marble', 12], ['worm', 14], ['nail', 9], ['snake', 6], ['wood', 12]];
function makeSpots(day, name) {
  const M = MAPS[name];
  let r = day * 7919 + name.length * 131 + 13; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const cand = [];
  for (let y = 1; y < M.H - 1; y++) for (let x = 1; x < M.W - 1; x++) {
    if (M.blocked[y][x] || (name === 'farm' && S.cells && S.cells[x + ',' + y])) continue;
    cand.push({ x, y, w: M.path[y][x] ? 1 : 3 });
  }
  const out = [], tot = SPOT_KINDS.reduce((a, b) => a + b[1], 0), n = name === 'farm' ? 8 : name === 'house' ? 0 : 6;
  for (let i = 0; i < n && cand.length; i++) {
    let sum = cand.reduce((a, c) => a + c.w, 0), p = rnd() * sum, j = 0;
    while (p > cand[j].w) { p -= cand[j].w; j++; }
    const c = cand.splice(Math.min(j, cand.length - 1), 1)[0];
    let q = rnd() * tot, k = 0; while (q > SPOT_KINDS[k][1]) { q -= SPOT_KINDS[k][1]; k++; }
    out.push({ x: c.x, y: c.y, kind: SPOT_KINDS[k][0], used: false });
  }
  return out;
}
const FORAGE_LV = [0, 3, 8, 15, 25, 38, 55, 75, 100, 130];
DV.forageLevel = () => { let l = 0; FORAGE_LV.forEach((v, i) => { if (S.skill.forage >= v) l = i; }); return l; };
DV.FORAGE_LV = FORAGE_LV;
DV.gainForage = n => {
  const b = DV.forageLevel(); S.skill.forage += n; const a = DV.forageLevel();
  if (a > b) setTimeout(() => { DV.toast(`ทักษะหาของป่า เลเวล ${a}! ` + (a === 1 ? 'เริ่มเห็นประกายจาง ๆ ตรงจุดที่มีของ' : 'สายตาไวขึ้น เก็บได้มากขึ้น')); DV.sfx('spark'); }, 900);
};
function onStep(x, y) {
  const st = S.spots[S.map]; if (!st) return;
  const sp = st.list.find(s => !s.used && s.x === x && s.y === y); if (!sp) return;
  if (Math.random() > 0.5 + DV.forageLevel() * 0.07) return;
  sp.used = true;
  const fx = x * T + 16, fy = y * T - 30;
  DV.stat('found');
  if (sp.kind === 'nail') { DV.addEnergy(-5); burst(x, y, 'dirt'); DV.sfx('dirt'); DV.toast('โอ๊ย! เหยียบตะปูเก่า ๆ ที่จมดินอยู่ (แรง −5)'); return; }
  if (sp.kind === 'snake') { player.path = []; player.onArrive = null; return DV.showCard(window.DV_CARDS.find(c => c.id === 'find_snake')); }
  burst(x, y, 'spark'); DV.sfx('spark'); DV.gainForage(2);
  if (sp.kind === 'coin') { const g = 5 + Math.floor(Math.random() * 4) * 5; S.money += g; DV.floatText(fx, fy, `+฿${g}`, '#fff1a0'); DV.toast(`เจอเหรียญตกอยู่ในดิน ฿${g}`); }
  else { DV.addItem(sp.kind); DV.floatText(fx, fy, `+1 ${DV.item(sp.kind).name}`, '#fff4b0');
    DV.toast({ mushroom: 'เจอเห็ดขึ้นตรงโคนหญ้า!', mush2: 'เห็ดระโงก! ของหายาก', ant_egg: 'เจอรังมดแดงต่ำ ๆ ได้ไข่มดแดงห่อนึง',
      marble: 'เขี่ยดินเจอลูกแก้วเก่า… ของเล่นใครนะ', worm: 'ดินชื้นตรงนี้มีไส้เดือนตัวอ้วน (เหยื่อตกปลา)', wood: 'เจอกิ่งไม้แห้งพอดีมัด' }[sp.kind]); }
  DV.hud(); DV.save();
}

// ---------- input ----------
// tap = walk / interact · one finger drag = look around · two-finger pinch (or mouse wheel) = zoom
let down = null, pinch = null; const ptrs = new Map();
const pdist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
cv.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  if (ptrs.size === 1) {
    down = { x: e.clientX, y: e.clientY, ox: camOff.x, oy: camOff.y, moved: false };
    if (S && S.map === 'farm' && !DV.uiOpen() && ISO()) {
      const sx = e.clientX / zoom + cam.x, sy = e.clientY / zoom + cam.y, h = hitIsoAll(sx, sy), d0 = down;
      if (DV.lift && (h && h.obj === DV.lift.o || liftCellUnder(sx, sy))) { liftGrab(d0, sx, sy); }
      else if (h && canLift(h.obj)) d0.timer = setTimeout(() => { if (down === d0 && !d0.moved && !DV.uiOpen()) { liftStart(h.obj); liftGrab(d0, sx, sy); DV.sfx('wood'); if (navigator.vibrate) try { navigator.vibrate(25); } catch (_) {} } }, 420);
    }
  }
  else if (ptrs.size === 2) { pinch = { d0: pdist(), uz0: uz }; if (down) down.moved = true; }
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; setZoom(pinch.uz0 * pdist() / pinch.d0, (a.x + b.x) / 2, (a.y + b.y) / 2, true); return; }
  if (down && down.lift && ptrs.size === 1) { liftDrag(e.clientX / zoom + cam.x, e.clientY / zoom + cam.y); return; }
  if (down && ptrs.size === 1) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 12) down.moved = true;
    if (down.moved) { camOff.x = down.ox - dx / zoom; camOff.y = down.oy - dy / zoom; camFree = true; }
  }
});
const pend = e => {
  const had = ptrs.delete(e.pointerId); if (!had) return;
  if (ptrs.size < 2) pinch = null;
  if (down && down.timer) clearTimeout(down.timer);
  if (ptrs.size === 0 && down) { const d = down; down = null; if (d.lift) { DV.liftBar(); return; } if (!d.moved && S && e.type === 'pointerup') tapScreen(e.clientX / zoom + cam.x, e.clientY / zoom + cam.y); }
};
cv.addEventListener('pointerup', pend); cv.addEventListener('pointercancel', pend);
cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(uzT * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
let camFree = false;
function setZoom(z, fx, fy, now) {
  uzT = Math.max(Math.max(.6, zoomMin / zoomBase), Math.min(2.6, z)); zFocus = fx != null ? [fx, fy] : [innerWidth / 2, innerHeight / 2];
  if (now) { uz = uzT; applyZoom(...zFocus); }
  try { localStorage.setItem('dv3_zoom', uzT); } catch (_) {}
}
function zoomStep(dt) { if (Math.abs(uz - uzT) < .0005) return; uz += (uzT - uz) * Math.min(1, dt * 14); if (Math.abs(uz - uzT) < .0005) uz = uzT; applyZoom(...(zFocus || [innerWidth / 2, innerHeight / 2])); }
try { const z = parseFloat(localStorage.getItem('dv3_zoom')); if (z > 0) uz = uzT = z; } catch (_) {}
DV.toClient = (sx, sy) => [(sx - cam.x) * zoom, (sy - cam.y) * zoom];
DV.setZoom = setZoom; DV.recenter = () => { camOff.x = camOff.y = 0; camFree = false; };
DV.uiBlocked = () => busy || DV.uiOpen() || dayOver || fadeA > 0;
const sprRect = o => WORLD.atlas.rects[o.s];
function hitIso(sx, sy) {
  for (const n of DV.npcsHere) { const [x, y] = P(n.x, n.y); if (Math.abs(sx - x) < 15 && sy < y + 6 && sy > y - 56) return { npc: n }; }
  const objs = DV.M.objects.filter(o => o.si && DV.tapOf(o) && !isGone(o)).sort((a, b) => b.dep - a.dep);
  for (const o of objs) {
    const tree = DV.tapOf(o) === 'tree', small = o.iw < 34, big = o.iw > 100;
    const w = tree ? o.iw * .35 : small ? 16 : o.iw * .45, top = tree ? o.iy - 46 : o.iy - (big ? o.ih * .8 : Math.max(o.ih, 26));
    if (Math.abs(sx - o.ix) < w && sy < o.iy + (small ? 10 : 6) && sy > top) return { obj: o };
  }
  return null;
}
function hitIsoAll(sx, sy) {   // build mode: anything with a footprint
  const objs = DV.M.objects.filter(o => o.si && o.block.length && !isGone(o)).sort((a, b) => b.dep - a.dep);
  for (const o of objs) { const w = Math.max(14, o.iw * .42), top = o.iy - Math.max(o.ih * .85, 24); if (Math.abs(sx - o.ix) < w && sy < o.iy + 8 && sy > top) return { obj: o }; }
  return null;
}
function tapScreen(sx, sy) {
  if (S.map === 'house' && DV.gecko && Math.hypot(sx - DV.gecko.x, sy - DV.gecko.y) < 16 && !DV.uiBlocked()) return DV.geckoTalk && DV.geckoTalk();
  if (!ISO()) return tap(sx, sy);
  const [wx, wy] = unP(sx, sy);
  tap(wx, wy, (DV.build ? hitIsoAll(sx, sy) : hitIso(sx, sy)) || 0);
}
function hitSprite(wx, wy) {
  for (const n of DV.npcsHere) if (Math.abs(wx - n.x) < 15 && wy < n.y + 6 && wy > n.y - 56) return { npc: n };
  const objs = DV.M.objects.filter(o => DV.tapOf(o) && !isGone(o)).sort((a, b) => b.y - a.y);
  for (const o of objs) {
    const tree = DV.tapOf(o) === 'tree', small = o.w < 34, big = o.w > 100;
    const w = tree ? o.w * .35 : small ? 16 : o.w * .5, top = tree ? o.y - 46 : o.y - (big ? o.h * .8 : Math.max(o.h, 26));
    if (Math.abs(wx - o.x) < w && wy < o.y + (small ? 10 : 6) && wy > top) return { obj: o };
  }
  return null;
}
// ---------- Hay Day style moving: hold an object to lift it, drag it around, then ✓ place · ↔ flip · 📦 store · ✗ cancel ----------
DV.lift = null;
const WILD = { weeds: 1, pebble: 1, branch: 1, stump: 1, boulder: 1 };   // overgrowth is cleared with energy, never lifted
const canLift = o => !!(o && o.block && o.block.length && !WILD[o.tap] && (o.id === 'house' || !o.place));
DV.canLift = canLift;
function liftStart(o, dx = 0, dy = 0, fromStore = false) {
  if (DV.lift && DV.lift.o !== o) liftCancel();
  DV.lift = { o, dx, dy, flip: false, fromStore, grab: null }; applyMoves(); DV.sfx('tick');
}
function liftCellUnder(sx, sy) { const L = DV.lift; if (!L) return false; const [wx, wy] = unP(sx, sy), cx = Math.floor(wx / T), cy = Math.floor(wy / T); return L.o.block.some(([a, b]) => a === cx && b === cy); }
function liftGrab(d, sx, sy) { const [wx, wy] = unP(sx, sy); d.lift = true; d.moved = true; DV.lift.grab = [Math.floor(wx / T) - DV.lift.dx, Math.floor(wy / T) - DV.lift.dy]; const b = $('liftBar'); if (b) b.classList.add('drag'); }
function liftDrag(sx, sy) {
  const L = DV.lift; if (!L || !L.grab) return; const [wx, wy] = unP(sx, sy);
  const ndx = Math.floor(wx / T) - L.grab[0], ndy = Math.floor(wy / T) - L.grab[1];
  if (ndx !== L.dx || ndy !== L.dy) { L.dx = ndx; L.dy = ndy; applyMoves(); DV.sfx('tick'); }
}
function liftValid() {
  const L = DV.lift, M = DV.M; if (!L) return false;
  const own = new Set(L.o._b0.map(([a, b]) => { const m = (S.moved && S.moved[S.map] && S.moved[S.map][L.o.id]) || { dx: 0, dy: 0 }; return (a + m.dx) + ',' + (b + m.dy); }));
  return L.o.block.every(([a, b]) => a >= 1 && b >= 1 && a < M.W - 1 && b < M.H - 1 && (!blocked[b][a] || (own.has(a + ',' + b) && !L.fromStore)) && !inPlot(a, b)
    && !(a === player.cx && b === player.cy) && !(M.exits || []).some(e => e.cells.some(c => c[0] === a && c[1] === b)) && !DV.npcsHere.some(n => n.cx === a && n.cy === b) && !droppedAt(a, b));
}
DV.liftValid = liftValid;
const liftCost = o => Math.min(30, 2 + o.block.length);
DV.liftCost = liftCost;
function liftCancel() { if (!DV.lift) return; DV.lift = null; applyMoves(); const b = $('liftBar'); if (b) b.remove(); }
DV.liftCancel = () => { liftCancel(); DV.sfx('tick'); };
DV.liftFlip = () => { const L = DV.lift; if (!L) return; const xs = L.o._b0.map(b => b[0]), ys = L.o._b0.map(b => b[1]);
  if (Math.max(...xs) - Math.min(...xs) !== Math.max(...ys) - Math.min(...ys)) return DV.toast('ของชิ้นนี้กลับด้านไม่ได้ (ฐานไม่เป็นสี่เหลี่ยมจัตุรัส)');
  L.flip = !L.flip; applyMoves(); DV.sfx('wood'); DV.liftBar(); };
DV.liftConfirm = () => {
  const L = DV.lift; if (!L) return; if (!liftValid()) { DV.sfx('dirt'); return DV.toast('วางตรงนั้นไม่ได้ ชนของอื่น แปลงผัก หรือทางเดิน'); }
  const changed = L.dx || L.dy || L.flip || L.fromStore, cost = changed ? liftCost(L.o) : 0;
  if (S.energy < cost) return DV.toast(`แรงไม่พอ ต้องใช้ ${cost}`);
  const map = S.map; S.moved = S.moved || {}; const mv = (S.moved[map] = S.moved[map] || {}); const m = mv[L.o.id] || { dx: 0, dy: 0 };
  mv[L.o.id] = { dx: m.dx + L.dx, dy: m.dy + L.dy };
  if (L.flip) { S.flip = S.flip || {}; S.flip[map] = S.flip[map] || {}; S.flip[map][L.o.id] = S.flip[map][L.o.id] ? 0 : 1; }
  if (L.fromStore && S.stored && S.stored[map]) delete S.stored[map][L.o.id];
  const [cx, cy] = L.o.block[0]; DV.lift = null; rebuildBlocked(); const b = $('liftBar'); if (b) b.remove();
  if (cost) { DV.addEnergy(-cost); burst(cx, cy, 'dirt'); DV.sfx('wood'); DV.toast(`${L.fromStore ? 'วาง' : 'ย้าย'}แล้ว · แรง −${cost}`); }
  DV.hud(); DV.save(); DV.checkFaint();
};
DV.liftStore = () => {
  const L = DV.lift; if (!L) return; if (L.o.id === 'house') return DV.toast('บ้านยายย้ายได้ แต่เก็บเข้าคลังไม่ได้');
  const cost = Math.max(1, Math.round(liftCost(L.o) / 2)); if (S.energy < cost) return DV.toast(`แรงไม่พอ ต้องใช้ ${cost}`);
  const o = L.o; DV.lift = null; S.stored = S.stored || {}; S.stored[S.map] = S.stored[S.map] || {}; S.stored[S.map][o.id] = 1;
  rebuildBlocked(); const b = $('liftBar'); if (b) b.remove(); DV.addEnergy(-cost); DV.sfx('leaf');
  DV.toast(`เก็บ${DV.objName(o)}เข้าคลังแล้ว · แรง −${cost} · วางใหม่ได้จากปุ่ม "คลังของ"`); DV.hud(); DV.save(); DV.checkFaint();
};
DV.clearFarm = () => {   // ถางโล่ง: every movable thing except grandma's house goes to storage, ready to rebuild
  const list = DV.M.objects.filter(o => canLift(o) && o.id !== 'house' && !isGone(o));
  if (!list.length) return DV.toast('ฟาร์มโล่งแล้ว');
  const cost = Math.min(40, Math.ceil(list.length / 2)); if (S.energy < cost) return DV.toast(`แรงไม่พอ ต้องใช้ ${cost}`);
  S.stored = S.stored || {}; const st = (S.stored[S.map] = S.stored[S.map] || {}); list.forEach(o => { st[o.id] = 1; });
  rebuildBlocked(); DV.addEnergy(-cost); DV.sfx('leaf'); DV.toast(`ถางโล่งแล้ว เก็บ ${list.length} ชิ้นเข้าคลัง · แรง −${cost}`); DV.hud(); DV.save(); DV.checkFaint();
};
const OBJ_NAMES = [['house', 'บ้านยาย'], ['jars', 'โอ่งดิน'], ['jar', 'โอ่งน้ำ'], ['firewood', 'กองฟืน'], ['clothesline', 'ราวตากผ้า'], ['bike', 'จักรยาน'], ['cart', 'เกวียน'],
  ['stove', 'เตาถ่าน'], ['spirit', 'ศาลพระภูมิ'], ['doghouse', 'บ้านหมา'], ['compost', 'กองปุ๋ยหมัก'], ['pump', 'ปั๊มน้ำมือโยก'], ['hose', 'สายยาง'], ['fb', 'รั้วไม้'], ['fl', 'รั้วไม้'],
  ['scarecrow', 'หุ่นไล่กา'], ['haystack', 'กองฟาง'], ['sacks', 'กระสอบ'], ['tree', 'ต้นไม้'], ['bench', 'ม้านั่ง'], ['mailbox', 'ตู้จดหมาย'], ['lotus', 'กอบัว'], ['reeds', 'กอกก'],
  ['stake', 'หลักไม้'], ['bam', 'กอไผ่'], ['banr', 'กอกล้วย'], ['ban', 'กอกล้วย'], ['hedge', 'พุ่มรั้ว'], ['stump', 'ตอไม้'], ['peb', 'ก้อนหิน'], ['br', 'กิ่งไม้'], ['rock', 'ก้อนหิน']];
DV.objName = o => o.label || (OBJ_NAMES.find(([k]) => o.id.startsWith(k)) || [0, 'ของ'])[1];
DV.storedList = () => DV.M.objects.filter(o => S.stored && S.stored[S.map] && S.stored[S.map][o.id]);
DV.placeFromStore = o => {   // drop it in front of the player, lifted, ready to drag
  const m = (S.moved && S.moved[S.map] && S.moved[S.map][o.id]) || { dx: 0, dy: 0 };
  const b0 = o._b0[0], tx = player.cx + 1, ty = player.cy + 1;
  liftStart(o, tx - (b0[0] + m.dx), ty - (b0[1] + m.dy), true); DV.liftBar();
};
DV.build = null;   // { sel: object } while the farm build mode is on
const MOVABLE = o => o && !o.place && o.tap !== 'house' ? true : o && (o.id === 'house');
function buildTap(cx, cy, h) {
  const B = DV.build, M = DV.M, key = cx + ',' + cy;
  if (B.tool === 'dig' || B.tool === 'fill') {
    if (cx < 1 || cy < 1 || cx >= M.W - 1 || cy >= M.H - 1) return;
    if (B.tool === 'dig') {
      if (S.cells[key]) return DV.toast('ตรงนี้เป็นแปลงอยู่แล้ว');
      if (blocked[cy][cx] || (M.exits || []).some(e => e.cells.some(c => c[0] === cx && c[1] === cy)) || (cx === player.cx && cy === player.cy) || DV.npcsHere.some(n => n.cx === cx && n.cy === cy) || droppedAt(cx, cy))
        return DV.toast('ขุดตรงนั้นไม่ได้');
      if (S.energy < 3) return DV.toast('แรงไม่พอ');
      S.cells[key] = { soil: true, wet: false, crop: null, debris: null }; DV.addEnergy(-3); burst(cx, cy, 'dirt'); DV.sfx('hoe'); DV.toast('ขุดแปลงใหม่แล้ว · แรง −3');
    } else {
      const c = S.cells[key]; if (!c) return DV.toast('แตะดินในแปลงที่จะกลบ');
      if (c.crop && !B.confirm) { B.confirm = key; return DV.toast('มีผักอยู่ แตะอีกครั้งเพื่อกลบทิ้ง'); }
      if (S.energy < 2) return DV.toast('แรงไม่พอ');
      delete S.cells[key]; B.confirm = null; DV.addEnergy(-2); burst(cx, cy, 'grass'); DV.sfx('fill'); DV.toast('กลบดินเป็นพื้นแล้ว · แรง −2');
    }
    dirtySoil = true; DV.hud(); DV.save(); DV.checkFaint(); return;
  }
  const o = h && h.obj;
  if (DV.lift) return;   // a lifted object is waiting for ✓ / ✗
  if (!B.sel) {
    if (!o || !canLift(o)) return DV.toast('แตะสิ่งของบนฟาร์มที่อยากย้าย (ต้นไม้ รั้ว บ้าน ม้านั่ง ฯลฯ)');
    liftStart(o); DV.liftBar(); return;
  }
  if (o === B.sel) { B.sel = null; DV.buildBar(); return; }
  const sel = B.sel, a0 = sel.block[0], dx = cx - a0[0], dy = cy - a0[1];
  if (!dx && !dy) return;
  const cells = sel.block.map(([a, b]) => [a + dx, b + dy]), mine = new Set(sel.block.map(c => c.join()));
  const bad = cells.find(([a, b]) => a < 1 || b < 1 || a >= M.W - 1 || b >= M.H - 1 || (blocked[b][a] && !mine.has(a + ',' + b)) || inPlot(a, b) || (a === player.cx && b === player.cy)
    || (M.exits || []).some(e => e.cells.some(c => c[0] === a && c[1] === b)) || DV.npcsHere.some(n => n.cx === a && n.cy === b));
  if (bad) { DV.sfx('dirt'); return DV.toast('วางตรงนั้นไม่ได้ ชนของอื่นหรือทางเดิน'); }
  const cost = Math.min(30, 2 + sel.block.length);
  if (S.energy < cost) return DV.toast(`แรงไม่พอ ต้องใช้ ${cost}`);
  S.moved = S.moved || {}; const mv = (S.moved[S.map] = S.moved[S.map] || {}); const m = mv[sel.id] || { dx: 0, dy: 0 };
  mv[sel.id] = { dx: m.dx + dx, dy: m.dy + dy };
  rebuildBlocked(); DV.addEnergy(-cost); burst(cx, cy, 'dirt'); DV.sfx('wood'); DV.toast(`ย้ายแล้ว · แรง −${cost}`);
  B.sel = null; DV.buildBar(); DV.hud(); DV.save(); DV.checkFaint();
}
function tap(wx, wy, hit) {
  if (DV.build && !DV.uiOpen()) { const cx = Math.floor(wx / T), cy = Math.floor(wy / T); return buildTap(cx, cy, hit === undefined ? hitSprite(wx, wy) : hit || null); }
  if (DV.uiBlocked()) return;
  DV.closeSheet(); DV.standUp();
  const cx = Math.floor(wx / T), cy = Math.floor(wy / T);
  marker = { x: cx, y: cy, t: 0 };
  const h = hit === undefined ? hitSprite(wx, wy) : hit || null;
  if (h && h.npc) {
    const n = h.npc;
    return DV.goTo(DV.adjTo([[n.cx, n.cy]]), () => { DV.face(n.cx, n.cy); n.dir = [1, 0, 3, 2][player.dir]; DV.openNpc(n.id); });
  }
  const hs = DV.M.objects.find(o => o.tap && !o.si && o.block.some(([a, b]) => a === cx && b === cy));
  if (hs && !(h && h.npc)) return DV.goTo(DV.adjTo(hs.block), () => { DV.face(hs.block[0][0], hs.block[0][1]); DV.openObject(hs); });
  const dp = droppedAt(cx, cy);
  if (dp) return DV.goTo((x, y) => (x === cx && y === cy) || DV.adjTo([[cx, cy]])(x, y), () => { DV.face(cx, cy); pickUp(dp); });
  if (S.map === 'farm' && inPlot(cx, cy)) { if (DV.isVisiting && DV.isVisiting()) return DV.toast('นี่แปลงผักของเพื่อน ช่วยดูได้แต่ยังลงมือแทนไม่ได้'); return DV.goTo(DV.adjTo([[cx, cy]]), () => { DV.face(cx, cy); DV.openPlot(cx, cy); }); }
  if (h && h.obj) {
    const o = h.obj;
    if (o.place && DV.M.places[o.place]) {
      const d = DV.M.places[o.place].door;
      return DV.goTo((x, y) => (x === d[0] && y === d[1]) || DV.adjTo([d])(x, y), () => { player.dir = 1; DV.openPlace(o.place); });
    }
    const cells = o.block.length ? o.block : [[Math.floor(o.x / T), Math.floor((o.y - 2) / T)]];
    const goal = o.block.length ? DV.adjTo(cells) : (x, y) => (x === cells[0][0] && y === cells[0][1]) || DV.adjTo(cells)(x, y);
    return DV.goTo(goal, () => { DV.face(cells[0][0], cells[0][1]); DV.openObject(o); });
  }
  if (cx < 0 || cy < 0 || cx >= DV.M.W || cy >= DV.M.H) return;
  if (walkable(cx, cy)) DV.goTo((x, y) => x === cx && y === cy, null, [cx, cy, wx, wy]);
  else DV.goTo(DV.adjTo([[cx, cy]]));
}
DV.tap = tap;
function arrive() {
  const steps = player.walkTiles || 0; player.walkTiles = 0;
  S.px = player.cx; S.py = player.cy;
  const ex = (DV.M.exits || []).find(e => e.cells.some(([a, b]) => a === player.cx && b === player.cy));
  if (ex && steps) { player.onArrive = null; return DV.travel(ex.to, ex.spawn); }
  if (steps && S.min >= DV.NIGHT && !safeSpot() && !DV.uiOpen()) {
    // one roll per night: ผีหลอก 50% · โจร 20% · ไม่เจออะไร 30% — happens once, the first time you're out walking after dark
    if (!S.night || S.night.day !== S.day) { const r = Math.random(); S.night = { day: S.day, kind: r < .5 ? 'ghost' : r < .7 ? 'thief' : 'none', done: 0 }; }
    if (!S.night.done && S.night.kind !== 'none' && Math.random() < .5) {
      let kind = S.night.kind;
      if (kind === 'ghost' && S.amuletDay === S.day && Math.random() < .9) kind = 'none';          // ผ้ายันต์ไล่ผีได้ ไล่โจรไม่ได้
      else if (kind === 'ghost' && S.prayedDay === S.day && Math.random() < .6) kind = 'none';
      S.night.done = 1;
      if (kind !== 'none') { player.onArrive = null; return DV.showCard(kind === 'ghost' ? DV.ghostCard() : DV.thiefCard()); }
    }
  }
  DV.checkVisit && DV.checkVisit();
  const f = player.onArrive; player.onArrive = null; if (f) f();
}
addEventListener('keydown', e => {
  if (!S) return;
  if (e.key === 'Escape') { DV.closeAll(); return; }
  if (DV.uiBlocked() || player.path.length) return;
  const m = { ArrowDown: [0, 1, 0], s: [0, 1, 0], ArrowUp: [0, -1, 1], w: [0, -1, 1], ArrowRight: [1, 0, 2], d: [1, 0, 2], ArrowLeft: [-1, 0, 3], a: [-1, 0, 3] }[e.key];
  if (m) { DV.closeSheet(); DV.standUp(); player.dir = m[2]; const nx = player.cx + m[0], ny = player.cy + m[1]; if (walkable(nx, ny)) DV.goTo((x, y) => x === nx && y === ny); e.preventDefault(); return; }
  if (e.key === 'm' || e.key === 'M') return DV.openMap();
  if (e.key === 'i' || e.key === 'I') return DV.openBag();
  if (e.key === 'p' || e.key === 'P') return DV.openPhone();
  if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') {
    const d = [[0, 1], [0, -1], [1, 0], [-1, 0]][player.dir], tx = player.cx + d[0], ty = player.cy + d[1];
    const n = npcAt(tx, ty); if (n) { n.dir = [1, 0, 3, 2][player.dir]; return DV.openNpc(n.id); }
    if (S.map === 'farm' && inPlot(tx, ty)) return DV.openPlot(tx, ty);
    const pl = Object.keys(DV.M.places).find(k => { const dd = DV.M.places[k].door; return dd[0] === player.cx && dd[1] === player.cy; });
    if (pl) return DV.openPlace(pl);
    const o = DV.M.objects.find(o => DV.tapOf(o) && !isGone(o) && (o.block.length ? o.block : [[Math.floor(o.x / T), Math.floor((o.y - 2) / T)]]).some(([a, b]) => a === tx && b === ty)); if (o) DV.openObject(o);
    e.preventDefault();
  }
});

// ---------- effects ----------
const parts = [], floats = []; let marker = null;
const pickc = a => a[Math.floor(Math.random() * a.length)];
function burst(cx, cy, kind) {
  const [x, y] = P(cx * T + 16, cy * T + 22);
  const col = { dirt: ['#8a5a32', '#a87444', '#5e3b20'], water: ['#9fd8ff', '#5fb4ea', '#e8f7ff'], grass: ['#7fb04c', '#5f8f3a', '#b7d67a'],
    seed: ['#d8b56a', '#8a6a3a'], spark: ['#fff3a0', '#ffd34d', '#ffffff'], heart: ['#ff8fa0', '#ffc2cc'], zzz: ['#ffffff'], tick: ['#ffffff'],
    wood: ['#9a6a3c', '#c79a62', '#6b4626'], leaf: ['#6fa63e', '#9bcf5a', '#f2c94c'] }[kind] || ['#fff'];
  const up = kind === 'leaf' ? 40 : 0;
  for (let i = 0; i < 12; i++) parts.push({ x: x + (Math.random() - .5) * 24, y: y - Math.random() * 8 - up, vx: (Math.random() - .5) * 60,
    vy: -40 - Math.random() * 70 + (kind === 'leaf' ? 50 : 0), life: .6 + Math.random() * .4, c: pickc(col), s: kind === 'spark' ? 2 : 3 });
}
DV.burst = burst;
DV.floatText = (x, y, t, c) => { const yy = y; let [px, py] = P(x, yy + 60); py -= 60; if (!ISO()) { px = x; py = y; } floats.push({ x: px, y: py, t, c, life: 1.3 }); };
const bubbles = [];   // speech bubbles over NPCs (ambient barks)
DV.bubble = (npcId, text, secs = 4) => { const n = DV.npcsHere.find(e => e.id === npcId); if (n) bubbles.push({ n, text: DV.say(text), life: secs }); };
let fadeA = 0, fadeCb = null;
DV.fade = cb => { fadeA = 0.001; fadeCb = cb; };
DV.isFading = () => fadeA > 0;

// ---------- sound: see js/audio.js (DV.sfx / DV.step / music) ----------
DV.muted = false;

// ---------- soil layer ----------
let soilCv = null, sctx = null, dirtySoil = true;
DV.dirtySoil = () => { dirtySoil = true; };
function drawSoil() {
  const M = MAPS.farm;
  if (!soilCv) { soilCv = document.createElement('canvas'); soilCv.width = M.W * T; soilCv.height = M.H * T; sctx = soilCv.getContext('2d'); }
  sctx.clearRect(0, 0, soilCv.width, soilCv.height);
  const CELLS = (DV.visitCells && DV.visitCells()) || S.cells;
  const s = (x, y) => { const c = CELLS[x + ',' + y]; return c && c.soil ? 1 : 0; };
  const ks = Object.keys(CELLS).map(k => k.split(',').map(Number)); if (!ks.length) { dirtySoil = false; return; }
  const PX = Math.min(...ks.map(k => k[0])), PY = Math.min(...ks.map(k => k[1])), PWc = Math.max(...ks.map(k => k[0])) - PX + 1, PHc = Math.max(...ks.map(k => k[1])) - PY + 1;
  for (let j = PY; j <= PY + PHc; j++) for (let i = PX; i <= PX + PWc; i++) {
    const idx = s(i - 1, j - 1) * 8 + s(i, j - 1) * 4 + s(i - 1, j) * 2 + s(i, j);
    if (idx) sctx.drawImage(IMG.soil, idx * 32, 0, 32, 32, i * T - 16, j * T - 16, 32, 32);
  }
  for (const k in CELLS) { const c = CELLS[k]; if (!c.soil || !c.wet) continue; const [x, y] = k.split(',').map(Number);
    sctx.drawImage(IMG.wet, ((x * 7 + y * 3) % 8) * 32, 0, 32, 32, x * T, y * T, 32, 32); }
  dirtySoil = false;
}

// ---------- render ----------
const cam = { x: 0, y: 0 }; let camLift = 0;
DV.cam = cam;
function shadow(x, y, w) { ctx.fillStyle = 'rgba(20,32,8,.34)'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, 4.5, 0, 0, Math.PI * 2); ctx.fill(); }
function drawChar(e, sheet, feet) {
  const im = IMG['ch_' + sheet]; if (!im) return;
  const M = CMETA[sheet] || {};
  if (M.dirs === 8 && (e.d8 == null || e._d8from !== e.dir)) { e.d8 = DIR4TO8[e.dir] || 0; e._d8from = e.dir; }
  const R = M.dirs === 8 ? e.d8 : e.dir, idleN = (M.idle && M.idle[R]) || 4;
  let col, row = R, dy = 0;
  if (e.sit && M.sit) {
    const now = performance.now(); if (!e._sitAt) e._sitAt = now;
    const k = (now - e._sitAt) / 1000, intro = Math.min(4, M.sit - 1);
    row = M.dirs === 8 ? 8 : 4; col = k * 8 < intro ? Math.floor(k * 8) : intro + Math.floor((k - intro / 8) * 3) % Math.max(1, M.sit - intro);
  } else {
    e._sitAt = 0;
    col = e.moving ? Math.floor(e.t * 10) % 6 : 6 + Math.floor(e.t * (e.sit ? 1.5 : 2.5)) % idleN;
    if (e.sit) dy = 3;
  }
  const [ex, ey] = P(e.x, e.y);
  if (!e.lift) shadow(ex, ey, 22);
  ctx.drawImage(im, col * 64, row * 64, 64, 64, Math.round(ex - 32), Math.round(ey - feet + dy - (e.lift || 0)), 64, 64);
}
function drawSpr(key, x, y, alpha, flip) {
  const r = WORLD.atlas.rects[key]; if (!r) return;
  const [sh, sx, sy, w, h] = r;
  if (alpha != null) ctx.globalAlpha = alpha;
  if (flip) { ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(IMG['sheet' + sh], sx, sy, w, h, Math.round(-w / 2), Math.round(y - h), w, h); ctx.restore(); }
  else ctx.drawImage(IMG['sheet' + sh], sx, sy, w, h, Math.round(x - w / 2), Math.round(y - h), w, h);
  if (alpha != null) ctx.globalAlpha = 1;
}
DV.drawSpr = drawSpr;
let now = 0; const remote = {};
function render(dt) {
  const M = DV.M, I = ISO(), PW = I ? I.SW : M.W * T, PH = I ? I.SH : M.H * T;
  const [psx, psy] = P(player.x, player.y);
  if (S.map === 'farm' && dirtySoil) drawSoil();
  let lift = 0; for (const id of ['sheet', 'talk']) { const el = $(id); if (!el.classList.contains('hidden')) lift = Math.max(lift, el.offsetHeight / zoom / 2); }
  camLift += (lift - camLift) * Math.min(1, dt * 8);
  if (player.path.length || player.moving) { const k = Math.min(1, dt * 4); camOff.x -= camOff.x * k; camOff.y -= camOff.y * k; }
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  camOff.x = lim(camOff.x, -PW, PW); camOff.y = lim(camOff.y, -PH, PH);
  cam.x = Math.max(0, Math.min(PW - VW, psx + camOff.x - VW / 2)); cam.y = Math.max(0, Math.min(PH - VH + camLift * 2, psy + camOff.y - 24 - VH / 2 + camLift));
  // keep the look-around offset inside the map so dragging back responds at once
  if (VW < PW) camOff.x = lim(camOff.x, VW / 2 - psx, PW - VW / 2 - psx); else camOff.x = 0;
  if (VH < PH) camOff.y = lim(camOff.y, VH / 2 - psy + 24 - camLift, PH - VH / 2 + camLift - psy + 24); else camOff.y = 0;
  if (VW >= PW) cam.x = (PW - VW) / 2; if (VH >= PH) cam.y = (PH - VH) / 2;
  ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, -Math.round(cam.x * zoom * dpr), -Math.round(cam.y * zoom * dpr));
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2b2117'; ctx.fillRect(cam.x - 2, cam.y - 2, VW + 4, VH + 4);
  if (I) { ctx.drawImage(IMG['iso_' + S.map], 0, 0); if (S.map === 'farm') { ctx.save(); ctx.transform(I.K, I.K / 2, -I.K, I.K / 2, I.OX, 0); ctx.drawImage(soilCv, 0, 0); ctx.restore(); } }
  else { ctx.drawImage(IMG['bg_' + S.map], 0, 0); if (S.map === 'farm') ctx.drawImage(soilCv, 0, 0); }
  if (I && I.rtShadow) { ctx.fillStyle = 'rgba(28,40,10,.34)';
    M.objects.forEach(o => { if (!o.si || isGone(o)) return;
      if (o.shadow === 'building' && o.fp) { const [x0, y0, x1, y1] = o.fp, c = [[x0, y0], [x1 + 8, y0], [x1 + 8, y1 + 6], [x0, y1 + 6]].map(([a, b]) => P(a + 6, b + 4));
        ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(q => ctx.lineTo(...q)); ctx.closePath(); ctx.fill(); }
      else if (o.shadow === 'tree') { ctx.beginPath(); ctx.ellipse(o.ix + 4, o.iy - 2, o.iw * .34, o.iw * .15, 0, 0, 7); ctx.fill(); }
      else if (o.shadow) { ctx.beginPath(); ctx.ellipse(o.ix + 1, o.iy - 1, Math.max(6, o.iw * .4), Math.max(3, Math.min(7, o.iw * .18)), 0, 0, 7); ctx.fill(); } }); }
  if (DV.build) { ctx.strokeStyle = 'rgba(255,240,170,.35)'; ctx.lineWidth = 1;
    for (let y = 1; y < M.H - 1; y++) for (let x = 1; x < M.W - 1; x++) if (!blocked[y][x] && !inPlot(x, y)) { const c = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => P(a * T, b * T)); ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(q => ctx.lineTo(...q)); ctx.closePath(); ctx.stroke(); }
    const sel = null; if (sel) { ctx.fillStyle = `rgba(255,220,90,${.25 + .15 * Math.sin(now / 150)})`; sel.block.forEach(([x, y]) => { const c = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => P(a * T, b * T)); ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(q => ctx.lineTo(...q)); ctx.closePath(); ctx.fill(); }); } }
  if (S.map === 'house' && IMG.gecko) {   // ไอ้จุก, the house gecko: sits still, somewhere new each day
    const spots = [[92, 96], [70, 122], [118, 84], [252, 74], [300, 98], [210, 70], [150, 60], [330, 128], [56, 150]];
    const [gx, gy] = spots[(S.day * 7 + 3) % spots.length];
    DV.gecko = { x: gx, y: gy };
    ctx.drawImage(IMG.gecko, gx - 13, gy - 13, 26, 26);
  }
  if (DV.lift && S.map === 'farm') { const ok = liftValid(); ctx.fillStyle = ok ? 'rgba(120,230,110,.45)' : 'rgba(240,80,70,.5)'; ctx.strokeStyle = ok ? 'rgba(220,255,200,.9)' : 'rgba(255,200,190,.9)'; ctx.lineWidth = 1;
    DV.lift.o.block.forEach(([x, y]) => { const c = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => P(a * T, b * T)); ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(q => ctx.lineTo(...q)); ctx.closePath(); ctx.fill(); ctx.stroke(); }); }
  // hidden spots sparkle (forage Lv1+)
  const lv = DV.forageLevel(), st = S.spots[S.map];
  if (lv >= 1 && st) st.list.forEach((s, i) => { if (s.used) return;
    const a = Math.min(.7, .18 + lv * .1) * (.45 + .55 * Math.max(0, Math.sin(now / 500 + i * 1.7)));
    const [x, y] = P(s.x * T + 16 + Math.sin(i * 3.1) * 6, s.y * T + 18 + Math.cos(i * 2.3) * 5);
    ctx.fillStyle = `rgba(255,246,190,${a})`; ctx.fillRect(x - .5, y - 3, 1.5, 7); ctx.fillRect(x - 3, y - .5, 7, 1.5); });
  if (marker) { marker.t += dt; const a = Math.max(0, 1 - marker.t / .6); if (a > 0) { ctx.strokeStyle = `rgba(255,248,220,${a})`; ctx.lineWidth = 1.5;
    if (I) { const g = (1 - a) * 3, c = [[marker.x * T + 2 - g, marker.y * T + 2 - g], [marker.x * T + 30 + g, marker.y * T + 2 - g], [marker.x * T + 30 + g, marker.y * T + 30 + g], [marker.x * T + 2 - g, marker.y * T + 30 + g]].map(([x, y]) => P(x, y));
      ctx.beginPath(); ctx.moveTo(...c[0]); c.slice(1).forEach(q => ctx.lineTo(...q)); ctx.closePath(); ctx.stroke(); }
    else ctx.strokeRect(marker.x * T + 2 - (1 - a) * 3, marker.y * T + 2 - (1 - a) * 3, 28 + (1 - a) * 6, 28 + (1 - a) * 6); } }
  // y-sorted
  const list = [];
  M.objects.forEach(o => { if (isGone(o)) return;
    if (I) { if (!o.si) return; const key = o.si === o.s ? DV.objSprite(o) : o.si; const r = WORLD.atlas.rects[key]; if (!r) return; const w = r[3], h = r[4];
      const pd = player.x + player.y, behind = (o.iw > 60 && o.ih > 70) && pd < o.dep && psy < o.iy - 4 && psy > o.iy - h + 16 && Math.abs(psx - o.ix) < w * .46;
      const lifted = DV.lift && DV.lift.o === o, up = lifted ? 7 + Math.sin(now / 160) * 2 : 0;
      list.push({ y: lifted ? 1e9 - 1 : o.front ? 1e9 : o.dep, d: () => drawSpr(key, o.ix, o.iy - up, lifted ? .9 : behind ? .5 : null, o.flip) }); return; }
    const key = DV.objSprite(o); const r = WORLD.atlas.rects[key]; if (!r) return;
    const w = r[3], h = r[4];
    const behind = (o.w > 60 && o.h > 70) && player.y < o.y - 4 && player.y > o.y - h + 16 && Math.abs(player.x - o.x) < w * .46;
    list.push({ y: o.front ? 1e9 : o.y, d: () => drawSpr(key, o.x, o.y, behind ? .5 : null) }); });
  const CELLS = S.map === 'farm' && ((DV.visitCells && DV.visitCells()) || S.cells);
  if (S.map === 'farm') for (const k in CELLS) {
    const c = CELLS[k]; const [x, y] = k.split(',').map(Number);
    if (c.debris) { const key = WORLD.atlas.debris[c.debris]; const r = WORLD.atlas.rects[key]; const [dx, dy] = P(x * T + 16, y * T + 22); if (r) list.push({ y: depth(x * T + 16, y * T + 22), d: () => drawSpr(key, dx, dy + 4) }); }
    if (c.crop) {
      const cr = DV.CROPS[c.crop.k], bb = CROPMETA.crops[cr.row][c.crop.st], w = bb[2] - bb[0], h = bb[3] - bb[1];
      const sway = c.crop.st >= 2 ? Math.sin(now / 700 + x * 1.3 + y) * .6 : 0;
      const [qx, qy] = P(x * T + 16, y * T + 20);
      list.push({ y: depth(x * T + 16, y * T + 22), d: () => {
        ctx.drawImage(IMG.crops, c.crop.st * 64 + bb[0], cr.row * 64 + bb[1], w, h, Math.round(qx - w / 2 + sway), Math.round(qy + 4 - h), w, h);
        if (c.crop.st >= 4) { const b = Math.sin(now / 250 + x) * 1.5; ctx.fillStyle = '#fff3a0'; ctx.fillRect(qx - 1, qy + 4 - h - 7 + b, 2, 2); } } });
    }
  }
  (S.dropped && S.dropped[S.map] || []).filter(groundLive).forEach(d => { const [qx, qy] = P(d.x * T + 16, d.y * T + 18); const ic = DV.icon(DV.item(d.k).icon);
    list.push({ y: depth(d.x * T + 16, d.y * T + 18), d: () => { shadow(qx, qy + 2, 16); ctx.drawImage(IMG.icons, (ic % 32) * 32, Math.floor(ic / 32) * 32, 32, 32, Math.round(qx - 12), Math.round(qy - 22 + Math.sin(now / 500 + d.x) * 1), 24, 24); } }); });
  for (const n of DV.npcsHere) list.push({ y: depth(n.x, n.y), d: () => { drawChar(n, n.id, (CMETA[n.id] || { feet: 60 }).feet); drawMark(n); } });
  list.push({ y: depth(player.x, player.y), d: () => drawChar(player, 'player_' + S.gender, (CMETA['player_' + S.gender] || { feet: 60 }).feet) });
  // friends on the call: drawn from their presence, eased towards the latest position
  (DV.netPlayers ? DV.netPlayers() : []).forEach(pr => {
    const e = remote[pr.num] || (remote[pr.num] = { x: pr.x, y: pr.y, t: 0, dir: 0 }); e.x += (pr.x - e.x) * Math.min(1, dt * 8); e.y += (pr.y - e.y) * Math.min(1, dt * 8);
    e.dir = pr.dir || 0; if (pr.d8 != null) { e.d8 = pr.d8; e._d8from = e.dir; } e.moving = !!pr.mv; e.sit = !!pr.sit; e.t += dt; const sheet = 'player_' + (pr.g === 'f' ? 'f' : 'm');
    list.push({ y: depth(e.x, e.y), d: () => { drawChar(e, sheet, (CMETA[sheet] || { feet: 60 }).feet); const [x, y] = P(e.x, e.y);
      ctx.font = '8px Mitr, sans-serif'; ctx.textAlign = 'center'; const w = ctx.measureText(pr.name || '').width + 8;
      ctx.fillStyle = 'rgba(40,28,18,.75)'; roundRect(x - w / 2, y - 76, w, 11, 3); ctx.fill(); ctx.fillStyle = '#fff3d9'; ctx.fillText(pr.name || '', x, y - 67.5);
      if (pr.say && pr.say.text) { const tw = ctx.measureText(pr.say.text).width + 10; ctx.fillStyle = 'rgba(255,250,236,.95)'; roundRect(x - tw / 2, y - 94, tw, 14, 4); ctx.fill(); ctx.fillStyle = '#33251a'; ctx.fillText(pr.say.text, x, y - 84); } } });
  });
  list.sort((a, b) => a.y - b.y).forEach(s => s.d());
  // tool icon
  if (player.tool >= 0 || busy) {
    const hx = psx, hy = psy - 72 + Math.sin(now / 120) * 1.5;
    if (player.tool >= 0) { ctx.fillStyle = 'rgba(255,248,230,.92)'; ctx.beginPath(); ctx.arc(hx, hy, 13, 0, 7); ctx.fill(); ctx.drawImage(IMG.tools, player.tool * 32, 0, 32, 32, hx - 12, hy - 12, 24, 24); }
    ctx.fillStyle = 'rgba(40,28,18,.85)'; ctx.fillRect(hx - 16, hy + 15, 32, 5); ctx.fillStyle = '#9ad35e'; ctx.fillRect(hx - 15, hy + 16, 30 * player.prog, 3);
  }
  if (player.sit) { const hx = psx + 12, hy = psy - 66 - (player.lift || 0) + Math.sin(now / 400) * 2;
    ctx.fillStyle = 'rgba(255,248,230,.92)'; ctx.beginPath(); ctx.ellipse(hx, hy, 12, 8, 0, 0, 7); ctx.fill();
    ctx.font = '8px Mitr, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#5f8f3a'; ctx.fillText('พัก', hx, hy + 3); }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  ctx.font = '9px Mitr, sans-serif'; ctx.textAlign = 'center';
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.y -= 16 * dt; if (f.life <= 0) { floats.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = 'rgba(30,20,10,.7)'; ctx.fillText(f.t, f.x + .7, f.y + .7); ctx.fillStyle = f.c; ctx.fillText(f.t, f.x, f.y); }
  ctx.globalAlpha = 1;
  // speech bubbles
  ctx.font = '8px Mitr, sans-serif';
  for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.life -= dt; if (b.life <= 0 || !DV.npcsHere.includes(b.n)) { bubbles.splice(i, 1); continue; }
    const lines = wrap(b.text, 120); const w = Math.min(130, Math.max(...lines.map(l => ctx.measureText(l).width)) + 10), h = lines.length * 10 + 6;
    const [bnx, bny] = P(b.n.x, b.n.y); const x = bnx - w / 2, y = bny - 64 - h; ctx.globalAlpha = Math.min(1, b.life * 2);
    ctx.fillStyle = 'rgba(255,250,236,.95)'; roundRect(x, y, w, h, 4); ctx.fill(); ctx.strokeStyle = 'rgba(59,42,28,.8)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bnx - 3, y + h); ctx.lineTo(bnx, y + h + 4); ctx.lineTo(bnx + 3, y + h); ctx.fill();
    ctx.fillStyle = '#33251a'; ctx.textAlign = 'left'; lines.forEach((l, k) => ctx.fillText(l, x + 5, y + 11 + k * 10)); ctx.textAlign = 'center'; }
  ctx.globalAlpha = 1;
  // day / night tint
  const h = 6 + S.min / 60; let tint = null;
  if (S.rain && h < 10) tint = [60, 80, 110, .18];
  if (h >= 16.5 && h < 18.5) tint = [240, 130, 40, (h - 16.5) / 2 * .22];
  else if (h >= 18.5 && h < 21) tint = [30, 40, 90, .25 + (h - 18.5) / 2.5 * .25];
  else if (h >= 21) tint = [12, 16, 48, .58];
  if (tint) { ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`; ctx.fillRect(cam.x, cam.y, VW, VH); }
  if (h >= 18.5) { // window / lamp lights (code-made night lights)
    ctx.globalCompositeOperation = 'lighter';
    M.objects.forEach(o => { const ox = I ? o.ix : o.x, oy = I ? o.iy : o.y, ow = I ? o.iw : o.w, oh = I ? o.ih : o.h;
      if (ow > 100 && oh > 80 && !isGone(o)) { const g = ctx.createRadialGradient(ox, oy - oh * .45, 4, ox, oy - oh * .45, ow * .55);
      g.addColorStop(0, 'rgba(255,190,90,.20)'); g.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = g; ctx.fillRect(ox - ow, oy - oh, ow * 2, oh * 1.4); }
      if (o.id && o.id.startsWith('lamp')) { const g = ctx.createRadialGradient(ox, oy - 30, 2, ox, oy - 20, 60); g.addColorStop(0, 'rgba(255,220,140,.35)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(ox - 60, oy - 80, 120, 120); } });
    ctx.globalCompositeOperation = 'source-over';
  }
  if (fadeA > 0) {
    fadeA += dt * (fadeCb ? 1.6 : -1.2);
    if (fadeA >= 1 && fadeCb) { const f = fadeCb; fadeCb = null; f(); fadeA = 1; }
    fadeA = Math.max(0, fadeA); ctx.fillStyle = `rgba(10,8,14,${Math.min(1, fadeA)})`; ctx.fillRect(cam.x, cam.y, VW, VH);
  }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrap(t, maxw) {
  const out = []; let cur = '';
  for (const ch of Array.from(t)) { if (ctx.measureText(cur + ch).width > maxw && cur) { out.push(cur); cur = ''; } cur += ch; }
  if (cur) out.push(cur); return out.slice(0, 4);
}
function drawMark(n) {   // "!" over NPCs with a quest offer / turn-in, "…" for story
  const m = DV.npcMark && DV.npcMark(n.id); if (!m) return;
  const [nsx, nsy] = P(n.x, n.y); const x = nsx, y = nsy - 70 + Math.sin(now / 200) * 2;
  ctx.fillStyle = m === '!' ? '#f2b84b' : '#9ad35e'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#3b2a1c'; ctx.font = 'bold 9px Mitr, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(m, x, y + 3);
}
const D8ANG = [0, 1, 2, 3, 4, 5, 6, 7];
function moveEnt(e, dt, speed, isPlayer) {
  e.t += dt;
  if (!e.path.length) { if (e.moving) { e.moving = false; if (isPlayer) arrive(); } return; }
  const [tx, ty] = e.path[0];
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (!e.moving) e.moving = true;
  if (d > 0.5) {
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 0 : 1);
    const ang = Math.atan2((dx + dy) / 2, dx - dy);   // screen direction of the step (iso)
    e.d8 = [2, 1, 0, 7, 6, 5, 4, 3][((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8]; e._d8from = e.dir;
  }
  const st = speed * dt, k = d <= st ? 1 : st / d;
  const nx = e.x + dx * k, ny = e.y + dy * k, [ncx, ncy] = cellOfPx(nx, ny);
  if ((ncx !== e.cx || ncy !== e.cy) && !walkable(ncx, ncy)) {   // something stepped into the way: find a new route to the same goal
    if (isPlayer && player.goal && (player.replans = (player.replans || 0) + 1) < 6) {
      const w = planWalk(player.goal, player.goalExact); if (w) { e.path = w; return; }
    }
    e.path = []; return;
  }
  e.x = nx; e.y = ny;
  if (ncx !== e.cx || ncy !== e.cy) {
    e.cx = ncx; e.cy = ncy;
    if (isPlayer) { player.walkTiles = (player.walkTiles || 0) + 1; onStep(ncx, ncy); DV.step && DV.step(S.map === 'house' ? 'wood' : DV.M.path[ncy][ncx] ? (S.map === 'town' ? 'hard' : 'dirt') : 'grass'); }
  }
  if (k === 1) e.path.shift();
}
// NPCs don't walk (walk cycle parked for now): they stand, breathe, look around, and swap spots only while off-screen
function npcIdle(dt) {
  for (const n of DV.npcsHere) {
    n.t += dt; n.path = []; n.moving = false;
    n.wait = (n.wait || 3 + Math.random() * 6) - dt;
    if (n.wait <= 0) { n.wait = 5 + Math.random() * 9; if (Math.random() < .6) n.dir = Math.floor(Math.random() * 4); }
  }
}
function onScreen(cx, cy) { const [x, y] = P(cx * T + 16, cy * T + 28); return x > cam.x - 40 && x < cam.x + VW + 40 && y > cam.y - 10 && y < cam.y + VH + 80; }
DV.onScreen = onScreen;
let hudT = 0;
function tick(dt) {
  if (DV.paused()) return;
  const gm = dt * gmPerSec();
  if (player.sit) {
    const gain = gm / 3 * (player.sit === 'บนม้านั่ง' ? 1.5 : 1);
    if (S.energy < DV.MAX_E) { DV.addEnergy(gain, true); player.sitAcc += gain; if (player.sitAcc >= 5) { player.sitAcc -= 5; DV.floatText(player.x, player.y - 78, 'แรง +5', '#c8f59a'); } }
  }
  DV.addMins(gm);
  if ((hudT += dt) > .25) { hudT = 0; DV.hud(); }
  DV.ambientTick && DV.ambientTick(dt);
}
let last = performance.now();
function loop(t) {
  const dt = Math.min(.05, (t - last) / 1000); last = t; now = t;
  if (S && DV.M) { zoomStep(dt); tick(dt); moveEnt(player, dt, 84, true); npcIdle(dt); render(dt); }
  requestAnimationFrame(loop);
}
DV.startLoop = () => requestAnimationFrame(loop);
DV.bindState = st => { S = st; dayOver = false; };
})();
