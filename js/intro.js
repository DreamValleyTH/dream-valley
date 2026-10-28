// Dream Valley — title intro: the camera drifts down from the sky onto the valley, the logo drops in, then
// เริ่มเกมใหม่ → character creation · เล่นต่อ → back up through the clouds and down onto grandma's farm · อัปเดต → paper scroll.
(() => {
'use strict';
const DV = window.DV, $ = DV.$;
const root = $('title'), cv = $('tiCv'), ctx = cv.getContext('2d'), cur = $('tiCurtain'), cctx = cur.getContext('2d');
const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = s; });
let IM = null, W = 0, H = 0, sc = 1;
function size() {
  const d = devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  for (const c of [cv, cur]) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  for (const c of [ctx, cctx]) { c.setTransform(d, 0, 0, d, 0, 0); c.imageSmoothingEnabled = false; }
  sc = Math.max(1, Math.round(Math.max(W / 480, H * .62 / 270) * 2) / 2);
}
addEventListener('resize', size); size();
const C = Array.from({ length: 9 }, (_, i) => ({ x: Math.random(), y: Math.random() * 1.6, s: .6 + Math.random() * .9, v: 4 + Math.random() * 8, k: i }));
const B = Array.from({ length: 5 }, (_, i) => ({ x: -.1 - i * .05, y: .2 + Math.random() * .2, d: i * .7, v: 28 + Math.random() * 8 }));
const motes = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6 }));
const ease = t => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3), inout = t => t < 0 ? 0 : t > 1 ? 1 : t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// camera: 0 = top of the sky, 1 = resting on the valley
let camF = 0, tw = null, mode = 'intro', curtainA = 0, ready = false, running = true, stageSet = 0;
const tween = (from, to, dur, fn, done, curve = inout) => { tw = { from, to, dur, fn, done, t0: performance.now(), curve }; };
const T0 = performance.now();
function frame(now) {
  const t = (now - T0) / 1000;
  if (mode === 'intro') camF = ease((t - .6) / 3.6);
  if (tw) { const k = Math.min(1, (now - tw.t0) / 1000 / tw.dur); tw.fn(tw.from + (tw.to - tw.from) * tw.curve(k)); if (k >= 1) { const f = tw.done; tw = null; f && f(); } }
  if (IM) { if (mode !== 'reveal') draw(t); drawCurtain(t); }
  if (mode === 'intro') {
    if (t > 2.6 && stageSet < 1) { root.classList.add('show-logo'); stageSet = 1; }
    if (t > 3.7 && stageSet < 2) { root.classList.add('show-sub'); stageSet = 2; }
    if (t > 4.4 && ready) toMenu();
  }
  if (running) requestAnimationFrame(frame);
}
function draw(t) {
  const landH = 270 * sc, skyH = H * 1.9, cam = (skyH + landH - H) * camF;
  const g = ctx.createLinearGradient(0, -cam, 0, skyH - cam);
  g.addColorStop(0, '#2c3a6b'); g.addColorStop(.35, '#5d79b4'); g.addColorStop(.7, '#9cc3d9'); g.addColorStop(1, '#cce0dd');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sy = skyH + 60 * sc - cam, rg = ctx.createRadialGradient(W * .62, sy, 4, W * .62, sy, W * .7);
  rg.addColorStop(0, 'rgba(255,236,170,.75)'); rg.addColorStop(.3, 'rgba(255,214,140,.25)'); rg.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  for (const c of C) { const im = IM.clouds[c.k % 3], s = Math.max(1, Math.round(sc * c.s)), x = ((c.x * (W + 200) + t * c.v) % (W + 200)) - 100, y = c.y * skyH * .9 - cam;
    ctx.globalAlpha = .92; ctx.drawImage(im, Math.round(x), Math.round(y), im.width * s, im.height * s); ctx.globalAlpha = 1; }
  const lw = 480 * sc, lx = Math.round((W - lw) / 2), ly = Math.round(skyH - cam), land = IM.land;
  ctx.drawImage(land, lx, ly, lw, landH);
  if (lw < W) { ctx.drawImage(land, 0, 0, 1, 270, 0, ly, lx, landH); ctx.drawImage(land, 479, 0, 1, 270, lx + lw, ly, W - lx - lw, landH); }
  if (ly + landH < H) { ctx.drawImage(land, 0, 269, 480, 1, lx, ly + landH, lw, H - ly - landH); }
  const fg = ctx.createLinearGradient(0, ly - 2, 0, ly + 70 * sc); fg.addColorStop(0, 'rgba(204,224,221,1)'); fg.addColorStop(1, 'rgba(204,224,221,0)'); ctx.fillStyle = fg; ctx.fillRect(0, ly - 2, W, 70 * sc);
  for (const b of B) { const im = IM.birds[Math.floor((t * 6 + b.d * 3) % 2)], x = ((b.x + (t - b.d) * b.v / 400) % 1.3) * W, y = (skyH * .55 + b.y * 260 * sc) - cam + Math.sin(t * 2 + b.d) * 6, s = Math.max(1, Math.round(sc * .9));
    ctx.drawImage(im, Math.round(x), Math.round(y), im.width * s, im.height * s); }
  ctx.fillStyle = 'rgba(255,246,200,.8)';
  for (const m of motes) { const x = (m.x * W + Math.sin(t * .6 + m.p) * 14) % W, y = H * (.35 + m.y * .6) + Math.cos(t * .5 + m.p) * 10; if ((t * 2 + m.p) % 6 < 4) ctx.fillRect(Math.round(x), Math.round(y), 2, 2); }
}
// a wall of big clouds that rolls in from both sides and parts again
function drawCurtain(t) {
  cctx.clearRect(0, 0, W, H); if (curtainA <= 0) return;
  const im = IM.clouds[0], s = Math.max(4, Math.round(sc * 2.6)), cw = im.width * s, ch = im.height * s, cols = W / (cw * .55);
  for (let row = -1; row < H / (ch * .45) + 1; row++) for (let i = -1; i < cols + 1; i++) {
    const side = i < cols / 2 ? -1 : 1, off = (1 - curtainA) * W * .9 * side;
    const x = i * cw * .55 + (row % 2) * cw * .27 + off + Math.sin(t + row) * 6, y = row * ch * .45;
    cctx.drawImage(IM.clouds[(i + row + 3) % 3], Math.round(x), Math.round(y), cw, ch);
  }
  cctx.fillStyle = `rgba(240,244,255,${Math.max(0, curtainA - .55) * 2})`; cctx.fillRect(0, 0, W, H);
}

// ---------- menu ----------
const last = () => DV.lastLogin && DV.lastLogin();
function toMenu() {
  if (mode !== 'intro') return;
  root.classList.add('show-logo', 'show-sub', 'show-menu'); stageSet = 3; mode = 'menu'; camF = 1; $('tiSkip').style.display = 'none';
  const l = last(); $('tiWho').innerHTML = l ? `เล่นต่อเป็น <b>${esc(l.name)}</b> · <a id="tiSwitch">ใช้ชื่ออื่น</a>` : '';
  const sw = $('tiSwitch'); if (sw) sw.onclick = () => openPanel('cont');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
root.addEventListener('pointerdown', e => { if (mode === 'intro' && !e.target.closest('button') && camF > .05) { if (ready) toMenu(); else { camF = 1; mode = 'wait'; root.classList.add('show-logo', 'show-sub'); } } });

// ---------- character creation / login panel ----------
let gender = 'm', dayLen = 10, panel = 'new', confirmOverwrite = false;
const GN = { m: 'ผู้ชาย', f: 'ผู้หญิง' }, pctx = $('tiPv').getContext('2d'); pctx.imageSmoothingEnabled = false;
let pvIm = {};
setInterval(() => { if (panel !== 'new' || !root.classList.contains('creating')) return; const im = pvIm[gender]; if (!im) return;
  const f = 6 + Math.floor(performance.now() / 400) % 4; pctx.clearRect(0, 0, 64, 64); pctx.drawImage(im, f * 64, 0, 64, 64, 0, 2, 64, 64); }, 100);
document.querySelectorAll('.ti-arrow').forEach(b => b.onclick = () => { gender = gender === 'm' ? 'f' : 'm'; $('tiGname').textContent = GN[gender]; DV.sfx && DV.sfx('tick'); });
document.querySelectorAll('.ti-days button').forEach(b => b.onclick = () => { document.querySelectorAll('.ti-days button').forEach(x => x.classList.toggle('on', x === b)); dayLen = +b.dataset.m; });
const err = t => { $('loginErr').textContent = t; };
$('pcode').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6); });
$('genCode').onclick = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += A[Math.floor(Math.random() * A.length)]; $('pcode').value = c; };
function openPanel(kind) {
  panel = kind; mode = 'panel'; confirmOverwrite = false; err('');
  const isNew = kind === 'new';
  $('tiPanelH').textContent = isNew ? 'สร้างตัวละคร' : 'เล่นต่อ';
  $('newOnly').classList.toggle('hidden', !isNew); $('dlRow').classList.toggle('hidden', !isNew);
  $('startBtn').textContent = isNew ? 'ไปบ้านยาย' : 'เข้าเล่นต่อ';
  const l = last(); if (isNew) { $('pname').value = ''; $('pcode').value = ''; } else if (l) { $('pname').value = l.name; $('pcode').value = l.code; }
  const p = $('tiCreate'); p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  root.classList.add('out', 'creating');
}
$('tiBack').onclick = () => { root.classList.remove('out', 'creating'); mode = 'menu'; };
$('startBtn').onclick = async () => {
  const name = $('pname').value.trim(), code = $('pcode').value.trim().toUpperCase();
  if (!name) return err('ใส่ชื่อเล่นก่อนนะ');
  if (!/^[A-Za-z0-9]{6}$/.test(code)) return err('รหัสต้องเป็นตัวอักษร/ตัวเลข 6 ตัว (กดสุ่มก็ได้)');
  $('startBtn').disabled = true; err('กำลังโหลด…');
  const ex = await DV.loadSlot(name, code);
  $('startBtn').disabled = false;
  if (panel === 'cont') { if (!ex) return err('ไม่พบเซฟของชื่อ + รหัสนี้ ลองเช็กตัวสะกดอีกครั้ง'); err(''); root.classList.remove('creating'); return dive(ex, false); }
  if (ex && !confirmOverwrite) { confirmOverwrite = true; return err(`มีเซฟชื่อ + รหัสนี้อยู่แล้ว (วันที่ ${ex.day}) กดอีกครั้งเพื่อเริ่มใหม่ทับ`); }
  err(''); root.classList.remove('creating'); dive(DV.newState(name, code, gender, dayLen), true);
};

// ---------- เล่นต่อ / start: up into the sky, through the clouds, down onto grandma's farm ----------
function dive(state, fresh) {
  mode = 'dive'; root.classList.add('out'); DV.sfx && DV.sfx('tick');
  let z0 = 1; try { z0 = parseFloat(localStorage.getItem('dv3_zoom')) || 1; } catch (_) {}
  tween(camF, 0, 1.4, v => camF = v, () => tween(0, 1, .7, v => curtainA = v, () => {
    mode = 'reveal'; DV.begin(state, fresh, fresh ? 4200 : 3000);   // the world is built behind the clouds
    DV.setZoom(z0 * 1.8, null, null, true);
    const a = document.createElement('div'); a.id = 'tiArrive'; document.body.appendChild(a);
    const s = DV.S; a.textContent = `${s.map === 'farm' || !s.map ? 'ฟาร์มยาย' : 'บ้านดงเย็น'} · วันที่ ${s.day} · ${DV.fmt(s.min)}`;
    setTimeout(() => tween(1, 0, 1.8, v => { curtainA = v; DV.setZoom(z0 * (1 + .8 * v), null, null, true); }, () => {
      a.classList.add('on'); running = false; cctx.clearRect(0, 0, W, H); cur.remove();
      setTimeout(() => { a.classList.remove('on'); setTimeout(() => a.remove(), 600); }, 1800);
    }, ease), 150);
  }));
}

// ---------- อัปเดต: a paper scroll rises from the bottom and unrolls; ม้วนเก็บ rolls it down again ----------
const scroll = $('tiScroll'), paper = $('tiPaper');
function openScroll() {
  const L = window.DV_CHANGELOG || [];
  paper.innerHTML = '<button class="close">ม้วนเก็บ</button><h3>อัปเดตเกม</h3>' + L.map(c => `<h4>v${c.v} · ${c.title}</h4><ul>${c.items.map(x => `<li>${x}</li>`).join('')}</ul>`).join('');
  paper.querySelector('.close').onclick = () => { paper.style.maxHeight = paper.offsetHeight + 'px'; paper.scrollTop = 0; void paper.offsetHeight; scroll.classList.remove('on'); paper.style.maxHeight = ''; mode = 'menu'; };
  scroll.classList.add('on'); mode = 'scroll';
  try { localStorage.setItem(DV.CL_KEY, L[0].v); } catch (e) {} $('clDot').classList.add('hidden');
}
document.querySelectorAll('#tiMenu button').forEach(b => b.onclick = async () => {
  if (mode !== 'menu') return;
  DV.sfx && DV.sfx('tick');
  if (b.dataset.a === 'new') openPanel('new');
  if (b.dataset.a === 'upd') openScroll();
  if (b.dataset.a === 'cont') {
    const l = last(); if (!l) return openPanel('cont');
    mode = 'loading'; $('tiWho').textContent = 'กำลังโหลดเซฟ…';
    const ex = await DV.loadSlot(l.name, l.code);
    if (!ex) { mode = 'menu'; toMenuWho(); return openPanel('cont'); }
    dive(ex, false);
  }
});
const toMenuWho = () => { const l = last(); $('tiWho').innerHTML = l ? `เล่นต่อเป็น <b>${esc(l.name)}</b> · <a id="tiSwitch">ใช้ชื่ออื่น</a>` : ''; const sw = $('tiSwitch'); if (sw) sw.onclick = () => openPanel('cont'); };

// ---------- boot hooks (called from main.js) ----------
DV.introReady = () => { ready = true; $('loading').classList.add('hidden'); if (mode === 'wait') { mode = 'intro'; toMenu(); } };
const L = window.DV_CHANGELOG || [];
$('tiVer').textContent = L.length ? 'v' + L[0].v : '';
if (DV.clUnseen && DV.clUnseen()) $('clDot').classList.remove('hidden');
Promise.all(['land', 'cloud_0', 'cloud_1', 'cloud_2', 'bird_0', 'bird_1'].map(n => load(`assets/intro/${n}.png`)).concat([load('assets/chars/player_m.png'), load('assets/chars/player_f.png')]))
  .then(([land, c0, c1, c2, b0, b1, pm, pf]) => { IM = { land, clouds: [c0, c1, c2], birds: [b0, b1] }; pvIm = { m: pm, f: pf }; requestAnimationFrame(frame); });
})();
