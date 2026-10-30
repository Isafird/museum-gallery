import * as THREE from 'three';
import { DEFAULT_LOOK } from './config.js';

// ---- Daftar pilihan karakter. Urutan = nomor yang disimpan; tambah item baru di akhir daftar lalu buat bentuknya di bawah. ----
export const HATS = ['Tanpa topi', 'Topi baseball', 'Topi tinggi', 'Topi pantai', 'Kupluk', 'Topi koboi', 'Topi bucket', 'Mahkota', 'Topi koki', 'Topi ulang tahun'].map((name, id) => ({ id, name }));
export const TOPS = ['Kaos', 'Lengan panjang', 'Hoodie', 'Kemeja', 'Kaos belang', 'Jaket', 'Baju pantai (bunga)', 'Tanpa lengan'].map((name, id) => ({ id, name }));
export const BOTTOMS = ['Celana panjang', 'Celana pendek', 'Rok', 'Celana kargo', 'Celana pantai'].map((name, id) => ({ id, name }));
// tw/td lebar/tebal badan, aw tebal lengan, lw tebal kaki, hs ukuran kepala, h tinggi keseluruhan
export const BODIES = [
  { id: 0, name: 'Normal', tw: 1, td: 1, aw: 1, lw: 1, hs: 1, h: 1 },
  { id: 1, name: 'Kurus', tw: .82, td: .85, aw: .78, lw: .8, hs: 1, h: 1.03 },
  { id: 2, name: 'Atletis', tw: 1.28, td: 1.1, aw: 1.35, lw: 1.1, hs: .95, h: 1.04 },
  { id: 3, name: 'Gemuk', tw: 1.4, td: 1.45, aw: 1.15, lw: 1.2, hs: 1.05, h: .98 },
  { id: 4, name: 'Mungil (kepala besar)', tw: .95, td: .95, aw: .95, lw: .95, hs: 1.45, h: .8 },
  { id: 5, name: 'Tinggi', tw: .92, td: .9, aw: .9, lw: .92, hs: .95, h: 1.18 },
].map(b => ({ ...b }));
export const FACES = ['Biasa', 'Senyum lebar', 'Kedip', 'Mata besar', 'Kacamata hitam', 'Kacamata bulat', 'Terkejut', 'Kumis', 'Pipi merona', 'Mata hati'].map((name, id) => ({ id, name }));
export const HAT_ORN = ['Tanpa hiasan', 'Bunga', 'Pita', 'Bulu', 'Bintang', 'Telinga kucing', 'Tanduk', 'Antena'].map((name, id) => ({ id, name }));
export const TOP_ORN = ['Tanpa hiasan', 'Lencana bintang', 'Hati', 'Dasi kupu-kupu', 'Dasi panjang', 'Syal', 'Kalung bunga', 'Tas punggung', 'Jubah'].map((name, id) => ({ id, name }));
// Warna bawaan (dipakai kalau warna topi / hiasan tidak diubah)
export const HAT_DEF = ['#c0392b', '#c0392b', '#1c1c22', '#e3c27a', '#e67e22', '#8a5a2b', '#6f8f5a', '#f2c744', '#ffffff', '#e84a8a'];
export const HAT_ORN_DEF = ['#ffd23f', '#ff6b9d', '#e63946', '#f4f1e8', '#ffd23f', '#f2a7bd', '#ece3c8', '#44c0a0'];
export const TOP_ORN_DEF = ['#ffd23f', '#ffd23f', '#e63946', '#e63946', '#2a5db0', '#c0392b', '#ff6b9d', '#3a7d44', '#6a4c93'];
const HAT_TOP = [.32, .41, .69, .47, .56, .52, .47, .52, .72, .67];       // tinggi puncak topi dari dasar kepala

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
const accent = hex => { const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); return hsl.l < .3 ? '#' + c.offsetHSL(0, 0, .32).getHexString() : shade(hex, .62); };   // warna pita / aksen yang kontras dengan warna utama
function part(w, h, d, c, x, y, z, pivotTop, extra) {
  const g = new THREE.BoxGeometry(w, h, d); if (pivotTop) g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, c && c.isMaterial ? c : mat(c, extra)); m.position.set(x, y, z); return m;
}

// ---- tekstur kecil (dibagi antar karakter): wajah, belang, bunga ----
const texCache = new Map();
function cached(key, size, draw) {
  if (!texCache.has(key)) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache.set(key, t); }
  return texCache.get(key);
}
function faceTex(id, skin) {
  return cached('f' + id + skin, 128, (g, S) => {
    g.fillStyle = skin; g.fillRect(0, 0, S, S); g.lineCap = 'round'; g.lineJoin = 'round';
    const ink = '#17171b', ex = [32, 96], ey = 52, my = 88;
    const dot = (x, y, r = 7) => { g.fillStyle = ink; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    const smile = (w, h, lw = 5) => { g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.moveTo(64 - w, my - h / 2); g.quadraticCurveTo(64, my + h, 64 + w, my - h / 2); g.stroke(); };
    const eyes = () => ex.forEach(x => dot(x, ey));
    if (id === 0) { eyes(); smile(14, 8, 4); }
    else if (id === 1) { eyes(); g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = 4; g.beginPath(); g.moveTo(34, 80); g.quadraticCurveTo(64, 126, 94, 80); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#d9576b'; g.beginPath(); g.ellipse(64, 102, 12, 7, 0, 0, 7); g.fill(); }
    else if (id === 2) { dot(ex[0], ey); g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(ex[1] - 12, ey); g.lineTo(ex[1] + 12, ey - 3); g.stroke(); smile(18, 12); }
    else if (id === 3) { ex.forEach(x => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, ey, 17, 21, 0, 0, 7); g.fill(); g.strokeStyle = ink; g.lineWidth = 3; g.stroke(); dot(x + 2, ey + 3, 10); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 6, ey - 3, 3.5, 0, 7); g.fill(); }); smile(12, 8, 4); }
    else if (id === 4) { g.fillStyle = '#0d0d10'; [[10, 54], [70, 114]].forEach(([a, b]) => { g.beginPath(); g.roundRect ? g.roundRect(a, 36, b - a, 32, 8) : g.rect(a, 36, b - a, 32); g.fill(); }); g.fillRect(54, 42, 20, 7); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(16, 41, 14, 5); g.fillRect(76, 41, 14, 5); smile(14, 8, 4); }
    else if (id === 5) { g.strokeStyle = '#2a2a30'; g.lineWidth = 5; ex.forEach(x => { g.beginPath(); g.arc(x, ey, 21, 0, 7); g.stroke(); }); g.beginPath(); g.moveTo(53, ey); g.lineTo(75, ey); g.stroke(); eyes(); smile(14, 8, 4); }
    else if (id === 6) { eyes(); ex.forEach(x => dot(x, ey, 9)); g.fillStyle = '#fff'; ex.forEach(x => { g.beginPath(); g.arc(x, ey, 11, 0, 7); g.fill(); }); ex.forEach(x => dot(x, ey, 5)); g.fillStyle = '#4a1d1d'; g.beginPath(); g.ellipse(64, 96, 10, 14, 0, 0, 7); g.fill(); }
    else if (id === 7) { eyes(); g.fillStyle = '#3a2418'; g.beginPath(); g.moveTo(64, 78); g.quadraticCurveTo(38, 66, 14, 86); g.quadraticCurveTo(40, 92, 64, 88); g.quadraticCurveTo(88, 92, 114, 86); g.quadraticCurveTo(90, 66, 64, 78); g.fill(); smile(10, 6, 4); g.translate(0, 18); g.translate(0, -18); }
    else if (id === 8) { eyes(); g.fillStyle = 'rgba(235,90,110,.55)'; [24, 104].forEach(x => { g.beginPath(); g.ellipse(x, 76, 14, 9, 0, 0, 7); g.fill(); }); smile(14, 8, 4); }
    else if (id === 9) { g.fillStyle = '#e0334f'; ex.forEach(x => { g.beginPath(); g.moveTo(x, ey + 16); g.bezierCurveTo(x - 30, ey - 6, x - 12, ey - 26, x, ey - 8); g.bezierCurveTo(x + 12, ey - 26, x + 30, ey - 6, x, ey + 16); g.fill(); }); smile(16, 10); }
  });
}
function patTex(kind, color) {
  return cached('p' + kind + color, 64, (g, S) => {
    g.fillStyle = color; g.fillRect(0, 0, S, S);
    if (kind === 'stripe') { g.fillStyle = '#f4f2ee'; for (let y = 0; y < S; y += 16) g.fillRect(0, y, S, 8); }
    else if (kind === 'flower') { const cols = ['#f7e7a0', '#ff8fa3', '#ffffff']; [[12, 14], [44, 10], [28, 34], [8, 50], [52, 46]].forEach(([x, y], i) => { g.fillStyle = cols[i % 3]; for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, 7); g.fill(); } g.fillStyle = '#e8a33a'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }); g.fillStyle = 'rgba(40,120,70,.7)'; [[26, 8], [58, 30], [18, 62], [40, 58]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 6, 3, .6, 0, 7); g.fill(); }); }
  });
}

// ---- topi (koordinat relatif terhadap dasar kepala; kepala selebar .32, depan = -z) ----
function addHat(H, id, c) {
  const cy = (rt, rb, h, col, x, y, z, seg = 18, o = {}) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(col, o)); m.position.set(x, y, z); H.add(m); return m; };
  const ball = (r, col, x, y, z, sy = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(col)); m.position.set(x, y, z); m.scale.y = sy; H.add(m); return m; };
  if (id === 1) { H.add(part(.36, .1, .36, c, 0, .36, 0)); H.add(part(.36, .03, .16, shade(c, .85), 0, .33, -.24)); ball(.03, shade(c, .8), 0, .42, 0); }
  else if (id === 2) { cy(.17, .17, .38, c, 0, .5, 0, 18); cy(.26, .26, .03, c, 0, .33, 0); cy(.175, .175, .07, accent(c), 0, .38, 0); }
  else if (id === 3) { cy(.44, .44, .02, c, 0, .335, 0, 28); cy(.19, .2, .15, shade(c, 1.08), 0, .41, 0); cy(.205, .205, .05, accent(c), 0, .36, 0); }
  else if (id === 4) { cy(.185, .185, .17, c, 0, .385, 0); cy(.2, .2, .07, shade(c, .8), 0, .33, 0); ball(.055, accent(c), 0, .5, 0); }
  else if (id === 5) { cy(.4, .4, .025, c, 0, .335, 0, 28); cy(.13, .18, .17, c, 0, .42, 0); cy(.185, .185, .04, accent(c), 0, .36, 0); }
  else if (id === 6) { cy(.16, .2, .16, c, 0, .39, 0); cy(.31, .31, .02, shade(c, .9), 0, .315, 0, 24); }
  else if (id === 7) { const gold = { metalness: .5, roughness: .35 }; cy(.17, .17, .08, c, 0, .36, 0, 18, gold); for (let k = 0; k < 5; k++) { const a = k * 1.2566, m = new THREE.Mesh(new THREE.ConeGeometry(.04, .12, 4), mat(c, gold)); m.position.set(Math.sin(a) * .15, .46, Math.cos(a) * .15); H.add(m); } ball(.025, '#d6203a', 0, .36, -.175); }
  else if (id === 8) { cy(.16, .16, .1, c, 0, .37, 0); ball(.2, c, 0, .52, 0, .8); }
  else if (id === 9) { const m = new THREE.Mesh(new THREE.ConeGeometry(.13, .34, 14), mat(c)); m.position.set(0, .49, 0); H.add(m); ball(.04, accent(c), 0, .67, 0); }
}

// ---- hiasan (ornamen): bentuk kecil yang dipakai di topi dan baju ----
function starGeo(R, r, depth) {
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R, x = Math.cos(a) * rad, y = Math.sin(a) * rad; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.rotateY(Math.PI); return g;      // permukaan menghadap -z (depan)
}
function heartGeo(S, depth) {
  const s = new THREE.Shape(); s.moveTo(0, -.5); s.bezierCurveTo(-.6, -.1, -.45, .45, 0, .2); s.bezierCurveTo(.45, .45, .6, -.1, 0, -.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: depth / S, bevelEnabled: false }); g.scale(S, S, S); g.rotateY(Math.PI); return g;
}
function bowGroup(c, k = 1) {
  const g = new THREE.Group(), m = mat(c);
  [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.ConeGeometry(.045 * k, .09 * k, 4), m); w.rotation.z = s * Math.PI / 2; w.position.x = s * .05 * k; g.add(w); });
  const b = new THREE.Mesh(new THREE.SphereGeometry(.022 * k, 10, 8), mat(shade(c, .8))); g.add(b); return g;
}
function flowerGroup(c) {
  const g = new THREE.Group(), m = mat(c);
  for (let k = 0; k < 5; k++) { const a = k * 1.2566, p = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 8), m); p.position.set(Math.cos(a) * .04, Math.sin(a) * .04, 0); p.scale.z = .55; g.add(p); }
  const ctr = new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), mat('#ffd23f')); ctr.position.z = -.012; g.add(ctr); return g;
}
// Titik tempel hiasan di sisi depan-kiri topi: [x, y, z] untuk tiap model topi (0 = tanpa topi: di sisi kepala)
const HAT_ATTACH = [[-.12, .33, -.1], [-.185, .37, -.06], [-.178, .45, -.04], [-.196, .42, -.06], [-.19, .39, -.05], [-.18, .42, -.04], [-.18, .39, -.05], [0, .37, -.178], [-.2, .49, -.09], [-.09, .41, -.05]];
function addHatOrn(H, hat, orn, c) {
  if (!orn) return; const top = HAT_TOP[hat], m = mat(c), put = (obj, [x, y, z], tilt = 0) => {   // taruh di titik tempel, menghadap keluar
    const o = new THREE.Group(), inner = new THREE.Group(); inner.add(obj); inner.rotation.z = tilt; o.add(inner); o.position.set(x, y, z); o.rotation.y = Math.atan2(-x, -(z || -.001)); H.add(o); return o;
  };
  const at = HAT_ATTACH[hat] || HAT_ATTACH[0];
  if (orn === 1) put(flowerGroup(c), at);
  else if (orn === 2) put(bowGroup(c, 1), at);
  else if (orn === 3) { const f = new THREE.Group(), v = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), m); v.scale.set(.026, .15, .018); v.position.y = .1; f.add(v); const q = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .2, 5), mat('#5a4a3a')); q.position.y = .08; f.add(q); put(f, at, at[0] < 0 ? .5 : -.5); }
  else if (orn === 4) { const s = new THREE.Mesh(starGeo(.05, .022, .016), mat(c, { metalness: .3, roughness: .4 })); put(s, at); }
  else if (orn === 5) [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.ConeGeometry(.055, .12, 4), m); e.position.set(s * .1, top + .05, 0); e.rotation.set(0, Math.PI / 4, -s * .15); H.add(e); const i = new THREE.Mesh(new THREE.ConeGeometry(.03, .08, 4), mat('#f6c4d0')); i.position.set(s * .1, top + .04, -.015); i.rotation.set(0, Math.PI / 4, -s * .15); H.add(i); });
  else if (orn === 6) [-1, 1].forEach(s => { const h = new THREE.Mesh(new THREE.ConeGeometry(.03, .14, 8), m); h.position.set(s * .115, top + .05, -.02); h.rotation.z = -s * .45; H.add(h); });
  else if (orn === 7) { const g = new THREE.Group(), st = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .16, 6), mat('#444')); st.position.y = .08; g.add(st); const b = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 8), m); b.position.y = .17; g.add(b); g.position.set(.06, top, 0); g.rotation.z = -.2; H.add(g); }
}
function addTopOrn(B, orn, c, tw, td) {
  if (!orn) return; const fz = -td / 2, m = mat(c);
  if (orn === 1) { const s = new THREE.Mesh(starGeo(.06, .026, .014), mat(c, { metalness: .3, roughness: .4 })); s.position.set(-tw * .22, 1.33, fz - .002); B.add(s); }
  else if (orn === 2) { const h = new THREE.Mesh(heartGeo(.16, .014), m); h.position.set(0, 1.17, fz - .002); B.add(h); }
  else if (orn === 3) { const b = bowGroup(c, 1.2); b.position.set(0, 1.43, fz - .018); B.add(b); }
  else if (orn === 4) { B.add(part(.055, .05, .03, shade(c, .85), 0, 1.42, fz - .012)); B.add(part(.07, .3, .016, c, 0, 1.25, fz - .006)); }
  else if (orn === 5) {
    const R = .2, f = Math.max((tw / 2 + .04) / R, (td / 2 + .05) / R); const t = new THREE.Mesh(new THREE.TorusGeometry(R, .05, 8, 20), m); t.rotation.x = Math.PI / 2; t.position.y = 1.45; t.scale.set((tw / 2 + .045) / R, (td / 2 + .055) / R, 1); B.add(t);
    B.add(part(.11, .3, .045, c, tw * .2, 1.3, fz - .035));
  }
  else if (orn === 6) { const cols = [c, '#ffd23f', '#ff8fb1']; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, front = Math.max(0, -Math.cos(a)), s = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), mat(cols[i % 3])); s.position.set(Math.sin(a) * (tw / 2 + .035), 1.4 - .13 * front, Math.cos(a) * (td / 2 + .04)); B.add(s); } }
  else if (orn === 7) { B.add(part(Math.min(.4, tw * .8), .42, .14, c, 0, 1.15, td / 2 + .07)); B.add(part(.045, .52, .02, shade(c, .7), -tw * .27, 1.2, fz - .008)); B.add(part(.045, .52, .02, shade(c, .7), tw * .27, 1.2, fz - .008)); }
  else if (orn === 8) { const cape = part(tw + .1, .9, .025, c, 0, 0, 0, true); const g = new THREE.Group(); g.position.set(0, 1.44, td / 2 + .01); g.rotation.x = -.1; g.add(cape); B.add(g); const clasp = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), mat('#ffd23f', { metalness: .6, roughness: .3 })); clasp.position.set(0, 1.44, fz - .01); B.add(clasp); }
}

// Karakter dibuat dari kotak. Depan karakter menghadap -z.
export function makeAvatar(look) {
  const l = { ...DEFAULT_LOOK, ...look }, bd = BODIES[l.body] || BODIES[0], top = +l.top || 0, bot = +l.bottom || 0, hat = +l.hat || 0;
  const root = new THREE.Group(), B = new THREE.Group(), u = {}; root.add(B); B.scale.setScalar(bd.h);
  const longSleeve = top === 1 || top === 2 || top === 5, noSleeve = top === 7;
  const tmap = top === 4 ? patTex('stripe', l.shirt) : top === 6 ? patTex('flower', l.shirt) : null;
  const shirtM = () => mat(tmap ? 0xffffff : l.shirt, tmap ? { map: tmap } : {});
  const tw = .5 * bd.tw, td = .28 * bd.td;

  B.add(part(tw, .7, td, shirtM(), 0, 1.1, 0));                       // badan
  if (top === 2) B.add(part(tw * .8, .2, .12, shade(l.shirt, .92), 0, 1.4, td / 2 + .05));     // tudung (di punggung)
  if (top === 3) { B.add(part(.12, .05, .06, '#f2f2f2', -.07, 1.46, -td / 2 - .005)); B.add(part(.12, .05, .06, '#f2f2f2', .07, 1.46, -td / 2 - .005)); B.add(part(.025, .62, .01, shade(l.shirt, .7), 0, 1.1, -td / 2 - .006)); }   // kerah + kancing
  if (top === 5) { B.add(part(tw + .02, .08, td + .02, shade(l.shirt, .75), 0, 1.44, 0)); B.add(part(.02, .66, .01, '#cfcfcf', 0, 1.1, -td / 2 - .006)); }                      // kerah + ritsleting
  if (top === 6) { B.add(part(.1, .05, .06, '#f2f2f2', -.06, 1.46, -td / 2 - .005)); B.add(part(.1, .05, .06, '#f2f2f2', .06, 1.46, -td / 2 - .005)); }

  const H = new THREE.Group(); H.position.y = 1.45; H.scale.setScalar(bd.hs); B.add(H);       // kepala (skala dari lehernya)
  const faceM = mat(0xffffff, { map: faceTex(+l.face || 0, l.skin) }), skinM = () => mat(l.skin);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.32, .32, .32), [skinM(), skinM(), skinM(), skinM(), skinM(), faceM]); head.position.y = .16; H.add(head);
  const hatC = l.hatc || HAT_DEF[hat];
  addHat(H, hat, hatC); addHatOrn(H, hat, +l.hornT || 0, l.ornc || HAT_ORN_DEF[+l.hornT || 0]);

  // lengan: pangkal di bahu, ayunan lewat rotation.x
  const arm = side => {
    const g = new THREE.Group(), w = .14 * bd.aw, d = .16 * bd.aw, s = noSleeve ? 0 : longSleeve ? .5 : .26;
    g.position.set(side * (tw / 2 + w / 2 + .01), 1.42, 0);
    if (s) { const m = part(w + .01, s, d + .01, shirtM(), 0, -s / 2, 0); g.add(m); }
    g.add(part(w, .62 - s, d, skinM(), 0, -s - (.62 - s) / 2, 0)); return g;
  };
  u.aL = arm(-1); u.aR = arm(1);

  // kaki: celana + kulit + sepatu
  const pantsLen = [.68, .34, 0, .68, .46][bot], pm = bot === 4 ? mat(0xffffff, { map: patTex('stripe', l.pants) }) : null;
  const leg = side => {
    const g = new THREE.Group(), w = .2 * bd.lw, d = .2 * bd.lw;
    g.position.set(side * (w / 2 + .03), .75, 0);
    if (pantsLen) g.add(part(w + .005, pantsLen, d + .005, pm || l.pants, 0, -pantsLen / 2, 0));
    if (pantsLen < .68) g.add(part(w, .68 - pantsLen, d, skinM(), 0, -pantsLen - (.68 - pantsLen) / 2, 0));
    g.add(part(w + .02, .07, d + .1, bot === 4 ? '#e8e2d4' : '#24262c', 0, -.715, -.04));     // sepatu
    if (bot === 3) g.add(part(.02, .16, d * .7, shade(l.pants, .8), side * (w / 2 + .006), -.25, 0));   // kantong kargo
    return g;
  };
  u.lL = leg(-1); u.lR = leg(1);
  [u.aL, u.aR, u.lL, u.lR].forEach(m => B.add(m));
  if (bot === 2) {                                                  // rok lipit melebar (A-line): pinggang pas, ujung melebar, panjang di atas lutut
    const k = new THREE.Mesh(new THREE.CylinderGeometry(.5, .72, .3, 16), mat(l.pants, { flatShading: true })); k.position.y = .64;
    k.scale.set(tw * 1.04, 1, td * 1.9); B.add(k);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(.725, .73, .03, 16), mat(shade(l.pants, .75), { flatShading: true })); hem.position.y = .505; hem.scale.set(tw * 1.04, 1, td * 1.9); B.add(hem);
    B.add(part(tw + .02, .07, td + .02, shade(l.pants, .7), 0, .78, 0));          // ikat pinggang
  }
  else B.add(part(tw + .005, .06, td + .005, shade(l.pants, .8), 0, .78, 0));                                                                       // pinggang celana

  addTopOrn(B, +l.tornT || 0, l.ornc || TOP_ORN_DEF[+l.tornT || 0], tw, td);
  root.userData.u = u; root.userData.top = (1.45 + (HAT_TOP[hat] + ([0, 0, 0, 0, .1, .1, .06, .2][+l.hornT || 0])) * bd.hs) * bd.h;
  return root;
}
// Bebaskan geometri dan bahan karakter yang dibuang (tekstur dibagi, jadi tidak ikut dibuang)
export function disposeAvatar(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.isSprite) [].concat(o.material).forEach(m => m.dispose()); }); }

// Label nama di atas kepala
export function nameTag(name, top = 1.77) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,22,28,.75)'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#fff'; g.font = '600 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
  s.scale.set(1, .25, 1); s.position.y = top + .32; return s;
}

// Ayunan tangan dan kaki. amt: 0 (diam) sampai 1 (jalan penuh)
export function animateAvatar(g, amt, t) {
  const u = g.userData.u, s = Math.sin(t * 8) * .7 * amt;
  u.aL.rotation.x = s; u.aR.rotation.x = -s; u.lL.rotation.x = -s; u.lR.rotation.x = s;
}

// Gelembung chat di atas kepala. Hilang sendiri setelah beberapa detik (lihat tickBubble).
function makeBubble(text, base) {
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
  s.position.y = base + c.height * k / 2; return s;
}
function clearBubble(g) {
  const b = g.userData.bubble; if (!b) return;
  g.remove(b.s); b.s.material.map.dispose(); b.s.material.dispose(); g.userData.bubble = null;
}
export function sayOver(g, text) {
  clearBubble(g); const s = makeBubble(text, (g.userData.top || 1.77) + .5); g.add(s);
  g.userData.bubble = { s, until: performance.now() + Math.min(9000, 3500 + text.length * 70) };
}
export function tickBubble(g) { const b = g.userData.bubble; if (b && performance.now() > b.until) clearBubble(g); }
