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
