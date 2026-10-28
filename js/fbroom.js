// Dream Valley — a tiny "room" over Firebase Realtime Database, shaped like the Artifact room capability
// (join(name) → presence / peers / onPeers / leave) so net.js can use either one.
// Data: /rooms/<line>/<uid> = { d: "<presence json>", t: <server time> } — removed automatically when the tab closes.
(() => {
'use strict';
const V = '10.12.2', SDK = n => `https://www.gstatic.com/firebasejs/${V}/firebase-${n}-compat.js`;
const script = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
let ready = null;
window.DV_fbRoom = () => {
  if (ready) return ready;
  ready = (async () => {
    const cfg = window.DV_FIREBASE; if (!cfg || !cfg.databaseURL) return null;
    if (!window.firebase) { await script(SDK('app')); await Promise.all([script(SDK('auth')), script(SDK('database'))]); }
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    const cred = await app.auth().signInAnonymously(); const uid = cred.user.uid, db = app.database();
    const join = async name => {
      const ref = db.ref('rooms/' + name.replace(/[.#$\[\]\/]/g, '_')), mine = ref.child(uid);
      await mine.onDisconnect().remove();
      const peers = {}, subs = new Set();
      // the farm layout (big, rarely changes) lives in its own field so moving around only sends a few bytes
      const mk = s => { const v = s.val() || {}; let pr = null; try { pr = JSON.parse(v.d || 'null'); if (pr && v.f) Object.assign(pr, JSON.parse(v.f)); } catch (_) {} return { peer: s.key, isMe: s.key === uid, sameTab: s.key === uid, guest: false, presence: pr }; };
      let lastF = null, pend = null, timer = null, lastSend = 0;
      const send = () => { timer = null; lastSend = Date.now(); const o = Object.assign({}, pend), f = {}; ['farm', 'mvd'].forEach(k => { if (k in o) { f[k] = o[k]; delete o[k]; } });
        const up = { d: JSON.stringify(o).slice(0, 1900), t: firebase.database.ServerValue.TIMESTAMP }, fs = JSON.stringify(f);
        if (fs !== lastF) { up.f = fs.slice(0, 3900); lastF = fs; }
        return mine.update(up); };
      const fire = (joined, left) => subs.forEach(f => { try { f({ joined, left }); } catch (e) { console.error(e); } });
      ref.on('child_added', s => { const p = mk(s); peers[s.key] = p; fire([p], []); });
      ref.on('child_changed', s => { const p = peers[s.key]; if (p) p.presence = mk(s).presence; else peers[s.key] = mk(s); fire([], []); });
      ref.on('child_removed', s => { const p = peers[s.key] || mk(s); delete peers[s.key]; fire([], [p]); });
      return {
        presence: obj => { pend = obj; if (timer) return Promise.resolve(); const wait = Math.max(0, 250 - (Date.now() - lastSend)); timer = setTimeout(send, wait); return Promise.resolve(); },   // ≤4 updates/s
        peers: () => Object.values(peers),
        onPeers: fn => { subs.add(fn); return () => subs.delete(fn); },
        leave: async () => { ref.off(); subs.clear(); clearTimeout(timer); await mine.onDisconnect().cancel(); await mine.remove(); },
      };
    };
    return { join, kind: 'firebase' };
  })().catch(e => { console.warn('firebase off', e); return null; });
  return ready;
};
})();
