import * as THREE from 'three';

// Tekstur motif untuk bingkai, digambar dengan canvas (tanpa file gambar).
// Arah serat / garis selalu sepanjang sumbu u (panjang rail). tile = ukuran ulangan dalam meter,
// fit = true: seluruh tinggi tekstur dipakai untuk lebar rail (untuk motif ukiran yang tidak boleh terpotong).
const S = 256;
const rng = seed => { let s = (seed | 0) || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${Math.max(0, Math.min(100, l))}%,${a})`;
function mk() { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; }
const TAU = Math.PI * 2;

// ---- kayu: serat bergelombang + mata kayu ----
function wood(h, s, l, contrast = 1, seed = 1) {
  const [c, g] = mk(), r = rng(seed); let v = 0;
  for (let y = 0; y < S; y++) { v += (r() - .5) * 4; v *= .92; g.fillStyle = hsl(h, s, l + v * contrast); g.fillRect(0, y, S, 1); }
  for (let k = 0; k < 80; k++) {
    const y0 = r() * S, amp = 1 + r() * 5, per = 1 + Math.floor(r() * 3), ph = r() * TAU, dark = r() < .65;
    g.strokeStyle = dark ? hsl(h, s, l - (8 + r() * 8) * contrast, .22 + r() * .3) : hsl(h, s - 5, l + (6 + r() * 6) * contrast, .16 + r() * .2);
    g.lineWidth = .6 + r() * 1.5; g.beginPath();
    for (let x = 0; x <= S; x += 4) { const y = y0 + Math.sin(x / S * TAU * per + ph) * amp + Math.sin(x / S * TAU * per * 2 + ph * 2) * amp * .3; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  for (let k = 0; k < 2; k++) {
    const x = 30 + r() * (S - 60), y = 30 + r() * (S - 60);
    for (let n = 6; n > 0; n--) { g.strokeStyle = hsl(h, s, l - 16 + n * 2, .35); g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, n * 5, n * 2.2, 0, 0, TAU); g.stroke(); }
    g.fillStyle = hsl(h, s, l - 22, .55); g.beginPath(); g.ellipse(x, y, 4, 2, 0, 0, TAU); g.fill();
  }
  return c;
}

// ---- emas: pita pantulan + goresan halus + kilau ----
function gold(light, seed = 3) {
  const [c, g] = mk(), r = rng(seed), gr = g.createLinearGradient(0, 0, 0, S);
  const st = light ? ['#8a6a14', '#f3d77a', '#c9a227', '#fff1b0', '#b8921c', '#e8c85a', '#9c7a1d'] : ['#6e4f0e', '#c9a227', '#8a6a14', '#e8c85a', '#7a5a10', '#bf9a22', '#5e440b'];
  st.forEach((col, i) => gr.addColorStop(i / (st.length - 1), col)); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < .5 ? 'rgba(255,245,200,.07)' : 'rgba(60,40,0,.07)'; g.fillRect(r() * S, r() * S, 20 + r() * 90, 1); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,235,${.2 + r() * .4})`; g.fillRect(r() * S, r() * S, 1.5, 1.5); }
  return c;
}
// emas berukir: garis tepi, pola gulungan daun yang berulang, dan manik-manik kecil
function goldOrnate() {
  const c = gold(true, 7), g = c.getContext('2d');
  g.strokeStyle = '#6e4f0e'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 18); g.lineTo(S, 18); g.moveTo(0, S - 18); g.lineTo(S, S - 18); g.stroke();
  for (let x = 8; x < S; x += 16) for (const y of [36, S - 36]) { g.fillStyle = '#7a5a10'; g.beginPath(); g.arc(x + 1, y + 1, 9, 0, TAU); g.fill(); g.fillStyle = '#ffeaa0'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); }
  const spiral = (cx, cy, dir) => { g.beginPath(); for (let t = 0; t <= 1.001; t += .04) { const a = t * 9, rr = 28 * (1 - t * .85), x = cx + dir * Math.cos(a) * rr, y = cy + Math.sin(a) * rr; t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
  g.lineWidth = 5;
  for (let i = 0; i < 2; i++) {
    const cx = i * 128 + 64; g.strokeStyle = '#6e4f0e';
    spiral(cx - 32, S / 2, 1); spiral(cx + 32, S / 2, -1);
    g.fillStyle = '#fff1b0'; g.strokeStyle = '#6e4f0e'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, S / 2 - 14); g.lineTo(cx + 9, S / 2); g.lineTo(cx, S / 2 + 14); g.lineTo(cx - 9, S / 2); g.closePath(); g.fill(); g.stroke(); g.lineWidth = 5;
  }
  return c;
}
function goldBeads() {
  const c = gold(false, 5), g = c.getContext('2d');
  for (let i = 0; i < 2; i++) {
    const x = i * 128 + 64, y = S / 2, rg = g.createRadialGradient(x - 14, y - 14, 4, x, y, 56);
    rg.addColorStop(0, '#fff6c8'); rg.addColorStop(.5, '#d4af37'); rg.addColorStop(1, '#5e440b'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, 56, 0, TAU); g.fill();
  }
  return c;
}

// ---- cat putih, kayu hitam (eboni) ----
function paintWhite() {
  const [c, g] = mk(), r = rng(11); g.fillStyle = '#f2f1ed'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(120,115,105,${.03 + r() * .05})`; g.fillRect(0, r() * S, S, .8 + r() * 1.5); }
  for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(150,145,135,.12)'; g.fillRect(r() * S, r() * S, 1.5, 1.5); }
  return c;
}
function ebony() {
  const [c, g] = mk(), r = rng(13); g.fillStyle = '#121216'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${60 + r() * 30},${60 + r() * 30},${70 + r() * 30},${.15 + r() * .25})`; g.lineWidth = .6 + r(); const y = r() * S, a = 1 + r() * 3, p = 1 + Math.floor(r() * 3); g.beginPath(); for (let x = 0; x <= S; x += 4) { const yy = y + Math.sin(x / S * TAU * p) * a; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.35, 'rgba(255,255,255,.14)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S); return c;
}

// ---- lucu & fun ----
function yellowStripe() {
  const [c, g] = mk(); g.fillStyle = '#ffd54a'; g.fillRect(0, 0, S, S); g.fillStyle = '#fff1a8';
  for (let k = 0; k <= 16; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + 16, 0); g.lineTo(k * 32 + 16 - S, S); g.lineTo(k * 32 - S, S); g.closePath(); g.fill(); }
  return c;
}
function pinkDots() {
  const [c, g] = mk(); g.fillStyle = '#ff8fb8'; g.fillRect(0, 0, S, S);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = i * 64 + (j % 2 ? 32 : 0) + 16, y = j * 64 + 32;
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x, y, 13, 0, TAU); g.fill();
    g.fillStyle = '#ffe066'; g.beginPath(); g.arc((x + 32) % S, y + 32 > S ? y - 32 : y + 32, 5, 0, TAU); g.fill();
  }
  return c;
}
function confetti(color, seed) {
  const [c, g] = mk(), r = rng(seed); g.fillStyle = color; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) {
    g.save(); g.translate(r() * S, r() * S); g.rotate(r() * TAU); g.fillStyle = r() < .5 ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.18)';
    if (r() < .5) g.fillRect(-7, -2.5, 14, 5); else { g.beginPath(); g.arc(0, 0, 3 + r() * 3, 0, TAU); g.fill(); } g.restore();
  }
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return c;
}

// ---- minimalis, modern, neon ----
function linen() {
  const [c, g] = mk(), r = rng(17); g.fillStyle = '#f4f3ef'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(110,105,95,${.03 + r() * .06})`; g.fillRect(0, y, S, 1); }
  for (let x = 0; x < S; x += 2) { g.fillStyle = `rgba(110,105,95,${.02 + r() * .05})`; g.fillRect(x, 0, 1, S); }
  return c;
}
function brushed(l, seed) {
  const [c, g] = mk(), r = rng(seed), h = 215; g.fillStyle = hsl(h, 8, l); g.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) { g.fillStyle = r() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; g.fillRect(r() * S, r() * S, 30 + r() * 140, 1); }
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(.3, 'rgba(255,255,255,.18)'); gr.addColorStop(.6, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S); return c;
}
function carbon() {
  const [c, g] = mk();
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    const x = i * 16, y = j * 16, horiz = (i + j) % 2 === 0, gr = horiz ? g.createLinearGradient(x, y, x, y + 16) : g.createLinearGradient(x, y, x + 16, y);
    gr.addColorStop(0, '#2d3039'); gr.addColorStop(.5, '#14161b'); gr.addColorStop(1, '#2a2d35'); g.fillStyle = gr; g.fillRect(x, y, 16, 16);
  }
  return c;
}

// ---- daftar tekstur ----
const MAKE = {
  'wood-walnut': { f: () => wood(26, 38, 19, 1, 1), tile: .7 },
  'wood-oak': { f: () => wood(32, 46, 40, 1.1, 4), tile: .7 },
  'wood-dark': { f: () => wood(22, 40, 17, 1, 8), tile: .7 },
  'wood-mid': { f: () => wood(27, 42, 30, 1, 6), tile: .7 },
  gold: { f: () => gold(false), tile: .5 },
  'gold-light': { f: () => gold(true, 9), tile: .5 },
  'gold-ornate': { f: goldOrnate, fit: true },
  'gold-beads': { f: goldBeads, fit: true },
  white: { f: paintWhite, tile: .8 },
  ebony: { f: ebony, tile: .7 },
  'yellow-stripe': { f: yellowStripe, tile: .6 },
  'pink-dots': { f: pinkDots, tile: .8 },
  linen: { f: linen, tile: .5 },
  'steel-dark': { f: () => brushed(26, 21), fit: true },
  'steel-light': { f: () => brushed(75, 23), fit: true },
  carbon: { f: carbon, tile: .3 },
};
[['red', '#ff595e'], ['yel', '#ffca3a'], ['grn', '#8ac926'], ['blu', '#1982c4'], ['pur', '#6a4c93']].forEach(([k, col], i) => { MAKE['fun-' + k] = { f: () => confetti(col, 30 + i), tile: .4 }; });

const cache = new Map();
export function getTex(name) {
  if (!cache.has(name)) {
    const d = MAKE[name]; if (!d) return null;
    const canvas = d.f(), map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
    cache.set(name, { canvas, map, tile: d.tile || 1, fit: !!d.fit });
  }
  return cache.get(name);
}

// Gambar kecil untuk pilihan gaya bingkai di editor foto
const SW = { kayu: 'wood-walnut', emas: 'gold-light', putih: 'white', hitam: 'ebony', tipis: 'wood-oak', ornamen: 'wood-oak', kerajaan: 'gold-ornate', lucu: 'pink-dots', fun: 'fun-grn', minimalis: 'linen', modern: 'steel-dark', neon: 'carbon' };
const swCache = new Map();
export function frameSwatch(id) {
  if (!swCache.has(id)) { const t = SW[id] && getTex(SW[id]); swCache.set(id, t ? `url(${t.canvas.toDataURL('image/jpeg', .7)})` : null); }
  return swCache.get(id);
}
