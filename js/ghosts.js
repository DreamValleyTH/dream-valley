// Dream Valley — ghost encounters (v1.7): the night closes in, a scene fades up (swamp / forest / rice field),
// then a ghost cut out from its background comes out at you — each kind with its own entrance — and lunges "out of the screen".
// Pure JS + Web Animations. window.GS.play({ id, bg, level, base, onReady(api) }) ; api.say(html) / api.end()
(() => {
'use strict';
const GS = window.GS = window.GS || {};
GS.LIST = [   // each ghost: its legendary place, its own entrance (move) and its own way out (a minigame)
  { id: 'krasue', name: 'ผีกระสือ', bg: 'swamp', place: 'ริมหนองน้ำท้ายหมู่บ้าน', move: 'float', line: 'หัวผู้หญิงลอยต่ำเรี่ยน้ำ ไส้ห้อยระย้า… แล้วมันก็หันมาสบตา',
    act: { label: '🏃 วิ่งเลาะคันนา หลบไส้ที่ห้อยระย้า', kind: 'dodge', o: { time: 9, lives: 3, obstacles: ['🫀', '🦴', '🕸️', '🌿', '🪨'], sub: 'แตะซ้าย/ขวาเปลี่ยนเลน หลบให้พ้น!' } } },
  { id: 'pop', name: 'ผีปอบ', bg: 'pop', place: 'ใต้ถุนบ้านไม้เก่า', move: 'peek', line: 'ยายแก่ผมกระเซิงแสยะยิ้มฟันดำ “ตับหลาน… หอมจัง”',
    act: { label: '🛕 วิ่งสุดแรงไปวัด! (ปอบกลัววัด)', kind: 'mash', o: { need: 26, time: 6, goal: '🛕', sub: 'สลับกดซ้าย–ขวาให้เร็วที่สุด!' } } },
  { id: 'krahang', name: 'ผีกระหัง', bg: 'field', place: 'กลางทุ่งนา', move: 'fly', line: 'เสียงกระด้งตีลมพึ่บพั่บ ผู้ชายขี่สากโฉบต่ำมาจนผมปลิว',
    act: { label: '🙇 ก้มหลบกระด้งที่โฉบลงมา', kind: 'arrows', o: { n: 9, limit: 1000, sub: 'มันโฉบมาทางไหน กดหลบทางนั้นให้ทัน!' } } },
  { id: 'pret', name: 'เปรต', bg: 'pret', place: 'ลานวัดเก่า', move: 'rise', line: 'ร่างผอมสูงเท่าต้นตาลค่อย ๆ ยืดขึ้นจากหมอก ส่งเสียงหวีดจากปากเท่ารูเข็ม “ขอส่วนบุญ…”',
    act: { label: '💧 กรวดน้ำอุทิศส่วนบุญให้', kind: 'hold', pass: .99, o: { rounds: 3, zone: .15, btn: 'กดค้าง = รินน้ำ แล้วปล่อย', sub: 'รินน้ำให้พอดีขีด อย่าให้ขาดหรือล้น' } } },
  { id: 'kumanthong', name: 'กุมารทอง', bg: 'kumanthong', place: 'หิ้งบูชาในบ้านร้าง', move: 'peek', line: 'เด็กตัวทองโผล่จากหลังหิ้ง ตาขาวโพลน “มาเล่นด้วยกันนะ…”',
    act: { label: '🧸 ยอมเล่นด้วย (จับคู่ของเล่น)', kind: 'pairs', o: { symbols: ['🪀', '🧸', '🍬', '🎈', '🪁', '🥁'], time: 26, sub: 'เปิดไพ่จับคู่ให้ครบก่อนหมดเวลา' } } },
  { id: 'kongkoi', name: 'ผีกองกอย', bg: 'kongkoi', place: 'ป่าลึกริมลำธาร', move: 'hop', line: '“กองกอย! กองกอย!” อะไรบางอย่างกระโดดขาเดียวตรงเข้ามา',
    act: { label: '🦘 กระโดดข้ามรากไม้หนีตามจังหวะ', kind: 'timing', o: { rounds: 5, zone: .2, speed: 1.2, shrink: .88, btn: 'กระโดด!', sub: 'กระโดดตอนเข็มอยู่ในช่องเขียว' } } },
  { id: 'chaothi', name: 'ผีเจ้าที่', bg: 'chaothi', place: 'หน้าศาลพระภูมิ', move: 'float', line: 'ร่างโปร่งแสงลอยออกจากศาล “มาอยู่ตั้งนาน ไม่เคยไหว้!”',
    act: { label: '🌺 ถวายของขอขมาให้ถูกลำดับ', kind: 'sequence', pass: .99, o: { symbols: ['🌺', '🕯️', '🍌', '💧'], len: 5, prompt: 'วางของถวายตามลำดับที่ท่านชี้!' } } },
  { id: 'kokhad', name: 'ผีคอขาด', bg: 'kokhad', place: 'ทางรถไฟร้าง', move: 'peek', line: 'ทหารไร้หัวยื่นหัวตัวเองมาให้ดู หัวนั้นยิ้มแล้วกระพริบตา',
    act: { label: '🤫 ย่องหนีตอนหัวมองไปทางอื่น', kind: 'reaction', o: { need: 11, time: 15, away: '🙈', watch: '👁️', goal: '🏠', btn: 'ย่อง…' } } },
  { id: 'taithongklom', name: 'ผีตายทั้งกลม', bg: 'forest', place: 'ใต้ต้นตะเคียนริมคลอง', move: 'float', line: 'เสียงสะอื้นใต้ต้นตะเคียน… หญิงท้องโตในชุดขาวค่อย ๆ หันมา',
    act: { label: '⚖️ เดินเลาะตลิ่งลื่นหนีให้พ้น', kind: 'balance', o: { time: 9, sub: 'กดค้างเอียงตัวสู้แรงลื่น อย่าตกคลอง!' } } },
];
GS.BG = ['swamp', 'forest', 'field'];
const css = `
#scare{position:fixed;inset:0;z-index:55;overflow:hidden;background:#000;opacity:0;font-family:"Mitr","Leelawadee UI",system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none}
#scare.hidden{display:none}
#scare .sb{position:absolute;z-index:0;inset:-6%;background:#05040a center/cover no-repeat;image-rendering:pixelated;filter:brightness(.0) saturate(.7);will-change:transform,filter}
#scare .fog{position:absolute;z-index:1;inset:-20%;pointer-events:none;opacity:.55;background:radial-gradient(ellipse at 30% 70%,rgba(200,210,230,.22),transparent 45%),radial-gradient(ellipse at 75% 80%,rgba(200,210,230,.18),transparent 50%),radial-gradient(ellipse at 50% 95%,rgba(220,225,240,.25),transparent 55%);animation:gsfog 14s linear infinite alternate}
@keyframes gsfog{from{transform:translateX(-6%)}to{transform:translateX(6%)}}
#scare .vig{position:absolute;z-index:3;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 55%,transparent 25%,rgba(0,0,0,.55) 60%,rgba(0,0,0,.96) 100%)}
#scare .red{position:absolute;z-index:4;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,transparent 30%,rgba(120,0,0,.55));opacity:0}
#scare .gw{position:absolute;z-index:2;left:50%;top:52%;width:min(78vw,60vh);aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none}
#scare .gsg{position:absolute;inset:0;background:center/contain no-repeat;image-rendering:pixelated;opacity:0;will-change:transform,opacity,filter}
#scare .flash{position:absolute;z-index:5;inset:0;background:#fff;opacity:0;pointer-events:none}
#scare .pl{position:absolute;z-index:6;left:0;right:0;bottom:22%;text-align:center;font-size:17px;color:#d9cfe6;letter-spacing:.08em;text-shadow:0 2px 6px #000;opacity:0}
#scare .nm{position:absolute;z-index:6;top:max(22px,env(safe-area-inset-top));left:0;right:0;text-align:center;font-size:30px;font-weight:600;color:#ffe3e3;letter-spacing:.06em;text-shadow:0 3px 0 #000,0 0 22px #b3001b;opacity:0}
#scare .say{position:absolute;z-index:7;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translate(-50%,130%);width:min(420px,94vw);background:#f6ead2;color:#33251a;border:4px solid #3b2a1c;border-radius:16px;padding:14px;box-shadow:0 8px 0 rgba(0,0,0,.4);transition:transform .35s cubic-bezier(.2,1.2,.4,1)}
#scare .say.on{transform:translate(-50%,0)}
#scare .say h2{margin:0 0 4px;font-size:19px}#scare .say p{margin:0 0 8px;font-size:14px;color:#6b5440;line-height:1.5}
#scare .say button{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px;border-radius:10px;border:2px solid #cdb68c;background:#fff8e8;font:500 15px inherit;font-family:inherit;color:#33251a}
#scare .say button small{display:block;font-size:12px;color:#6b5440;font-weight:400}
#scare .skip{position:absolute;right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));color:rgba(255,255,255,.35);font-size:12px}
`;
let root = null, ac = null, live = null;
function ensure() { if (root) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  root = document.createElement('div'); root.id = 'scare'; root.className = 'hidden'; document.body.appendChild(root); }
// ---- sound: made on the fly ----
const A = () => { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} if (ac && ac.state === 'suspended') ac.resume(); return ac; };
function tone(f, d, type, v, slide = 0, at = 0) { const a = A(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, f + slide), t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .05); }
function noise(d, v, at = 0, freq = 900, q = 1) { const a = A(); if (!a) return; const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; s.buffer = b; g.gain.value = v; s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + at); }
const heart = (at, v) => { tone(60, .16, 'sine', v, -20, at); tone(55, .18, 'sine', v * .8, -20, at + .2); };
function drone(sec, v) { tone(48, sec, 'sawtooth', v * .35, 6); tone(73, sec, 'sine', v * .5, -8); noise(sec, v * .25, 0, 300, .7); }
function sting(v, kind) { [0, 3, 6, 10].forEach(k => tone(330 * Math.pow(2, k / 12), 1.3, 'sawtooth', v * .22, -260, 0)); tone(42, 1.6, 'sine', v * 1.4, -12); noise(.5, v * 1.1, 0, 1400, .6);
  tone(1800, .7, 'square', v * .12, -1500, .02); if (kind === 'hop') [0, .12, .24].forEach(t => noise(.08, v * .6, t, 300, 2)); if (kind === 'fly') noise(.9, v * .6, 0, 500, .5); }
// ---- the encounter ----
const LV = { soft: { snd: .08, flash: 0, shake: 5, out: 1.8 }, mid: { snd: .18, flash: .7, shake: 16, out: 2.7 }, max: { snd: .28, flash: .95, shake: 28, out: 3.4 } };
const FR = 9;   // frames in each ghost's PixelLab scare animation strip (an_<id>.png)
GS.play = ({ id, bg, level = 'mid', base = '', onReady } = {}) => {
  ensure(); const L = LV[level] || LV.mid, G = GS.LIST.find(g => g.id === id) || GS.LIST[Math.floor(Math.random() * GS.LIST.length)];
  bg = bg || G.bg;
  const strip = `${base}assets/ghosts/an_${G.id}.png`;
  root.innerHTML = `<div class="sb" style="background-image:url(${base}assets/ghosts/bg_${bg}.png)"></div><div class="fog"></div>
    <div class="gw"><div class="gsg m" style="background-image:url(${strip});background-size:${FR * 100}% 100%;background-position:0 0"></div></div>
    <div class="vig"></div><div class="red"></div><div class="flash"></div><div class="pl">${G.place}</div><div class="nm">${G.name}</div><div class="say"></div>`;
  root.classList.remove('hidden'); A();
  { const im = new Image(); im.onload = () => { const r = im.naturalWidth / FR / im.naturalHeight, g = root.querySelector('.gw'); if (g) { g.style.aspectRatio = r; g.style.width = `min(80vw, ${Math.round(62 * r)}vh)`; } }; im.src = strip; }
  const q = s => root.querySelector(s), sb = q('.sb'), gw = q('.gw'), gm = q('.gsg.m'), fl = q('.flash'), nm = q('.nm'), red = q('.red'), say = q('.say'), pl = q('.pl');
  const me = live = { stop: false, anims: [] };
  const an = (el, k, o) => { const a = el.animate(k, o); me.anims.push(a); return a; };
  const at = (f, ms) => setTimeout(() => { if (live === me && !me.stop) f(); }, ms);
  const frame = i => { gm.style.backgroundPosition = `${i / (FR - 1) * 100}% 0`; };
  // 1. the night closes in, the place fades up out of the dark, a heartbeat
  an(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: 'forwards' });
  an(sb, [{ filter: 'brightness(0) saturate(.6)', transform: 'scale(1)' }, { filter: 'brightness(.66) saturate(.8)', transform: 'scale(1.07)' }], { duration: 2800, delay: 300, fill: 'forwards', easing: 'ease-out' });
  an(pl, [{ opacity: 0 }, { opacity: .85, offset: .3 }, { opacity: .85, offset: .75 }, { opacity: 0 }], { duration: 2600, delay: 600, fill: 'forwards' });
  drone(3.8, L.snd); [0, .9, 1.65, 2.25, 2.7, 3.05, 3.35].forEach(t => heart(t, L.snd * 1.6));
  // 2. something moves out there — every ghost comes in its own way (still frame 0)
  const enter = {
    float: [{ transform: 'translate(-30%,10%) scale(.16)', opacity: 0, filter: 'blur(5px)' }, { transform: 'translate(-10%,4%) scale(.28)', opacity: .85, offset: .55 }, { transform: 'translate(6%,-2%) scale(.38)', opacity: 1, filter: 'blur(0)' }],
    peek: [{ transform: 'translate(75%,10%) scale(.5)', opacity: 0 }, { transform: 'translate(48%,6%) scale(.5)', opacity: 1, offset: .35 }, { transform: 'translate(48%,6%) scale(.5)', opacity: 1, offset: .75 }, { transform: 'translate(40%,4%) scale(.55)', opacity: 1 }],
    fly: [{ transform: 'translate(-130%,-40%) scale(.28) rotate(-25deg)', opacity: 1 }, { transform: 'translate(60%,-20%) scale(.34) rotate(18deg)', offset: .55 }, { transform: 'translate(10%,0) scale(.42) rotate(-4deg)', opacity: 1 }],
    rise: [{ transform: 'translate(0,60%) scale(.45,.05)', opacity: 0 }, { transform: 'translate(0,20%) scale(.45,.6)', opacity: .8, offset: .5 }, { transform: 'translate(0,-4%) scale(.5,1)', opacity: 1 }],
    hop: [{ transform: 'translate(-60%,20%) scale(.18)', opacity: 0 }, { transform: 'translate(-40%,-8%) scale(.22)', opacity: 1, offset: .2 }, { transform: 'translate(-24%,18%) scale(.26)', offset: .4 }, { transform: 'translate(-8%,-6%) scale(.32)', offset: .6 }, { transform: 'translate(4%,16%) scale(.38)', offset: .8 }, { transform: 'translate(0,0) scale(.44)', opacity: 1 }],
  }[G.move];
  at(() => { frame(0); tone(900, .4, 'sine', L.snd * .25, -500); an(gm, enter, { duration: 1600, easing: 'ease-in-out', fill: 'forwards' }); }, 2600);
  // 3. the scare: its own PixelLab animation plays while it rushes out of the screen at you
  at(() => {
    const k = L.out; let f = 0; const tk = setInterval(() => { if (live !== me) return clearInterval(tk); frame(Math.min(FR - 1, ++f)); if (f >= FR - 1) clearInterval(tk); }, 95);
    an(gm, [{ transform: getComputedStyle(gm).transform, opacity: 1 }, { transform: `translate(0,8%) scale(${k})`, opacity: 1, offset: .38 }, { transform: `translate(0,5%) scale(${k * .88})`, opacity: 1, offset: .58 }, { transform: 'translate(0,0) scale(1.08)', opacity: 1 }],
      { duration: 1150, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' });
    if (L.flash) { an(fl, [{ opacity: L.flash }, { opacity: 0 }], { duration: 240 }); an(red, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: .3 }], { duration: 1600, fill: 'forwards' }); }
    const sh = []; for (let i = 0; i < 10; i++) sh.push({ transform: `translate(calc(-50% + ${(Math.random() - .5) * L.shake}px),calc(-50% + ${(Math.random() - .5) * L.shake}px))` }); sh.push({ transform: 'translate(-50%,-50%)' });
    an(gw, sh, { duration: 540 }); an(sb, [{ filter: 'brightness(1.3) saturate(.4)' }, { filter: 'brightness(.45) saturate(.7)' }], { duration: 700, fill: 'forwards' });
    sting(L.snd, G.move); if (navigator.vibrate && level !== 'soft') try { navigator.vibrate(level === 'max' ? [90, 40, 160] : 60); } catch (_) {}
    an(nm, [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400, delay: 500, fill: 'forwards' });
  }, 4400);
  // 4. after the scare it just floats there, still — and you have to decide
  at(() => {
    frame(FR - 1);
    an(gw, [{ transform: 'translate(-50%,-50%)' }, { transform: 'translate(-50%,-51.6%)' }], { duration: 2200, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    const api = { ghost: G, bg, say: html => { say.innerHTML = html; say.classList.add('on'); return say; }, hideSay: () => say.classList.remove('on'), end: GS.end };
    onReady ? onReady(api) : api.say(`<h2>${G.name}!</h2><p>${G.line}</p><button>ปิด</button>`).querySelector('button').onclick = GS.end;
  }, 5800);
  return G;
};
// the whole encounter, shared by the game and the mockup: scare → choose → that ghost's own minigame → onDone(ok, text, energyCost)
GS.encounter = ({ id, level, base = '', luck = 0, onDone }) => {
  const MG = window.MG;
  return GS.play({ id, level, base, onReady: api => { const G = api.ghost, a = G.act, pr = Math.min(.8, .3 + luck);
    const c = api.say(`<h2>${G.name}!</h2><p>${G.line}</p><button data-c="act">${a.label}<small>มินิเกม · รอด = แรง −6 · พลาด = แรง −35</small></button>
      <button data-c="pray">🙏 หลับตาภาวนา (วัดดวง)<small>โอกาสรอด ${Math.round(pr * 100)}%${luck ? ' · มีผ้ายันต์/ไหว้ศาลมา' : ' · ไหว้ศาลพระภูมิหรือเช่าผ้ายันต์จะดีขึ้น'} · พลาด = แรง −40</small></button>`);
    const end = (ok, win, lose, ew, el) => { GS.end(); setTimeout(() => onDone && onDone(ok, ok ? win : lose, ok ? ew : el), 450); };
    c.onclick = e => { const b = e.target.closest('button'); if (!b) return; api.hideSay();
      if (b.dataset.c === 'pray') return setTimeout(() => end(Math.random() < pr, `ลมเย็นพัดผ่าน ${G.name}ค่อย ๆ จางหายไปในหมอก`, 'ลืมตามา… มันยังอยู่ตรงหน้า หัวเราะคิกคัก ขาอ่อนจนทรุด', 3, 40), 700);
      MG.play(a.kind, Object.assign({ dark: true, title: `${G.name}!` }, a.o, { onEnd: sc => end(sc >= (a.pass || .7), 'รอดมาได้! หอบจนตัวสั่น', 'พลาด… กว่าจะคลานกลับถึงบ้านแรงหมด', 6, 35) })); }; } });
};
GS.end = () => { if (!live) return; const me = live; me.stop = true; root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).onfinish = () => { if (live === me) { me.anims.forEach(a => a.cancel()); root.classList.add('hidden'); root.innerHTML = ''; root.getAnimations().forEach(a => a.cancel()); live = null; } }; };
GS.open = () => !!live;
})();
