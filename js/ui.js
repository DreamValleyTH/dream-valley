// Dream Valley — UI: sheet menus, HUD, bag, quests, travel map, phone (LINE), login with name + 6-char code
(() => {
'use strict';
const DV = window.DV, $ = DV.$;
const S = () => DV.S;
const WORLD = window.DV_WORLD;

// ---------- icons in DOM ----------
const ICOLS = 32;
const UIIC = ['bag', 'bank', 'bed', 'broadcast', 'camera', 'chat', 'clock', 'close', 'contacts', 'cook', 'diary', 'door', 'drop', 'energy', 'heart', 'home', 'lotto', 'map', 'menu', 'money', 'moon', 'music', 'phone', 'place', 'pray', 'quest', 'quest_done', 'rain', 'settings', 'shop', 'sound', 'star', 'sun', 'use', 'water', 'zoom'];
DV.iconCss = (ic, size = 32) => {
  if (!ic) return '';
  const [sheet, i] = ic;
  if (sheet === 'ui') { const c = UIIC.indexOf(i); return `background-image:url(assets/ui/icons.png);background-size:${8 * size}px auto;background-position:${-(c % 8) * size}px ${-Math.floor(c / 8) * size}px`; }
  if (sheet === 'tools') return `background-image:url(assets/tools.png);background-size:${8 * size}px ${size}px;background-position:${-i * size}px 0`;
  const x = (i % ICOLS) * size, y = Math.floor(i / ICOLS) * size;
  return `background-image:url(assets/icons_all.png);background-size:${ICOLS * size}px ${9 * size}px;background-position:${-x}px ${-y}px`;
};
const sprCss = (key, box = 48) => {
  const r = WORLD.atlas.rects[key]; if (!r) return '';
  const [sh, x, y, w, h] = r, sc = Math.min(box / w, box / h, 1.5);
  const img = new Image(); return `background-image:url(assets/${WORLD.atlas.sheets[sh]});background-size:${Math.round(1024 * sc)}px auto;background-position:${-x * sc}px ${-y * sc}px;width:${Math.round(w * sc)}px;height:${Math.round(h * sc)}px`;
};

// ---------- bottom sheet ----------
DV.openSheet = (title, sub, icon, opts, vis) => {
  $('sheetTitle').textContent = title; $('sheetSub').innerHTML = sub || '';
  const si = $('sheetIcon'); si.className = ''; si.style.cssText = '';
  if (vis && vis.portrait) { si.className = 'portrait'; si.style.backgroundImage = `url(assets/portraits/${vis.portrait}.png)`; }
  else if (vis && vis.spr) si.style.cssText = sprCss(vis.spr, 48);
  else si.style.cssText = DV.iconCss(icon, 48);
  const body = $('sheetBody'); body.innerHTML = '';
  opts.forEach(o => {
    const b = document.createElement('button'); b.className = 'opt' + (o.info ? ' info' : '') + (o.hl ? ' hl' : '');
    const warn = o.cost && DV.warnCost(o.cost, o.n || 1);
    const right = o.disabled ? o.disabled : [o.extra, o.cost != null ? DV.costLabel(o.cost, o.n || 1) + (warn ? ' (จะเป็นลม!)' : '') : ''].filter(Boolean).join(' · ');
    const iconHtml = o.portrait ? `<span class="oi pt" style="background-image:url(assets/portraits/${o.portrait}.png)"></span>` : `<span class="oi" style="${DV.iconCss(o.icon)}"></span>`;
    b.innerHTML = `${iconHtml}<span class="ol">${o.label}</span><span class="oc${warn ? ' warn' : ''}">${right || ''}</span>`;
    if (o.disabled || o.info) b.disabled = true; else b.onclick = () => { DV.sfx('tick'); o.run(); };
    body.appendChild(b);
  });
  $('sheet').classList.remove('hidden'); $('sheet').scrollTop = 0;
};
DV.closeSheet = () => $('sheet').classList.add('hidden');
$('sheetClose').onclick = DV.closeSheet;
DV.uiOpen = () => ['cardWrap', 'talk', 'map', 'phone', 'scene', 'title', 'panel', 'mg'].some(id => !$(id).classList.contains('hidden'));
DV.closeAll = () => { DV.closeSheet(); ['talk', 'map', 'phone', 'panel'].forEach(id => $(id).classList.add('hidden')); };

// ---------- HUD ----------
DV.hud = () => {
  const s = S(); if (!s) return;
  $('dayLabel').textContent = `วันที่ ${s.day} · ${['', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'][DV.weekday(s.day)]}${s.rain ? ' · ฝน' : ''}`;
  $('clock').textContent = DV.fmt(s.min);
  const h = 6 + s.min / 60; $('clockIcon').className = 'uic uic-' + (h >= 18.5 || h < 5.5 ? 'moon' : s.rain && h < 12 ? 'rain' : 'sun');
  $('energyNum').textContent = Math.round(s.energy); $('energyBar').style.width = (s.energy / DV.MAX_E * 100) + '%';
  $('energyBar').classList.toggle('low', s.energy < 25);
  $('money').textContent = '฿' + s.money.toLocaleString(); $('water').textContent = `${s.water}/${DV.CAN_MAX}`;
  $('waterCard').classList.toggle('hidden', s.map !== 'farm');
  const ql = DV.questList ? DV.questList() : { act: [], offers: [] };
  $('questBtn').classList.toggle('badge', ql.act.some(a => a.ready));
  const un = DV.lineUnread ? DV.lineUnread() : 0;
  $('phoneBtn').dataset.n = un > 99 ? '99+' : un || ''; $('phoneBtn').classList.toggle('badge', un > 0);
};
let toastT = 0;
// emoji in messages → pixel icons from the PixelLab UI set
const EMO = { '📜': 'quest', '💬': 'chat', '📢': 'broadcast', '📔': 'diary', '📩': 'chat', '🎉': 'star', '✓': 'quest_done', '✅': 'quest_done', '⭐': 'star', '♥': 'heart', '❤️': 'heart', '🤍': 'heart', '☁️': 'home', '📱': 'phone', '🎲': 'zoom', '👍': 'heart' };
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
DV.iconize = t => esc(t).replace(/❤️|☁️|[✅✓⭐♥]|\uD83D[\uDCDC\uDCAC\uDCE2\uDCD4\uDCE9\uDF89\uDCF1\uDC4D]|🎲|🤍/g, m => EMO[m] ? `<span class="uic uic-${EMO[m]}"></span>` : '');
DV.toast = t => { const el = $('toast'); el.innerHTML = DV.iconize(t); el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3000); };
let notT = 0;
DV.notify = t => { const el = $('notif'); el.innerHTML = DV.iconize(t); el.classList.add('show'); clearTimeout(notT); notT = setTimeout(() => el.classList.remove('show'), 3800); el.onclick = () => { el.classList.remove('show'); DV.openPhone('line'); }; };
let tickT = 0;
DV.ticker = t => { const el = $('ticker'); el.innerHTML = `<span>${DV.iconize(t)}</span>`; el.classList.add('show'); clearTimeout(tickT); tickT = setTimeout(() => el.classList.remove('show'), 14000); el.onclick = () => el.classList.remove('show'); };

// ---------- bag ----------
// ---------- bag: Minecraft-style slots · tap a slot → description + ใช้ / ทิ้ง / วางไว้ ----------
let bagSel = null, bagConfirm = false;
const bagItems = () => {
  const s = S(), out = [];
  Object.keys(s.items).forEach(k => { if (s.items[k] > 0) out.push({ k, n: s.items[k], it: DV.item(k) }); });
  Object.keys(DV.SEEDS).forEach(k => { if ((s.seeds[k] || 0) > 0) out.push({ k: 'seed:' + k, n: s.seeds[k], seed: k, it: { name: 'เมล็ด' + DV.SEEDS[k].name, icon: DV.SEEDS[k].icon } }); });
  return out;
};
const itemDesc = e => {
  if (e.seed) return `ซองเมล็ด${DV.SEEDS[e.seed].name} ปลูกที่แปลงผักที่พรวนแล้ว รดน้ำทุกวันจนเก็บเกี่ยวได้`;
  if (e.k === 'lottery_ticket') return `สลากพัฒนาตำบล ใบละ ฿100 ออกวันที่ ${DV.nextDraw ? DV.nextDraw() : 16} เวลา 16:00 · เก็บไว้ในกระเป๋าแล้วรอลุ้น`;
  const c = (window.DV_CATALOG || {})[e.k] || {}, it = e.it, bits = [];
  if (DV.CROPS && DV.CROPS[e.k]) bits.push('ผลผลิตจากแปลงผักยาย');
  if (c.where) bits.push('หาได้ที่' + c.where.replace(/^ที่/, ''));
  if (it.eat) bits.push(`กินแล้วแรง +${it.eat}`);
  if (it.sell) bits.push(`ขายได้ราว ฿${it.sell}`);
  return bits.join(' · ') || 'ของเก็บสะสม';
};
DV.openBag = () => {
  const s = S(), p = $('panel'), list = bagItems(), N = Math.max(30, Math.ceil(list.length / 6) * 6);
  if (bagSel && !list.find(e => e.k === bagSel)) bagSel = null;
  const sel = list.find(e => e.k === bagSel);
  const lv = DV.forageLevel(), next = DV.FORAGE_LV[lv + 1];
  let html = `<div class="panel-h"><b><span class="uic uic-bag"></span> กระเป๋า</b><button class="x">✕</button></div><div class="panel-b bag">`;
  html += `<div class="bag-top"><span><span class="uic uic-money"></span>฿${s.money.toLocaleString()}</span><span><span class="uic uic-water"></span>${s.water}/${DV.CAN_MAX}</span><button class="bag-sk">⭐ ทักษะ</button></div>`;
  html += '<div class="slots">' + Array.from({ length: N }, (_, i) => { const e = list[i];
    return e ? `<button class="slot${e.k === bagSel ? ' sel' : ''}" data-k="${e.k}"><span class="si" style="${DV.iconCss(['icons', DV.icon(e.it.icon)], 32)}"></span>${e.n > 1 ? `<b>${e.n}</b>` : ''}</button>` : '<span class="slot empty"></span>'; }).join('') + '</div>';
  if (sel) {
    const canUse = sel.it.eat || sel.seed;
    html += `<div class="bag-info"><div class="bi-h"><span class="si big" style="${DV.iconCss(['icons', DV.icon(sel.it.icon)], 48)}"></span><div><b>${sel.it.name}</b> <small>×${sel.n}</small><p>${itemDesc(sel)}</p></div></div>
      <div class="bi-act"><button class="btn" data-a="use"${canUse ? '' : ' disabled'}><span class="uic uic-use"></span>ใช้</button>
      <button class="btn" data-a="drop">${bagConfirm ? 'ทิ้งจริงนะ?' : '<span class="uic uic-drop"></span>ทิ้ง'}</button>
      <button class="btn" data-a="place"${s.map === 'house' ? ' disabled' : ''}><span class="uic uic-place"></span>วางไว้</button></div></div>`;
  } else html += '<p class="muted bag-hint">แตะช่องเพื่อดูรายละเอียด · ใช้ / ทิ้ง / วางไว้บนพื้น</p>';
  html += '</div>';
  p.innerHTML = html; p.classList.remove('hidden');
  p.querySelector('.x').onclick = () => { bagSel = null; p.classList.add('hidden'); };
  p.querySelector('.bag-sk').onclick = () => { p.classList.add('hidden'); DV.openSkills(); };
  p.querySelectorAll('.slot[data-k]').forEach(b => b.onclick = () => { bagSel = b.dataset.k === bagSel ? null : b.dataset.k; bagConfirm = false; DV.sfx('tick'); DV.openBag(); });
  p.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a, e = sel; if (!e) return;
    const take = (n = 1) => { if (e.seed) s.seeds[e.seed] = Math.max(0, (s.seeds[e.seed] || 0) - n); else DV.addItem(e.k, -n); };
    if (a === 'use') {
      if (e.seed) { p.classList.add('hidden'); DV.toast(`แตะแปลงผักที่พรวนแล้วเพื่อปลูก${e.it.name.replace('เมล็ด', '')}`); return; }
      if (s.energy >= DV.MAX_E) return DV.toast('แรงเต็มแล้ว เก็บไว้กินทีหลังดีกว่า');
      take(); DV.addEnergy(e.it.eat); DV.floatText(DV.player.x, DV.player.y - 60, `แรง +${e.it.eat}`, '#c8f59a'); DV.sfx('heart'); DV.toast(`กิน${e.it.name} อร่อย! แรง +${e.it.eat}`);
    } else if (a === 'drop') {
      if (!bagConfirm) { bagConfirm = true; return DV.openBag(); }
      take(); bagConfirm = false; DV.sfx('dirt'); DV.toast(`ทิ้ง${e.it.name}ไป 1 ชิ้น`);
    } else if (a === 'place') {
      if (e.seed) return DV.toast('เมล็ดต้องปลูกในแปลง วางกองไว้เดี๋ยวนกกินหมด');
      if (!DV.placeItem(e.k)) return; take(); DV.sfx('seed'); DV.toast(`วาง${e.it.name}ไว้ตรงนี้ แตะเพื่อเก็บคืน`);
    }
    bagConfirm = false; DV.hud(); DV.save(); DV.openBag();
  });
};

// ---------- quests panel ----------
DV.openQuests = () => {
  const { act, done, offers } = DV.questList();
  let html = '<div class="panel-h"><b><span class="uic uic-quest"></span> งาน</b><button class="x" id="panelX">✕</button></div><div class="panel-b">';
  const card = (q, sub, cls) => `<div class="qcard ${cls || ''}"><div class="qp" style="background-image:url(assets/portraits/${q.npc}.png)"></div><div><div class="qt">${q.title}</div><div class="qs">${DV.say(sub || '')}</div></div></div>`;
  const sh = DV.storyHints();
  if (sh.length) html += '<h4><span class="uic uic-star"></span> เนื้อเรื่องหลัก</h4>' + sh.map(h => `<div class="qcard ready"><div class="qp star"><span class="uic uic-star" style="--s:28px"></span></div><div><div class="qt">${DV.say(h.title)}</div><div class="qs">ไปที่ ${h.where} · เวลา ${h.when}${h.dayMax ? ' · ภายในวันที่ ' + h.dayMax : ''}</div></div></div>`).join('');
  html += '<h4>กำลังทำ</h4>' + (act.length ? act.map(a => card(a.q, (a.ready ? '✅ พร้อมส่ง — ไปคุยกับ ' + DV.npcName(a.q.npc) + ' · ' : '') + (a.hint || a.q.desc), a.ready ? 'ready' : '')).join('') : '<p class="muted">ยังไม่มีงาน — คุยกับคนที่มีเครื่องหมาย ! เหนือหัว</p>');
  if (offers.length) html += '<h4>มีคนอยากให้ช่วย</h4>' + offers.slice(0, 8).map(o => card(o.q, `${DV.npcName(o.q.npc)} · ${o.q.desc || ''}`, 'offer')).join('');
  html += `<h4>เสร็จแล้ว (${done.length})</h4>` + done.slice(-12).reverse().map(d => card(d.q, 'เสร็จแล้ว', 'done')).join('');
  const st = S().stats;
  html += `<h4>สถิติ</h4><p class="muted">เก็บเกี่ยว ${st.harvest || 0} · ขายของ ${st.sold || 0} ครั้ง · คุย ${st.talks || 0} ครั้ง · เจอของซ่อน ${st.found || 0} · งานเสร็จ ${st.quests || 0}</p>`;
  html += `<h4>คนที่รู้จัก</h4><div class="rel">${Object.keys(window.DV_NPCS).filter(id => S().flags['met_' + id]).map(id => `<div class="ri"><div class="qp" style="background-image:url(assets/portraits/${id}.png)"></div><span>${DV.npcName(id)}<br><b>${'♥'.repeat(Math.ceil(DV.heart(id) / 2)) || '·'}</b></span></div>`).join('') || '<p class="muted">ยังไม่รู้จักใคร</p>'}</div>`;
  html += '</div>';
  showPanel(html);
};
function showPanel(html) { const p = $('panel'); p.innerHTML = html; p.classList.remove('hidden'); const x = $('panelX'); if (x) x.onclick = () => p.classList.add('hidden'); }

// ---------- travel map: drone photo of the sub-district with pins (positions in % of the 480×360 aerial) ----------
const PLACES = [
  { id: 'farm', name: 'ฟาร์มยาย', sub: 'บ้านไม้หลังเก่า บ่อบัว สวนมะม่วง', x: 11, y: 41, map: 'farm' },
  { id: 'town', name: 'ใจกลางตำบล', sub: 'ตลาด ร้านค้า อบต. รพ.สต. โรงเรียน ศาลา', x: 47, y: 40, map: 'town' },
  { id: 'temple', name: 'วัดดงเย็น', sub: 'อยู่ในใจกลางตำบล ข้ามสะพานไปทางใต้', x: 75, y: 68, map: 'town' },
  { id: 'forest', name: 'ป่าชุมชน', sub: 'เปิดในเวอร์ชันถัดไป', x: 16, y: 13 },
  { id: 'res', name: 'อ่างเก็บน้ำ', sub: 'เปิดในเวอร์ชันถัดไป', x: 55, y: 6 },
  { id: 'moo4', name: 'ชุมชนหมู่ 4', sub: 'เปิดในเวอร์ชันถัดไป', x: 88, y: 33 },
  { id: 'paddy', name: 'ทุ่งนา', sub: 'เปิดในเวอร์ชันถัดไป', x: 42, y: 90 },
  { id: 'company', name: 'ที่ดินบริษัท', sub: 'ล้อมรั้ว ถังน้ำสีฟ้าเรียงเป็นแถว…', x: 88, y: 86 },
  { id: 'district', name: 'อำเภอ', sub: 'ถนนออกไปทางนี้ · รถเมล์ (เปิดเร็ว ๆ นี้)', x: 93, y: 6 },
];
DV.openMap = () => DV.openPhone('map');
DV.renderMapApp = (scr, top) => {
  scr.innerHTML = top + `<div class="ph-map"><div class="ln-head map-h"><button class="back">‹</button><b><span class="uic uic-map"></span> แผนที่ตำบลบ้านดงเย็น</b><span></span></div><div id="mapBox"></div><div id="mapInfo"></div></div>`;
  drawMap(); };
function drawMap() {
  const box = $('mapBox'), by = id => PLACES.find(p => p.id === id), cur = S().map === 'house' ? 'farm' : S().map;
  box.innerHTML = '<div class="aerial"></div>' + PLACES.map(p => `<button class="pin${p.map === cur && (p.id === 'farm' || p.id === 'town') ? ' here' : ''}${p.map ? '' : ' locked'}" data-id="${p.id}" style="left:${p.x}%;top:${p.y}%"><i></i><span>${p.name}</span></button>`).join('');
  box.querySelectorAll('.pin').forEach(b => b.onclick = () => info(by(b.dataset.id)));
  const info = p => {
    DV.sfx('tick'); box.querySelectorAll('.pin').forEach(b => b.classList.toggle('sel', b.dataset.id === p.id));
    const here = p.map === cur, e = DV.TRAVEL_E[cur + '>' + p.map] || 6;
    $('mapInfo').innerHTML = `<b>${p.name}</b>${p.sub ? `<div class="sub">${p.sub}</div>` : ''}<div class="sub">${here ? 'คุณอยู่แถวนี้' : p.map ? `เดินทางใช้แรง ${e} (ไม่เสียเวลา)` : ''}</div>` +
      (p.map && !here ? `<button class="btn primary" id="goBtn"><span class="uic uic-energy"></span> ออกเดินทาง</button>` : (!p.map ? '<button class="btn" disabled>ยังไปไม่ได้</button>' : ''));
    const g = $('goBtn'); if (g) g.onclick = () => { $('phone').classList.add('hidden'); DV.travel(p.map, p.map === 'town' ? 'from_farm' : 'from_town'); };
  };
  info(PLACES.find(p => p.map === cur));
}

// ---------- phone ----------
let phoneTab = 'home';
DV.openPhone = tab => { DV.closeSheet(); phoneTab = tab || 'home'; renderPhone(); $('phone').classList.remove('hidden'); DV.sfx('tick'); };
DV.rerenderPhone = () => { if (!$('phone').classList.contains('hidden')) renderPhone(); };
const av = id => window.DV_NPCS[id] ? `<div class="av" style="background-image:url(assets/portraits/${id}.png)"></div>` : `<div class="av anon">${(DV.npcName(id) || '?').slice(0, 1)}</div>`;
function renderPhone() {
  const s = S(), scr = $('phoneScreen'), feed = s.lineFeed || [];
  const top = `<div class="ph-top"><span>${DV.fmt(s.min)}</span><span><span class="uic uic-phone" style="--s:14px"></span></span></div>`;
  if (phoneTab === 'home') {
    const un = DV.lineUnread();
    const apps = [['map', 'แผนที่', 'map'], ['line', 'LINE', 'chat', un], ['call', 'โทรศัพท์', 'phone', DV.callBadge ? DV.callBadge() : 0], ['bc', 'หอกระจายข่าว', 'broadcast'], ['diary', 'สมุดยาย', 'diary'], ['quests', 'งาน', 'quest'], ['contacts', 'รายชื่อ', 'contacts'],
      ['bank', 'ธนาคาร', 'bank', 0, true], ['cam', 'กล้อง', 'camera', 0, true], ['shop', 'ขายออนไลน์', 'shop', 0, true], ['set', 'ตั้งค่า', 'settings']];
    scr.innerHTML = top + `<div class="ph-wall"><div class="ph-date">วันที่ ${s.day}<br><small>${s.name} · รหัส ${s.code}</small></div><div class="ph-grid">` +
      apps.map(([id, n, e, b, soon]) => `<button class="app${soon ? ' soon' : ''}" data-a="${id}"><span class="ae"><span class="uic uic-${e}" style="--s:36px"></span>${b ? `<i>${b}</i>` : ''}</span>${n}${soon ? '<small>เร็ว ๆ นี้</small>' : ''}</button>`).join('') + '</div></div>';
    scr.querySelectorAll('.app').forEach(b => b.onclick = () => { const a = b.dataset.a;
      if (a === 'quests') { $('phone').classList.add('hidden'); return DV.openQuests(); }
      if (a === 'set') { $('phone').classList.add('hidden'); return DV.openMenu(); }
      if (['bank', 'cam', 'shop'].includes(a)) return DV.toast('แอปนี้จะเปิดในเวอร์ชันถัดไป');
      phoneTab = a; renderPhone(); });
  } else if (phoneTab === 'line' || phoneTab.startsWith('chat:')) {
    DV.renderLine(scr, top, phoneTab, t => { phoneTab = t; renderPhone(); });
  } else if (phoneTab === 'map') {
    DV.renderMapApp(scr, top);
  } else if (phoneTab.startsWith('call')) {
    DV.renderCall(scr, top, phoneTab, t => { phoneTab = t; renderPhone(); });
  } else if (phoneTab === 'bc') {
    const log = (s.bcLog || []).slice(-40).reverse();
    scr.innerHTML = top + `<div class="ln-head"><button class="back">‹</button><b><span class="uic uic-broadcast"></span> หอกระจายข่าว</b><span></span></div><div class="ln-feed">${log.length ? log.map(b => `<div class="bc"><small>วันที่ ${b.day} ${b.time}</small><div>${b.text}</div></div>`).join('') : '<p class="muted">ยังไม่มีประกาศ (รอบ 06:00 และ 17:00)</p>'}</div>`;
  } else if (phoneTab === 'diary') {
    const pages = Object.keys(s.flags).filter(f => f.startsWith('diary_'));
    scr.innerHTML = top + `<div class="ln-head"><button class="back">‹</button><b><span class="uic uic-diary"></span> สมุดบันทึกยายเพียร</b><span>${pages.length}/9</span></div><div class="ln-feed diary">` +
      `<div class="page">หน้าแรก — วางอยู่บนหิ้งพระ: “ถ้าหลานได้อ่าน แปลว่ายายไม่อยู่แล้ว หน้าที่เหลือยายฝากไว้กับคนในตำบล ไปเอาคืนมาทีละหน้านะ”</div>` +
      pages.map(f => `<div class="page">หน้าที่ได้จาก <b>${DV.npcName(f.slice(6))}</b> · วันที่ ${s.flags[f]}<br><small>(อ่านเนื้อหาเต็มได้จากเรื่องราวของ${DV.npcName(f.slice(6))})</small></div>`).join('') +
      (pages.length < 9 ? `<p class="muted">อีก ${9 - pages.length} หน้าอยู่กับคนเฒ่าคนแก่ในตำบล — ช่วยงานพวกเขาแล้วจะได้คืน</p>` : '') + '</div>';
  } else if (phoneTab === 'contacts') {
    const ids = Object.keys(window.DV_NPCS);
    scr.innerHTML = top + `<div class="ln-head"><button class="back">‹</button><b><span class="uic uic-contacts"></span> คนในตำบล</b><span></span></div><div class="ln-feed">` +
      ids.map(id => { const met = s.flags['met_' + id]; const w = DV.whereIs(id); const pl = w && DV.MAPS[w.map].places[w.place];
        return `<div class="ct${met ? '' : ' unk'}">${met ? av(id) : '<div class="av anon">?</div>'}<div><b>${met ? DV.npcName(id) : '???'}</b><br><small>${met ? (pl ? 'ตอนนี้: ' + pl.name : 'ไม่รู้ว่าไปไหน') : 'ยังไม่เคยคุย'}</small></div><span>${met ? '♥'.repeat(Math.ceil(DV.heart(id) / 2)) : ''}</span></div>`; }).join('') + '</div>';
  }
  scr.querySelectorAll('.back').forEach(b => b.onclick = () => { phoneTab = b.dataset.to || 'home'; renderPhone(); });
  DV.hud();
}
$('phoneClose').onclick = () => $('phone').classList.add('hidden');

// ---------- menu ----------
// ---------- changelog ----------
DV.CL_KEY = 'dv3_cl_seen';
DV.clUnseen = () => { const L = window.DV_CHANGELOG || []; let seen = ''; try { seen = localStorage.getItem(DV.CL_KEY) || ''; } catch (e) {} return L.length && L[0].v !== seen; };
DV.openChangelog = () => {
  const L = window.DV_CHANGELOG || [], p = $('panel');
  p.innerHTML = `<div class="panel-h"><b><span class="uic uic-star"></span> อัปเดตเกม</b><button class="x">✕</button></div><div class="panel-b cl">` +
    L.map((c, i) => `<div class="cl-v${i ? '' : ' new'}"><div class="cl-h"><span class="cl-tag">v${c.v}</span><b>${c.title}</b><small>${c.date}</small></div><ul>${c.items.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('') + '</div>';
  p.classList.remove('hidden'); p.querySelector('.x').onclick = () => p.classList.add('hidden');
  try { localStorage.setItem(DV.CL_KEY, L[0].v); } catch (e) {}
  document.querySelectorAll('.cl-dot').forEach(d => d.remove());
};
// ---------- build mode (farm only) ----------
DV.startBuild = () => { if (S().map !== 'farm') return DV.toast('จัดของได้เฉพาะในฟาร์มยาย'); DV.closeAll(); DV.build = { sel: null, tool: 'move' }; DV.buildBar(); };
DV.endBuild = () => { DV.build = null; const b = $('buildBar'); if (b) b.remove(); };
DV.buildBar = () => {
  let b = $('buildBar'); if (!b) { b = document.createElement('div'); b.id = 'buildBar'; document.body.appendChild(b); }
  const B = DV.build, sel = B && B.sel, t = B.tool;
  const nStore = DV.storedList ? DV.storedList().length : 0;
  const hint = t === 'dig' ? 'แตะพื้นที่จะขุดเป็นแปลงผัก (แรง −3)' : t === 'fill' ? 'แตะดินในแปลงที่จะกลบเป็นพื้น (แรง −2)'
    : 'แตะของที่จะย้าย แล้วลากไปวาง · ✓ วาง · ↔ กลับด้าน · 📦 เก็บเข้าคลัง (นอกโหมดนี้: กดค้างที่ของได้เลย)';
  b.innerHTML = `<div class="bb-tools">${[['move', 'ย้ายของ'], ['dig', 'ขุดแปลง'], ['fill', 'กลบดิน']].map(([k, n]) => `<button class="${t === k ? 'on' : ''}" data-t="${k}">${n}</button>`).join('')}<button class="store">คลัง ${nStore}</button><button class="clear">ถางโล่ง</button><button class="btn done">เสร็จ</button></div><div class="bb-hint">${hint}</div>`;
  b.querySelectorAll('[data-t]').forEach(x => x.onclick = () => { DV.liftCancel && DV.lift && DV.liftCancel(); B.tool = x.dataset.t; B.sel = null; B.confirm = null; DV.sfx('tick'); DV.buildBar(); });
  b.querySelector('.store').onclick = () => DV.openStore();
  b.querySelector('.clear').onclick = e => { if (DV.lift) DV.liftCancel(); if (B.confirm !== 'clear') { B.confirm = 'clear'; e.target.textContent = 'ยืนยันถาง?'; e.target.classList.add('on'); return DV.toast('ของทุกชิ้นยกเว้นบ้านยายจะเก็บเข้าคลัง (แปลงผักไม่หาย) · แตะอีกครั้งเพื่อยืนยัน'); } B.confirm = null; DV.clearFarm(); DV.buildBar(); };
  b.querySelector('.done').onclick = () => { if (DV.lift) DV.liftCancel(); DV.endBuild(); };
};
// ---------- Hay Day style lift bar: shown while an object is lifted ----------
DV.liftBar = () => {
  const L = DV.lift; let b = $('liftBar'); if (!L) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'liftBar'; document.body.appendChild(b); }
  b.classList.remove('drag');
  const ok = DV.liftValid(), cost = (L.dx || L.dy || L.flip || L.fromStore) ? DV.liftCost(L.o) : 0;
  b.innerHTML = `<div class="lb-name">${DV.objName(L.o)} <small>${ok ? (cost ? 'แรง −' + cost : 'ลากเพื่อย้าย') : 'วางตรงนี้ไม่ได้'}</small></div>
    <div class="lb-btns"><button class="no" title="ยกเลิก">✕</button><button class="flip" title="กลับด้าน">⇋</button>${L.o.id === 'house' ? '' : '<button class="store" title="เก็บเข้าคลัง">📦</button>'}<button class="ok"${ok ? '' : ' disabled'} title="วาง">✓</button></div>`;
  b.querySelector('.no').onclick = () => { DV.liftCancel(); DV.build && DV.buildBar(); };
  b.querySelector('.flip').onclick = () => DV.liftFlip();
  const st = b.querySelector('.store'); if (st) st.onclick = () => { DV.liftStore(); DV.build && DV.buildBar(); };
  b.querySelector('.ok').onclick = () => { DV.liftConfirm(); DV.build && DV.buildBar(); };
};
DV.openStore = () => {
  const L = DV.storedList();
  if (!L.length) return DV.toast('คลังว่างอยู่ — ยกของขึ้นแล้วกด 📦 เพื่อเก็บ');
  DV.openSheet('คลังของ', 'แตะเพื่อนำออกมาวาง (ลากไปตรงที่ต้องการแล้วกด ✓)', null, L.map(o => ({ label: DV.objName(o), icon: null, run: () => { DV.closeSheet(); DV.placeFromStore(o); } })));
};
DV.openMenu = () => DV.openSheet('เมนู', `${S().name} · รหัส ${S().code}<br><small>${DV.cloudLabel()} · 1 วันในเกม = ${S().dayLen} นาทีจริง</small>`, null, [
  { label: 'อัปเดตเกม' + (DV.clUnseen() ? ' (ใหม่)' : ''), icon: null, run: () => { DV.closeSheet(); DV.openChangelog(); } },
  { label: 'โหมดจัดฟาร์ม (ย้ายของ ใช้แรง)', icon: ['ui', 'settings'], run: () => DV.startBuild() },
  { label: 'ปรับเสียงเพลง / เอฟเฟกต์', icon: null, run: () => { DV.closeSheet(); DV.openSound(); } },
  { label: DV.muted ? 'เปิดเสียงทั้งหมด' : 'ปิดเสียงทั้งหมด', icon: null, run: () => { DV.muted = !DV.muted; DV.music(!DV.muted); DV.closeSheet(); } },
  { label: 'กลับมาที่ตัวละคร / ซูมปกติ', icon: null, run: () => { DV.recenter(); DV.setZoom(1); DV.closeSheet(); } },
  { label: 'บันทึกตอนนี้', icon: null, run: () => { DV.save(true); DV.toast('บันทึกแล้ว — เข้าเล่นต่อด้วยชื่อ + รหัสเดิม'); DV.closeSheet(); } },
  { label: 'ออกไปหน้าแรก', icon: null, run: () => { DV.save(true); location.reload(); } },
]);

// ---------- bottom bar ----------
$('bagBtn').onclick = () => S() && !DV.uiBlocked() && DV.openBag();
$('questBtn').onclick = () => S() && !DV.uiBlocked() && DV.openQuests();
$('phoneBtn').onclick = () => S() && !DV.uiBlocked() && DV.openPhone();
$('menuBtn').onclick = () => S() && !DV.uiBlocked() && DV.openMenu();

})();
