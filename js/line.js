// Dream Valley — in-game LINE: chat list like the real app; one room per group and per person.
// Groups exist only once joined; extra groups open with the story and are offered by an NPC (at random, when close enough).
(() => {
'use strict';
const DV = window.DV, $ = DV.$, S = () => DV.S;
const GROUPS = () => ((window.DV_STORY || {}).groups) || [];
const NPC = id => (window.DV_NPCS || {})[id];
const av = id => NPC(id) ? `<div class="av" style="background-image:url(assets/portraits/${id}.png)"></div>` : `<div class="av anon">${(DV.npcName(id) || '?').slice(0, 1)}</div>`;
const st = () => { const s = S(); s.groups = s.groups || {}; s.gfeed = s.gfeed || {}; s.gread = s.gread || {}; s.gposted = s.gposted || {}; s.ginvite = s.ginvite || {}; return s; };

// ---- delivery: posts of joined groups arrive as their day/flags come (called from the LINE pass every tick) ----
DV.groupPass = () => {
  const s = st();
  for (const g of GROUPS()) {
    if (!s.groups[g.id]) continue;
    const f = s.gfeed[g.id] = s.gfeed[g.id] || [];
    for (const p of g.posts || []) {
      const key = g.id + ':' + p.id; if (s.gposted[key]) continue;
      if ((p.day_min || 0) > s.day || !DV.cond(p.when || {})) continue;
      s.gposted[key] = 1; f.push({ id: key, from: p.from, text: DV.say(p.text), replies: (p.replies || []).map(r => ({ from: r.from, text: DV.say(r.text) })), like: p.like, day: s.day, time: DV.fmt(s.min) });
      if (DV.notify && s.groups[g.id] !== s.day) DV.notify(`💬 ${g.name}: ${DV.npcName(p.from)}`);
    }
  }
};
DV.joinGroup = id => {
  const s = st(), g = GROUPS().find(x => x.id === id); if (!g || s.groups[id]) return;
  s.groups[id] = s.day; const f = s.gfeed[id] = s.gfeed[id] || [];
  (g.welcome || []).forEach((w, i) => f.push({ id: id + ':w' + i, from: w.from, text: DV.say(w.text), day: s.day, time: DV.fmt(s.min) }));
  DV.groupPass(); DV.sfx('line'); DV.toast(`💬 ถูกเพิ่มเข้ากลุ่ม "${g.name}" แล้ว — ดูในมือถือ`); DV.save(); DV.hud();
};
// ---- invites: only from the right NPC, only after the story opens the group, only by luck while talking ----
DV.groupInviteFor = npc => {
  const s = st();
  return GROUPS().find(g => g.invite && g.invite.npc === npc && !s.groups[g.id] && s.ginvite[g.id] !== s.day
    && DV.heart(npc) >= (g.invite.heart_min || 3) && DV.cond(g.unlock_when || {}, { npc }));
};
DV.maybeGroupInvite = npc => {
  const g = DV.groupInviteFor(npc); if (!g || Math.random() > .3) return false;
  st().ginvite[g.id] = S().day;
  DV.showTalk(npc, g.invite.text, [{ text: g.invite.accept || 'เอาสิ{k}', reply: 'เพิ่มแล้ว ๆ ดูในไลน์เลย', heart: 1, invite: g.id }, { text: g.invite.decline || 'ไว้ก่อนนะ{kq}', reply: 'ได้ ๆ เปลี่ยนใจเมื่อไหร่บอก', heart: 0 }],
    o => { if (o.invite) DV.joinGroup(o.invite); DV.showTalk(npc, o.reply, []); });
  return true;
};

// ---- unread ----
const village = () => S().lineFeed || [];
const dmsFrom = () => { const s = S(), by = {}; (s.dmIn || []).forEach(id => { const d = (DV.LINE.dms || []).find(x => x.id === id); if (d) (by[d.from] = by[d.from] || []).push(d); }); return by; };
const unreadOf = key => {
  const s = st();
  if (key === 'village') return !DV.villageJoined() ? 0 : Math.max(0, village().length - (s.line.read || 0));
  if (key.startsWith('g:')) { const id = key.slice(2); return Math.max(0, (s.gfeed[id] || []).length - (s.gread[id] || 0)); }
  if (key.startsWith('p:')) return (dmsFrom()[key.slice(2)] || []).filter(d => !s.line.dmRead[d.id]).length;
  return 0;
};
DV.lineUnread = () => { if (!S()) return 0; const s = st(); let n = unreadOf('village'); Object.keys(s.groups).forEach(id => n += unreadOf('g:' + id)); Object.keys(dmsFrom()).forEach(p => n += unreadOf('p:' + p)); return n; };

// ---- screens ----
const short = t => { const x = String(t || '').replace(/<[^>]+>/g, ''); return x.length > 34 ? x.slice(0, 34) + '…' : x; };
DV.renderLine = (scr, top, tab, go) => {
  const s = st();
  if (tab === 'line') {   // chat list
    const rows = [];
    const vf = village(), vl = vf[vf.length - 1];
    if (DV.villageJoined()) rows.push({ key: 'village', pic: '<div class="av grp">ม.3</div>', name: (DV.LINE.group_name) || 'บ้านดงเย็น ม.3 💚', last: vl ? `${DV.npcName(vl.from)}: ${short(vl.text)}` : 'ยังเงียบอยู่', time: vl ? vl.time : '', d: vl ? vl.day : 0 });
    GROUPS().filter(g => s.groups[g.id]).forEach(g => { const f = s.gfeed[g.id] || [], l = f[f.length - 1];
      rows.push({ key: 'g:' + g.id, pic: g.avatar ? av(g.avatar) : '<div class="av grp">กลุ่ม</div>', name: g.name, last: l ? `${DV.npcName(l.from)}: ${short(l.text)}` : 'เพิ่งสร้างกลุ่ม', time: l ? l.time : '', d: l ? l.day : s.groups[g.id] }); });
    const by = dmsFrom();
    Object.keys(by).forEach(p => { const l = by[p][by[p].length - 1]; rows.push({ key: 'p:' + p, pic: av(p), name: DV.npcName(p), last: short(DV.say(l.text)), time: '', d: 0 }); });
    rows.sort((a, b) => (unreadOf(b.key) > 0) - (unreadOf(a.key) > 0) || b.d - a.d);
    scr.innerHTML = top + `<div class="ln-app"><div class="ln-tabs"><b>แชท</b><span>เพื่อน</span></div><div class="ln-search">ค้นหา</div><div class="ln-list">` +
      (rows.length ? '' : '<p class="muted" style="padding:24px 14px;text-align:center">ยังไม่มีแชตเลย<br><small>คนที่นี่ยังไม่รู้จักเรา… เดี๋ยวคงมีคนชวนเข้ากลุ่มหมู่บ้าน</small></p>') +
      rows.map(r => { const u = unreadOf(r.key); return `<button class="ln-row" data-k="${r.key}">${r.pic}<div class="ln-mid"><b>${r.name}</b><small>${r.last}</small></div><div class="ln-r"><small>${r.time}</small>${u ? `<i>${u > 99 ? '99+' : u}</i>` : ''}</div></button>`; }).join('') +
      `</div><button class="back ln-home">‹ หน้าหลัก</button></div>`;
    scr.querySelectorAll('.ln-row').forEach(b => b.onclick = () => { DV.sfx('tick'); go('chat:' + b.dataset.k); });
    return;
  }
  const key = tab.slice(5);
  const bubbleRow = (p, i, liked) => `<div class="msg">${av(p.from)}<div class="bub"><div class="who">${DV.npcName(p.from) || p.from} <small>${p.time || ''}</small></div>` +
    (p.sticker ? `<div class="stk">${p.sticker}</div>` : '') + `<div>${p.text}</div>` +
    (p.replies && p.replies.length ? `<div class="reps">${p.replies.map(r => `<div><b>${DV.npcName(r.from) || r.from}:</b> ${r.text}</div>`).join('')}</div>` : '') +
    `<button class="like" data-i="${i}"><span class="uic uic-heart" style="${liked ? '' : 'filter:grayscale(1) opacity(.5)'}"></span></button></div></div>`;
  const dayBreaks = list => { let d = -1; return list.map((p, i) => { const sep = p.day !== d ? `<div class="ln-day">วันที่ ${p.day}</div>` : ''; d = p.day; return sep + bubbleRow(p, i, s.line.liked[p.id]); }).join(''); };
  if (key === 'village' || key.startsWith('g:')) {
    const g = key === 'village' ? null : GROUPS().find(x => x.id === key.slice(2));
    const list = (key === 'village' ? village() : (s.gfeed[g.id] || [])).slice(-80);
    if (key === 'village') s.line.read = village().length; else s.gread[g.id] = (s.gfeed[g.id] || []).length;
    const members = g ? (g.members || []).length + 1 : Object.keys(window.DV_NPCS).length + 41;
    scr.innerHTML = top + `<div class="ln-head"><button class="back" data-to="line">‹</button><b>${g ? g.name : (DV.LINE.group_name || 'บ้านดงเย็น ม.3 💚')}</b><span>${members} คน</span></div>` +
      `<div class="ln-feed">${list.length ? dayBreaks(list) : '<p class="muted">ยังเงียบอยู่…</p>'}</div>`;
    const f = scr.querySelector('.ln-feed'); f.scrollTop = f.scrollHeight;
    scr.querySelectorAll('.like').forEach(b => b.onclick = () => { const p = list[+b.dataset.i]; if (!p || s.line.liked[p.id]) return; s.line.liked[p.id] = 1;
      if (p.like && NPC(p.like)) { const k = 'lk' + s.day + p.like; if (!s.flags[k]) { s.flags[k] = 1; DV.addHeart(p.like, 1); DV.toast(`${DV.npcName(p.like)} เห็นว่าคุณกดหัวใจ ♥ ความสนิทเพิ่มขึ้นนิดหน่อย`); } }
      DV.sfx('heart'); DV.save(); go(tab); });
  } else if (key.startsWith('p:')) {
    const who = key.slice(2), list = dmsFrom()[who] || [];
    let html = '';
    list.forEach(d => { s.line.dmRead[d.id] = 1; const ans = s.line.dmAns[d.id];
      html += `<div class="msg">${av(d.from)}<div class="bub">${DV.say(d.text)}</div></div>`;
      if (ans != null) html += `<div class="msg me"><div class="bub">${DV.say(d.reply_options[ans].text)}</div></div><div class="msg">${av(d.from)}<div class="bub">${DV.say(d.reply_options[ans].reply || '👍')}</div></div>`; });
    const open = list.find(d => s.line.dmAns[d.id] == null && d.reply_options);
    scr.innerHTML = top + `<div class="ln-head"><button class="back" data-to="line">‹</button><b>${DV.npcName(who)}</b><span></span></div><div class="ln-feed">${html}</div>` +
      (open ? `<div class="ln-reply">${open.reply_options.map((r, i) => `<button data-r="${i}">${DV.say(r.text)}</button>`).join('')}</div>` : '<div class="ln-reply off">พิมพ์ข้อความ…</div>');
    const f = scr.querySelector('.ln-feed'); f.scrollTop = f.scrollHeight;
    scr.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { s.line.dmAns[open.id] = +b.dataset.r; const r = open.reply_options[+b.dataset.r];
      if (r.heart && NPC(open.from)) DV.addHeart(open.from, r.heart); if (r.effect) DV.applyEffect(r.effect, { npc: open.from }); DV.sfx('line'); DV.save(); go(tab); });
  }
  DV.hud();
};
})();
