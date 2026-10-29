import { FILTERS } from './config.js';

// Filter foto dihitung per piksel (tanpa ctx.filter), jadi hasilnya sama di semua browser termasuk Safari iPhone.
// Nilai filter disimpan sebagai teks: "id" (bawaan) atau "id~b10,c-5,w20" (bawaan + penyesuaian manual).
export const ADJ = [   // [kunci, nama, min, maks]
  ['b', 'Kecerahan', -100, 100], ['c', 'Kontras', -100, 100], ['s', 'Saturasi', -100, 100],
  ['w', 'Suhu (dingin - hangat)', -100, 100], ['t', 'Warna (hijau - magenta)', -100, 100],
  ['f', 'Pudar', 0, 100], ['v', 'Vinyet', 0, 100], ['g', 'Butiran film', 0, 100], ['n', 'Ketajaman', 0, 100],
];
const KEYS = ['b', 'c', 's', 'w', 't', 'f', 'v', 'g', 'n', 'sep'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function parseFilter(str) {
  const [id, rest] = String(str || 'none').split('~'), adj = {};
  if (rest) rest.split(',').forEach(kv => { const m = /^([a-z]+)(-?\d+)$/.exec(kv); if (m && KEYS.includes(m[1])) adj[m[1]] = clamp(+m[2], -100, 100); });
  return { id: FILTERS.some(f => f.id === id) ? id : 'none', adj };
}
export function stringifyFilter(id, adj) {
  const parts = Object.entries(adj).filter(([, v]) => v).map(([k, v]) => k + Math.round(v));
  return parts.length ? id + '~' + parts.join(',') : id;
}
const params = ({ id, adj }) => {
  const base = FILTERS.find(f => f.id === id).p, o = {};
  KEYS.forEach(k => { const v = (base[k] || 0) + (adj[k] || 0); o[k] = ['f', 'v', 'g', 'n', 'sep'].includes(k) ? clamp(v, 0, 100) : clamp(v, -100, 100); });
  return o;
};

// Terapkan filter ke area (x, y, w, h) pada kanvas 2D g
export function applyFilter(g, x, y, w, h, str) {
  const P = params(parseFilter(str)); if (KEYS.every(k => !P[k])) return;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); if (w < 1 || h < 1) return;
  const img = g.getImageData(x, y, w, h), d = img.data;
  const B = P.b * 1.28, C = P.c * 1.28, cf = (259 * (C + 255)) / (255 * (259 - C)), S = 1 + P.s / 100, sep = P.sep / 100;
  const wr = P.w * .32, wg = P.w * .05, wb = -P.w * .32, tg = -P.t * .24, tr = P.t * .08;
  const fade = P.f / 100, fa = 1 - fade * .22, fb = fade * 255 * .12, vig = P.v / 100, gr = P.g * .45;
  for (let py = 0, i = 0; py < h; py++) {
    const ny = (py / h - .5) * 2;
    for (let px = 0; px < w; px++, i += 4) {
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      if (sep) { const a = .393 * r + .769 * gg + .189 * b, c2 = .349 * r + .686 * gg + .168 * b, e = .272 * r + .534 * gg + .131 * b; r += (a - r) * sep; gg += (c2 - gg) * sep; b += (e - b) * sep; }
      if (B) { r += B; gg += B; b += B; }
      if (C) { r = (r - 128) * cf + 128; gg = (gg - 128) * cf + 128; b = (b - 128) * cf + 128; }
      if (P.s) { const L = .299 * r + .587 * gg + .114 * b; r = L + (r - L) * S; gg = L + (gg - L) * S; b = L + (b - L) * S; }
      if (P.w) { r += wr; gg += wg; b += wb; }
      if (P.t) { gg += tg; r += tr; b += tr; }
      if (fade) { r = r * fa + fb; gg = gg * fa + fb; b = b * fa + fb; }
      if (vig) { const nx = (px / w - .5) * 2, dd = Math.sqrt(nx * nx + ny * ny) / 1.414, k = dd < .35 ? 0 : (dd - .35) / .65, m = 1 - vig * .75 * k * k; r *= m; gg *= m; b *= m; }
      if (gr) { const hs = (Math.imul(px, 73856093) ^ Math.imul(py, 19349663)) >>> 0, nz = ((hs % 1000) / 500 - 1) * gr; r += nz; gg += nz; b += nz; }
      d[i] = r; d[i + 1] = gg; d[i + 2] = b;      // Uint8ClampedArray membatasi 0..255
    }
  }
  if (P.n) sharpen(d, w, h, P.n / 100 * .8);
  g.putImageData(img, x, y);
}
function sharpen(d, w, h, a) {
  const src = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) d[i + c] = src[i + c] * (1 + 4 * a) - a * (src[i + c - 4] + src[i + c + 4] + src[i + c - w * 4] + src[i + c + w * 4]);
  }
}
