// Dream Valley — boot
(() => {
'use strict';
const DV = window.DV, $ = DV.$;
DV.begin = (state, fresh, storyDelay) => {
  setTimeout(() => DV.netConnect && DV.netConnect(), 1500);
  // migrate older saves
  state.items = state.items || {}; state.line = state.line || { read: 0, liked: {}, posted: {}, dmRead: {}, dmAns: {}, bcSeen: {} };
  ['hearts', 'talked', 'gifted', 'convo', 'convoHeart', 'reactDay', 'q', 'scenes', 'diary', 'trees', 'gone', 'spots', 'stats', 'flags', 'seenCards'].forEach(k => state[k] = state[k] || {});
  DV.S = state; DV.bindState(state);
  DV.enterMap(state.map || 'farm', [state.px, state.py], true);
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); $('bar').classList.remove('hidden');
  DV.hud(); DV.save(true);
  setTimeout(() => DV.startStory(fresh), storyDelay || 0);
};
const baseFlag = () => {};
const prevOnFlag = DV.onFlag;
DV.onFlag = f => {
  if (f.startsWith('diary_')) { DV.S.diary[f] = DV.S.day; setTimeout(() => { DV.toast(`📔 ได้หน้าสมุดบันทึกยายคืนมาจาก${DV.npcName(f.slice(6))}! (ดูในโทรศัพท์)`); DV.sfx('spark'); }, 1200); }
  prevOnFlag && prevOnFlag(f);
};
DV.resize();

$('loadBar').style.width = '5%';
DV.loadAssets(p => { $('loadBar').style.width = Math.round(p * 100) + '%'; }).then(() => {
  DV.startLoop(); DV.introReady();
  DV.cloudReady().then(ok => { $('cloudNote').textContent = ok ? 'เซฟผูกกับบัญชีนี้ — เปิดจากเครื่องไหนก็เล่นต่อได้ด้วยชื่อ + รหัสเดิม' : 'เซฟเก็บในเครื่องนี้ (ใช้ชื่อ + รหัสเดิมเพื่อเล่นต่อ)'; });
});
window.__dv = DV;
})();
