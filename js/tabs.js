// Dream Valley — v1.9: hunger & health, the bottom tabs (เรื่องราว · สมุดยาย · สุขภาพ), tapping players, fruiting plants,
// and sleeping together (nobody wakes up until everyone in the call is asleep or passed out).
(() => {
'use strict';
const DV = window.DV, $ = DV.$, S = () => DV.S, T = DV.T;
const ic = n => ['icons', DV.icon(n)];
const hour = () => 6 + S().min / 60;
const cat = window.DV_CATALOG = window.DV_CATALOG || {};
Object.assign(cat, {
  banana_bunch: { name: 'กล้วยน้ำว้า (หวี)', buy: null, sell: 40, where: 'กอกล้วย (ผลไม้ อาหาร)', icon: 'crop_banana_bunch' },
  papaya: { name: 'มะละกอสุก', buy: null, sell: 25, where: 'ต้นมะละกอ (ผลไม้ อาหาร)', icon: 'crop_papaya' },
  sugarcane: { name: 'อ้อย (ลำ)', buy: null, sell: 15, where: 'กออ้อย (อาหาร)', icon: 'crop_sugarcane' },
  coconut: { name: 'มะพร้าวอ่อน', buy: null, sell: 30, where: 'ต้นมะพร้าว (อาหาร)', icon: 'crop_coconut' },
});

// ================= hunger, sickness, risks =================
const SWEET = ['energy_drink', 'iced_coffee', 'snack', 'khanom_chan', 'khanom_pia', 'lodchong', 'nam_khaeng_sai', 'soy_milk_set', 'coconut_smoothie', 'honey', 'kluay_buat_chee', 'sugarcane', 'khanom_krok'];
const SALTY = ['instant_noodle', 'canned_fish', 'pla_ra', 'salted_egg', 'somtum_poo_plara', 'moo_krob', 'meatball_fried', 'somtum', 'tomyum'];
const RAW = ['somtum_poo_plara', 'larb_pladuk', 'larb_home'];
const st = () => { const s = S(); if (s.full == null) s.full = 80; s.sick = s.sick || {}; s.diet = s.diet || {}; s.seen = s.seen || {}; return s; };
const add = (k, n) => { const d = st().diet, day = S().day; d[k] = (d[k] || []).filter(x => day - x < 7); for (let i = 0; i < n; i++) d[k].push(day); };
DV.onEat = (k, it) => { const s = st(), was = s.full; s.full = Math.min(100, s.full + Math.round((it.full || it.eat * 1.3) || 10));
  if (SWEET.includes(k)) add('sweet', 1); if (SALTY.includes(k)) add('salty', 1); if (RAW.includes(k)) add('raw', 1);
  if (s.sick.stomach && s.full > 20) { delete s.sick.stomach; DV.toast('ท้องอิ่มแล้ว อาการปวดท้องหายไป'); }
  if (was < 100 && s.full >= 100) DV.notify('🍚 อิ่มแปล้แล้ว'); DV.hud(); };
const SICK = { fever: ['ตัวร้อน เป็นไข้', 'ตากฝนนานเกินไป / ตัวเปียก'], heat: ['ร้อนจนเพลีย (เกือบลมแดด)', 'อยู่กลางแดดเที่ยงนานเกินไป'], stomach: ['ปวดท้อง หิวจนไส้กิ่ว', 'ไม่ได้กินอะไรจนหลอดความอิ่มหมด'] };
DV.cure = () => { const s = st(), had = Object.keys(s.sick).map(k => SICK[k] ? SICK[k][0] : k); s.sick = {}; s.rainOut = 0; s.sunOut = 0; DV.hud(); return had.join(', '); };
const outdoors = () => S().map !== 'house' && !(DV.player && DV.player.sit && /ใต้ร่ม|ชาน|ศาลา/.test(String(DV.player.sit)));
const tick = DV.onTick;
DV.onTick = () => { tick && tick(); const s = st(); if (DV.isDayOver && DV.isDayOver()) return;
  // hunger: about 5 points an hour
  s.full = Math.max(0, s.full - .9);
  if (s.full <= 0) { if (!s.sick.stomach) { s.sick.stomach = s.day; DV.notify('🤢 ปวดท้อง หิวมาก — กินอะไรหน่อย'); } DV.addEnergy(-2, true); }
  else if (s.full < 20 && !s.flags['hungry' + s.day]) { s.flags['hungry' + s.day] = 1; DV.notify('🍚 เริ่มหิวแล้ว'); }
  // rain: an hour out in the rain → fever
  if (s.rain && outdoors() && hour() < 12) { s.rainOut = (s.rainOut || 0) + 10; if (s.rainOut >= 60 && !s.sick.fever && Math.random() < .25) { s.sick.fever = s.day; DV.notify('🤒 ตากฝนนานไป ตัวรุม ๆ เป็นไข้'); } }
  else s.rainOut = Math.max(0, (s.rainOut || 0) - 5);
  // midday sun: 2½ hours of hard sun without resting → heat exhaustion
  const h = hour(); if (!s.rain && h >= 11 && h < 15 && outdoors() && !(DV.player && DV.player.sit)) { s.sunOut = (s.sunOut || 0) + 10; if (s.sunOut >= 150 && !s.sick.heat) { s.sick.heat = s.day; DV.notify('🥵 ร้อนจนหน้ามืด ไปพักในร่มหรือกินน้ำ'); } }
  else { s.sunOut = Math.max(0, (s.sunOut || 0) - 15); if (s.sick.heat && s.sunOut === 0) { delete s.sick.heat; DV.toast('พักแล้ว หายร้อนแล้ว'); } }
  if (s.sick.fever) DV.addEnergy(-1, true);
  if (s.sick.heat) DV.addEnergy(-1.5, true);
  DV.hud(); DV.checkFaint && DV.checkFaint(); };
const nd = DV.newDay;
DV.newDay = fainted => { const s = st(); nd(fainted); s.full = Math.max(15, (s.full || 0) - 25);   // you wake up hungry
  if (s.sick.fever && Math.random() < .5) { delete s.sick.fever; DV.notify('😌 นอนพักแล้ว ไข้ลดลง'); }
  if (s.sick.fever) { s.energy = Math.round(s.energy * .8); DV.notify('🤒 ยังเป็นไข้อยู่ แรงไม่เต็ม — ไป รพ.สต. หรือซื้อยาที่ร้านภก.มด'); } DV.hud(); };
const hud = DV.hud;
DV.hud = () => { hud(); const s = S(); if (!s) return; const f = s.full == null ? 80 : s.full, b = $('fullBar'); if (b) { b.style.width = f + '%'; b.classList.toggle('low', f < 20); }
  const hb = $('healthBtn'); if (hb) hb.classList.toggle('badge', !!(s.sick && Object.keys(s.sick).length)); };
// the medicine set from the pharmacy cures, and remember what has ever been in the bag (for grandma's guide)
const addItem = DV.addItem;
DV.addItem = (k, n = 1) => { addItem(k, n); if (n > 0 && S()) st().seen[k] = 1; };
const risk = (n, a, b) => n >= b ? ['สูง', 'risk-high'] : n >= a ? ['ปานกลาง', 'risk-mid'] : ['ต่ำ', 'risk-low'];
DV.openHealth = () => {
  const s = st(), sick = Object.keys(s.sick), d = s.diet, n = k => (d[k] || []).filter(x => s.day - x < 7).length;
  const met = id => s.flags['met_' + id];
  let h = `<div class="panel-h"><b><span class="uic uic-heart"></span> สุขภาพ</b><button class="x" id="panelX">✕</button></div><div class="panel-b">`;
  h += `<div class="hl-row"><span>⚡ แรง</span><b>${Math.round(s.energy)}/${DV.MAX_E}</b></div><div class="hl-row" style="display:block"><div style="display:flex;justify-content:space-between"><span>🍚 ความอิ่ม</span><b>${Math.round(s.full)}/100</b></div><div class="meter2"><i style="width:${s.full}%;background:${s.full < 20 ? 'var(--chili)' : ''}"></i></div><small class="muted">หิวลงเรื่อย ๆ · กินอาหารได้ทั้งแรงและความอิ่ม · ถ้าหมดจะปวดท้องและแรงลด</small></div>`;
  h += '<h4>อาการตอนนี้</h4>' + (sick.length ? sick.map(k => `<div class="hl-row"><span>${SICK[k][0]}<br><small class="muted">สาเหตุ: ${SICK[k][1]}</small></span><b class="risk-high">เป็นอยู่</b></div>`).join('') +
    '<p class="muted">รักษา: ตรวจที่ รพ.สต. (ฟรี) หรือกินยาชุดสมุนไพรจากร้านภก.มด · ไข้มักลดเองหลังนอนพัก · ร้อนเกินให้เข้าร่มหรือนั่งพัก · ปวดท้องให้กินข้าว</p>' : '<p class="muted">แข็งแรงดี ไม่มีอาการ</p>');
  h += `<div class="hl-row"><span>🌧️ ตากฝนวันนี้</span><b>${s.rainOut || 0} นาที</b></div><div class="hl-row"><span>☀️ อยู่กลางแดดเที่ยง</span><b>${s.sunOut || 0} นาที</b></div>`;
  const R = [['เบาหวาน', n('sweet'), 5, 9, 'ของหวาน น้ำหวาน กาแฟเย็น เครื่องดื่มชูกำลัง', met('ann') ? 'หมอแอนเคยเตือนเรื่องน้ำหวาน' : ''],
    ['ความดัน / โรคไต', n('salty'), 5, 9, 'บะหมี่ ปลากระป๋อง ปลาร้า ไข่เค็ม ส้มตำ', met('mod') ? 'ภก.มดเคยบอกว่าคนแถวนี้กินเค็มจัด' : ''],
    ['พยาธิใบไม้ตับ', n('raw'), 2, 4, 'ของดิบ ๆ สุก ๆ เช่น ส้มตำปูปลาร้า ลาบ', 'ผู้ใหญ่ในหมู่บ้านคุยกันบ่อยเรื่องมะเร็งท่อน้ำดี'],
    ['ลมแดด', Math.floor((s.sunOut || 0) / 30), 3, 5, 'ทำงานกลางแดดเที่ยงนาน ๆ', '']];
  h += '<h4>ความเสี่ยงโรค (7 วันล่าสุด)</h4>' + R.map(([nm, v, a, b, why, note]) => { const [lv, cls] = risk(v, a, b); return `<div class="hl-row"><span>${nm}<br><small class="muted">${why}${note ? ' · ' + note : ''}</small></span><b class="${cls}">${lv}</b></div>`; }).join('');
  h += '</div>'; const p = $('panel'); p.innerHTML = h; p.classList.remove('hidden'); $('panelX').onclick = () => p.classList.add('hidden');
};

// ================= เรื่องราว: the main story and everyone else's stories =================
DV.openStory = () => {
  const s = S(), { act, done, offers } = DV.questList(), sh = DV.storyHints(), SC = (window.DV_STORY || {}).scenes || [];
  const card = (q, sub, cls) => `<div class="qcard ${cls || ''}"><div class="qp" style="background-image:url(assets/portraits/${q.npc}.png)"></div><div><div class="qt">${q.title}</div><div class="qs">${DV.say(sub || '')}</div></div></div>`;
  let h = '<div class="panel-h"><b><span class="uic uic-quest"></span> เรื่องราว</b><button class="x" id="panelX">✕</button></div><div class="panel-b">';
  h += '<h4><span class="uic uic-star"></span> เรื่องหลัก — หลานยายเพียร</h4>';
  h += sh.length ? sh.map(x => `<div class="qcard ready"><div class="qp star"><span class="uic uic-star" style="--s:28px"></span></div><div><div class="qt">ต่อไป: ${DV.say(x.title)}</div><div class="qs">ไปที่ ${x.where} · เวลา ${x.when}${x.dayMax ? ' · ภายในวันที่ ' + x.dayMax : ''}</div></div></div>`).join('') : '<p class="muted">ใช้ชีวิตไปก่อน เรื่องต่อไปจะมาหาเอง</p>';
  const seen = SC.filter(x => s.scenes[x.id]).sort((a, b) => s.scenes[a.id] - s.scenes[b.id]);
  h += seen.length ? `<div class="qcard"><div><div class="qt">ผ่านมาแล้ว ${seen.length} ตอน</div><div class="qs">${seen.slice(-8).map(x => `วันที่ ${s.scenes[x.id]} · ${DV.say(x.title || '')}`).join('<br>')}</div></div></div>` : '';
  const pages = Object.keys(s.flags).filter(f => f.startsWith('diary_')).length; h += `<p class="muted">หน้าสมุดยายที่ได้คืน ${pages}/9 · อ่านได้ในแท็บ "สมุดยาย"</p>`;
  h += '<h4>เรื่องของคนในตำบล</h4>';
  const by = {}; act.forEach(a => (by[a.q.npc] = by[a.q.npc] || []).push(card(a.q, (a.ready ? '✅ พร้อมส่ง — ไปคุยกับ ' + DV.npcName(a.q.npc) + ' · ' : 'กำลังช่วย · ') + (a.hint || a.q.desc), a.ready ? 'ready' : '')));
  offers.forEach(o => (by[o.q.npc] = by[o.q.npc] || []).push(card(o.q, `มีเรื่องอยากให้ช่วย · ${o.q.desc || ''}`, 'offer')));
  h += Object.keys(by).length ? Object.entries(by).map(([id, L]) => `<div class="muted" style="margin:8px 0 2px">${DV.npcName(id)} ${'♥'.repeat(Math.ceil(DV.heart(id) / 2))}</div>` + L.join('')).join('') : '<p class="muted">ยังไม่มีใครเล่าเรื่องให้ฟัง — คุยกับคนที่มี ! เหนือหัว</p>';
  if (done.length) h += `<h4>จบไปแล้ว (${done.length})</h4>` + done.slice(-10).reverse().map(d => card(d.q, `${DV.npcName(d.q.npc)} · จบแล้ว`, 'done')).join('');
  h += `<h4>คนที่รู้จัก</h4><div class="rel">${Object.keys(window.DV_NPCS).filter(id => s.flags['met_' + id]).map(id => `<div class="ri"><div class="qp" style="background-image:url(assets/portraits/${id}.png)"></div><span>${DV.npcName(id)}<br><b>${'♥'.repeat(Math.ceil(DV.heart(id) / 2)) || '·'}</b></span></div>`).join('') || '<p class="muted">ยังไม่รู้จักใคร</p>'}</div>`;
  h += '</div>'; const p = $('panel'); p.innerHTML = h; p.classList.remove('hidden'); $('panelX').onclick = () => p.classList.add('hidden');
};

// ================= สมุดยาย: grandma's notebook — her diary pages and how to find things =================
const HINT = { chili: 'ปลูกในแปลง · เมล็ดที่ร้านป้าแต๋ว', basil: 'ปลูกในแปลง · เมล็ดที่ร้านป้าแต๋ว', corn: 'ปลูกในแปลง · เมล็ดที่ร้านเสี่ยเฮง', morning_glory: 'ปลูกในแปลง · เมล็ดที่ร้านป้าแต๋ว',
  mango: 'สอยจากต้นมะม่วงในฟาร์ม ทุก 3 วัน', tamarind: 'เก็บฝักจากต้นมะขาม', wood: 'ตัดกิ่งแห้ง · ผ่าตอไม้ · เก็บกิ่งไม้หล่น', stone: 'เก็บก้อนกรวดตามพื้น', ant_egg: 'ตัดกิ่งมะม่วง (ถ้าโชคดีมีรังมดแดง)',
  mushroom: 'ผ่าตอไม้ผุ · ค้นพุ่มไม้', mush2: 'ค้นพุ่มไม้ (หายาก)', honey: 'ตัดกิ่งไม้ (โชคดีมาก)', worm: 'ถางหญ้ารก · ค้นพุ่มไม้ · ใช้เป็นเหยื่อตกปลา', marble: 'ค้นพุ่มไม้',
  egg_chicken: 'เล้าไก่ (ซ่อมเล้า ให้อาหารไก่ทุกวัน)', egg_twin: 'เล้าไก่ (โอกาสน้อย)', banana_bunch: 'กอกล้วย ทุก 6 วัน', papaya: 'ต้นมะละกอ ทุก 4 วัน', sugarcane: 'กออ้อย ทุก 5 วัน', coconut: 'ต้นมะพร้าว ทุก 5 วัน',
  fish_perch: 'ตกปลาที่บ่อ/คลอง', fish_barb: 'ตกปลาที่บ่อ/คลอง', fish_tilapia_fresh: 'ตกปลาที่บ่อ/คลอง', fish_catfish: 'ตกปลา (ตัวใหญ่)', fish_snakehead: 'ตกปลา (ดึงให้เป๊ะ)', fish_golden: 'ตกปลา (หายากมาก)' };
const BOOKFR = 9;
DV.openBook = (tab = 'diary') => {
  const s = st(), p = $('panel');
  const head = '<div class="panel-h"><b><span class="uic uic-diary"></span> สมุดยายเพียร</b><button class="x" id="panelX">✕</button></div>';
  const draw = () => {
    let h = head + `<div class="panel-b"><div class="bk-tabs"><button data-t="diary" class="${tab === 'diary' ? 'on' : ''}">บันทึกของยาย</button><button data-t="guide" class="${tab === 'guide' ? 'on' : ''}">หาของได้ที่ไหน</button></div>`;
    if (tab === 'diary') { const pages = Object.keys(s.flags).filter(f => f.startsWith('diary_'));
      h += `<div class="ln-feed diary"><div class="page">หน้าแรก — “ถ้าหลานได้อ่าน แปลว่ายายไม่อยู่แล้ว หน้าที่เหลือยายฝากไว้กับคนในตำบล ไปเอาคืนมาทีละหน้านะ”</div>` +
        pages.map(f => `<div class="page">หน้าที่ได้จาก <b>${DV.npcName(f.slice(6))}</b> · วันที่ ${s.flags[f]}</div>`).join('') + (pages.length < 9 ? `<p class="muted">อีก ${9 - pages.length} หน้าอยู่กับคนเฒ่าคนแก่ในตำบล</p>` : '') + '</div>'; }
    else { const SH = DV.SHOPS || {}, shopOf = {}; for (const id in SH) (SH[id].sells || []).forEach(k => { (shopOf[k] = shopOf[k] || []).push(SH[id].name); });
      const keys = [...new Set([...Object.keys(HINT), ...Object.keys(shopOf)])];
      const known = keys.filter(k => s.seen[k] || s.items[k]), unk = keys.length - known.length;
      h += `<p class="muted">ยายจดไว้ว่าของแต่ละอย่างหาได้จากไหน · เจอแล้ว ${known.length}/${keys.length}</p><div class="guide">` +
        keys.map(k => { const it = DV.item(k), ok = s.seen[k] || s.items[k], w = HINT[k] || ('ซื้อได้ที่ ' + (shopOf[k] || []).slice(0, 2).join(' · '));
          return `<span class="si" style="${DV.iconCss(ic(it.icon), 32)}${ok ? '' : ';filter:brightness(0) opacity(.35)'}"></span><span>${ok ? `<b>${it.name}</b>` : '<b>???</b>'}<br><small>${ok ? w : 'ยายเขียนไว้ว่า… ' + w.split(/[·(/]/)[0]}</small></span>`; }).join('') + '</div>'; }
    h += '</div>'; p.innerHTML = h; p.classList.remove('hidden'); $('panelX').onclick = () => p.classList.add('hidden');
    p.querySelectorAll('.bk-tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
  };
  // the opening animation (PixelLab) the first time it is opened each session
  if (DV._bookShown) return draw(); DV._bookShown = true;
  p.innerHTML = head + `<div class="panel-b"><div class="bk-open" id="bkAnim" style="background-image:url(assets/ui/book_open.png);background-size:${BOOKFR * 100}% 100%"></div></div>`; p.classList.remove('hidden'); $('panelX').onclick = () => p.classList.add('hidden');
  let f = 0; const el = $('bkAnim'); DV.sfx('tick'); const iv = setInterval(() => { f++; if (el) el.style.backgroundPosition = `${f / (BOOKFR - 1) * 100}% 0`; if (f >= BOOKFR - 1) { clearInterval(iv); setTimeout(draw, 450); } }, 110);
};

// ================= tapping a player: yourself or a friend =================
DV.tapPlayers = near => {
  const me = DV.player;
  if (near(me.x, me.y)) { DV.openSheet(S().name, 'ทำอะไรดี', null, [
      { label: 'นั่งพักตรงนี้', icon: ['ui', 'home'], extra: 'แรงฟื้นช้า ๆ', run: () => { DV.closeSheet(); DV.sitDown('ตรงนี้'); } },
      { label: 'กินอะไรหน่อย', icon: ['ui', 'bag'], run: () => { DV.closeSheet(); DV.openBag(); } },
      { label: 'ดูสุขภาพ', icon: ['ui', 'heart'], run: () => { DV.closeSheet(); DV.openHealth(); } }], { portrait: 'player_' + S().gender }); return true; }
  const P = (DV.netPlayers && DV.netPlayers()) || []; const f = P.find(p => near(p.x, p.y)); if (!f) return false;
  DV.openSheet(f.name || 'เพื่อน', `เบอร์ ${DV.fmtNum ? DV.fmtNum(f.num || '') : ''}`, null, [
    { label: 'ให้ของจากกระเป๋า', icon: ['ui', 'bag'], run: () => giveMenu(f) },
    { label: 'ทักทาย 👋', icon: ['ui', 'chat'], run: () => { DV.closeSheet(); DV.netSay && DV.netSay(`สวัสดี ${f.name}!`); } },
    { label: 'ชวนไปตลาด', icon: ['ui', 'map'], run: () => { DV.closeSheet(); DV.netSay && DV.netSay('ไปตลาดกัน!'); } }]);
  return true;
};
function giveMenu(f) {
  const s = S(), L = Object.keys(s.items).filter(k => s.items[k] > 0);
  if (!L.length) return DV.toast('กระเป๋าว่าง');
  DV.openSheet(`ให้ของ ${f.name}`, 'แตะเพื่อให้ 1 ชิ้น · ยาวกว่านั้นให้ทั้งหมด', null, L.map(k => ({ label: DV.item(k).name, icon: ic(DV.item(k).icon), extra: `มี ${s.items[k]} · ให้ 1`,
    run: () => { DV.addItem(k, -1); DV.netEvSend({ k: 'give', to: f.num, item: k, n: 1, from: s.name }); DV.sfx('coin'); DV.toast(`ให้${DV.item(k).name}กับ ${f.name} แล้ว`); DV.save(); giveMenu(f); } })));
}
const gseen = new Set();
setInterval(() => { const s = S(); if (!s || !DV.sessionPeers) return; const me = DV.myNumber && DV.myNumber();
  DV.sessionPeers().forEach(p => (p.ev || []).forEach(e => { if (e.k !== 'give' || e.to !== me) return; const key = p.num + e.i; if (gseen.has(key)) return; gseen.add(key);
    s.gotGifts = s.gotGifts || []; if (s.gotGifts.includes(key)) return; s.gotGifts = s.gotGifts.concat([key]).slice(-60);
    DV.addItem(e.item, e.n || 1); DV.sfx('coin'); DV.notify(`🎁 ${e.from || p.name} ให้${DV.item(e.item).name} ${e.n || 1} ชิ้น`); DV.hud(); DV.save(); })); }, 700);

// ================= fruiting plants: banana, papaya, sugarcane, coconut =================
const PL = { banana: ['กอกล้วย', 'banana_bunch', 6, 1, 'ตัดกล้วย 1 หวี'], papaya: ['ต้นมะละกอ', 'papaya', 4, 2, 'สอยมะละกอ'], sugarcane: ['กออ้อย', 'sugarcane', 5, 2, 'ตัดอ้อย'], coconut: ['ต้นมะพร้าว', 'coconut', 5, 2, 'สอยมะพร้าว'] };
DV.openPlant = o => {
  const s = S(), kind = o.tap.slice(6), P = PL[kind]; if (!P) return; s.trees = s.trees || {}; const t = s.trees[o.id] = s.trees[o.id] || { fruitDay: -99 };
  const left = P[2] - (s.day - t.fruitDay), cell = o.block.length ? o.block[0] : [Math.floor(o.x / T), Math.floor(o.y / T)];
  const opts = left <= 0 ? [{ label: `${P[4]} (~${P[3]})`, icon: ic(DV.item(P[1]).icon), cost: 3, run: () => DV.doAction({ energy: 3, tool: DV.TOOL.hand, fx: 'leaf', targets: [cell],
      apply: () => { t.fruitDay = s.day; DV.addItem(P[1], P[3]); DV.gainForage && DV.gainForage(1); }, after: () => DV.toast(`ได้${DV.item(P[1]).name} ${P[3]} — กินได้ ขายได้`) }) }]
    : [{ info: true, label: `ยังไม่ออกผล อีก ${left} วัน` }];
  opts.push({ label: 'นั่งพักใต้ร่ม', icon: ic('food_water'), run: () => { DV.closeSheet(); DV.sitDown('ใต้ร่ม' + P[0]); } });
  DV.openSheet(P[0], 'ปลูกไว้ตั้งแต่สมัยยาย ออกผลเป็นรอบ ๆ', null, opts, { spr: o.s });
};

// ================= sleeping together =================
// while you're in a call, whoever sleeps (or passes out) waits on a "sleeping…" screen; the new day starts for everyone at once
const zz = document.createElement('div'); zz.id = 'zzz'; zz.className = 'hidden'; document.body.appendChild(zz);
let pendingDay = null;
const nd2 = DV.newDay;
DV.newDay = fainted => {
  const peers = (DV.sessionPeers && DV.sessionPeers()) || [];
  if (!peers.length || pendingDay) { if (!pendingDay) return nd2(fainted); return; }
  pendingDay = { fainted }; DV.net.zz = Date.now(); DV.netPush && DV.netPush(); draw();
};
function draw() { const peers = DV.sessionPeers(); const asleep = peers.filter(p => p.zz).length;
  zz.innerHTML = `<div class="zz">😴</div><b>${pendingDay && pendingDay.fainted ? 'สลบไป…' : 'หลับอยู่…'}</b><div>รอเพื่อนนอนด้วยกัน (${asleep + 1}/${peers.length + 1})</div><small>${peers.map(p => `${p.name}: ${p.zz ? 'หลับแล้ว' : 'ยังไม่นอน'}`).join(' · ')}</small><small style="opacity:.6">วันใหม่จะเริ่มพร้อมกันเมื่อทุกคนนอนหรือสลบ</small>`;
  zz.classList.remove('hidden'); }
setInterval(() => { if (!pendingDay) return; const peers = (DV.sessionPeers && DV.sessionPeers()) || [];
  if (peers.length && !peers.every(p => p.zz)) return draw();
  const f = pendingDay.fainted; pendingDay = null; zz.classList.add('hidden'); nd2(f);
  setTimeout(() => { DV.net.zz = 0; DV.netPush && DV.netPush(); }, 5000);   // stay "asleep" a moment longer so everyone sees it
}, 600);
const uo = DV.uiOpen; DV.uiOpen = () => uo() || !zz.classList.contains('hidden');

// ---- bottom bar ----
$('questBtn').onclick = () => S() && !DV.uiBlocked() && DV.openStory();
$('bookBtn').onclick = () => S() && !DV.uiBlocked() && DV.openBook();
$('healthBtn').onclick = () => S() && !DV.uiBlocked() && DV.openHealth();
})();
