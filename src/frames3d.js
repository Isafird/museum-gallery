import * as THREE from 'three';

// Bentuk 3D tiap gaya bingkai. Bukaan lukisan berukuran 2,4 x 1,7 (setengahnya 1,2 x 0,85) dan berpusat di (0,0).
// z = jarak dari dinding: permukaan dinding di z = -0,05 dan lukisan di z = 0,06.
const cache = new Map();
function mat(color, metal = 0, rough = .5, emissive = 0, ei = 0) {
  const k = [color, metal, rough, emissive, ei].join();
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive, emissiveIntensity: ei }));
  return cache.get(k);
}
const box = (g, w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
const ball = (g, r, x, y, z, m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); g.add(o); return o; };
const cone = (g, r, h, seg, x, y, z, m) => { const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); o.position.set(x, y, z); g.add(o); return o; };

// Empat rail di sekeliling bukaan. inset = jarak dari tepi bukaan, bt = lebar rail, front = tinggi muka rail dari dinding
function ring(g, bt, front, m, inset = 0) {
  const ix = 1.2 + inset, iy = .85 + inset, d = front + .05, z = (front - .05) / 2;
  box(g, 2 * (ix + bt), bt, d, 0, iy + bt / 2, z, m); box(g, 2 * (ix + bt), bt, d, 0, -iy - bt / 2, z, m);
  box(g, bt, 2 * iy, d, -ix - bt / 2, 0, z, m); box(g, bt, 2 * iy, d, ix + bt / 2, 0, z, m);
}
const corners = f => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(f);

const STYLES = {
  kayu: g => ring(g, .15, .05, mat(0x2a2018, 0, .5)),
  emas: g => ring(g, .15, .05, mat(0xc9a227, .4, .4)),
  putih: g => ring(g, .15, .05, mat(0xf2f1ed, 0, .6)),
  hitam: g => ring(g, .15, .05, mat(0x0f0f12, .1, .4)),
  tipis: g => ring(g, .07, .05, mat(0x2a2018, 0, .5)),

  // Kayu berlapis tiga dengan hiasan ukir di sudut dan tengah sisi
  ornamen(g) {
    const light = mat(0x9a6a3a, 0, .45), dark = mat(0x3a2412, 0, .55), mid = mat(0x6b4423, 0, .5);
    ring(g, .06, .09, light, 0); ring(g, .08, .065, dark, .06); ring(g, .06, .05, mid, .14);
    const X = 1.4, Y = 1.05;
    corners(([sx, sy]) => ball(g, .11, sx * (X - .02), sy * (Y - .02), .09, light));
    [[0, -Y], [0, Y], [-X, 0], [X, 0]].forEach(([x, y]) => { const o = box(g, .15, .15, .05, x, y, .08, light); o.rotation.z = Math.PI / 4; });
  },

  // Emas bergaya istana: bingkai tebal, permata, dan mahkota di atas
  kerajaan(g) {
    const gold = mat(0xd4af37, .6, .3), dgold = mat(0x9c7a1d, .5, .35), red = mat(0xb3122e, .2, .2, 0x5a0010, .6), blue = mat(0x2557d6, .2, .2, 0x0a1f66, .6);
    ring(g, .07, .12, dgold, 0); ring(g, .18, .075, gold, .07);
    const X = 1.45, Y = 1.1;
    corners(([sx, sy]) => { ball(g, .15, sx * X, sy * Y, .09, gold); ball(g, .06, sx * X, sy * Y, .23, red); });
    [[-X, 0], [X, 0], [0, -Y]].forEach(([x, y]) => ball(g, .07, x, y, .15, blue));
    box(g, .62, .1, .1, 0, Y + .02, .06, gold);                                   // alas mahkota
    [[-.22, .2], [0, .3], [.22, .2]].forEach(([x, h]) => { cone(g, .07, h, 4, x, Y + .07 + h / 2, .06, gold); ball(g, .04, x, Y + .07 + h, .06, red); });
    ball(g, .08, 0, Y + .02, .15, red);
  },

  // Merah muda dengan bintik putih dan telinga kucing
  lucu(g) {
    const pink = mat(0xff8fb8, 0, .6), yel = mat(0xffe066, 0, .6), white = mat(0xffffff, 0, .5);
    ring(g, .06, .09, yel, 0); ring(g, .2, .06, pink, .06);
    const X = 1.46, Y = 1.11;
    for (let i = -5; i <= 5; i++) { ball(g, .045, i * .26, Y - .13, .075, white); ball(g, .045, i * .26, -(Y - .13), .075, white); }
    for (let j = -3; j <= 3; j++) { ball(g, .045, X - .13, j * .26, .075, white); ball(g, .045, -(X - .13), j * .26, .075, white); }
    [-1, 1].forEach(s => { const e = cone(g, .22, .36, 4, s * .85, Y + .15, .03, pink); e.rotation.y = Math.PI / 4; const i = cone(g, .12, .22, 4, s * .85, Y + .12, .07, yel); i.rotation.y = Math.PI / 4; });
  },

  // Balok warna-warni seperti mainan
  fun(g) {
    const cols = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93], bt = .17, d = .12, z = .035;
    const W = 2 * (1.2 + bt), H2 = 1.7; let k = 0;
    for (let i = 0; i < 8; i++) { const w = W / 8, x = -W / 2 + w * (i + .5); box(g, w - .015, bt, d, x, .85 + bt / 2, z, mat(cols[k++ % 5], 0, .5)); box(g, w - .015, bt, d, x, -.85 - bt / 2, z, mat(cols[k++ % 5], 0, .5)); }
    for (let j = 0; j < 5; j++) { const h = H2 / 5, y = -H2 / 2 + h * (j + .5); box(g, bt, h - .015, d, -(1.2 + bt / 2), y, z, mat(cols[k++ % 5], 0, .5)); box(g, bt, h - .015, d, 1.2 + bt / 2, y, z, mat(cols[k++ % 5], 0, .5)); }
    corners(([sx, sy]) => ball(g, .09, sx * (1.2 + bt + .02), sy * (.85 + bt + .02), .1, mat(0xffffff, 0, .4)));
  },

  // Passe-partout putih tipis dengan garis hitam halus
  minimalis(g) { ring(g, .13, .035, mat(0xf4f3ef, 0, .9), 0); ring(g, .02, .055, mat(0x16161a, 0, .5), .13); },

  // Logam abu gelap yang tebal dengan garis perak
  modern(g) { ring(g, .06, .17, mat(0x2b2f36, .7, .35), 0); ring(g, .015, .175, mat(0xc7ccd4, .9, .2), .06); },

  // Rangka gelap dengan garis neon yang menyala
  neon(g) {
    ring(g, .05, .06, mat(0x0d0f14, .2, .5), 0);
    ring(g, .016, .072, mat(0x00e5ff, 0, .4, 0x00e5ff, 2.4), 0);
    ring(g, .016, .072, mat(0xff2bd6, 0, .4, 0xff2bd6, 2.4), .034);
  },
};
export function buildFrame(group, id) { (STYLES[id] || STYLES.kayu)(group); }
