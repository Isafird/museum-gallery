import * as THREE from 'three';

// Daftar topi. Tambah item baru lalu buat bentuknya di makeAvatar().
export const HATS = [{ id: 0, name: 'Tanpa topi' }, { id: 1, name: 'Topi baseball' }, { id: 2, name: 'Topi tinggi' }];

const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
function part(w, h, d, c, x, y, z, pivotTop) {
  const g = new THREE.BoxGeometry(w, h, d); if (pivotTop) g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, mat(c)); m.position.set(x, y, z); return m;
}

// Karakter dibuat dari kotak. Depan karakter menghadap -z.
export function makeAvatar(l) {
  const g = new THREE.Group(), u = {};
  g.add(part(.5, .7, .28, l.shirt, 0, 1.1, 0));          // badan
  g.add(part(.32, .32, .32, l.skin, 0, 1.61, 0));        // kepala
  const em = new THREE.MeshBasicMaterial({ color: 0x111111 });
  [-.08, .08].forEach(x => { const e = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .02), em); e.position.set(x, 1.64, -.165); g.add(e); });
  u.aL = part(.14, .62, .16, l.skin, -.33, 1.42, 0, 1); u.aR = part(.14, .62, .16, l.skin, .33, 1.42, 0, 1);
  u.lL = part(.2, .75, .2, l.pants, -.13, .75, 0, 1);    u.lR = part(.2, .75, .2, l.pants, .13, .75, 0, 1);
  [u.aL, u.aR, u.lL, u.lR].forEach(m => g.add(m));
  const hat = +l.hat;
  if (hat === 1) { g.add(part(.36, .1, .36, l.shirt, 0, 1.81, 0)); g.add(part(.36, .03, .16, l.shirt, 0, 1.78, -.24)); }
  if (hat === 2) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .38, 16), mat(0x1c1c22)); a.position.y = 1.95; g.add(a);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, .03, 16), mat(0x1c1c22)); b.position.y = 1.78; g.add(b);
  }
  g.userData.u = u; return g;
}

// Label nama di atas kepala
export function nameTag(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,22,28,.75)'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#fff'; g.font = '600 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
  s.scale.set(1, .25, 1); s.position.y = 2.25; return s;
}

// Ayunan tangan dan kaki. amt: 0 (diam) sampai 1 (jalan penuh)
export function animateAvatar(g, amt, t) {
  const u = g.userData.u, s = Math.sin(t * 8) * .7 * amt;
  u.aL.rotation.x = s; u.aR.rotation.x = -s; u.lL.rotation.x = -s; u.lR.rotation.x = s;
}

// Gelembung chat di atas kepala. Hilang sendiri setelah beberapa detik (lihat tickBubble).
function makeBubble(text) {
  const W = 512, PAD = 22, LH = 46, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = '500 34px system-ui,sans-serif';
  const lines = []; let cur = '';
  text.split(/\s+/).forEach(w => {
    while (g.measureText(w).width > W - 2 * PAD) { let n = w.length; while (n > 1 && g.measureText(w.slice(0, n)).width > W - 2 * PAD) n--; if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, n)); w = w.slice(n); }   // kata sangat panjang dipotong
    const t = cur ? cur + ' ' + w : w;
    if (cur && g.measureText(t).width > W - 2 * PAD) { lines.push(cur); cur = w; } else cur = t;
  });
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 4); if (lines.length > 4) shown[3] = shown[3].replace(/.{0,2}$/, '…');
  const widest = Math.max(...shown.map(l => g.measureText(l).width)), bw = Math.min(W, Math.ceil(widest + 2 * PAD)), bh = shown.length * LH + 2 * PAD - 8, TAIL = 22;
  c.width = W; c.height = bh + TAIL;
  g.font = '500 34px system-ui,sans-serif';
  const x0 = (W - bw) / 2; g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath();
  if (g.roundRect) g.roundRect(x0, 0, bw, bh, 22); else g.rect(x0, 0, bw, bh);
  g.fill(); g.beginPath(); g.moveTo(W / 2 - 14, bh - 1); g.lineTo(W / 2 + 14, bh - 1); g.lineTo(W / 2, bh + TAIL); g.closePath(); g.fill();
  g.fillStyle = '#16181d'; g.textAlign = 'center'; g.textBaseline = 'middle';
  shown.forEach((l, i) => g.fillText(l, W / 2, PAD - 4 + LH / 2 + i * LH));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  const k = 1.9 / W; s.scale.set(W * k, c.height * k, 1); s.renderOrder = 10;
  s.position.y = 2.42 + c.height * k / 2; return s;
}
function clearBubble(g) {
  const b = g.userData.bubble; if (!b) return;
  g.remove(b.s); b.s.material.map.dispose(); b.s.material.dispose(); g.userData.bubble = null;
}
export function sayOver(g, text) {
  clearBubble(g); const s = makeBubble(text); g.add(s);
  g.userData.bubble = { s, until: performance.now() + Math.min(9000, 3500 + text.length * 70) };
}
export function tickBubble(g) { const b = g.userData.bubble; if (b && performance.now() > b.until) clearBubble(g); }
