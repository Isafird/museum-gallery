// Denah museum = daftar bentuk ruangan (digabung jadi satu lantai), dinding pembatas, dan bingkai.
//   shapes:   { k, x, z, w, h, r }  bentuk dalam kotak (x,z,w,h), r = putaran 0..3 x 90 derajat
//             { k:'poly', pts }     bentuk bebas
//   dividers: [x1, z1, x2, z2]      dinding pembatas di dalam ruangan
//   frames:   { id, x, z, a, pl, sp } bingkai menempel di dinding; (x,z) titik di tengah dinding, a = arah hadap,
//                                     pl = papan nama ('b' bawah, 't' atas, 'n' tidak ada), sp = lampu sorot
//   doors:    { x, z, a }             pintu di dinding (lebar DOOR_W); menyatukan ruang di kedua sisinya
//   lights:   [{ x, z, on }]          lampu ruangan (kalau kosong dibuat otomatis)
// Semua fungsi di sini murni (tanpa THREE) sehingga dipakai editor 2D dan tampilan 3D.
export const MAX_FRAMES = 40, MAX_LIGHTS = 12, WALL_T = .3, FRAME_OFF = .2, FRAME_W = 2.7, DOOR_W = 2.4, DOOR_D = 1.2;

const circle = Array.from({ length: 40 }, (_, i) => { const t = i / 40 * 2 * Math.PI; return [.5 + .5 * Math.cos(t), .5 + .5 * Math.sin(t)]; });
export const TEMPLATES = {
  rect: [[0, 0], [1, 0], [1, 1], [0, 1]],
  ellipse: circle,
  tri: [[.5, 0], [1, 1], [0, 1]],            // (tidak ada lagi di alat gambar, dipertahankan untuk denah lama)
  semi: Array.from({ length: 25 }, (_, i) => { const t = i / 24 * Math.PI; return [.5 + .5 * Math.cos(t), 1 - Math.sin(t)]; }),   // setengah lingkaran, sisi datar di bawah
  hex: [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]],
  ell: [[0, 0], [.4, 0], [.4, .6], [1, .6], [1, 1], [0, 1]],
  tee: [[0, 0], [1, 0], [1, .35], [.65, .35], [.65, 1], [.35, 1], [.35, .35], [0, .35]],
  plus: [[1/3, 0], [2/3, 0], [2/3, 1/3], [1, 1/3], [1, 2/3], [2/3, 2/3], [2/3, 1], [1/3, 1], [1/3, 2/3], [0, 2/3], [0, 1/3], [1/3, 1/3]],
};

export function defaultLayout() {
  const frames = []; let id = 0;
  [-9, -3, 3, 9].forEach(x => frames.push({ id: id++, x, z: -9, a: 0 }));
  [-9, -3, 3, 9].forEach(x => frames.push({ id: id++, x, z: 9, a: Math.PI }));
  [-3, 3].forEach(x => frames.push({ id: id++, x, z: 0, a: 0 }));
  [-3, 3].forEach(x => frames.push({ id: id++, x, z: 0, a: Math.PI }));
  return { v: 1, shapes: [{ k: 'rect', x: -15, z: -9, w: 30, h: 18, r: 0 }], dividers: [[-7, 0, 7, 0]], doors: [], frames };
}
export function normalizeLayout(l) {
  if (!l || !Array.isArray(l.shapes) || !l.shapes.length) return defaultLayout();
  const out = { v: 1, shapes: l.shapes.slice(0, 60), dividers: (l.dividers || []).slice(0, 80), doors: (l.doors || []).slice(0, 40), frames: (l.frames || []).slice(0, MAX_FRAMES) };
  if (Array.isArray(l.lights)) out.lights = l.lights.slice(0, MAX_LIGHTS);
  return out;
}

// ---------- geometri dasar ----------
// Lantai kecil di sekitar pintu (DOOR_W x DOOR_D). Ikut digabung ke lantai, sehingga dinding di lokasi pintu terbuka
export function doorPoly(d) {
  const nx = Math.sin(d.a), nz = Math.cos(d.a), tx = nz, tz = -nx, hw = DOOR_W / 2, hd = DOOR_D / 2;
  const p = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [d.x + tx * hw * a + nx * hd * b, d.z + tz * hw * a + nz * hd * b]);
  return area(p) < 0 ? p.reverse() : p;
}
export const area = p => p.reduce((s, q, i) => { const n = p[(i + 1) % p.length]; return s + q[0] * n[1] - n[0] * q[1]; }, 0) / 2;
export function shapePoly(s) {
  let pts;
  if (s.k === 'poly') pts = s.pts.map(p => [p[0], p[1]]);
  else {
    let u = TEMPLATES[s.k] || TEMPLATES.rect;
    for (let n = 0; n < (s.r || 0); n++) u = u.map(([a, b]) => [1 - b, a]);
    pts = u.map(([a, b]) => [s.x + a * s.w, s.z + b * s.h]);
  }
  return area(pts) < 0 ? pts.reverse() : pts;     // selalu berlawanan arah jarum jam
}
export function pip(p, q) {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, zi] = q[i], [xj, zj] = q[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function segD(x, z, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / L2));
  return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
}
function segT(a, b, c, d) {   // titik potong a-b dengan c-d (parameter t di a-b), atau null
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const qp = [c[0] - a[0], c[1] - a[1]], t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den;
  return t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
}
function onSeg(a, b, v) {     // v ada di tengah a-b? kembalikan t
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / L2;
  if (t <= 1e-9 || t >= 1 - 1e-9) return null;
  const px = a[0] + t * dx - v[0], pz = a[1] + t * dz - v[1];
  return px * px + pz * pz < 1e-8 ? t : null;
}

// Dinding = sisi luar gabungan semua bentuk. Sisi yang tertutup bentuk lain dibuang,
// jadi bentuk yang bertumpuk atau bersebelahan menyatu menjadi satu ruang.
function unionEdges(P) {
  const out = [], seen = new Set();
  P.forEach((poly, pi) => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], ts = [0, 1];
      P.forEach((q, qi) => {
        if (qi === pi) return;
        for (let j = 0; j < q.length; j++) {
          const t = segT(a, b, q[j], q[(j + 1) % q.length]); if (t !== null) ts.push(t);
          const t2 = onSeg(a, b, q[j]); if (t2 !== null) ts.push(t2);
        }
      });
      ts.sort((x, y) => x - y);
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
      for (let k = 0; k < ts.length - 1; k++) {
        if (ts[k + 1] - ts[k] < 1e-6) continue;
        const tm = (ts[k] + ts[k + 1]) / 2, mx = a[0] + dx * tm, mz = a[1] + dz * tm;
        const probe = [mx + dz / len * 1e-3, mz - dx / len * 1e-3];            // sedikit ke luar
        if (P.some((q, qi) => qi !== pi && pip(probe, q))) continue;            // tertutup bentuk lain
        const x1 = a[0] + dx * ts[k], z1 = a[1] + dz * ts[k], x2 = a[0] + dx * ts[k + 1], z2 = a[1] + dz * ts[k + 1];
        const key = [x1, z1, x2, z2].map(v => Math.round(v * 1000)); const kk = (key[0] < key[2] || (key[0] === key[2] && key[1] <= key[3]) ? key : [key[2], key[3], key[0], key[1]]).join(',');
        if (seen.has(kk)) continue; seen.add(kk);
        out.push({ x1, z1, x2, z2, nx: -dz / len, nz: dx / len, div: false });   // normal ke arah dalam ruangan
      }
    }
  });
  return out;
}

export function analyze(l) {
  const doors = l.doors || [], polys = l.shapes.map(shapePoly).concat(doors.map(doorPoly)), walls = unionEdges(polys);
  (l.dividers || []).forEach(([x1, z1, x2, z2]) => {          // dinding pembatas, dipotong di tempat pintu
    const L = Math.hypot(x2 - x1, z2 - z1); if (L < 1e-6) return;
    const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = -uz, nz = ux, cuts = [];
    doors.forEach(d => {
      if (segD(d.x, d.z, x1, z1, x2, z2) > .06 || Math.abs(Math.sin(d.a) * nx + Math.cos(d.a) * nz) < .98) return;
      const s = (d.x - x1) * ux + (d.z - z1) * uz; cuts.push([s - DOOR_W / 2, s + DOOR_W / 2]);
    });
    cuts.sort((a, b) => a[0] - b[0]); let cur = 0;
    const piece = (a, b) => { if (b - a > .05) walls.push({ x1: x1 + ux * a, z1: z1 + uz * a, x2: x1 + ux * b, z2: z1 + uz * b, nx, nz, div: true }); };
    cuts.forEach(([a, b]) => { if (a > cur) piece(cur, Math.min(a, L)); cur = Math.max(cur, b); }); if (cur < L) piece(cur, L);
  });
  const all = polys.flat(), b = { minx: Infinity, maxx: -Infinity, minz: Infinity, maxz: -Infinity };
  all.forEach(([x, z]) => { b.minx = Math.min(b.minx, x); b.maxx = Math.max(b.maxx, x); b.minz = Math.min(b.minz, z); b.maxz = Math.max(b.maxz, z); });
  const bounds = all.length ? b : { minx: -5, maxx: 5, minz: -5, maxz: 5 };
  return { polys, walls, bounds, lights: Array.isArray(l.lights) ? l.lights : autoLights({ polys, bounds }) };
}
// Lampu ruangan otomatis: kisi merata di dalam lantai, paling banyak MAX_LIGHTS
export function autoLights(m) {
  const b = m.bounds;
  for (let s = 6; s < 40; s++) {
    const out = [];
    for (let x = b.minx + s / 2; x < b.maxx; x += s) for (let z = b.minz + s / 2; z < b.maxz; z += s)
      if (inFloor(m, x, z)) out.push({ x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2, on: true });
    if (out.length && out.length <= MAX_LIGHTS) return out;
  }
  return [{ x: Math.round((b.minx + b.maxx)), z: Math.round((b.minz + b.maxz)), on: true }].map(l => ({ x: l.x / 2, z: l.z / 2, on: true }));
}
export const inFloor = (m, x, z) => m.polys.some(q => pip([x, z], q));
export const walkable = (m, x, z, r = .45) => inFloor(m, x, z) && m.walls.every(w => segD(x, z, w.x1, w.z1, w.x2, w.z2) >= r);
const areaCache = new WeakMap();
export function floorArea(m) {   // perkiraan luas lantai (m2), dihitung per 0,5 m (di-cache per hasil analisis)
  if (areaCache.has(m)) return areaCache.get(m);
  let n = 0; const b = m.bounds;
  for (let x = b.minx + .25; x < b.maxx; x += .5) for (let z = b.minz + .25; z < b.maxz; z += .5) if (inFloor(m, x, z)) n++;
  const r = Math.round(n * .25); areaCache.set(m, r); return r;
}
export function findSpawn(m) {
  const b = m.bounds, cx = (b.minx + b.maxx) / 2, cz = (b.minz + b.maxz) / 2; let best = null, bd = 1e9;
  for (let x = Math.ceil(b.minx); x <= b.maxx; x++) for (let z = Math.ceil(b.minz); z <= b.maxz; z++)
    if (walkable(m, x, z, 1.2)) { const d = Math.hypot(x - cx, z - cz); if (d < bd) { bd = d; best = [x, z]; } }
  return best || [cx, cz];
}

// ---------- bingkai di dinding ----------
// Cari titik dinding terdekat dari (px,pz), disnap ke kelipatan `step` meter. null kalau tidak ada.
// Gabungkan potongan dinding yang segaris dan bersambung (dinding terpecah di titik singgung bentuk lain)
const mergedCache = new WeakMap();
function mergeWalls(ws) {
  if (mergedCache.has(ws)) return mergedCache.get(ws);
  const groups = new Map();
  for (const w of ws) {
    const dx = w.x2 - w.x1, dz = w.z2 - w.z1, L = Math.hypot(dx, dz); if (L < 1e-9) continue;
    let [ax, az, bx, bz] = [w.x1, w.z1, w.x2, w.z2], ux = dx / L, uz = dz / L;
    if (ux < -1e-9 || (Math.abs(ux) < 1e-9 && uz < 0)) { [ax, az, bx, bz] = [bx, bz, ax, az]; ux = -ux; uz = -uz; }
    const key = [Math.round(ux * 1e3), Math.round(uz * 1e3), Math.round((-uz * ax + ux * az) * 100), +w.div, Math.round(w.nx * 1e3), Math.round(w.nz * 1e3)].join();
    if (!groups.has(key)) groups.set(key, { ux, uz, nx: w.nx, nz: w.nz, div: w.div, items: [] });
    groups.get(key).items.push({ t0: ux * ax + uz * az, t1: ux * bx + uz * bz, ax, az });
  }
  const out = [];
  for (const g of groups.values()) {
    g.items.sort((p, q) => p.t0 - q.t0); let cur = null;
    const flush = () => { if (cur) out.push({ x1: cur.ax, z1: cur.az, x2: cur.ax + g.ux * (cur.t1 - cur.t0), z2: cur.az + g.uz * (cur.t1 - cur.t0), nx: g.nx, nz: g.nz, div: g.div }); };
    for (const it of g.items) { if (cur && it.t0 <= cur.t1 + 1e-3) cur.t1 = Math.max(cur.t1, it.t1); else { flush(); cur = { ...it }; } }
    flush();
  }
  mergedCache.set(ws, out); return out;
}
export function snapToWall(m, px, pz, step = .5, margin0 = FRAME_W / 2 + .1) {
  let best = null;
  for (const w of mergeWalls(m.walls)) {
    const dx = w.x2 - w.x1, dz = w.z2 - w.z1, L = Math.hypot(dx, dz); if (L < .2) continue;
    const margin = Math.min(margin0, L / 2);       // sisi pendek (dinding melengkung): bingkai di tengah sisi
    const ux = dx / L, uz = dz / L, clamp = s => Math.max(margin, Math.min(L - margin, s));
    let s = clamp((px - w.x1) * ux + (pz - w.z1) * uz);
    const horiz = Math.abs(uz) < 1e-6, vert = Math.abs(ux) < 1e-6;
    if (horiz || vert) { const base = horiz ? w.x1 : w.z1, dir = horiz ? ux : uz; s = clamp((Math.round((base + dir * s) / step) * step - base) / dir); }
    else s = clamp(Math.round(s / step) * step);
    const ax = w.x1 + ux * s, az = w.z1 + uz * s, d = Math.hypot(px - ax, pz - az);
    let nx = w.nx, nz = w.nz;
    if (w.div && (px - ax) * -uz + (pz - az) * ux < 0) { nx = -nx; nz = -nz; }   // dinding pembatas: pilih sisi kursor
    const rank = d + (L < 2 * margin0 ? .6 : 0);      // dinding lurus panjang diutamakan daripada sisi-sisi pendek lingkaran
    if (!best || rank < best.rank) best = { x: +ax.toFixed(3), z: +az.toFixed(3), a: +Math.atan2(nx, nz).toFixed(4), d, rank };
  }
  return best && best.d < 2 ? best : null;
}
export function frameOnWall(f, m) {
  const nx = Math.sin(f.a), nz = Math.cos(f.a);
  return m.walls.some(w => segD(f.x, f.z, w.x1, w.z1, w.x2, w.z2) < .06 && (w.div ? Math.abs(nx * w.nx + nz * w.nz) : nx * w.nx + nz * w.nz) > .98);
}
