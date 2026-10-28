// Dream Valley — story scenes, event cards, ghosts, LINE group / DMs / broadcast tower
(() => {
'use strict';
const DV = window.DV, $ = DV.$;
const ST = window.DV_STORY || {};
const S = () => DV.S;
const SCENES = ST.scenes || [];
const LINE = ST.line || {};

// ---------- story scenes ----------
const ART = { letter: 'assets/card_letter.png' };
let sceneQ = [], scenePlaying = null;
function sceneOk(sc, trig) {
  const s = S();
  if (s.scenes[sc.id]) return false;
  if (sc.when && sc.when.map && sc.when.map !== s.map) return false;
  if (sc.trigger === 'visit' || sc.place) {
    const pl = DV.M.places[sc.place]; if (!pl) return false;
    const d = pl.door; if (Math.abs(DV.player.cx - d[0]) + Math.abs(DV.player.cy - d[1]) > 4) return false;
  }
  return DV.cond(sc.when || {});
}
DV.checkScenes = trig => {
  if (scenePlaying || DV.uiOpen() || DV.isFading()) return false;
  const sc = SCENES.find(x => sceneOk(x, trig));
  if (!sc) return false;
  playScene(sc); return true;
};
function playScene(sc) {
  const s = S(); s.scenes[sc.id] = s.day; scenePlaying = sc;
  DV.closeSheet(); DV.closeTalk && $('talk').classList.add('hidden'); DV.standUp();
  const g = s.gender === 'f' ? 'f' : 'm';
  const beats = (sc.beats || []).filter(b => b && b.text && (!b.g || b.g === g));
  let i = 0;
  const el = $('scene'), art = $('sceneArt');
  art.className = 'scene-art art-' + (sc.art || 'village'); const SA = window.DV_STORYART || [];
  const fid = sc.id + '_f', useF = g === 'f' && SA.includes(fid);
  const img = useF ? `assets/story/${fid}.png` : SA.includes(sc.id) ? `assets/story/${sc.id}.png` : SA.includes('art_' + sc.art) ? `assets/story/art_${sc.art}.png` : ART[sc.art];
  art.style.backgroundImage = img ? `url(${img})` : ''; art.classList.toggle('pic', SA.includes(sc.id) || SA.includes('art_' + sc.art));
  $('sceneTitle').textContent = DV.say(sc.title || '');
  const show = () => {
    const b = beats[i];
    const who = b.who || 'narrator'; if (who !== 'narrator' && who !== 'player') DV._talkTo = who;
    const p = DV.portrait(who);
    $('scenePortrait').style.backgroundImage = p ? `url(${p})` : '';
    $('scenePortrait').classList.toggle('hidden', !p);
    $('sceneName').textContent = who === 'narrator' ? '' : DV.npcName(who);
    $('sceneText').textContent = DV.say(b.text);
    $('sceneText').classList.toggle('narr', who === 'narrator');
    const ch = $('sceneChoices'); ch.innerHTML = '';
    if (i < beats.length - 1) { const nb = document.createElement('button'); nb.className = 'btn next'; nb.textContent = 'ต่อ ›'; nb.onclick = () => { i++; DV.sfx('tick'); show(); }; ch.appendChild(nb); }
    else if (sc.choices && sc.choices.length) sc.choices.forEach(c => {
      const bt = document.createElement('button'); bt.className = 'btn';
      bt.innerHTML = DV.say(c.text) + (c.hint ? `<small>${DV.say(c.hint)}</small>` : '');
      bt.onclick = () => finish(c.effect); ch.appendChild(bt);
    });
    else { const nb = document.createElement('button'); nb.className = 'btn next'; nb.textContent = 'ปิด'; nb.onclick = () => finish(null); ch.appendChild(nb); }
  };
  const finish = eff => {
    el.classList.add('hidden'); scenePlaying = null;
    const msgs = [...DV.applyEffect(eff), ...DV.applyEffect(sc.effect)];
    DV.hud(); DV.save(true);
    if (msgs.length) DV.toast(msgs.join(' · '));
    setTimeout(() => DV.checkScenes('any'), 400);
  };
  if (!beats.length) beats.push({ who: 'narrator', text: sc.title || '…' });
  el.classList.remove('hidden'); DV.sfx('card'); show();
}
DV.sceneOpen = () => !!scenePlaying;
DV.playScene = sc => { if (scenePlaying) return false; playScene(sc); return true; };   // ad-hoc cutscenes (art = assets/story/<id>.png)
// what the main story wants next (shown in 📜 and as a morning reminder)
DV.storyHints = () => {
  const s = S(), out = [];
  for (const sc of SCENES) {
    if (s.scenes[sc.id] || !(sc.trigger === 'visit' || sc.place)) continue;
    const w = Object.assign({}, sc.when || {}); const tf = w.time_from, tt = w.time_to; delete w.time_from; delete w.time_to; delete w.map;
    if (!DV.cond(w)) continue;
    const pl = DV.MAPS.town.places[sc.place] || DV.MAPS.farm.places[sc.place];
    out.push({ title: sc.title, where: pl ? pl.name : sc.place, when: tf ? `${tf}–${tt || ''}` : 'วันนี้', dayMax: w.day_max });
  }
  return out;
};

// ---------- event cards (cards.js) ----------
const CARDS = window.DV_CARDS || [];
const cardOpen = () => !$('cardWrap').classList.contains('hidden');
DV.cardOpen = cardOpen;
function eligible(c) {
  const w = c.when || {}, s = S(); if (c.type !== 'random') return false;
  if (s.seenCards[c.id] && s.day - s.seenCards[c.id] < 3) return false;
  if (w.from != null && s.min < w.from) return false; if (w.to != null && s.min > w.to) return false;
  if (w.minMoney && s.money < w.minMoney) return false; if (w.needItem && !DV.has(w.needItem)) return false;
  if (w.map && w.map !== s.map) return false;
  if (c.id === 'afternoon_rain' && s.rain) return false;
  if (c.id === 'hens' && s.map !== 'farm') return false;
  return true;
}
DV.maybeRandomCard = p => {
  const s = S();
  if (!s || DV.uiOpen() || s.cardsToday >= 3 || Math.random() > p) return;
  const pool = CARDS.filter(eligible); if (!pool.length) return;
  DV.showCard(DV.pick(pool));
};
DV.showCard = c => {
  if (!c) return;
  DV.closeSheet(); $('talk').classList.add('hidden'); DV.standUp();
  const s = S();
  if (c.id) { s.seenCards[c.id] = s.day; if (c.type === 'random') s.cardsToday++; }
  const tag = $('cardTag'); tag.className = 'card-tag ' + c.type;
  tag.textContent = { story: 'เนื้อเรื่อง', random: 'เหตุการณ์', place: 'ที่นี่', night: 'กลางคืน', find: 'ระหว่างทาง' }[c.type] || 'เหตุการณ์';
  const art = $('cardArt'); art.className = 'card-art'; art.style.cssText = '';
  const arts = { letter: 'assets/card_letter.png', hen: 'assets/card_hen.png', phone: `assets/portraits/player_${s.gender}.png` };
  if (c.art === 'night' || c.art === 'snake' || c.art === 'rain' || c.art === 'ghost') art.classList.add(c.art === 'ghost' ? 'night' : c.art);
  else if (c.art && c.art.startsWith('img:') && (window.DV_STORYART || []).includes(c.art.slice(4).split('/').pop().replace('.png', ''))) { art.style.backgroundImage = `url(${c.art.slice(4)})`; art.style.backgroundSize = 'cover'; }
  else if (c.art && c.art.startsWith('icon:')) art.style.backgroundImage = 'url(assets/card_chili.png)';
  else if (c.art && c.art.startsWith('npc:')) { art.style.backgroundImage = `url(assets/portraits/${c.art.slice(4)}.png)`; art.style.backgroundSize = 'auto 100%'; }
  else if (arts[c.art]) art.style.backgroundImage = `url(${arts[c.art]})`;
  $('cardTitle').textContent = DV.say(c.title); $('cardText').textContent = DV.say(c.text);
  const ch = $('cardChoices'); ch.innerHTML = '';
  c.choices.forEach(o => {
    const b = document.createElement('button'); b.className = 'btn';
    b.innerHTML = `${DV.say(o.label)}${o.hint ? `<small>${DV.say(o.hint)}</small>` : ''}`;
    b.onclick = () => resolveChoice(o.effect || {}, c);
    ch.appendChild(b);
  });
  $('cardWrap').classList.remove('hidden'); DV.sfx(c.type === 'night' ? 'ghost' : 'card');
};
function resolveChoice(e, c) {
  $('cardWrap').classList.add('hidden');
  if (e.walk && DV.walkThen) { const w = e.walk, e2 = Object.assign({}, e); delete e2.walk; return DV.walkThen(w, () => resolveChoice(e2, c)); }   // v2.0: go there first, then it happens
  if (e.faintDay) { DV.fade(() => DV.newDay(true)); return; }
  if (e.chance) { const p = (S().prayedDay === S().day && e.chance.pIfPrayed) || e.chance.p, base = Object.assign({}, e); delete base.chance; delete base.text; e = Object.assign(base, Math.random() < p ? e.chance.win : e.chance.lose); }
  const faint = e.faint; const e2 = Object.assign({}, e); delete e2.faint;
  const msgs = DV.applyEffect(e2, { npc: c && c.npc || 'taew' });
  DV.hud(); DV.save();
  if (faint) { DV.faint(e.text || ''); return; }
  if (msgs.length) DV.toast(msgs.join(' · '));
  DV.checkFaint();
}
// ghosts (22.5): a different folk ghost each night, faithful to Thai legends — shown as a card, no chase AI
const GHOSTS = [
  { t: 'อะไรอยู่ในพุ่มไม้', x: 'ไฟฉายดับวูบ ในพุ่มไม้ริมทางมีแสงเล็ก ๆ สองดวงจ้องมา แล้วกะพริบ…' },
  { t: 'ผีกระสือ', x: 'ดวงไฟสีเขียวอมแดงลอยเรี่ยพื้นมาทางร่องน้ำ ส่ายไปมาเหมือนหาอะไรกิน กลิ่นคาวลอยมาตามลม' },
  { t: 'ผีกระหัง', x: 'เสียงกระพือปีกหนัก ๆ เหนือหลังคาบ้านใครสักหลัง เงาคนกางกระด้งสองข้างเหมือนปีก กระโดดข้ามรั้วไป' },
  { t: 'ผีโพง', x: 'แสงสลัวเหมือนตะเกียงลอยข้ามทุ่ง หยุด… แล้วหันมาทางนี้' },
  { t: 'นางตะเคียน', x: 'ลมหยุดนิ่ง ต้นไม้ใหญ่ริมทางมีผ้าสามสีพันอยู่ เสียงผู้หญิงหัวเราะเบา ๆ มาจากบนกิ่ง' },
  { t: 'ผีปอบ', x: 'ยายแก่คนหนึ่งยืนหันหลังอยู่กลางถนน เรียกชื่อ {player} เสียงเหมือนคนรู้จัก… แต่ไม่ใช่' },
];
DV.ghostCard = () => {
  const g = GHOSTS[(S().day * 5 + Math.floor(S().min / 37)) % GHOSTS.length];
  return { id: 'night_ghost', type: 'night', art: 'night', title: g.t, text: g.x, npc: 'bua',
    choices: [
      { label: 'วิ่งหนีกลับบ้าน!', hint: 'มินิเกม · รอด = แรง −6 · ล้ม = แรง −35', effect: { ghostRun: g.t } },
      { label: 'ยกมือไหว้ขอทาง', hint: 'ไหว้ศาลพระภูมิ/เช่าผ้ายันต์ไว้จะดีกว่า', effect: { chance: { p: S().amuletDay === S().day ? .95 : .5, pIfPrayed: .9, win: { text: 'ลมเย็นพัดผ่าน แล้วทุกอย่างก็เงียบ' }, lose: { faint: true, text: 'ขาอ่อนจนทรุดลงกับพื้น…' } } } },
      { label: 'ยืนนิ่ง หลับตา นับหนึ่งถึงสิบ', hint: 'สุ่ม', effect: { chance: { p: .5, win: { energy: -5, text: 'พอลืมตา ก็ไม่มีอะไรแล้ว' }, lose: { faint: true, text: 'มีมือเย็น ๆ แตะไหล่…' } } } },
    ] };
};

// โจรกลางคืน: a motorbike with its headlight off — lose some cash unless you're lucky or fast
DV.thiefCard = () => {
  const cash = S().money, take = Math.min(300, Math.max(20, Math.round(cash * .2 / 10) * 10));
  return { id: 'night_thief', type: 'night', art: 'night', title: 'มอเตอร์ไซค์ปิดไฟ', npc: 'sathian',
    text: `เสียงเครื่องยนต์ค่อย ๆ ไหลมาข้างหลัง ไม่เปิดไฟหน้า ชายใส่หมวกกันน็อกเต็มใบชะลอข้าง ๆ "น้อง… มีตังค์ติดตัวไหม"`,
    choices: [
      { label: `ยื่นเงินให้ (−฿${take})`, hint: 'ปลอดภัย', effect: { money: -take, text: 'เขารับเงินแล้วบิดหายไปในความมืด ใจยังสั่นอยู่เลย · พรุ่งนี้ไปแจ้งดาบเสถียรดีไหมนะ' } },
      { label: 'วิ่งเข้าซอย', hint: 'แรง −15 · ลุ้น', effect: { energy: -15, chance: { p: .6, win: { text: 'ลัดเข้าดงกล้วยจนเสียงเครื่องเงียบไป รอดหวุดหวิด' }, lose: { money: -take, text: 'สะดุดรากไม้ เขาคว้ากระเป๋าไปได้…' } } } },
      { label: 'ตะโกนให้คนช่วย', hint: 'สุ่ม · ใกล้บ้านคนจะดีกว่า', effect: { chance: { p: S().map === 'town' ? .7 : .35, win: { text: 'หมาทั้งซอยเห่าพร้อมกัน ไฟบ้านข้าง ๆ เปิด มอเตอร์ไซค์บิดหนีไป' }, lose: { money: -Math.round(take * 1.5), text: 'ไม่มีใครได้ยิน… เขาเอาไปมากกว่าเดิมเพราะหงุดหงิด' } } } },
    ] };
};

// ---------- สลากพัฒนาตำบล: ใบละ 100 (หน้าตั๋ว 80 · อีก 20 เขาเรียกค่าความหวัง) · ออกวันที่ 1 กับ 16 ของเดือนเกม เวลา 16:00 ----------
DV.isDrawDay = d => d > 1 && d % 15 === 1;
DV.nextDraw = () => { let d = S().day; while (!DV.isDrawDay(d) || (d === S().day && S().min >= 600)) d++; return d; };
const LOSE = [
  'ไม่ถูกสักตัว… ลุงสมหมายบอกว่า "งวดหน้ามาแน่ เลขมันกำลังวอร์ม"',
  'ห่างจากรางวัลที่ 1 แค่หกหลัก',
  'ไม่ถูก แต่ได้รางวัลปลอบใจ: ประสบการณ์',
  'เลขที่ออกตรงกับทะเบียนรถกระบะของ อบต. ทั้งตำบลเงียบไปหนึ่งนาที',
  'ไม่ถูก ป้าแต๋วปลอบว่า "ไม่เป็นไร ถือว่าทำบุญให้รัฐ"',
  'เลขออกตรงกับที่ตาเผือกฝันเมื่อวาน แต่ตาไม่ได้ซื้อเพราะไม่มีใครเชื่อตา',
];
DV.lottoDraw = () => {
  const s = S(); s.lotto = s.lotto || { spent: 0, won: 0, draws: 0 };
  const n = (s.items.lottery_ticket || 0); if (s.lottoDrawn === s.day) return; s.lottoDrawn = s.day; s.lotto.draws++;
  const two = String(Math.floor(Math.random() * 100)).padStart(2, '0'), first = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  DV.postLine && DV.postLine({ who: 'somsak', text: `📢 ผลสลากงวดนี้ รางวัลที่ 1 ${first} · เลขท้าย 2 ตัว ${two} · ผู้ใหญ่ถูกเลขท้ายบ้านเลขที่ตัวเอง ไม่ต้องมาขอยืมนะครับ` }, true);
  if (!n) { DV.notify(`📢 หวยออก: เลขท้าย ${two} — เราไม่ได้ซื้อ เลยไม่เสียใจ (เสียใจแทนคนอื่นแทน)`); return; }
  DV.addItem('lottery_ticket', -n);
  let win = 0; const lines = [];
  for (let i = 0; i < n; i++) { const r = Math.random(); if (r < 0.0005) { win += 30000; lines.push('🎉 ถูกเลขท้าย 3 ตัว! ฿30,000'); } else if (r < 0.015) { win += 2000; lines.push('ถูกเลขท้าย 2 ตัว ฿2,000'); } }
  s.lotto.won += win; DV.stat && DV.stat('lotto');
  if (win) { s.money += win; DV.setFlag('won_lottery'); DV.sfx('coin'); }
  const sum = `ซื้อมาแล้วทั้งหมด ฿${s.lotto.spent.toLocaleString()} · ได้คืน ฿${s.lotto.won.toLocaleString()}`;
  DV.showCard({ id: 'lotto_draw', type: 'random', art: 'img:assets/story/lotto.png', title: `หวยออก · เลขท้าย ${two}`,
    text: (win ? `${lines.join(' · ')}\nทั้งตำบลรู้ก่อนเราอีก ป้าแต๋วโพสต์ในกลุ่มแล้ว ญาติที่ไม่เคยเห็นหน้าเริ่มทักไลน์` : `${n} ใบ ${DV.pick(LOSE)}`) + `\n\n(${sum})`,
    choices: win ? [{ label: 'แบ่งทำบุญที่วัด ฿' + Math.round(win * .1), hint: 'หัวใจทั้งตำบลนิดหน่อย', effect: { money: -Math.round(win * .1), heart: { sumet: 1, jamrat: 1, taew: 1 }, text: 'พระอาจารย์ไม่รับเงิน ลุงจำรัสรับแทน พร้อมใบอนุโมทนา' } },
                   { label: 'เก็บเงียบ ๆ', hint: '(ไม่มีทางเงียบหรอก)', effect: { text: 'เย็นนั้นมีคนมายืมเงินสามคน หนึ่งในนั้นเราไม่รู้จัก' } }]
             : [{ label: 'งวดหน้าเอาใหม่', hint: '', effect: {} }, { label: 'เลิกแล้ว (รอบที่สาม)', hint: '', effect: { text: 'ประโยคนี้ทั้งตำบลพูดมาแล้วสามสิบปี' } }] });
};
DV.buyLotto = (n, price = 100) => { const s = S(); s.lotto = s.lotto || { spent: 0, won: 0, draws: 0 }; s.lotto.spent += n * price; };

// ---------- LINE (phone) ----------
const feed = () => S().lineFeed || (S().lineFeed = []);
DV.postLine = (p, silent) => {
  const s = S(); if (!p || !p.text) return;
  feed().push({ id: p.id || ('x' + Date.now() % 1e7), from: p.from || 'villager', text: DV.say(p.text), sticker: p.sticker, replies: (p.replies || []).map(r => ({ from: r.from, text: DV.say(r.text) })),
    like: p.like_heart || null, day: s.day, time: DV.fmt(s.min) });
  if (feed().length > 160) feed().splice(0, feed().length - 160);
  DV.hud();
  if (!silent && DV.villageJoined()) { DV.sfx('line'); DV.notify(`💬 ${DV.npcName(p.from) || p.from}: ${DV.say(p.text).slice(0, 46)}…`); }
};
DV.villageJoined = () => !!(S() && S().flags && S().flags.story_broadcast_welcome);   // the village group invite comes with the day-2 broadcast
function linePass() {
  const s = S(), L = LINE, joined = DV.villageJoined();
  for (const p of joined ? (L.posts || []) : []) {
    if (s.line.posted[p.id]) continue;
    const t = p.time ? DV.hm(p.time) : 0;
    if (s.min < t) continue;
    const w = Object.assign({}, p.when || {});
    if (!DV.cond(w)) { if (w.day_max != null && s.day > w.day_max) s.line.posted[p.id] = 1; continue; }
    s.line.posted[p.id] = 1; DV.postLine(p, true); DV.notifyLine();
  }
  for (const d of L.dms || []) {
    if (s.line.dmRead[d.id] != null) continue;
    const t = d.time ? DV.hm(d.time) : 0; if (s.min < t) continue;
    if (!DV.cond(d.when || {}, { npc: d.from })) continue;
    s.line.dmRead[d.id] = 0; (s.dmIn || (s.dmIn = [])).push(d.id); DV.sfx('line'); DV.notify(`📩 ${DV.npcName(d.from)} ส่งข้อความถึงคุณ`);
  }
  for (const b of L.broadcast || []) {
    if (s.line.bcSeen[b.id]) continue;
    const t = b.time ? DV.hm(b.time) : 0; if (s.min < t || s.min > t + 120) continue;
    if (!DV.cond(b.when || {})) continue;
    s.line.bcSeen[b.id] = s.day; (s.bcLog || (s.bcLog = [])).push({ text: DV.say(b.text), day: s.day, time: DV.fmt(t) });
    DV.ticker('📢 หอกระจายข่าว: ' + DV.say(b.text));
  }
  DV.groupPass && DV.groupPass();
}
DV.onFlag = f => {   // gossip about the player spreads to LINE
  const g = (LINE.gossip || []).find(x => x.flag === f);
  if (g && DV.villageJoined() && !S().line.posted[g.id]) { S().line.posted[g.id] = 1; setTimeout(() => DV.postLine(g), 2500); }
};
DV.notifyLine = () => { DV.hud(); };
DV.lineUnread = () => Math.max(0, feed().length - (S().line.read || 0)) + (S().dmIn || []).filter(id => !S().line.dmRead[id]).length;
DV.LINE = LINE;

// ---------- hooks ----------
DV.onHour = h => { linePass(); DV.save(); if (h === 16 && DV.isDrawDay(S().day) && !DV.uiOpen()) { DV.lottoDraw(); return; } if (!DV.checkScenes('hour') && !DV.isBusy() && DV.player.path.length === 0 && $('sheet').classList.contains('hidden')) DV.maybeRandomCard(0.15); };
DV.onTick = () => { linePass(); DV.checkScenes('visit'); };
DV.onEnterMap = m => { setTimeout(() => { linePass(); DV.checkScenes('enter_map') || DV.checkScenes('hour'); }, 500); };
DV.onMorning = () => { setTimeout(() => { linePass(); DV.checkScenes('morning') || DV.checkScenes('hour'); const h = DV.storyHints()[0]; if (h) setTimeout(() => DV.notify(`⭐ วันนี้: ${h.title} — ${h.where} ${h.when}`), 2500); }, 900); };
DV.afterTalk = () => setTimeout(() => DV.checkScenes('hour'), 300);
DV.startStory = fresh => {
  if (fresh) { if (!DV.checkScenes('newgame')) DV.showCard(CARDS.find(c => c.id === 'intro')); }
  else setTimeout(() => DV.checkScenes('hour'), 600);
  linePass();
};
})();
