// Dream Valley — play together through the in-game phone.
// Every player has a phone number (from their save). Open the โทรศัพท์ app, dial a friend's number on the keypad:
// your game joins their line ("room"), they get an incoming call, and once they pick up you see each other walking around.
// Uses the Artifact `room` capability: presence only (position, map, a short "say"), so nothing here is stored or trusted.
(() => {
'use strict';
const DV = window.DV, S = () => DV.S;
const NET = DV.net = { room: null, own: null, line: null, mode: null, target: null, peers: [], status: '', incoming: null, accepted: {}, dial: '', log: [] };
DV.myNumber = () => { const s = S(); if (!s) return ''; let h = 2166136261; for (const c of (s.code + '|' + s.name)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const d = String(h % 100000000).padStart(8, '0'); return '08' + d; };
const fmtNum = n => n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}` : n;
DV.fmtNum = fmtNum;
const roomName = n => 'dv-' + n;

// ---- connect: every player sits on their own line so friends can call in ----
async function connect() {
  if (NET.room !== null) return NET.room;
  try { NET.room = (window.claude && claude.use) ? await claude.use('room') : null; } catch (_) { NET.room = null; }
  if (!NET.room && window.DV_fbRoom) NET.room = await window.DV_fbRoom();   // GitHub Pages / installed app → Firebase
  if (!NET.room) { NET.room = false; return false; }
  try { NET.own = await NET.room.join(roomName(DV.myNumber())); } catch (_) { NET.own = null; }
  if (NET.own) {
    NET.own.onPeers(ch => {
      (ch.joined || []).forEach(p => { if (!p.isMe && !NET.accepted[p.peer]) { NET.incoming = p; DV.sfx('line'); DV.notify('📱 สายเรียกเข้า — เปิดแอปโทรศัพท์เพื่อรับสาย'); DV.rerenderPhone && DV.rerenderPhone(); DV.hud(); } });
      (ch.left || []).forEach(p => { if (NET.incoming && NET.incoming.peer === p.peer) NET.incoming = null; delete NET.accepted[p.peer]; DV.rerenderPhone && DV.rerenderPhone(); });
      if (NET.mode !== 'guest') NET.peers = NET.own.peers().filter(p => !p.isMe && NET.accepted[p.peer]);
    }, () => {});
  }
  setInterval(pushPresence, 150);
  return NET.room;
}
DV.netConnect = connect;
DV.callBadge = () => NET.incoming ? 1 : 0;

// ---- my presence: who I am, where I stand, my farm (so a visitor sees the same plot) ----
let lastP = '';
function pushPresence() {
  const s = S(), line = NET.mode === 'guest' ? NET.line : NET.own; if (!s || !line) return;
  const p = DV.player;
  const me = { num: DV.myNumber(), name: s.name, g: s.gender, map: s.map, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, d8: p.d8, mv: p.moving ? 1 : 0, sit: p.sit ? 1 : 0, say: NET.say || null,
    host: NET.mode === 'guest' ? 0 : 1, acc: Object.keys(NET.accepted).slice(0, 5) };
  if (me.host && s.cells) { me.farm = Object.entries(s.cells).filter(([, c]) => c.soil || c.crop).map(([k, c]) => `${k}:${c.wet ? 1 : 0}${c.crop ? c.crop.k[0] + c.crop.st : ''}`).join(' ').slice(0, 1800); me.mvd = JSON.stringify((s.moved || {}).farm || {}).slice(0, 600); }
  const str = JSON.stringify(me); if (str === lastP) return; lastP = str;
  line.presence(me).catch(() => {});
}

// ---- dialling a friend ----
async function call(num) {
  if (num === DV.myNumber()) { NET.status = 'นี่เบอร์ของเราเอง'; return; }
  const room = await connect(); if (!room) { NET.status = 'ยังโทรไม่ได้ — ต้องต่ออินเทอร์เน็ต (และเปิดระบบออนไลน์ของเกม)'; DV.rerenderPhone(); return; }
  NET.target = num; NET.status = 'กำลังโทร…'; DV.rerenderPhone();
  try { NET.line = await room.join(roomName(num)); } catch (e) { NET.status = 'สายไม่ว่าง ลองใหม่อีกครั้ง'; DV.rerenderPhone(); return; }
  NET.mode = 'guest'; pushPresence();
  const t0 = Date.now();
  const watch = NET.line.onPeers(() => {
    const host = NET.line.peers().find(p => !p.isMe && p.presence && p.presence.host && p.presence.num === num);
    if (!host) { if (Date.now() - t0 > 9000 && NET.status === 'กำลังโทร…') { NET.status = 'ไม่มีผู้รับสาย (เพื่อนต้องเปิดเกมค้างไว้)'; hang(); } return; }
    const ok = (host.presence.acc || []).length >= 0 && Array.isArray(host.presence.acc) && host.presence.acc.some(x => NET.line.peers().some(m => m.isMe && m.sameTab && m.peer === x));
    if (ok && NET.status !== 'connected') { NET.status = 'connected'; NET.hostPeer = host.peer; DV.sfx('coin'); DV.toast(`ต่อสายกับ ${host.presence.name} แล้ว — เจอกันที่ฟาร์มของเขา`); DV.rerenderPhone(); if (S().map !== 'farm') DV.travel('farm', 'home'); }
    NET.peers = NET.line.peers().filter(p => !p.isMe);
  }, () => {});
  NET.unwatch = watch;
  setTimeout(() => { if (NET.status === 'กำลังโทร…') { NET.status = 'ไม่มีผู้รับสาย (เพื่อนต้องเปิดเกมค้างไว้)'; hang(); } }, 20000);
}
function hang() {
  if (NET.unwatch) { NET.unwatch(); NET.unwatch = null; }
  if (NET.line) { NET.line.leave().catch(() => {}); NET.line = null; }
  NET.mode = null; NET.peers = NET.own ? NET.own.peers().filter(p => !p.isMe && NET.accepted[p.peer]) : []; NET.hostPeer = null; DV.visitFarm = null;
  DV.rerenderPhone && DV.rerenderPhone(); DV.dirtySoil && DV.dirtySoil();
}
DV.hangUp = () => { if (NET.status === 'connected') DV.toast('วางสายแล้ว'); NET.status = ''; hang(); };
function accept() { if (!NET.incoming) return; NET.accepted[NET.incoming.peer] = 1; NET.mode = NET.mode || 'host'; DV.toast('รับสายแล้ว เพื่อนกำลังมาที่ฟาร์ม'); NET.incoming = null; pushPresence(); DV.rerenderPhone(); DV.hud(); }
function reject() { NET.incoming = null; DV.rerenderPhone(); DV.hud(); }
DV.netSay = text => { NET.say = { t: Date.now(), text }; pushPresence(); setTimeout(() => { if (NET.say && Date.now() - NET.say.t > 3900) { NET.say = null; pushPresence(); } }, 4000); };

// ---- what the world needs: other players to draw, and the host's farm while visiting ----
DV.netPlayers = () => {
  const s = S(); if (!s) return [];
  const list = NET.mode === 'guest' && NET.line ? NET.line.peers() : NET.own ? NET.own.peers().filter(p => NET.accepted[p.peer]) : [];
  return list.filter(p => !p.isMe && p.presence && p.presence.map === s.map && (NET.mode !== 'guest' || NET.status === 'connected' || !p.presence.host)).map(p => p.presence);
};
DV.visitCells = () => {
  if (NET.mode !== 'guest' || NET.status !== 'connected' || !NET.line || S().map !== 'farm') return null;
  const host = NET.line.peers().find(p => p.peer === NET.hostPeer); if (!host || !host.presence.farm) return null;
  if (host.presence.farm === NET._farmStr) return NET._farm;
  const cells = {}; Object.keys(S().cells || {}).forEach(k => cells[k] = { soil: false, wet: false, crop: null });
  const CK = { c: 'chili', b: 'basil', m: 'morning_glory' };
  host.presence.farm.split(' ').forEach(t => { const m = t.match(/^(\d+,\d+):(\d)([a-z])?(\d)?$/); if (!m) return;
    cells[m[1]] = { soil: true, wet: m[2] === '1', crop: m[3] ? { k: m[3] === 'c' ? (CK.c) : m[3] === 'b' ? 'basil' : m[3] === 'm' ? 'morning_glory' : 'corn', st: +m[4] } : null }; });
  NET._farmStr = host.presence.farm; NET._farm = cells; DV.dirtySoil && DV.dirtySoil(); return cells;
};
DV.isVisiting = () => NET.mode === 'guest' && NET.status === 'connected';

// ---- the โทรศัพท์ app ----
const QUICK = ['สวัสดี!', 'มาทางนี้', 'ขอบคุณนะ', 'ไปตลาดกัน', 'ง่วงแล้ว', '555'];
DV.renderCall = (scr, top, tab, go) => {
  connect();
  const me = DV.myNumber();
  if (NET.incoming) {
    const p = NET.incoming.presence || {};
    scr.innerHTML = top + `<div class="call-in"><div class="ci-ring"><span class="uic uic-phone" style="--s:56px"></span></div><b>${p.name || 'เพื่อน'}</b><small>${fmtNum(p.num || '')}</small><p>อยากมาเที่ยวฟาร์มของคุณ</p>
      <div class="ci-btns"><button class="ci-no">ปฏิเสธ</button><button class="ci-yes">รับสาย</button></div></div>`;
    scr.querySelector('.ci-yes').onclick = accept; scr.querySelector('.ci-no').onclick = reject; return;
  }
  if (NET.status === 'connected' || (NET.mode === 'host' && Object.keys(NET.accepted).length)) {
    const ps = DV.netPlayers();
    scr.innerHTML = top + `<div class="call-on"><div class="co-h"><span class="uic uic-phone"></span> กำลังเล่นด้วยกัน</div><div class="co-list">${(NET.mode === 'guest' ? NET.line.peers() : NET.own.peers()).filter(p => !p.isMe && p.presence && p.presence.name).map(p => `<div class="co-p"><b>${p.presence.name}</b><small>${fmtNum(p.presence.num || '')} · ${p.presence.map === 'town' ? 'ใจกลางตำบล' : p.presence.map === 'house' ? 'ในบ้าน' : 'ฟาร์ม'}</small></div>`).join('') || '<p class="muted">รอเพื่อนเข้ามา…</p>'}</div>
      <div class="co-say">${QUICK.map(q => `<button>${q}</button>`).join('')}</div><button class="co-end">วางสาย</button></div>`;
    scr.querySelectorAll('.co-say button').forEach(b => b.onclick = () => { DV.netSay(b.textContent); DV.sfx('talk'); });
    scr.querySelector('.co-end').onclick = () => { if (NET.mode === 'host') { NET.accepted = {}; NET.mode = null; pushPresence(); } DV.hangUp(); go('call'); };
    return;
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  scr.innerHTML = top + `<div class="dialer"><div class="dl-me">เบอร์ของฉัน <b>${fmtNum(me)}</b><small>ให้เพื่อนโทรหาเบอร์นี้ เพื่อมาเล่นที่ฟาร์มของเรา</small></div>
    <div class="dl-num">${fmtNum(NET.dial) || '<span>กดเบอร์เพื่อน</span>'}</div><div class="dl-st">${NET.status && NET.status !== 'connected' ? NET.status : ''}</div>
    <div class="dl-pad">${keys.map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>
    <div class="dl-act"><button class="dl-del">ลบ</button><button class="dl-call"${NET.dial.length === 10 ? '' : ' disabled'}><span class="uic uic-phone"></span> โทร</button></div>
    ${(S().calls || []).length ? `<div class="dl-recent"><small>โทรล่าสุด</small>${S().calls.slice(-3).reverse().map(c => `<button data-n="${c.n}">${c.name || fmtNum(c.n)}</button>`).join('')}</div>` : ''}
    <button class="back">‹ หน้าหลัก</button></div>`;
  scr.querySelectorAll('.dl-pad button').forEach(b => b.onclick = () => { if (/\d/.test(b.dataset.k) && NET.dial.length < 10) NET.dial += b.dataset.k; DV.sfx('tick'); NET.status = ''; go('call'); });
  scr.querySelector('.dl-del').onclick = () => { NET.dial = NET.dial.slice(0, -1); go('call'); };
  scr.querySelectorAll('.dl-recent button').forEach(b => b.onclick = () => { NET.dial = b.dataset.n; go('call'); });
  scr.querySelector('.dl-call').onclick = () => { const s = S(); s.calls = (s.calls || []).filter(c => c.n !== NET.dial).concat([{ n: NET.dial }]).slice(-8); call(NET.dial); };
};
})();
