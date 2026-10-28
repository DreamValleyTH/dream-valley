// Dream Valley — audio: soft footsteps by surface, procedural chill music, volume settings
(() => {
'use strict';
const DV = window.DV;
const V = { music: .45, sfx: .7 };
try { Object.assign(V, JSON.parse(localStorage.getItem('dv3_vol') || '{}')); } catch (_) {}
DV.vol = V;
DV.setVol = (k, v) => { V[k] = Math.max(0, Math.min(1, v)); try { localStorage.setItem('dv3_vol', JSON.stringify(V)); } catch (_) {} if (master) master.gain.value = V.music * .55; };
let AC = null, master = null, sfxBus = null, noiseBuf = null, mbus = null, amb = null;
function ac() {
  if (AC) return AC;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  master = AC.createGain(); master.gain.value = V.music * .55;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  master.connect(lp); lp.connect(AC.destination);
  mbus = AC.createGain(); mbus.gain.value = 1; mbus.connect(master);   // the tune itself (fades out at dusk)
  amb = AC.createGain(); amb.gain.value = 0; amb.connect(AC.destination);   // night ambience: crickets, frogs, an owl
  sfxBus = AC.createGain(); sfxBus.gain.value = 1; sfxBus.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * .4, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return AC;
}
DV.audioCtx = ac;
// ---- sfx: tones for UI, layered filtered noise for real actions (dig, chop, water, cut, plant, pick up) ----
function nz(t, dur, type, freq, q, vol, attack = .005) {
  const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol * V.sfx, t + attack); g.gain.exponentialRampToValueAtTime(.0003, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t, Math.random() * .2); src.stop(t + dur + .05);
}
function tone(t, f0, f1, dur, type, vol) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol * V.sfx, t + .006); g.gain.exponentialRampToValueAtTime(.0003, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + .05);
}
const ACTION = {
  hoe: t => { tone(t, 140, 60, .12, 'sine', .25); nz(t + .01, .22, 'lowpass', 900, .7, .22); nz(t + .06, .25, 'bandpass', 2200, .8, .05); },   // blade into soil + crumbling earth
  dirt: t => { tone(t, 120, 55, .1, 'sine', .2); nz(t, .2, 'lowpass', 800, .7, .2); },
  fill: t => { nz(t, .35, 'lowpass', 600, .5, .16, .05); nz(t + .12, .25, 'lowpass', 900, .6, .1, .04); },                               // pushing soil back
  water: t => { nz(t, .55, 'bandpass', 1800, 1.4, .1, .06); nz(t + .05, .5, 'bandpass', 3200, 2, .05, .08); tone(t + .1, 900, 600, .12, 'sine', .03); },  // pouring + drips
  wood: t => { tone(t, 220, 90, .08, 'triangle', .3); nz(t, .09, 'bandpass', 1400, 3, .3); nz(t + .02, .3, 'lowpass', 500, .8, .08); },    // axe knock + crack
  grass: t => { nz(t, .18, 'highpass', 2600, .6, .14, .02); nz(t + .09, .16, 'highpass', 3400, .6, .1, .02); },                            // sickle swish
  leaf: t => { nz(t, .3, 'bandpass', 3000, .8, .08, .03); nz(t + .12, .3, 'bandpass', 2400, .8, .06, .03); },
  seed: t => { [0, .07, .14].forEach((d, i) => { nz(t + d, .05, 'bandpass', 3500 + i * 300, 4, .08); tone(t + d, 900 + i * 120, 0, .04, 'sine', .04); }); },
  spark: t => { tone(t, 1320, 0, .09, 'triangle', .07); tone(t + .07, 1760, 0, .14, 'triangle', .06); nz(t, .12, 'highpass', 6000, .5, .03); },   // pick-up chime
  coin: t => { tone(t, 1568, 0, .07, 'square', .04); tone(t + .06, 2093, 0, .16, 'square', .04); },
};
DV.sfx = kind => {
  if (DV.muted || !V.sfx || !ac()) return;
  const t = AC.currentTime;
  if (ACTION[kind]) return ACTION[kind](t);
  const seq = { tick: [[660, .05]], card: [[392, .08], [523, .1]], talk: [[600, .04], [500, .04]], heart: [[700, .06], [900, .08]], zzz: [[220, .2]],
    line: [[988, .05], [1319, .08]], ghost: [[180, .3], [150, .4]] }[kind] || [[600, .05]];
  let tt = t;
  seq.forEach(([f, d]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = kind === 'ghost' ? 'triangle' : 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(.04 * V.sfx, tt); g.gain.exponentialRampToValueAtTime(.0005, tt + d); o.connect(g); g.connect(sfxBus); o.start(tt); o.stop(tt + d); tt += d * .9; });
};
// ---- footsteps (v2.0): one soft, deep thud on every surface — a low body plus a little muffled grit ----
let stepAlt = 0;
DV.step = () => {
  if (DV.muted || !V.sfx || !ac()) return;
  const t = AC.currentTime; stepAlt ^= 1;
  const o = AC.createOscillator(), og = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(stepAlt ? 92 : 84, t); o.frequency.exponentialRampToValueAtTime(48, t + .09);
  og.gain.setValueAtTime(.0001, t); og.gain.linearRampToValueAtTime(.2 * V.sfx, t + .006); og.gain.exponentialRampToValueAtTime(.0005, t + .12); o.connect(og); og.connect(sfxBus); o.start(t); o.stop(t + .14);
  const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = .6;
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.07 * V.sfx, t + .005); g.gain.exponentialRampToValueAtTime(.0005, t + .07);
  src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t, Math.random() * .3); src.stop(t + .1);
};
// ---- music: gentle lo-fi loop (Rhodes-ish pad, soft pluck melody, brushed shaker); night = slower, darker ----
const DAY = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53]];        // Cmaj7 Am7 Fmaj7 G7
const NIGHT = [[45, 48, 52, 55], [41, 45, 48, 52], [38, 41, 45, 48], [40, 43, 47, 50]];       // Am7 Fmaj7 Dm7 Em7
const PENTA = [0, 2, 4, 7, 9];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
let playing = false, nextT = 0, beat = 0, timer = null, mel = 72;
function note(m, t, dur, type, vol, dest = mbus) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = hz(m);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.08, dur * .2)); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
}
// ---- dusk: the tune fades out between 17:00 and 18:00; after that only crickets, frogs and now and then an owl ----
function dusk() { const h = DV.S ? 6 + DV.S.min / 60 : 12; return h <= 17 ? 0 : h >= 18 ? 1 : h - 17; }
function chirp(t, f, n, vol) {   // a cricket: n quick ringing pulses
  for (let i = 0; i < n; i++) { const o = AC.createOscillator(), g = AC.createGain(), tt = t + i * .055; o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - .5) * .01);
    g.gain.setValueAtTime(.0001, tt); g.gain.linearRampToValueAtTime(vol, tt + .006); g.gain.exponentialRampToValueAtTime(.0003, tt + .04); o.connect(g); g.connect(amb); o.start(tt); o.stop(tt + .05); }
}
function croak(t, f, vol) {   // a frog: buzzy, falling, through a nasal band
  for (let i = 0, n = Math.random() < .4 ? 2 : 1; i < n; i++) { const tt = t + i * .2, o = AC.createOscillator(), bp = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * .72, tt + .14); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 2.5;
    g.gain.setValueAtTime(.0001, tt); g.gain.linearRampToValueAtTime(vol, tt + .02); g.gain.exponentialRampToValueAtTime(.0004, tt + .16); o.connect(bp); bp.connect(g); g.connect(amb); o.start(tt); o.stop(tt + .2); }
}
function owl(t) {   // "ฮู้ … ฮู้ฮู้" far away
  [[0, .55], [.75, .3], [1.1, .6]].forEach(([d, len]) => { const tt = t + d, o = AC.createOscillator(), v = AC.createOscillator(), vg = AC.createGain(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(400, tt); o.frequency.linearRampToValueAtTime(360, tt + len); v.frequency.value = 6; vg.gain.value = 6; v.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(.0001, tt); g.gain.linearRampToValueAtTime(.05, tt + .08); g.gain.linearRampToValueAtTime(.0001, tt + len); o.connect(g); g.connect(amb); o.start(tt); o.stop(tt + len + .05); v.start(tt); v.stop(tt + len + .05); });
}
let nextOwl = 0;
function ambience(d) {
  const t = AC.currentTime;
  amb.gain.setTargetAtTime(d * V.music * .9, t, 1.5);
  if (d <= 0) return;
  if (Math.random() < .55 * d) chirp(t + Math.random() * .2, 4200 + Math.random() * 900, 3 + Math.floor(Math.random() * 3), .012);   // crickets / cicadas
  if (Math.random() < .3 * d) chirp(t + Math.random() * .2, 5600, 2, .007);
  if (Math.random() < .12 * d) croak(t + Math.random() * .2, 150 + Math.random() * 90, .05);                                         // frogs in the paddies
  if (d >= 1 && t > nextOwl) { if (nextOwl) owl(t + .2); nextOwl = t + 40 + Math.random() * 50; }                                       // an owl, now and then
}
function schedule() {
  if (!playing || !AC) return;
  const d = dusk(); mbus.gain.setTargetAtTime(1 - d, AC.currentTime, .8); ambience(d);
  if (d >= 1) { nextT = AC.currentTime + .1; return; }   // night: no tune at all
  const night = d > .5;
  const bpm = night ? 62 : 74, spb = 60 / bpm, prog = night ? NIGHT : DAY;
  while (nextT < AC.currentTime + .6) {
    const bar = Math.floor(beat / 4) % 4, b = beat % 4, ch = prog[bar];
    if (b === 0) { ch.forEach((m, i) => note(m + 12, nextT + i * .015, spb * 3.8, 'sine', .05)); note(ch[0] - 12, nextT, spb * 1.8, 'triangle', .09); }
    if (b === 2) note(ch[0] - 12 + (Math.random() < .5 ? 7 : 0), nextT, spb * 1.6, 'triangle', .07);
    // melody: wanders on the pentatonic, rests often
    for (const off of [0, .5]) if (Math.random() < (night ? .28 : .42)) {
      mel += (Math.random() < .5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2)); mel = Math.max(67, Math.min(84, mel));
      const pc = ((mel % 12) + 12) % 12; let best = mel; let bd = 99; for (const p of PENTA) for (const o of [-12, 0, 12]) { const c = mel - pc + p + o; if (Math.abs(c - mel) < bd) { bd = Math.abs(c - mel); best = c; } }
      note(best, nextT + off * spb, spb * (night ? 1.6 : 1.1), 'triangle', night ? .035 : .045);
    }
    // brushed shaker on the off-beats
    if (!night || b % 2) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
      const t = nextT + spb * .5; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.02, t + .01); g.gain.exponentialRampToValueAtTime(.0003, t + .09);
      s.connect(f); f.connect(g); g.connect(mbus); s.start(t, Math.random() * .3); s.stop(t + .12); }
    nextT += spb; beat++;
  }
}
DV.music = on => {
  if (!ac()) return;
  if (AC.state === 'suspended') AC.resume();
  if (on && !playing) { playing = true; nextT = AC.currentTime + .1; timer = setInterval(schedule, 200); }
  if (!on && playing) { playing = false; clearInterval(timer); }
};
// browsers only allow sound after a tap: start the loop on the first interaction
const kick = () => { DV.music(true); removeEventListener('pointerdown', kick); };
addEventListener('pointerdown', kick);
document.addEventListener('visibilitychange', () => { if (!AC) return; if (document.hidden) AC.suspend(); else AC.resume(); });
// ---- settings panel ----
DV.openSound = () => {
  const p = document.getElementById('panel');
  p.innerHTML = `<div class="panel-h"><b><span class="uic uic-music"></span> เสียง</b><button class="x">✕</button></div><div class="panel-b snd">
    <label><span class="uic uic-music"></span>เพลง <input type="range" min="0" max="100" value="${Math.round(V.music * 100)}" data-k="music"><b>${Math.round(V.music * 100)}</b></label>
    <label><span class="uic uic-sound"></span>เสียงเอฟเฟกต์ / เดิน <input type="range" min="0" max="100" value="${Math.round(V.sfx * 100)}" data-k="sfx"><b>${Math.round(V.sfx * 100)}</b></label>
    <p class="muted">เพลงเปลี่ยนเป็นจังหวะช้าลงตอนกลางคืน · ซูมแผนที่: ถ่างนิ้ว · ดูรอบ ๆ: ลากนิ้วเดียว</p></div>`;
  p.classList.remove('hidden'); p.querySelector('.x').onclick = () => p.classList.add('hidden');
  p.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { DV.setVol(r.dataset.k, r.value / 100); r.nextElementSibling.textContent = r.value; if (r.dataset.k === 'sfx') DV.step('grass'); });
};
})();
