// Dream Valley — audio: soft footsteps by surface, procedural chill music, volume settings
(() => {
'use strict';
const DV = window.DV;
const V = { music: .45, sfx: .7 };
try { Object.assign(V, JSON.parse(localStorage.getItem('dv3_vol') || '{}')); } catch (_) {}
DV.vol = V;
DV.setVol = (k, v) => { V[k] = Math.max(0, Math.min(1, v)); try { localStorage.setItem('dv3_vol', JSON.stringify(V)); } catch (_) {} if (master) master.gain.value = V.music * .55; };
let AC = null, master = null, sfxBus = null, noiseBuf = null;
function ac() {
  if (AC) return AC;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  master = AC.createGain(); master.gain.value = V.music * .55;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  master.connect(lp); lp.connect(AC.destination);
  sfxBus = AC.createGain(); sfxBus.gain.value = 1; sfxBus.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * .4, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return AC;
}
DV.audioCtx = ac;
// ---- sfx (replaces the old beeper; same names) ----
DV.sfx = kind => {
  if (DV.muted || !V.sfx || !ac()) return;
  const seq = { tick: [[660, .05]], dirt: [[180, .07], [140, .07]], water: [[900, .06], [1200, .05], [1000, .05]], grass: [[300, .05], [380, .05]],
    seed: [[520, .05], [700, .06]], spark: [[880, .06], [1320, .1]], coin: [[1046, .06], [1568, .12]], card: [[392, .08], [523, .1]],
    talk: [[600, .04], [500, .04]], heart: [[700, .06], [900, .08]], zzz: [[220, .2]], wood: [[150, .06], [120, .08], [150, .06]],
    leaf: [[500, .04], [620, .04], [540, .05]], line: [[988, .05], [1319, .08]], ghost: [[180, .3], [150, .4]] }[kind] || [[600, .05]];
  let t = AC.currentTime;
  seq.forEach(([f, d]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = kind === 'dirt' || kind === 'wood' || kind === 'ghost' ? 'triangle' : 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(.04 * V.sfx, t); g.gain.exponentialRampToValueAtTime(.0005, t + d); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + d); t += d * .9; });
};
// ---- footsteps: grass = soft swish, dirt/laterite = crunchy, hard road/floor = tap ----
let stepAlt = 0;
DV.step = surface => {
  if (DV.muted || !V.sfx || !ac()) return;
  const t = AC.currentTime, src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; stepAlt ^= 1;
  const cfg = { grass: ['bandpass', 1400, .7, .07], dirt: ['bandpass', 700, 1.2, .06], hard: ['highpass', 2200, .8, .035], wood: ['bandpass', 380, 2, .05] }[surface] || ['bandpass', 1000, 1, .06];
  f.type = cfg[0]; f.frequency.value = cfg[1] * (stepAlt ? 1 : .86); f.Q.value = cfg[2];
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.16 * V.sfx, t + .008); g.gain.exponentialRampToValueAtTime(.0005, t + cfg[3] + .03);
  src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t, Math.random() * .3); src.stop(t + .12);
};
// ---- music: gentle lo-fi loop (Rhodes-ish pad, soft pluck melody, brushed shaker); night = slower, darker ----
const DAY = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53]];        // Cmaj7 Am7 Fmaj7 G7
const NIGHT = [[45, 48, 52, 55], [41, 45, 48, 52], [38, 41, 45, 48], [40, 43, 47, 50]];       // Am7 Fmaj7 Dm7 Em7
const PENTA = [0, 2, 4, 7, 9];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
let playing = false, nextT = 0, beat = 0, timer = null, mel = 72;
function note(m, t, dur, type, vol, dest = master) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = hz(m);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.08, dur * .2)); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
}
function schedule() {
  if (!playing || !AC) return;
  const night = DV.S && (6 + DV.S.min / 60) >= 19;
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
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .3); s.stop(t + .12); }
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
