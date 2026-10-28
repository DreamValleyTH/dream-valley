// Dream Valley — ghost encounters (v1.6): the night closes in, a scene fades up (swamp / forest / rice field),
// then a ghost cut out from its background comes out at you — each kind with its own entrance — and lunges "out of the screen".
// Pure JS + Web Animations. window.GS.play({ id, bg, level, base, onReady(api) }) ; api.say(html) / api.end()
(() => {
'use strict';
const GS = window.GS = window.GS || {};
GS.LIST = [
  { id: 'krasue', name: 'ผีกระสือ', move: 'float', glow: '#7cff9a', line: 'หัวผู้หญิงลอยต่ำเรี่ยน้ำ ไส้ห้อยเรืองแสงวิบวับ… แล้วมันก็หันมาสบตา' },
  { id: 'pop', name: 'ผีปอบ', move: 'peek', glow: '#ff5a3c', line: 'ยายแก่ผมกระเซิงแสยะยิ้มฟันดำ “ตับหลาน… หอมจัง”' },
  { id: 'krahang', name: 'ผีกระหัง', move: 'fly', glow: '#ffb347', line: 'เสียงกระด้งตีลมพึ่บพั่บ ผู้ชายขี่สากโฉบต่ำมาจนผมปลิว' },
  { id: 'pret', name: 'เปรต', move: 'rise', glow: '#b9c6ff', line: 'ร่างผอมสูงเท่าต้นตาลค่อย ๆ ยืดขึ้นจากหมอก ส่งเสียงหวีดจากปากเท่ารูเข็ม' },
  { id: 'kumanthong', name: 'กุมารทอง', move: 'peek', glow: '#ffd84a', line: 'เด็กตัวทองโผล่จากพุ่มไม้ ตาขาวโพลน “มาเล่นด้วยกันนะ…”' },
  { id: 'kongkoi', name: 'ผีกองกอย', move: 'hop', glow: '#ffe066', line: '“กองกอย! กองกอย!” อะไรบางอย่างกระโดดขาเดียวตรงเข้ามา' },
  { id: 'chaothi', name: 'ผีเจ้าที่', move: 'float', glow: '#e8f4ff', line: 'ร่างโปร่งแสงในชุดขาวลอยออกจากหมอก “มาอยู่ตั้งนาน ไม่เคยไหว้!”' },
  { id: 'kokhad', name: 'ผีคอขาด', move: 'peek', glow: '#ff7b7b', line: 'ทหารไร้หัวยื่นหัวตัวเองมาให้ดู หัวนั้นยิ้มแล้วกระพริบตา' },
  { id: 'taithongklom', name: 'ผีตายทั้งกลม', move: 'float', glow: '#cfe9ff', line: 'เสียงสะอื้นใต้ต้นตะเคียน… หญิงท้องโตในชุดขาวค่อย ๆ หันมา' },
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
#scare .gsg.r,#scare .gsg.c{mix-blend-mode:screen;opacity:0}
#scare .flash{position:absolute;z-index:5;inset:0;background:#fff;opacity:0;pointer-events:none}
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
const LV = { soft: { snd: .07, flash: 0, shake: 4, out: 1.7 }, mid: { snd: .17, flash: .75, shake: 14, out: 2.5 }, max: { snd: .27, flash: .95, shake: 26, out: 3.2 } };
GS.play = ({ id, bg, level = 'mid', base = '', onReady } = {}) => {
  ensure(); const L = LV[level] || LV.mid, G = GS.LIST.find(g => g.id === id) || GS.LIST[Math.floor(Math.random() * GS.LIST.length)];
  bg = bg || GS.BG[Math.floor(Math.random() * GS.BG.length)];
  const src = `${base}assets/ghosts/gh_${G.id}.png`;
  root.innerHTML = `<div class="sb" style="background-image:url(${base}assets/ghosts/bg_${bg}.png)"></div><div class="fog"></div>
    <div class="gw"><div class="gsg r" style="background-image:url(${src})"></div><div class="gsg c" style="background-image:url(${src})"></div><div class="gsg m" style="background-image:url(${src});filter:drop-shadow(0 0 18px ${G.glow})"></div></div>
    <div class="vig"></div><div class="red"></div><div class="flash"></div><div class="nm">${G.name}</div><div class="say"></div>`;
  root.classList.remove('hidden'); A();
  const q = s => root.querySelector(s), sb = q('.sb'), gw = q('.gw'), gm = q('.gsg.m'), gr = q('.gsg.r'), gc = q('.gsg.c'), fl = q('.flash'), nm = q('.nm'), red = q('.red'), say = q('.say');
  const me = live = { stop: false, anims: [] };
  const an = (el, k, o) => { const a = el.animate(k, o); me.anims.push(a); return a; };
  const at = (f, ms) => setTimeout(() => { if (live === me && !me.stop) f(); }, ms);
  // 1. darkness falls, the place fades up, heartbeat
  an(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: 'forwards' });
  an(sb, [{ filter: 'brightness(0) saturate(.6)', transform: 'scale(1)' }, { filter: 'brightness(.62) saturate(.8)', transform: 'scale(1.06)' }], { duration: 2600, delay: 300, fill: 'forwards', easing: 'ease-out' });
  drone(3.6, L.snd); [0, .9, 1.65, 2.25, 2.7, 3.05].forEach(t => heart(t, L.snd * 1.6));
  // 2. something moves — each ghost has its own entrance
  const enter = {
    float: [{ transform: 'translate(-30%,10%) scale(.18)', opacity: 0, filter: 'blur(6px)' }, { transform: 'translate(-12%,4%) scale(.32)', opacity: .8, offset: .5 }, { transform: 'translate(8%,-2%) scale(.42)', opacity: 1, filter: 'blur(1px)' }],
    peek: [{ transform: 'translate(70%,10%) scale(.55)', opacity: 0 }, { transform: 'translate(46%,6%) scale(.55)', opacity: 1, offset: .35 }, { transform: 'translate(46%,6%) scale(.55)', opacity: 1, offset: .7 }, { transform: 'translate(40%,4%) scale(.6)', opacity: 1 }],
    fly: [{ transform: 'translate(-120%,-40%) scale(.3) rotate(-25deg)', opacity: 1 }, { transform: 'translate(60%,-20%) scale(.38) rotate(18deg)', offset: .55 }, { transform: 'translate(10%,0) scale(.45) rotate(-6deg)', opacity: 1 }],
    rise: [{ transform: 'translate(0,60%) scale(.5,.05)', opacity: 0 }, { transform: 'translate(0,20%) scale(.5,.6)', opacity: .8, offset: .5 }, { transform: 'translate(0,-4%) scale(.55,1.1)', opacity: 1 }],
    hop: [{ transform: 'translate(-60%,20%) scale(.2)', opacity: 0 }, { transform: 'translate(-40%,-8%) scale(.24)', opacity: 1, offset: .2 }, { transform: 'translate(-24%,18%) scale(.28)', offset: .4 }, { transform: 'translate(-8%,-6%) scale(.34)', offset: .6 }, { transform: 'translate(4%,16%) scale(.4)', offset: .8 }, { transform: 'translate(0,0) scale(.46)', opacity: 1 }],
  }[G.move];
  at(() => { tone(900, .4, 'sine', L.snd * .25, -500); an(gm, enter, { duration: 1500, easing: 'ease-in-out', fill: 'forwards' }); }, 2400);
  // 3. the lunge: out of the screen at you
  at(() => {
    const k = L.out;
    an(gm, [{ transform: getComputedStyle(gm).transform, opacity: 1 }, { transform: `translate(0,6%) scale(${k})`, opacity: 1, offset: .35 }, { transform: `translate(0,4%) scale(${k * .9})`, opacity: 1, offset: .55 }, { transform: 'translate(0,0) scale(1.05)', opacity: 1 }],
      { duration: 1100, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' });
    if (L.flash) { an(gr, [{ transform: 'translate(0,0) scale(1)', opacity: 0 }, { transform: `translate(-4%,2%) scale(${k})`, opacity: .55, offset: .3 }, { transform: 'translate(-1%,0) scale(1.05)', opacity: 0 }], { duration: 800, fill: 'forwards' });
      an(gc, [{ transform: 'translate(0,0) scale(1)', opacity: 0 }, { transform: `translate(4%,-2%) scale(${k})`, opacity: .45, offset: .3 }, { transform: 'translate(1%,0) scale(1.05)', opacity: 0 }], { duration: 800, fill: 'forwards' });
      gr.style.filter = 'sepia(1) saturate(9) hue-rotate(-40deg)'; gc.style.filter = 'sepia(1) saturate(9) hue-rotate(140deg)';
      an(fl, [{ opacity: L.flash }, { opacity: 0 }], { duration: 260 }); an(red, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: .35 }], { duration: 1600, fill: 'forwards' }); }
    const s = L.shake, sh = []; for (let i = 0; i < 10; i++) sh.push({ transform: `translate(${(Math.random() - .5) * s}px,${(Math.random() - .5) * s}px)` }); sh.push({ transform: 'none' });
    an(gw, sh, { duration: 520 }); an(sb, [{ filter: 'brightness(1.4) saturate(.4)' }, { filter: 'brightness(.42) saturate(.7)' }], { duration: 700, fill: 'forwards' });
    sting(L.snd, G.move); if (navigator.vibrate && level !== 'soft') try { navigator.vibrate(level === 'max' ? [90, 40, 160] : 60); } catch (_) {}
    an(nm, [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400, delay: 500, fill: 'forwards' });
  }, 4100);
  // 4. it hovers and breathes; now the player decides
  at(() => {
    const idle = { float: [{ transform: 'translate(0,0) scale(1.05)' }, { transform: 'translate(0,-3%) scale(1.07)' }], hop: [{ transform: 'translate(0,0) scale(1.05)' }, { transform: 'translate(0,-6%) scale(1.05)' }],
      fly: [{ transform: 'translate(-2%,0) scale(1.05) rotate(-3deg)' }, { transform: 'translate(2%,-2%) scale(1.05) rotate(3deg)' }], rise: [{ transform: 'scale(1.05,1.05)' }, { transform: 'scale(1.03,1.09)' }],
      peek: [{ transform: 'translate(0,0) scale(1.05)' }, { transform: 'translate(1%,-1%) scale(1.08)' }] }[G.move];
    an(gm, idle, { duration: 1300, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    const glitch = () => { if (live !== me || me.stop) return; an(gm, [{ opacity: 1 }, { opacity: .25 }, { opacity: 1 }, { opacity: .5 }, { opacity: 1 }], { duration: 180, composite: 'add' }); setTimeout(glitch, 1600 + Math.random() * 2600); };
    setTimeout(glitch, 1200);
    const api = { ghost: G, bg, say: html => { say.innerHTML = html; say.classList.add('on'); return say; }, hideSay: () => say.classList.remove('on'), end: GS.end };
    onReady ? onReady(api) : api.say(`<h2>${G.name}!</h2><p>${G.line}</p><button>ปิด</button>`).querySelector('button').onclick = GS.end;
  }, 5400);
  return G;
};
GS.end = () => { if (!live) return; const me = live; me.stop = true; root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).onfinish = () => { if (live === me) { me.anims.forEach(a => a.cancel()); root.classList.add('hidden'); root.innerHTML = ''; root.getAnimations().forEach(a => a.cancel()); live = null; } }; };
GS.open = () => !!live;
})();
