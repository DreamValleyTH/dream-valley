// Dream Valley — minigames (v1.6). Pure JS + DOM, no libraries. Works in the game and in the mockup pages.
// MG.play(kind, opts) → opts.onEnd(score 0..1, info). MG.pick(pool, opts) plays a random kind from a pool (never the same one twice in a row).
// kinds: timing · tension · taps · mash · sequence · stir · catch · dodge · arrows · hold · pairs · sweep
(() => {
'use strict';
const MG = window.MG = window.MG || {};
let root = null, live = null, lastKind = {};
const snd = k => { try { (MG.sfx || (() => {}))(k); } catch (_) {} };
const R = (a, b) => a + Math.random() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
const css = `
#mg{position:fixed;inset:0;z-index:60;background:rgba(20,14,8,.66);display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Mitr","Leelawadee UI",system-ui,sans-serif}
#mg.hidden{display:none}
#mg .mb{width:min(390px,94vw);background:#f6ead2;color:#33251a;border:4px solid #3b2a1c;border-radius:16px;box-shadow:0 6px 0 rgba(0,0,0,.35);padding:14px;text-align:center;position:relative}
#mg .mb.dark{background:#241f2e;color:#f1e6ff;border-color:#0f0b15}#mg .mb.dark .ms{color:#c4b2da}
#mg .mh{font-size:20px;font-weight:600;line-height:1.3}#mg .ms{font-size:13px;color:#6b5440;margin:2px 0 10px;min-height:18px}
#mg .ma{position:relative;margin:0 auto;touch-action:none}
#mg .mf{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-weight:500;font-size:15px}
#mg .go{display:block;width:100%;padding:15px;font-size:21px;font-weight:600;font-family:inherit;border-radius:12px;border:3px solid #3b2a1c;background:#f2b84b;color:#33251a;margin-top:10px}
#mg .go:active,#mg .go.on{transform:translateY(2px);background:#e09a2a}
#mg .bar{position:relative;height:34px;background:#c9b48d;border:3px solid #3b2a1c;border-radius:10px;overflow:hidden}
#mg .zone{position:absolute;top:0;bottom:0;background:linear-gradient(#8fd06a,#5f8f3a)}
#mg .pin{position:absolute;top:-2px;bottom:-2px;width:6px;margin-left:-3px;background:#c8432f;border-radius:3px;box-shadow:0 0 0 2px #fff8e8}
#mg .dots{display:flex;gap:7px;justify-content:center;margin:10px 0 0}#mg .dots i{width:15px;height:15px;border-radius:50%;background:#d8c7a4;border:2px solid #3b2a1c}
#mg .dots i.ok{background:#7fb04c}#mg .dots i.no{background:#c8432f}
#mg .msg{height:22px;margin-top:6px;font-weight:600}
#mg .grid{display:grid;gap:7px}#mg .grid button{aspect-ratio:1;border:3px solid #cdb68c;border-radius:12px;background:#fff8e8;font-size:30px;padding:0;color:#33251a}
#mg .grid button.flip{background:#fff8e8}#mg .grid button.back{background:#b48a5a;color:transparent}#mg .grid button.done{opacity:.35}
#mg .pad{display:flex;gap:10px}#mg .pad button{flex:1;padding:20px 0;font-size:24px;font-weight:600;font-family:inherit;border-radius:14px;border:3px solid #3b2a1c;background:#ecdcb8;color:#33251a}
#mg .pad button:active,#mg .pad button.hit{background:#f2b84b}#mg .pad button.lit{background:#fff3a8;box-shadow:0 0 18px #ffd84a}
#mg .field{position:relative;overflow:hidden;border:3px solid #3b2a1c;border-radius:12px;background:#cfe2a8}
#mg .field.dark{background:#1b1724}
#mg .spr{position:absolute;transform:translate(-50%,-50%);font-size:30px;line-height:1;pointer-events:none}
#mg .meter{height:14px;background:#c9b48d;border:2px solid #3b2a1c;border-radius:8px;overflow:hidden}#mg .meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f2b84b,#7fb04c)}
#mg .ready{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:600;color:#c8432f;background:rgba(246,234,210,.86);border-radius:12px;pointer-events:none;transition:opacity .25s}
#mg .mb.dark .ready{background:rgba(36,31,46,.86);color:#ff9a7a}
`;
function ensure() {
  if (root) return;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  root = document.createElement('div'); root.id = 'mg'; root.className = 'hidden'; document.body.appendChild(root);
}
MG.open = () => !!live;
function frame({ title, sub, dark, w = 330, h = 0 }) {
  ensure(); stop();
  root.innerHTML = `<div class="mb${dark ? ' dark' : ''}"><div class="mh">${title}</div><div class="ms">${sub || ''}</div><div class="ma" style="width:${w}px;max-width:100%${h ? `;height:${h}px` : ''}"></div><div class="mf"><span class="t"></span><span class="s"></span></div></div>`;
  root.classList.remove('hidden');
  const L = live = { raf: 0, timers: [], ivs: [], area: root.querySelector('.ma'), box: root.querySelector('.mb'), t: root.querySelector('.t'), s: root.querySelector('.s'), sub: root.querySelector('.ms'), done: false };
  L.after = (f, ms) => { const k = setTimeout(() => { if (live === L) f(); }, ms); L.timers.push(k); };
  L.every = (f, ms) => { const k = setInterval(() => { if (live === L) f(); }, ms); L.ivs.push(k); };
  L.loop = f => { let t0 = performance.now(); const step = now => { if (live !== L) return; const dt = Math.min(.05, (now - t0) / 1000); t0 = now; f(dt, now); L.raf = requestAnimationFrame(step); }; L.raf = requestAnimationFrame(step); };
  return L;
}
function stop() { if (!live) return; cancelAnimationFrame(live.raf); live.timers.forEach(clearTimeout); live.ivs.forEach(clearInterval); live = null; }
function finish(L, score, info, cb, ms = 450) { if (L.done) return; L.done = true; cancelAnimationFrame(L.raf); L.ivs.forEach(clearInterval);
  setTimeout(() => { if (live === L) { stop(); root.classList.add('hidden'); root.innerHTML = ''; } cb && cb(Math.max(0, Math.min(1, score)), info || {}); }, ms); }
MG.close = () => { stop(); if (root) { root.classList.add('hidden'); root.innerHTML = ''; } };
// "3·2·1" so a first tap never counts as a miss
function ready(L, go, text = 'พร้อม…') { const r = document.createElement('div'); r.className = 'ready'; r.textContent = text; L.box.appendChild(r);
  L.after(() => { r.textContent = 'เริ่ม!'; snd('tick'); }, 650); L.after(() => { r.style.opacity = 0; go(); }, 1050); L.after(() => r.remove(), 1350); }
const pos = (e, el) => { const b = el.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };

const G = {};
// 1. timing — a needle sweeps a bar; tap inside the green
G.timing = (o, L) => {
  const rounds = o.rounds || 3; let r = 0, hits = 0, p = 0, dir = 1, z = o.zone || .22, zx = 0, lock = 1;
  L.area.innerHTML = `<div class="bar"><i class="zone"></i><b class="pin"></b></div><div class="dots">${'<i></i>'.repeat(rounds)}</div><button class="go">${o.btn || 'แตะ!'}</button><div class="msg"></div>`;
  const zEl = L.area.querySelector('.zone'), pin = L.area.querySelector('.pin'), dots = L.area.querySelectorAll('.dots i'), msg = L.area.querySelector('.msg');
  const place = () => { zx = .06 + Math.random() * (.88 - z); }; place();
  L.loop(dt => { if (!lock) { p += dir * (o.speed || 1.1) * dt * (1 + r * .12); if (p > 1) { p = 1; dir = -1; } if (p < 0) { p = 0; dir = 1; } }
    zEl.style.left = zx * 100 + '%'; zEl.style.width = z * 100 + '%'; pin.style.left = p * 100 + '%'; });
  const hit = () => { if (lock) return; const ok = p >= zx && p <= zx + z; hits += ok; dots[r].className = ok ? 'ok' : 'no'; snd(ok ? 'coin' : 'dirt');
    msg.textContent = ok ? pick(['เยี่ยม!', 'ตรงเป๊ะ!', 'ดีมาก!']) : pick(['พลาด!', 'เร็วไปนิด', 'ช้าไปหน่อย']); r++; lock = 1;
    L.after(() => { msg.textContent = ''; if (r >= rounds) finish(L, hits / rounds, { hits, rounds }, o.onEnd, 0); else { z *= o.shrink || .88; place(); lock = 0; } }, 480); };
  L.area.querySelector('.go').onpointerdown = e => { e.preventDefault(); hit(); };
  ready(L, () => { lock = 0; });
};
// 2. tension — hold to lift the green catch bar, keep the fish inside it until the meter fills (Stardew-style fishing)
G.tension = (o, L) => {
  const H = 230; let bar = .1, v = 0, fish = .5, fv = 0, target = .5, prog = .3, hold = false, on = false, t = o.time || 14;
  const bh = o.bar || .26;
  L.area.innerHTML = `<div style="display:flex;gap:12px;justify-content:center"><div class="field" style="width:64px;height:${H}px;background:#7fb6cf"><i class="cb" style="position:absolute;left:3px;right:3px;background:rgba(127,208,90,.75);border:2px solid #3f7a22;border-radius:8px"></i><span class="spr fishi" style="left:50%">${o.icon || '🐟'}</span></div>
    <div class="meter" style="width:16px;height:${H}px;display:flex;align-items:flex-end"><i style="width:100%;height:30%"></i></div></div><button class="go">กดค้าง = ดึงขึ้น</button>`;
  const cb = L.area.querySelector('.cb'), fi = L.area.querySelector('.fishi'), m = L.area.querySelector('.meter i'), go = L.area.querySelector('.go');
  const set = h => { hold = h; go.classList.toggle('on', h); };
  go.onpointerdown = e => { e.preventDefault(); set(true); }; go.onpointerup = go.onpointerleave = go.onpointercancel = () => set(false);
  L.loop(dt => { if (!on) return; t -= dt;
    v += (hold ? 2.6 : -2.2) * dt; v *= .96; bar = Math.max(0, Math.min(1 - bh, bar + v * dt)); if (bar === 0 || bar === 1 - bh) v *= -.3;
    if (Math.random() < dt * (o.jumpy || 1.4)) target = Math.random(); fv += (target - fish) * dt * 6; fv *= .9; fish = Math.max(0, Math.min(1, fish + fv * dt));
    const inside = fish >= bar && fish <= bar + bh; prog = Math.max(0, Math.min(1, prog + (inside ? .16 : -.12) * dt));
    cb.style.bottom = bar * H + 'px'; cb.style.height = bh * H + 'px'; fi.style.top = (1 - fish) * H + 'px'; m.style.height = prog * 100 + '%'; m.style.background = inside ? '' : '#c8432f';
    L.t.textContent = `⏱ ${Math.max(0, t).toFixed(1)}`;
    if (prog >= 1) finish(L, 1, { caught: 1 }, o.onEnd); else if (prog <= 0 || t <= 0) finish(L, prog * .8, { caught: 0 }, o.onEnd); });
  ready(L, () => { on = true; });
};
// 3. taps — things pop up on a grid; tap them before they vanish
G.taps = (o, L) => {
  const cols = o.cols || 4, rows = o.rows || 3, N = cols * rows, need = o.need || 20; let got = 0, left = o.time || 15, on = false;
  L.area.innerHTML = `<div class="grid" style="grid-template-columns:repeat(${cols},1fr)">${'<button></button>'.repeat(N)}</div>`;
  const cells = [...L.area.querySelectorAll('button')], bad = o.bad || null;
  const pop = () => { if (!on) return; const free = cells.filter(c => !c.dataset.on); if (free.length) { const c = pick(free), isBad = bad && Math.random() < .2; c.dataset.on = isBad ? 'bad' : '1'; c.textContent = isBad ? pick(bad) : pick(o.items || ['🍂', '🥤', '🧻']);
      L.after(() => { if (c.dataset.on) { delete c.dataset.on; c.textContent = ''; } }, Math.max(700, 1500 - got * 25)); }
    L.after(pop, Math.max(250, 640 - got * 16)); };
  cells.forEach(c => c.onpointerdown = e => { e.preventDefault(); if (!c.dataset.on || !on) return; const b = c.dataset.on === 'bad'; delete c.dataset.on; c.textContent = b ? '💥' : '✨'; L.after(() => { if (!c.dataset.on) c.textContent = ''; }, 160);
    got = Math.max(0, got + (b ? -3 : 1)); snd(b ? 'dirt' : 'tick'); L.s.textContent = `ได้ ${got}`; });
  L.s.textContent = 'ได้ 0'; L.t.textContent = `⏱ ${left}`;
  ready(L, () => { on = true; pop(); pop(); L.every(() => { left--; L.t.textContent = `⏱ ${left}`; if (left <= 0) { on = false; finish(L, got / need, { got }, o.onEnd); } }, 1000); });
};
// 4. mash — alternate left/right as fast as you can
G.mash = (o, L) => {
  const need = o.need || 24; let n = 0, last = '', left = (o.time || 6) * 10, on = false;
  L.area.innerHTML = `<div class="field${L.box.classList.contains('dark') ? ' dark' : ''}" style="height:58px;margin-bottom:10px"><span class="spr" style="left:92%;top:50%">${o.goal || '🏠'}</span><span class="spr chase" style="left:6%;top:50%">${o.chaser || '👻'}</span><span class="spr me" style="left:16%;top:50%">🏃</span></div><div class="pad"><button data-f="L">ซ้าย</button><button data-f="R">ขวา</button></div>`;
  const me = L.area.querySelector('.me'), ch = L.area.querySelector('.chase');
  const draw = () => { me.style.left = (16 + n / need * 74) + '%'; ch.style.left = (6 + (1 - left / ((o.time || 6) * 10)) * 82) + '%'; L.t.textContent = `⏱ ${(left / 10).toFixed(1)}`; };
  L.area.querySelectorAll('.pad button').forEach(b => b.onpointerdown = e => { e.preventDefault(); if (!on || b.dataset.f === last) return; last = b.dataset.f; n++; snd('tick'); draw(); if (n >= need) { on = false; finish(L, 1, { n }, o.onEnd); } });
  draw(); ready(L, () => { on = true; L.every(() => { left--; draw(); if (left <= 0) { on = false; finish(L, n / need * .9, { n }, o.onEnd); } }, 100); });
};
// 5. sequence — watch the symbols light up, then repeat them in order (chants, recipes, safe dials)
G.sequence = (o, L) => {
  const sym = o.symbols || ['🌶️', '🧄', '🍋', '🧂'], len = o.len || 4, seq = Array.from({ length: len }, () => RI(0, sym.length - 1)); let i = 0, ok = 0, on = false;
  L.area.innerHTML = `<div class="ms seqmsg" style="font-weight:500">จำลำดับให้ดี…</div><div class="pad" style="flex-wrap:wrap">${sym.map((s, k) => `<button data-k="${k}" style="flex:1 0 40%">${s}</button>`).join('')}</div><div class="dots">${'<i></i>'.repeat(len)}</div>`;
  const bs = [...L.area.querySelectorAll('.pad button')], dots = L.area.querySelectorAll('.dots i'), m = L.area.querySelector('.seqmsg');
  const show = () => seq.forEach((k, j) => { L.after(() => { bs[k].classList.add('lit'); snd('tick'); }, 600 + j * 620); L.after(() => bs[k].classList.remove('lit'), 600 + j * 620 + 420); });
  show(); L.after(() => { on = true; m.textContent = o.prompt || 'ถึงตาเรา! กดตามลำดับ'; }, 700 + len * 620);
  bs.forEach(b => b.onpointerdown = e => { e.preventDefault(); if (!on) return; const k = +b.dataset.k, good = k === seq[i]; dots[i].className = good ? 'ok' : 'no'; ok += good; snd(good ? 'coin' : 'dirt'); i++;
    if (i >= len) { on = false; finish(L, ok / len, { ok }, o.onEnd); } });
};
// 6. stir — draw circles around the pot with a finger
G.stir = (o, L) => {
  const need = o.need || 8; let turns = 0, ang = null, acc = 0, left = o.time || 8, on = false;
  L.area.innerHTML = `<div class="field" style="width:240px;height:240px;margin:0 auto;border-radius:50%;background:radial-gradient(#8a5a2b 0 38%,#3b2a1c 39% 44%,#b8b0a4 45% 70%,#6e665c 71%)"><span class="spr spoon" style="left:50%;top:22%;font-size:34px">🥄</span><span class="spr" style="left:50%;top:50%;font-size:40px">${o.icon || '🍲'}</span></div><div class="meter" style="margin-top:10px"><i></i></div>`;
  const f = L.area.querySelector('.field'), sp = L.area.querySelector('.spoon'), m = L.area.querySelector('.meter i');
  const mv = e => { if (!on) return; const [x, y] = pos(e, f), a = Math.atan2(y - .5, x - .5); sp.style.left = x * 100 + '%'; sp.style.top = y * 100 + '%';
    if (ang != null) { let d = a - ang; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; acc += Math.abs(d); if (acc >= Math.PI * 2) { acc -= Math.PI * 2; turns++; snd('tick'); m.style.width = Math.min(100, turns / need * 100) + '%'; L.s.textContent = `${turns}/${need} รอบ`; if (turns >= need) { on = false; finish(L, 1, { turns }, o.onEnd); } } } ang = a; };
  f.onpointerdown = e => { f.setPointerCapture(e.pointerId); ang = null; mv(e); }; f.onpointermove = e => { if (e.buttons || e.pointerType === 'touch') mv(e); };
  L.s.textContent = `0/${need} รอบ`; L.t.textContent = `⏱ ${left}`;
  ready(L, () => { on = true; L.every(() => { left--; L.t.textContent = `⏱ ${left}`; if (left <= 0) { on = false; finish(L, turns / need, { turns }, o.onEnd); } }, 1000); });
};
// 7. catch — slide the basket to catch the good things, dodge the bad ones
G.catch = (o, L) => {
  const W = 300, H = 300; let bx = .5, items = [], got = 0, left = o.time || 14, on = false, spawn = 0;
  L.area.innerHTML = `<div class="field" style="width:${W}px;height:${H}px;max-width:100%;margin:0 auto;background:${o.bg || '#cfe2a8'}"><span class="spr bk" style="top:88%;font-size:40px">${o.basket || '🧺'}</span></div>`;
  const f = L.area.querySelector('.field'), bk = L.area.querySelector('.bk');
  const mv = e => { bx = Math.max(.08, Math.min(.92, pos(e, f)[0])); }; f.onpointerdown = e => { f.setPointerCapture(e.pointerId); mv(e); }; f.onpointermove = mv;
  L.loop(dt => { bk.style.left = bx * 100 + '%'; if (!on) return; spawn -= dt;
    if (spawn <= 0) { spawn = R(.35, .7) - Math.min(.2, got * .006); const bad = Math.random() < (o.badRate || .28); const el = document.createElement('span'); el.className = 'spr'; el.textContent = bad ? pick(o.bad || ['🪨']) : pick(o.good || ['🥚']); f.appendChild(el); items.push({ el, x: R(.08, .92), y: -.05, v: R(.35, .55) + got * .01, bad }); }
    items = items.filter(it => { it.y += it.v * dt; it.el.style.left = it.x * 100 + '%'; it.el.style.top = it.y * 100 + '%';
      if (it.y > .84 && it.y < .94 && Math.abs(it.x - bx) < .12) { it.el.remove(); got = Math.max(0, got + (it.bad ? -2 : 1)); snd(it.bad ? 'dirt' : 'coin'); L.s.textContent = `ได้ ${got}`; return false; }
      if (it.y > 1.05) { it.el.remove(); return false; } return true; }); });
  L.s.textContent = 'ได้ 0'; L.t.textContent = `⏱ ${left}`;
  ready(L, () => { on = true; L.every(() => { left--; L.t.textContent = `⏱ ${left}`; if (left <= 0) { on = false; finish(L, got / (o.need || 14), { got }, o.onEnd); } }, 1000); });
};
// 8. dodge — three lanes; tap a side to change lane and dodge what comes at you
G.dodge = (o, L) => {
  const W = 270, H = 320; let lane = 1, obs = [], hits = 0, t = o.time || 8, T0 = t, on = false, spawn = .4;
  const dark = L.box.classList.contains('dark');
  L.area.innerHTML = `<div class="field${dark ? ' dark' : ''}" style="width:${W}px;height:${H}px;max-width:100%;margin:0 auto;background:${dark ? 'linear-gradient(#0d0b14,#2a2236)' : '#d9c79c'}">
    <i style="position:absolute;left:33.3%;top:0;bottom:0;border-left:2px dashed rgba(255,255,255,.18)"></i><i style="position:absolute;left:66.6%;top:0;bottom:0;border-left:2px dashed rgba(255,255,255,.18)"></i>
    <span class="spr me" style="top:84%;font-size:36px">🏃</span><span class="spr" style="left:50%;top:6%;font-size:26px">${o.chaser || '👻'}</span></div><div class="pad" style="margin-top:10px"><button data-d="-1">◀</button><button data-d="1">▶</button></div>`;
  const f = L.area.querySelector('.field'), me = L.area.querySelector('.me');
  L.area.querySelectorAll('.pad button').forEach(b => b.onpointerdown = e => { e.preventDefault(); lane = Math.max(0, Math.min(2, lane + +b.dataset.d)); snd('tick'); });
  f.onpointerdown = e => { lane = Math.max(0, Math.min(2, Math.floor(pos(e, f)[0] * 3))); };
  L.loop(dt => { me.style.left = (lane + .5) / 3 * 100 + '%'; if (!on) return; t -= dt; spawn -= dt; L.t.textContent = `⏱ ${Math.max(0, t).toFixed(1)}`;
    if (spawn <= 0) { spawn = R(.45, .75) * (t / T0 * .5 + .5); const free = RI(0, 2); [0, 1, 2].filter(k => k !== free && Math.random() < .55).forEach(k => { const el = document.createElement('span'); el.className = 'spr'; el.textContent = pick(o.obstacles || ['🌳', '🪨', '🐍', '🕸️']); f.appendChild(el); obs.push({ el, lane: k, y: -.05 }); }); }
    obs = obs.filter(ob => { ob.y += (.55 + (1 - t / T0) * .4) * dt; ob.el.style.left = (ob.lane + .5) / 3 * 100 + '%'; ob.el.style.top = ob.y * 100 + '%';
      if (!ob.hit && ob.lane === lane && ob.y > .78 && ob.y < .9) { ob.hit = 1; hits++; snd('dirt'); f.animate([{ background: '#7a1f1f' }, { background: '' }], 250); L.s.textContent = `ชน ${hits}`; }
      if (ob.y > 1.05) { ob.el.remove(); return false; } return true; });
    if (hits >= (o.lives || 3)) { on = false; finish(L, .15, { hits }, o.onEnd); } else if (t <= 0) { on = false; finish(L, 1 - hits / (o.lives || 3) * .5, { hits }, o.onEnd); } });
  L.s.textContent = 'ชน 0';
  ready(L, () => { on = true; });
};
// 9. arrows — quick-time: press the arrow that appears before it fades
G.arrows = (o, L) => {
  const A = ['⬆️', '⬇️', '⬅️', '➡️'], n = o.n || 8; let i = 0, ok = 0, cur = -1, on = false, tmo = null;
  L.area.innerHTML = `<div class="field" style="height:110px;display:flex;align-items:center;justify-content:center;font-size:64px;background:${L.box.classList.contains('dark') ? '#1b1724' : '#fff8e8'}"><span class="big"></span></div>
    <div class="pad" style="margin-top:10px">${[2, 0, 1, 3].map(k => `<button data-k="${k}">${A[k]}</button>`).join('')}</div>`;
  const big = L.area.querySelector('.big');
  const next = () => { if (i >= n) { on = false; return finish(L, ok / n, { ok }, o.onEnd); } cur = RI(0, 3); big.textContent = A[cur]; big.animate([{ transform: 'scale(.4)' }, { transform: 'scale(1)' }], 120);
    const lim = Math.max(650, (o.limit || 1200) - i * 50); clearTimeout(tmo); tmo = setTimeout(() => { if (!on || live !== L) return; i++; snd('dirt'); L.s.textContent = `${ok}/${n}`; next(); }, lim); L.timers.push(tmo); };
  L.area.querySelectorAll('.pad button').forEach(b => b.onpointerdown = e => { e.preventDefault(); if (!on) return; const good = +b.dataset.k === cur; ok += good; snd(good ? 'coin' : 'dirt'); i++; L.s.textContent = `${ok}/${n}`; big.textContent = good ? '✅' : '❌'; clearTimeout(tmo); on = false; L.after(() => { on = true; next(); }, 220); });
  L.s.textContent = `0/${n}`; ready(L, () => { on = true; next(); });
};
// 10. hold — press and hold; let go when the gauge is in the green (pour, pry, aim)
G.hold = (o, L) => {
  const rounds = o.rounds || 3; let r = 0, hits = 0, v = 0, holding = false, on = false, zs = .62, zw = o.zone || .16;
  L.area.innerHTML = `<div class="bar" style="height:40px"><i class="zone"></i><i class="fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(200,67,47,.55)"></i></div><div class="dots">${'<i></i>'.repeat(rounds)}</div><button class="go">${o.btn || 'กดค้าง แล้วปล่อย'}</button><div class="msg"></div>`;
  const z = L.area.querySelector('.zone'), fi = L.area.querySelector('.fill'), go = L.area.querySelector('.go'), dots = L.area.querySelectorAll('.dots i'), msg = L.area.querySelector('.msg');
  const place = () => { zs = R(.35, .9 - zw); z.style.left = zs * 100 + '%'; z.style.width = zw * 100 + '%'; v = 0; fi.style.width = 0; }; place();
  go.onpointerdown = e => { e.preventDefault(); if (on) { holding = true; go.classList.add('on'); } };
  go.onpointerup = go.onpointercancel = go.onpointerleave = () => { if (!holding) return; holding = false; go.classList.remove('on'); const good = v >= zs && v <= zs + zw; hits += good; dots[r].className = good ? 'ok' : 'no'; snd(good ? 'coin' : 'dirt');
    msg.textContent = good ? pick(['พอดีเป๊ะ', 'สวย!', 'นิ่งมาก']) : v < zs ? 'ปล่อยเร็วไป' : 'เกินไปแล้ว!'; r++; on = false;
    L.after(() => { msg.textContent = ''; if (r >= rounds) finish(L, hits / rounds, { hits }, o.onEnd, 0); else { place(); on = true; } }, 520); };
  L.loop(dt => { if (holding) { v = Math.min(1, v + dt * (o.speed || .55) * (1 + r * .15)); fi.style.width = v * 100 + '%'; if (v >= 1) go.onpointerup(); } });
  ready(L, () => { on = true; });
};
// 11. pairs — flip cards and find the matching pairs before time runs out
G.pairs = (o, L) => {
  const sym = (o.symbols || ['🥚', '🌶️', '🐟', '🥬', '🌽', '🍋']).slice(0, 6), deck = [...sym, ...sym].sort(() => Math.random() - .5); let open = [], found = 0, left = o.time || 25, on = false;
  L.area.innerHTML = `<div class="grid" style="grid-template-columns:repeat(4,1fr)">${deck.map((s, k) => `<button class="flip" data-k="${k}">${s}</button>`).join('')}</div>`;
  const bs = [...L.area.querySelectorAll('button')];
  bs.forEach(b => b.onpointerdown = e => { e.preventDefault(); if (!on || !b.classList.contains('back') || open.length >= 2) return; b.classList.remove('back'); snd('tick'); open.push(b);
    if (open.length === 2) { const [a, c] = open; if (a.textContent === c.textContent) { found++; a.classList.add('done'); c.classList.add('done'); open = []; snd('coin'); L.s.textContent = `${found}/${sym.length} คู่`; if (found >= sym.length) { on = false; finish(L, 1, { found }, o.onEnd); } }
      else L.after(() => { a.classList.add('back'); c.classList.add('back'); open = []; }, 600); } });
  L.s.textContent = `0/${sym.length} คู่`; L.t.textContent = `⏱ ${left}`;
  L.after(() => bs.forEach(b => b.classList.add('back')), 1500);   // a quick peek first
  L.after(() => { on = true; L.every(() => { left--; L.t.textContent = `⏱ ${left}`; if (left <= 0) { on = false; finish(L, found / sym.length * .8, { found }, o.onEnd); } }, 1000); }, 1500);
};
// 12. sweep — drag your finger over the mess to sweep it away
G.sweep = (o, L) => {
  const W = 300, H = 260, n = o.n || 22; let left = o.time || 10, on = false, gone = 0;
  L.area.innerHTML = `<div class="field" style="width:${W}px;height:${H}px;max-width:100%;margin:0 auto;background:${o.bg || '#d9c79c'}"><span class="spr broom" style="font-size:40px;left:50%;top:50%">🧹</span></div>`;
  const f = L.area.querySelector('.field'), br = L.area.querySelector('.broom'), its = [];
  for (let i = 0; i < n; i++) { const el = document.createElement('span'); el.className = 'spr'; el.textContent = pick(o.items || ['🍂', '🍃', '🥤', '🧻']); const it = { el, x: R(.07, .93), y: R(.08, .92), hp: RI(1, 2) }; el.style.left = it.x * 100 + '%'; el.style.top = it.y * 100 + '%'; f.insertBefore(el, br); its.push(it); }
  let last = null;
  const mv = e => { const [x, y] = pos(e, f); br.style.left = x * 100 + '%'; br.style.top = y * 100 + '%'; if (!on) return; const sp = last ? Math.hypot(x - last[0], y - last[1]) : 0; last = [x, y];
    its.forEach(it => { if (it.gone || Math.hypot(it.x - x, (it.y - y) * H / W) > .1 || sp < .004) return; it.hp--; it.el.style.opacity = .5;
      if (it.hp <= 0) { it.gone = 1; gone++; snd('tick'); it.el.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: `translate(${(x < it.x ? 1 : -1) * 120}%,-50%) scale(.2)`, opacity: 0 }], 300).onfinish = () => it.el.remove(); L.s.textContent = `${gone}/${n}`; if (gone >= n) { on = false; finish(L, 1, { gone }, o.onEnd); } } }); };
  f.onpointerdown = e => { f.setPointerCapture(e.pointerId); last = null; mv(e); }; f.onpointermove = mv;
  L.s.textContent = `0/${n}`; L.t.textContent = `⏱ ${left}`;
  ready(L, () => { on = true; L.every(() => { left--; L.t.textContent = `⏱ ${left}`; if (left <= 0) { on = false; finish(L, gone / n, { gone }, o.onEnd); } }, 1000); });
};

// 13. reaction — "red light, green light": sneak forward only while it looks away; move while it watches and you're caught
G.reaction = (o, L) => {
  const need = o.need || 10; let steps = 0, look = false, on = false, left = o.time || 14, caught = false;
  const dark = L.box.classList.contains('dark');
  L.area.innerHTML = `<div class="field${dark ? ' dark' : ''}" style="height:150px;margin-bottom:10px"><span class="spr eye" style="left:50%;top:32%;font-size:54px">${o.away || '🙈'}</span>
    <span class="spr" style="left:90%;top:80%;font-size:26px">${o.goal || '🏠'}</span><span class="spr me" style="left:8%;top:80%;font-size:28px">🚶</span></div>
    <button class="go">${o.btn || 'ย่องไปข้างหน้า'}</button><div class="msg"></div>`;
  const eye = L.area.querySelector('.eye'), me = L.area.querySelector('.me'), msg = L.area.querySelector('.msg');
  const flip = () => { if (!on) return; look = !look; eye.textContent = look ? (o.watch || '👁️') : (o.away || '🙈'); msg.textContent = look ? 'มันหันมาแล้ว! อย่าขยับ!' : 'ย่องเร็ว!';
    if (look) { snd('tick'); L.after(flip, R(700, 1500)); } else L.after(flip, R(450, 1300) * (o.fast || 1)); };   // it turns back sooner and sooner
  L.area.querySelector('.go').onpointerdown = e => { e.preventDefault(); if (!on) return; if (look) { caught = true; on = false; snd('dirt'); msg.textContent = 'โดนจับได้!'; return finish(L, steps / need * .4, { caught }, o.onEnd, 600); }
    steps++; me.style.left = (8 + steps / need * 78) + '%'; snd('tick'); L.s.textContent = `${steps}/${need}`; if (steps >= need) { on = false; finish(L, 1, {}, o.onEnd); } };
  L.s.textContent = `0/${need}`; L.t.textContent = `⏱ ${left}`;
  ready(L, () => { on = true; L.after(flip, R(600, 1200)); L.every(() => { left--; L.t.textContent = `⏱ ${left}`; if (left <= 0 && on) { on = false; finish(L, steps / need * .8, {}, o.onEnd); } }, 1000); });
};
// 14. balance — keep your weight centred on a slippery bank; the push gets stronger
G.balance = (o, L) => {
  let x = 0, v = 0, push = 0, t = o.time || 9, T0 = t, on = false, hold = 0;
  L.area.innerHTML = `<div class="bar" style="height:44px;background:linear-gradient(90deg,#c8432f 0 12%,#c9b48d 12% 88%,#c8432f 88%)"><i class="zone" style="left:38%;width:24%;opacity:.55"></i><b class="pin" style="width:12px;margin-left:-6px"></b></div>
    <div class="meter" style="margin-top:10px"><i></i></div><div class="pad" style="margin-top:10px"><button data-d="-1">◀ เอียงซ้าย</button><button data-d="1">เอียงขวา ▶</button></div>`;
  const pin = L.area.querySelector('.pin'), m = L.area.querySelector('.meter i');
  L.area.querySelectorAll('.pad button').forEach(b => { b.onpointerdown = e => { e.preventDefault(); hold = +b.dataset.d; }; b.onpointerup = b.onpointerleave = b.onpointercancel = () => { if (hold === +b.dataset.d) hold = 0; }; });
  L.loop(dt => { pin.style.left = (50 + x * 50) + '%'; if (!on) return; t -= dt; const k = 1 - t / T0;
    if (Math.random() < dt * (1.2 + k * 2)) push = R(-1, 1) * (1.1 + k * 1.6) * (o.force || 1);
    v += (push + hold * 2.6 - x * .4) * dt; v *= .97; x += v * dt; m.style.width = (1 - t / T0) * 100 + '%'; L.t.textContent = `⏱ ${Math.max(0, t).toFixed(1)}`;
    if (Math.abs(x) >= .76) { on = false; snd('dirt'); finish(L, (1 - t / T0) * .7, { fell: 1 }, o.onEnd); } else if (t <= 0) { on = false; finish(L, 1, {}, o.onEnd); } });
  ready(L, () => { on = true; });
};
// 15. lockpick — a pointer circles the lock; tap when it is on the notch. Each miss makes noise; too much noise and you're heard
G.lockpick = (o, L) => {
  const pins = o.pins || 4, maxNoise = o.noise || 2; let pin = 0, ang = 0, dir = 1, sp = o.speed || 2.6, notch = R(0, Math.PI * 2), tol = o.tol || .2, noise = 0, on = false;
  L.area.innerHTML = `<div style="position:relative;width:220px;height:220px;margin:0 auto"><div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(#5b4a3a 0 30%,#c9b48d 31% 58%,#3b2a1c 59% 62%,#8a7458 63%);border:4px solid #3b2a1c"></div>
    <i class="nt" style="position:absolute;left:50%;top:50%;width:14px;height:104px;margin-left:-7px;transform-origin:50% 0;background:linear-gradient(transparent 70%,#7fb04c 70%);border-radius:7px"></i>
    <i class="ptr" style="position:absolute;left:50%;top:50%;width:6px;height:100px;margin-left:-3px;transform-origin:50% 0;background:linear-gradient(transparent 55%,#c8432f 55%);border-radius:3px"></i>
    <span class="spr" style="left:50%;top:50%;font-size:34px">🔒</span></div>
    <div class="dots">${'<i></i>'.repeat(pins)}</div><div class="ms" style="margin:6px 0 0">เสียงดัง: <b class="nz">${'○'.repeat(maxNoise + 1)}</b></div><button class="go">${o.btn || 'งัด!'}</button>`;
  const nt = L.area.querySelector('.nt'), ptr = L.area.querySelector('.ptr'), dots = L.area.querySelectorAll('.dots i'), nz = L.area.querySelector('.nz');
  const deg = a => `rotate(${a * 180 / Math.PI + 180}deg)`;
  L.loop(dt => { if (on) { ang += dir * sp * dt; if (Math.random() < dt * .35 * (o.flip || 1)) dir *= -1; } ptr.style.transform = deg(ang); nt.style.transform = deg(notch); });
  L.area.querySelector('.go').onpointerdown = e => { e.preventDefault(); if (!on) return; let d = Math.abs(((ang - notch) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (d <= tol) { dots[pin].className = 'ok'; pin++; snd('coin'); sp *= 1.18; tol *= .9; notch = R(0, Math.PI * 2); dir = Math.random() < .5 ? 1 : -1; if (pin >= pins) { on = false; finish(L, 1, { noise }, o.onEnd); } }
    else { noise++; snd('dirt'); nz.textContent = '●'.repeat(noise) + '○'.repeat(Math.max(0, maxNoise + 1 - noise)); L.box.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 160);
      if (noise > maxNoise) { on = false; finish(L, pin / pins * .5, { heard: 1 }, o.onEnd, 600); } } };
  ready(L, () => { on = true; });
};

const SUB = { timing: 'แตะตอนเข็มอยู่ในช่องเขียว', tension: 'กดค้างให้แถบเขียวลอยขึ้น คุมปลาไว้ในแถบจนหลอดเต็ม', taps: 'แตะเก็บให้ไวที่สุด', mash: 'สลับกดซ้าย–ขวาให้เร็วที่สุด!',
  sequence: 'ดูลำดับที่กระพริบ แล้วกดตามให้ถูก', stir: 'ใช้นิ้ววนรอบหม้อเป็นวงกลม', catch: 'ลากตะกร้ารับของดี หลบของเสีย', dodge: 'แตะซ้าย/ขวาเปลี่ยนเลน หลบสิ่งกีดขวาง',
  arrows: 'กดลูกศรให้ตรงกับที่ขึ้น ให้ทัน!', reaction: 'ย่องตอนมันหันไปทางอื่น ถ้ามันมองอยู่ห้ามกด!', balance: 'กดค้างเอียงตัวสู้แรงลื่น อย่าให้ตกขอบแดง', lockpick: 'แตะตอนเข็มแดงตรงช่องเขียว พลาดเสียงจะดัง', hold: 'กดค้าง แล้วปล่อยตอนแถบอยู่ในช่องเขียว', pairs: 'เปิดไพ่จับคู่ให้ครบ', sweep: 'ลากนิ้วกวาดให้เกลี้ยง' };
// difficulty: everything a notch harder than the first version (MG.diff, 1 = old feel)
MG.diff = 1.25;
const DEF = { timing: { zone: .22, speed: 1.1 }, tension: { bar: .26, jumpy: 1.4 }, taps: { need: 20 }, mash: { need: 24 }, sequence: { len: 4 }, stir: { need: 8 }, catch: { need: 14, badRate: .28 },
  dodge: { time: 8 }, arrows: { n: 8, limit: 1200 }, hold: { zone: .16, speed: .55 }, pairs: { time: 25 }, sweep: { n: 22 }, reaction: { need: 10, fast: 1 }, balance: { force: 1 }, lockpick: { speed: 2.6, tol: .2 } };
function harden(kind, o) { const D = MG.diff, d = DEF[kind] || {}, g = k => o[k] != null ? o[k] : d[k], r = Object.assign({}, o);
  ({ timing: () => { r.zone = g('zone') / D; r.speed = g('speed') * D; }, tension: () => { r.bar = g('bar') / D; r.jumpy = g('jumpy') * D; }, taps: () => { r.need = Math.ceil(g('need') * D); },
    mash: () => { r.need = Math.ceil(g('need') * D); }, sequence: () => { r.len = g('len') + 1; }, stir: () => { r.need = g('need') + 2; }, catch: () => { r.need = Math.ceil(g('need') * D); r.badRate = Math.min(.45, g('badRate') * D); },
    dodge: () => { r.time = g('time') * D; }, arrows: () => { r.n = g('n') + 2; r.limit = g('limit') / D; }, hold: () => { r.zone = g('zone') / D; r.speed = g('speed') * D; }, pairs: () => { r.time = Math.round(g('time') / D); },
    sweep: () => { r.n = Math.ceil(g('n') * D); }, reaction: () => { r.need = Math.ceil(g('need') * D); r.fast = 1 / D; }, balance: () => { r.force = g('force') * D; }, lockpick: () => { r.speed = g('speed') * D; r.tol = g('tol') / D; } }[kind] || (() => {}))();
  return r; }
MG.kinds = Object.keys(G);
MG.play = (kind, o = {}) => { const L = frame({ title: o.title || '', sub: o.sub || SUB[kind] || '', dark: o.dark, w: o.w || 330 }); try { G[kind](o.easy ? o : harden(kind, o), L); } catch (e) { console.error(e); finish(L, .5, {}, o.onEnd, 0); } };
// a random game from the pool (not the same as last time for this activity); per-kind overrides in o.per[kind]
MG.pick = (pool, o = {}) => { const key = o.key || pool.join(); let opts = pool.filter(k => k !== lastKind[key]); if (!opts.length) opts = pool; const k = pick(opts); lastKind[key] = k;
  MG.play(k, Object.assign({}, o, (o.per || {})[k] || {}, { sub: ((o.per || {})[k] || {}).sub || SUB[k] })); return k; };
})();
