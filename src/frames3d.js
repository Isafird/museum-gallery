import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTex } from './frametex.js';

// Bentuk 3D tiap gaya bingkai. Bukaan lukisan berukuran 2,4 x 1,7 (setengahnya 1,2 x 0,85) dan berpusat di (0,0).
// z = jarak dari dinding: permukaan dinding di z = -0,05 dan lukisan di z = 0,06.
const cache = new Map();
let HX = 1.2, HY = .85;   // setengah lebar / tinggi bukaan lukisan (mendatar 1,2 x 0,85, tegak 0,85 x 1,2)
// tex = nama tekstur motif (lihat frametex.js). Dengan tekstur, color jadi pengali warna (putih = warna asli tekstur).
function mat(color, metal = 0, rough = .5, emissive = 0, ei = 0, tex = '') {
  const k = [color, metal, rough, emissive, ei, tex].join();
  if (!cache.has(k)) {
    const t = tex && getTex(tex), m = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive, emissiveIntensity: ei, map: t ? t.map : null });
    if (t) m.userData.tex = t; cache.set(k, m);
  }
  return cache.get(k);
}
// Atur UV kotak supaya motif mengikuti ukuran asli: sisi terpanjang = arah serat / garis, dan ukuran motif tetap di semua rail
function uvMap(geo, w, h, d, t, x, y) {
  const uv = geo.attributes.uv, faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const o = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1, ou = o, ov = t.fit ? 0 : (o * 7.13) % 1;
  for (let f = 0; f < 6; f++) {
    const [a, b] = faces[f], swap = b > a, lu = swap ? b : a, lv = swap ? a : b, unit = t.fit ? Math.max(1e-3, Math.min(a, b)) : t.tile;
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i; let u = uv.getX(k), v = uv.getY(k); if (swap) [u, v] = [v, u];
      uv.setXY(k, u * lu / unit + ou, v * lv / unit + ov);
    }
  }
  uv.needsUpdate = true;
}
const box = (g, w, h, d, x, y, z, m) => {
  const geo = new THREE.BoxGeometry(w, h, d); if (m.userData.tex) uvMap(geo, w, h, d, m.userData.tex, x, y);
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o;
};
const ball = (g, r, x, y, z, m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; };
const cone = (g, r, h, seg, x, y, z, m) => { const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); o.position.set(x, y, z); g.add(o); return o; };

// Empat rail di sekeliling bukaan. inset = jarak dari tepi bukaan, bt = lebar rail, front = tinggi muka rail dari dinding
function ring(g, bt, front, m, inset = 0) {
  const ix = HX + inset, iy = HY + inset, d = front + .05, z = (front - .05) / 2;
  box(g, 2 * (ix + bt), bt, d, 0, iy + bt / 2, z, m); box(g, 2 * (ix + bt), bt, d, 0, -iy - bt / 2, z, m);
  box(g, bt, 2 * iy, d, -ix - bt / 2, 0, z, m); box(g, bt, 2 * iy, d, ix + bt / 2, 0, z, m);
}
const corners = f => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(f);

const STYLES = {
  kayu: g => ring(g, .15, .05, mat(0xffffff, 0, .5, 0, 0, 'wood-walnut')),
  emas: g => ring(g, .15, .05, mat(0xffffff, .25, .35, 0, 0, 'gold-light')),
  putih: g => ring(g, .15, .05, mat(0xffffff, 0, .6, 0, 0, 'white')),
  hitam: g => ring(g, .15, .05, mat(0xffffff, .1, .3, 0, 0, 'ebony')),
  tipis: g => ring(g, .07, .05, mat(0xffffff, 0, .5, 0, 0, 'wood-oak')),

  // Kayu berlapis tiga dengan hiasan ukir di sudut dan tengah sisi
  ornamen(g) {
    const light = mat(0xffffff, 0, .45, 0, 0, 'wood-oak'), dark = mat(0xffffff, 0, .55, 0, 0, 'wood-dark'), mid = mat(0xffffff, 0, .5, 0, 0, 'wood-mid');
    ring(g, .06, .09, light, 0); ring(g, .08, .065, dark, .06); ring(g, .06, .05, mid, .14);
    const X = HX + .2, Y = HY + .2;
    corners(([sx, sy]) => ball(g, .11, sx * (X - .02), sy * (Y - .02), .09, light));
    [[0, -Y], [0, Y], [-X, 0], [X, 0]].forEach(([x, y]) => { const o = box(g, .15, .15, .05, x, y, .08, light); o.rotation.z = Math.PI / 4; });
  },

  // Emas bergaya istana: bingkai tebal, permata, dan mahkota di atas
  kerajaan(g) {
    const gold = mat(0xffffff, .3, .3, 0, 0, 'gold-light'), dgold = mat(0xffffff, .3, .35, 0, 0, 'gold-beads'), orn = mat(0xffffff, .25, .3, 0, 0, 'gold-ornate'), red = mat(0xb3122e, .2, .2, 0x5a0010, .6), blue = mat(0x2557d6, .2, .2, 0x0a1f66, .6);
    ring(g, .07, .12, dgold, 0); ring(g, .18, .075, orn, .07);
    const X = HX + .25, Y = HY + .25;
    corners(([sx, sy]) => { ball(g, .15, sx * X, sy * Y, .09, gold); ball(g, .06, sx * X, sy * Y, .23, red); });
    [[-X, 0], [X, 0], [0, -Y]].forEach(([x, y]) => ball(g, .07, x, y, .15, blue));
    box(g, .62, .1, .1, 0, Y + .02, .06, gold);                                   // alas mahkota
    [[-.22, .2], [0, .3], [.22, .2]].forEach(([x, h]) => { cone(g, .07, h, 4, x, Y + .07 + h / 2, .06, gold); ball(g, .04, x, Y + .07 + h, .06, red); });
    ball(g, .08, 0, Y + .02, .15, red);
  },

  // Merah muda dengan bintik putih dan telinga kucing
  lucu(g) {
    const pink = mat(0xff8fb8, 0, .6), yel = mat(0xffffff, 0, .6, 0, 0, 'yellow-stripe'), dots = mat(0xffffff, 0, .6, 0, 0, 'pink-dots'), yelP = mat(0xffe066, 0, .6);
    ring(g, .06, .09, yel, 0); ring(g, .2, .06, dots, .06);
    const Y = HY + .26, EX = HX - .35;
    [-1, 1].forEach(s => { const e = cone(g, .22, .36, 4, s * EX, Y + .15, .03, pink); e.rotation.y = Math.PI / 4; const i = cone(g, .12, .22, 4, s * EX, Y + .12, .07, yelP); i.rotation.y = Math.PI / 4; });
  },

  // Balok warna-warni seperti mainan
  fun(g) {
    const cols = ['fun-red', 'fun-yel', 'fun-grn', 'fun-blu', 'fun-pur'], bt = .17, d = .12, z = .035;
    const W = 2 * (HX + bt), H2 = 2 * HY, nT = Math.round(W / .34), nS = Math.round(H2 / .34); let k = 0;
    for (let i = 0; i < nT; i++) { const w = W / nT, x = -W / 2 + w * (i + .5); box(g, w - .015, bt, d, x, HY + bt / 2, z, mat(0xffffff, 0, .5, 0, 0, cols[k++ % 5])); box(g, w - .015, bt, d, x, -HY - bt / 2, z, mat(0xffffff, 0, .5, 0, 0, cols[k++ % 5])); }
    for (let j = 0; j < nS; j++) { const h = H2 / nS, y = -H2 / 2 + h * (j + .5); box(g, bt, h - .015, d, -(HX + bt / 2), y, z, mat(0xffffff, 0, .5, 0, 0, cols[k++ % 5])); box(g, bt, h - .015, d, HX + bt / 2, y, z, mat(0xffffff, 0, .5, 0, 0, cols[k++ % 5])); }
    corners(([sx, sy]) => ball(g, .09, sx * (HX + bt + .02), sy * (HY + bt + .02), .1, mat(0xffffff, 0, .4)));
  },

  // Passe-partout putih tipis dengan garis hitam halus
  minimalis(g) { ring(g, .13, .035, mat(0xffffff, 0, .9, 0, 0, 'linen'), 0); ring(g, .02, .055, mat(0x16161a, 0, .5), .13); },

  // Logam abu gelap yang tebal dengan garis perak
  modern(g) { ring(g, .06, .17, mat(0xffffff, .35, .35, 0, 0, 'steel-dark'), 0); ring(g, .015, .175, mat(0xffffff, .5, .25, 0, 0, 'steel-light'), .06); },

  // Rangka gelap dengan garis neon yang menyala
  neon(g) {
    ring(g, .05, .06, mat(0xffffff, .2, .5, 0, 0, 'carbon'), 0);
    ring(g, .016, .072, mat(0x00e5ff, 0, .4, 0x00e5ff, 2.4), 0);
    ring(g, .016, .072, mat(0xff2bd6, 0, .4, 0xff2bd6, 2.4), .034);
  },
};
// Gabungkan potongan bingkai yang bahannya sama jadi satu mesh (puluhan potongan -> beberapa saja): jauh lebih sedikit draw call
function mergeByMaterial(group) {
  const by = new Map();
  group.children.slice().forEach(o => {
    if (!o.isMesh) return; o.updateMatrix();
    const g = o.geometry.index ? o.geometry : o.geometry.toNonIndexed(); g.applyMatrix4(o.matrix);
    if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(g); group.remove(o);
  });
  by.forEach((list, m) => { const g = list.length > 1 ? mergeBufferGeometries(list) : list[0]; if (g) group.add(new THREE.Mesh(g, m)); });
}
export function buildFrame(group, id, vertical = false) { HX = vertical ? .85 : 1.2; HY = vertical ? 1.2 : .85; (STYLES[id] || STYLES.kayu)(group); mergeByMaterial(group); }
