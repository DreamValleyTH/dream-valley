// Dream Valley — v2.0: farm fence tiers built by a hired builder, calendar (30-day months) and seasons, cutscenes
// (visiting a friend, the builder, …), a prologue before the farm, events that walk you somewhere, new beds anywhere.
(() => {
'use strict';
const DV = window.DV, $ = DV.$, S = () => DV.S, WORLD = window.DV_WORLD;
const ic = n => ['icons', DV.icon(n)];

// ================= calendar & seasons =================
// day 1 is 1 June (start of the rains); every month has 30 days
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], START_M = 5;
DV.date = (day = S().day) => { const m = (START_M + Math.floor((day - 1) / 30)) % 12, d = ((day - 1) % 30) + 1;
  const season = m >= 2 && m <= 4 ? 'hot' : m >= 5 && m <= 9 ? 'rain' : 'cool';
  return { d, m, month: MONTHS[m], season, seasonName: { hot: 'หน้าร้อน', rain: 'หน้าฝน', cool: 'หน้าหนาว' }[season] }; };
DV.season = () => DV.date().season;
DV.rainChance = day => ({ rain: .42, hot: .07, cool: .04 })[DV.date(day).season];
const hud0 = DV.hud;
DV.hud = () => { hud0(); const s = S(); if (!s) return; const dt = DV.date(); const el = $('dayLabel');
  if (el) el.textContent = `${dt.d} ${dt.month} · ${['', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'][DV.weekday(s.day)]}${s.rain ? ' · ฝน' : ''}`;
  const fn = $('fullNum'); if (fn) fn.textContent = Math.round(s.full == null ? 80 : s.full); };

// ================= cutscenes =================
DV.cut = (id, title, beats, art) => DV.playScene && DV.playScene({ id, title, art: art || 'village', beats });
DV.visitCut = name => DV.cut('st_visit_ride', `ไปบ้าน${name || 'เพื่อน'}`, [
  { who: 'narrator', text: `นั่งสองแถวสีฟ้าไปบ้าน${name || 'เพื่อน'} ลมเย็น ๆ พัดผ่านทุ่งนา` },
  { who: 'narrator', text: 'คนขับเปิดเพลงลูกทุ่งดังลั่น ป้าข้าง ๆ แบ่งข้าวเหนียวให้กิน… ถึงแล้ว!' }]);

// ================= farm fence: 4 tiers, a builder makes each one over a few days =================
const FT = {
  1: { name: 'รั้วไม้ไผ่พัง ๆ', keys: ['fence_bamboo_w'] },
  2: { name: 'รั้วไม้ไผ่ใหม่ สลับต้นเถาวัลย์', keys: ['fence_bamboo_n', 'fence_bamboo_v'], price: 2500, days: 2 },
  3: { name: 'รั้วลวดหนาม สลับเถาวัลย์', keys: ['fence_wire_n', 'fence_wire_v'], price: 6000, days: 3 },
  4: { name: 'รั้วปูนอย่างดี มีไม้ดอก', keys: ['fence_wall_n', 'fence_wall_v'], price: 18000, days: 5 },
};
const tier = () => (S() && S().fenceTier) || 1;
const so0 = DV.objSprite;
DV.objSprite = o => { if (o.tap === 'fence' && S() && S().map === 'farm') { const t = FT[tier()], c = o.block && o.block[0] || [0, 0]; const k = t.keys[(c[0] + c[1]) % t.keys.length];
  return (WORLD.atlas.alt || {})[k] || so0(o); } return so0(o); };
DV.openFence = () => {
  const s = S(), t = tier(), nx = FT[t + 1], job = s.fenceJob, opts = [];
  if (job) opts.push({ info: true, label: `ช่างเปี๊ยกกำลังทำ${FT[job.tier].name}`, extra: `เสร็จเช้าวันที่ ${DV.date(job.done).d} ${DV.date(job.done).month}` });
  else if (nx) opts.push({ label: `จ้างช่างเปี๊ยกทำ${nx.name}`, icon: ['ui', 'home'], hl: true, extra: `฿${nx.price.toLocaleString()} · ${nx.days} วัน`, disabled: s.money < nx.price && `เงินไม่พอ (มี ฿${s.money.toLocaleString()})`,
    run: () => { s.money -= nx.price; s.fenceJob = { tier: t + 1, done: s.day + nx.days }; DV.closeSheet(); DV.sfx('coin'); DV.hud(); DV.save();
      DV.cut('st_fence_build', 'จ้างช่างทำรั้ว', [{ who: 'piak', text: `ได้เลย! ${nx.name} ใช่ไหม เดี๋ยวพรุ่งนี้เช้าพาลูกน้องเข้าไปเริ่มงาน` }, { who: 'piak', text: `ให้เวลา ${nx.days} วันนะ เสร็จแล้วรับรองหมาข้างบ้านมุดไม่ได้` }]); } });
  else opts.push({ info: true, label: 'รั้วดีที่สุดแล้ว สวยที่สุดในตำบล' });
  [1, 2, 3, 4].forEach(i => opts.push({ info: true, label: `${i <= t ? '✅' : '▫️'} ขั้น ${i}: ${FT[i].name}`, extra: FT[i].price ? `฿${FT[i].price.toLocaleString()} · ${FT[i].days} วัน` : 'ตอนนี้' }));
  DV.openSheet('รั้วฟาร์มยาย', `ตอนนี้: ${FT[t].name}`, null, opts, { portrait: 'piak' });
};
const fenceMorning = s => { const j = s.fenceJob; if (!j || s.day < j.done) { if (j) DV.notify(`🔨 ช่างเปี๊ยกกำลังทำรั้ว (เสร็จ ${DV.date(j.done).d} ${DV.date(j.done).month})`); return; }
  s.fenceTier = j.tier; s.fenceJob = null; DV.save();
  setTimeout(() => DV.cut('st_fence_build', 'รั้วใหม่เสร็จแล้ว!', [{ who: 'piak', text: `เสร็จแล้ว! ${FT[s.fenceTier].name} ลองเดินดูรอบ ๆ สิ` }, { who: 'narrator', text: 'ฟาร์มยายดูเป็นบ้านคนขึ้นมาอีกนิด… ยายคงยิ้มอยู่' }]), 1500); };
const pe0 = DV.placeExtras;
DV.placeExtras = (pid, opts) => { pe0 && pe0(pid, opts); if (pid === 'workshop') opts.push({ label: 'จ้างทำรั้วฟาร์ม', icon: ['ui', 'home'], extra: `ตอนนี้ขั้น ${tier()}/4`, run: () => DV.openFence() }); };

// ================= events that make you walk there =================
const nearest = list => { const p = DV.player; let best = null, bd = 1e9; list.forEach(c => { const d = Math.abs(c[0] - p.cx) + Math.abs(c[1] - p.cy); if (d < bd) { bd = d; best = c; } }); return best; };
DV.walkThen = (kind, fn) => {
  const M = DV.M, s = S(); let goal = null;
  if (kind === 'home' || kind === 'shelter') {
    const doors = Object.entries(M.places || {}).filter(([id, pl]) => kind === 'home' ? pl.kind === 'home' : /home|sala|temple|store24|taew_shop|coffee|noi_noodle/.test(id + (pl.kind || ''))).map(([, pl]) => pl.door);
    const trees = kind === 'shelter' ? M.objects.filter(o => o.tap === 'tree' && !DV.isGone(o)).map(o => o.block[0]) : [];
    goal = nearest([...doors, ...trees]);
  } else if (kind === 'plot') goal = nearest(Object.keys(s.cells || {}).map(k => k.split(',').map(Number)));
  else if (kind === 'away') { const p = DV.player; goal = [p.cx + (p.dir === 2 ? -4 : p.dir === 3 ? 4 : 0), p.cy + (p.dir === 0 ? -4 : p.dir === 1 ? 4 : 0)]; }
  if (!goal) return fn();
  DV.toast({ home: 'เดินไปหลบใต้ถุนบ้าน…', shelter: 'มองหาที่หลบ…', plot: 'เดินไปที่แปลงผัก…', away: 'ค่อย ๆ ถอยออกมา…' }[kind] || 'เดินไป…');
  let done = false; const go = () => { if (!done) { done = true; fn(); } };
  DV.goTo((x, y) => (x === goal[0] && y === goal[1]) || DV.adjTo([goal])(x, y), go); setTimeout(() => { if (!DV.player.path.length) go(); }, 9000);
};

// ================= prologue: a new game opens with the city chapter before you see the farm =================
const pro = document.createElement('div'); pro.id = 'prologue'; pro.className = 'hidden'; document.body.appendChild(pro);
const st0 = DV.startStory;
DV.startStory = fresh => { const s = S(); if (fresh && !s.flags.open_bus_done) pro.classList.remove('hidden'); st0(fresh); };
setInterval(() => { const s = S(); if (!pro.classList.contains('hidden') && (!s || s.flags.open_bus_done || DV.isDayOver && DV.isDayOver())) pro.classList.add('hidden'); }, 300);

// ================= dig a new bed where you stand =================
DV.digHere = () => { const s = S(), p = DV.player, d = [[0, 1], [0, -1], [1, 0], [-1, 0]][p.dir] || [0, 1], x = p.cx + d[0], y = p.cy + d[1], k = x + ',' + y;
  if (s.map !== 'farm' || (DV.isVisiting && DV.isVisiting())) return DV.toast('ขุดแปลงได้ในฟาร์มของตัวเอง');
  if (s.cells[k]) return DV.openPlot(x, y);
  if (!DV.walkable(x, y, true) || (DV.M.path[y] && DV.M.path[y][x]) || (DV.M.water && DV.M.water[y] && DV.M.water[y][x])) return DV.toast('ตรงหน้าขุดไม่ได้ (ทางเดิน น้ำ หรือมีของวางอยู่)');
  DV.doAction({ energy: 3, tool: DV.TOOL.hoe, fx: 'hoe', targets: [[x, y]], apply: () => { s.cells[k] = { soil: true, wet: false, crop: null, debris: null }; }, after: () => { DV.dirtySoil(); DV.toast('ขุดแปลงใหม่ พรวนดินแล้ว พร้อมปลูก'); } }); };
const tp0 = DV.tapPlayers;
DV.tapPlayers = near => { const me = DV.player; if (near(me.x, me.y) && S().map === 'farm') { DV.openSheet(S().name, 'ทำอะไรดี', null, [
    { label: 'พรวนดินตรงหน้า (เปิดแปลงใหม่)', icon: ['tools', DV.TOOL.hoe], cost: 3, run: () => DV.digHere() },
    { label: 'นั่งพักตรงนี้', icon: ['ui', 'home'], extra: 'แรงฟื้นช้า ๆ', run: () => { DV.closeSheet(); DV.sitDown('ตรงนี้'); } },
    { label: 'กินอะไรหน่อย', icon: ['ui', 'bag'], run: () => { DV.closeSheet(); DV.openBag(); } },
    { label: 'ดูสุขภาพ', icon: ['ui', 'heart'], run: () => { DV.closeSheet(); DV.openHealth(); } }], { portrait: 'player_' + S().gender }); return true; }
  return tp0 ? tp0(near) : false; };

// ================= daily =================
const m0 = DV.onMorning;
DV.onMorning = () => { m0 && m0(); const s = S(); fenceMorning(s); const dt = DV.date();
  if (dt.d === 1) setTimeout(() => DV.notify(`📅 เข้าเดือน${dt.month}แล้ว · ${dt.seasonName}`), 4000); };

// ================= repairs: grandma's house (hire ช่างเปี๊ยก, takes days) and the dog house (do it yourself) =================
const so1 = DV.objSprite;
DV.objSprite = o => { const s = S(), A = WORLD.atlas.alt || {};
  if (s && s.map === 'farm' && o.tap === 'house' && s.houseFixed && A.house_fixed) return A.house_fixed;
  if (s && s.map === 'farm' && o.tap === 'doghouse' && s.dogFixed && A.dog_fixed) return A.dog_fixed;
  return so1(o); };
const HOUSE = { price: 12000, days: 3 };
DV.houseRepairOpt = () => { const s = S(); if (s.houseFixed || (DV.isVisiting && DV.isVisiting())) return [];
  const j = s.houseJob; if (j) return [{ info: true, label: 'ช่างเปี๊ยกกำลังซ่อมบ้าน', extra: `เสร็จเช้าวันที่ ${DV.date(j.done).d} ${DV.date(j.done).month}` }];
  return [{ label: 'จ้างช่างเปี๊ยกซ่อมบ้าน', icon: ['ui', 'home'], hl: true, extra: `หลังคาใหม่ ฝาใหม่ · ฿${HOUSE.price.toLocaleString()} · ${HOUSE.days} วัน`, disabled: s.money < HOUSE.price && `เงินไม่พอ (มี ฿${s.money.toLocaleString()})`,
    run: () => { s.money -= HOUSE.price; s.houseJob = { done: s.day + HOUSE.days }; DV.closeSheet(); DV.sfx('coin'); DV.hud(); DV.save();
      DV.cut('st_house_fix', 'จ้างช่างซ่อมบ้านยาย', [{ who: 'piak', text: 'บ้านยายเพียรหลังนี้ ลุงเคยมาเปลี่ยนเสาให้ตั้งแต่หลานยังไม่เกิด… ไม้เนื้อแข็งยังดีอยู่ แค่หลังคากับฝาที่ผุ' },
        { who: 'piak', text: `ให้เวลาลุง ${HOUSE.days} วัน เปลี่ยนสังกะสีทั้งแผง ตีฝาใหม่ ซ่อมบันได ฝนตกคืนไหนจะได้ไม่ต้องเอากะละมังรองน้ำอีก` }]); } }]; };
const houseMorning = s => { const j = s.houseJob; if (!j) return; if (s.day < j.done) return DV.notify(`🔨 ช่างเปี๊ยกกำลังซ่อมบ้าน (เสร็จ ${DV.date(j.done).d} ${DV.date(j.done).month})`);
  s.houseFixed = s.day; s.houseJob = null; DV.save();
  setTimeout(() => DV.cut('st_house_fix', 'บ้านยายหายรั่วแล้ว', [{ who: 'piak', text: 'เสร็จแล้ว! หลังคาใหม่เอี่ยม ฝาตีใหม่หมด บันไดไม่ลั่นเอี๊ยดแล้วด้วย' },
    { who: 'narrator', text: 'แดดเช้าสะท้อนหลังคาสังกะสีใหม่ บ้านไม้หลังเดิมดูยืดตัวขึ้นอีกนิด… เหมือนยายยืนยิ้มอยู่หน้าบ้าน' }]), 2600); };
const pe1 = DV.placeExtras;
DV.placeExtras = (pid, opts) => { pe1 && pe1(pid, opts); const s = S(); if (pid === 'workshop' && !s.houseFixed && !s.houseJob) opts.push({ label: 'จ้างซ่อมบ้านยาย', icon: ['ui', 'home'], extra: `฿${HOUSE.price.toLocaleString()} · ${HOUSE.days} วัน`, run: () => { const o = DV.houseRepairOpt()[0]; o && o.run && !o.disabled ? o.run() : DV.toast(o && o.disabled || 'ยังจ้างไม่ได้'); } }); };
DV.openDoghouse = o => { const s = S(), wood = (s.items && s.items.wood) || 0, need = 3, cost = 150;
  if (s.dogFixed) return DV.openSheet('บ้านหมา', 'ซ่อมแล้ว มีผ้าห่มผืนเก่าของยายปูไว้ข้างใน', null, [
    { info: true, label: 'ยังไม่มีเจ้าของบ้านหลังนี้', extra: 'ลูกหมาตัวนั้นแวะมาดมหน้าประตูบ่อย ๆ' }], { spr: o.s });
  DV.openSheet('บ้านหมาพัง ๆ', 'บ้านหมาของไอ้ด่าง หมาของยาย หลังคาผุ ไม้หลุดสองแผ่น', null, [
    { label: 'ซ่อมบ้านหมา', icon: ['tools', DV.TOOL.saw], cost: 15, extra: `ไม้ฟืน ${need} มัด + ฿${cost} ค่าตะปูกับสังกะสี`,
      disabled: (wood < need && `ไม้ไม่พอ (มี ${wood}/${need} · เก็บกิ่งไม้ ผ่าตอไม้)`) || (s.money < cost && `เงินไม่พอ (ต้องมี ฿${cost})`),
      run: () => DV.doAction({ energy: 15, tool: DV.TOOL.saw, fx: 'wood', targets: [o.block[0]], apply: () => { s.items.wood -= need; s.money -= cost; s.dogFixed = s.day; },
        after: () => { DV.sfx('spark'); DV.hud(); DV.save(); setTimeout(() => DV.cut('st_dog_fix', 'บ้านหมาของไอ้ด่าง', [
          { who: 'narrator', text: 'ตอกตะปูตัวสุดท้าย ปลอกคอเก่าสีแดงของไอ้ด่างยังแขวนอยู่ที่ตะปูข้างประตู ยายไม่เคยเอาออก' },
          { who: 'player', text: 'ไอ้ด่างอยู่กับยายมาสิบสองปี… ยายคงคิดถึงมันทุกเย็นที่นั่งตรงนี้' },
          { who: 'narrator', text: 'หลังโอ่งน้ำมีจมูกเล็ก ๆ โผล่มาดม ลูกหมาจรตัวหนึ่งมองบ้านหลังใหม่ตาแป๋ว… แล้ววิ่งหนีไป' }]), 900); } }) }], { spr: o.s }); };
const m1 = DV.onMorning;
DV.onMorning = () => { m1 && m1(); houseMorning(S()); };

// no browser right-click menu over the game
document.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
})();
