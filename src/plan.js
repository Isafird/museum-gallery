import { state } from './state.js';
import { analyze, shapePoly, snapToWall, frameOnWall, floorArea, pip, segD, MAX_FRAMES, FRAME_W } from './layout.js';
import { toggleModal } from './modal.js';
import { toast } from './toast.js';
import { commitLayout } from './world.js';

const $ = id => document.getElementById(id);
const el = $('plan'), cv = $('plc'), g = cv.getContext('2d');
const TOOLS = [['pan', 'Geser'], ['rect', 'Kotak'], ['circle', 'Lingkaran'], ['ellipse', 'Elips'], ['tri', 'Segitiga'], ['hex', 'Segi enam'],
  ['ell', 'Bentuk L'], ['tee', 'Bentuk T'], ['plus', 'Plus'], ['poly', 'Bebas'], ['wall', 'Dinding'], ['frame', 'Bingkai'], ['del', 'Hapus']];
const HINT = {
  pan: 'Seret untuk menggeser. Roda mouse untuk zoom.', poly: 'Klik titik-titik sudut. Klik titik awal atau tekan Enter untuk menutup.',
  wall: 'Seret untuk membuat dinding pembatas.', frame: 'Arahkan ke dinding lalu klik untuk menaruh bingkai.',
  del: 'Klik bingkai, dinding, atau ruangan untuk menghapus.',
};
let work, m, tool = 'rect', rot = 0, grid = 1, mir = 0, view = { cx: 0, cz: 0, s: 20 };
let start = null, pts = [], hov = null, raw = null, hist = [], pan = null, W = 1, H = 1, dpr = 1;

TOOLS.forEach(([id, name]) => {
  const b = document.createElement('button'); b.className = 'chip'; b.dataset.tool = id; b.textContent = name; b.onclick = () => setTool(id); $('pltools').append(b);
});
function setTool(t) {
  tool = t; start = null; pts = [];
  document.querySelectorAll('#pltools .chip').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); info(); draw();
}

// ---------- buka / tutup ----------
export function openPlan() {
  if (!state.access.canManage) { toast('Hanya pemilik yang bisa mengubah denah'); return; }
  work = JSON.parse(JSON.stringify(state.layout)); hist = []; rot = 0;
  toggleModal(el); resize(); reanalyze(); fit(); setTool('rect');
}
function resize() { dpr = devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; }
addEventListener('resize', () => { if (el.classList.contains('open')) { resize(); draw(); } });
function fit() {
  const b = m.bounds, bw = b.maxx - b.minx + 6, bh = b.maxz - b.minz + 6;
  view = { cx: (b.minx + b.maxx) / 2, cz: (b.minz + b.maxz) / 2, s: Math.max(4, Math.min(80, Math.min(W / bw, H / bh))) };
}
function reanalyze() { m = analyze(work); info(); }
function info() {
  const hp = hov ? `   x ${hov[0]}, z ${hov[1]}` : '';
  $('pinfo').textContent = `Luas ±${floorArea(m)} m², ${work.frames.length}/${MAX_FRAMES} bingkai${hp}. ${HINT[tool] || 'Seret di kanvas untuk menggambar. R untuk memutar.'}`;
}
function commit(fn) { hist.push(JSON.stringify(work)); if (hist.length > 60) hist.shift(); fn(); reanalyze(); draw(); }
function undo() { if (hist.length) { work = JSON.parse(hist.pop()); reanalyze(); draw(); } }

// ---------- simetri (cermin terhadap garis tengah x=0 dan z=0) ----------
const flips = () => { const r = [[1, 1]]; if (mir & 1) r.push([-1, 1]); if (mir & 2) r.push([1, -1]); if (mir === 3) r.push([-1, -1]); return r; };
const key = p => p.map(q => q.map(v => Math.round(v * 100)).join(',')).sort().join(';');
function addShape(s) {
  const base = shapePoly(s), seen = new Set(work.shapes.map(x => key(shapePoly(x))));
  flips().forEach(([fx, fz], i) => {
    const poly = base.map(([x, z]) => [fx * x, fz * z]), k = key(poly); if (seen.has(k)) return; seen.add(k);
    work.shapes.push(i === 0 ? s : { k: 'poly', pts: poly.map(p => p.map(v => +v.toFixed(3))) });
  });
}
function addWall(a, b) {
  const seen = new Set(work.dividers.map(d => key([[d[0], d[1]], [d[2], d[3]]])));
  flips().forEach(([fx, fz]) => {
    const d = [fx * a[0], fz * a[1], fx * b[0], fz * b[1]], k = key([[d[0], d[1]], [d[2], d[3]]]); if (seen.has(k)) return; seen.add(k); work.dividers.push(d);
  });
}
function addFrame(p) {
  flips().forEach(([fx, fz]) => {
    const f = { x: fx * p.x, z: fz * p.z, a: +Math.atan2(fx * Math.sin(p.a), fz * Math.cos(p.a)).toFixed(4) };
    if (work.frames.length >= MAX_FRAMES || !frameOnWall(f, m)) return;
    if (work.frames.some(o => Math.hypot(o.x - f.x, o.z - f.z) < FRAME_W && Math.abs(Math.sin(o.a - f.a)) < .05)) return;   // sudah ada di situ
    let id = 0; while (work.frames.some(o => o.id === id)) id++;
    work.frames.push({ id, ...f });
  });
}

// ---------- mouse / sentuh ----------
const wpt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - r.width / 2) / view.s + view.cx, (e.clientY - r.top - r.height / 2) / view.s + view.cz]; };
const sn = v => Math.round(v / grid) * grid, snp = p => [sn(p[0]), sn(p[1])];
function bbox(a, b) {   // kotak dari dua titik; lingkaran dipaksa persegi
  let w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
  if (tool === 'circle') w = h = Math.max(w, h);
  return { x: b[0] >= a[0] ? a[0] : a[0] - w, z: b[1] >= a[1] ? a[1] : a[1] - h, w, h };
}
const kindOf = () => tool === 'circle' ? 'ellipse' : tool;
cv.oncontextmenu = e => e.preventDefault();
cv.onpointerdown = e => {
  cv.setPointerCapture(e.pointerId); const p = wpt(e), q = snp(p);
  if (tool === 'pan' || e.button === 1 || e.button === 2) { pan = { x: e.clientX, y: e.clientY, cx: view.cx, cz: view.cz }; return; }
  if (tool === 'poly') {
    if (pts.length > 2 && Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) < 1e-6) closePoly();
    else if (!pts.length || q[0] !== pts[pts.length - 1][0] || q[1] !== pts[pts.length - 1][1]) pts.push(q);
    draw(); return;
  }
  if (tool === 'frame') { const sp = snapToWall(m, p[0], p[1]); if (sp) commit(() => addFrame(sp)); else toast('Arahkan ke dinding'); return; }
  if (tool === 'del') { del(p); return; }
  start = q; hov = q; draw();
};
cv.onpointermove = e => {
  raw = wpt(e); hov = snp(raw);
  if (pan) { view.cx = pan.cx - (e.clientX - pan.x) / view.s; view.cz = pan.cz - (e.clientY - pan.y) / view.s; }
  info(); draw();
};
cv.onpointerup = e => {
  pan = null; if (!start) return; const q = snp(wpt(e)), a = start; start = null;
  if (tool === 'wall') { if (a[0] !== q[0] || a[1] !== q[1]) commit(() => addWall(a, q)); else draw(); return; }
  const b = bbox(a, q); if (b.w < grid || b.h < grid) { draw(); return; }
  commit(() => addShape({ k: kindOf(), ...b, r: rot }));
};
cv.ondblclick = () => { if (tool === 'poly' && pts.length > 2) closePoly(); };
cv.addEventListener('wheel', e => {
  e.preventDefault(); const p = wpt(e); view.s = Math.max(4, Math.min(80, view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  const q = wpt(e); view.cx += p[0] - q[0]; view.cz += p[1] - q[1]; draw();
}, { passive: false });
function closePoly() { if (pts.length < 3) return; const p = pts.slice(); pts = []; commit(() => addShape({ k: 'poly', pts: p })); }
function del(p) {
  const [x, z] = p, fi = work.frames.findIndex(f => Math.hypot(f.x - x, f.z - z) < 1.3);
  if (fi >= 0) return commit(() => work.frames.splice(fi, 1));
  const di = work.dividers.findIndex(d => segD(x, z, d[0], d[1], d[2], d[3]) < .5);
  if (di >= 0) return commit(() => work.dividers.splice(di, 1));
  for (let i = work.shapes.length - 1; i >= 0; i--) if (pip(p, shapePoly(work.shapes[i]))) return commit(() => work.shapes.splice(i, 1));
}

// ---------- gambar ----------
const line = (x1, z1, x2, z2) => { g.beginPath(); g.moveTo(x1, z1); g.lineTo(x2, z2); g.stroke(); };
const path = poly => { g.beginPath(); poly.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); g.closePath(); };
function preview() {   // bentuk yang sedang digambar
  if (start && hov && tool !== 'wall') return shapePoly({ k: kindOf(), ...bbox(start, hov), r: rot });
  return null;
}
function draw() {
  if (!m) return;
  const s = view.s; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0f1115'; g.fillRect(0, 0, W, H);
  g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - view.cx * s), dpr * (H / 2 - view.cz * s));
  const x0 = view.cx - W / 2 / s, x1 = view.cx + W / 2 / s, z0 = view.cz - H / 2 / s, z1 = view.cz + H / 2 / s; let step = grid;
  while (step * s < 10) step *= 2;
  g.lineWidth = 1 / s;
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { g.strokeStyle = Math.abs(x) < 1e-9 ? '#3d6fa8' : Math.round(x / step) % 5 === 0 ? '#2b3039' : '#1b1f26'; line(x, z0, x, z1); }
  for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) { g.strokeStyle = Math.abs(z) < 1e-9 ? '#3d6fa8' : Math.round(z / step) % 5 === 0 ? '#2b3039' : '#1b1f26'; line(x0, z, x1, z); }
  g.fillStyle = '#2c3442'; m.polys.forEach(p => { path(p); g.fill(); });                       // lantai
  g.lineCap = 'round'; g.strokeStyle = '#e4e3df'; g.lineWidth = .3; m.walls.forEach(w => line(w.x1, w.z1, w.x2, w.z2));   // dinding
  work.frames.forEach(f => {                                                                   // bingkai
    const nx = Math.sin(f.a), nz = Math.cos(f.a), tx = nz, tz = -nx, ok = frameOnWall(f, m), cx = f.x + nx * .3, cz = f.z + nz * .3;
    g.strokeStyle = ok ? '#8fb4d9' : '#e5484d'; g.lineWidth = .22; line(cx - tx * FRAME_W / 2, cz - tz * FRAME_W / 2, cx + tx * FRAME_W / 2, cz + tz * FRAME_W / 2);
    g.fillStyle = '#fff'; g.font = '.7px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.id + 1, f.x + nx * 1, f.z + nz * 1);
  });
  if (tool === 'frame' && raw) {                                                               // bayangan bingkai
    const sp = snapToWall(m, raw[0], raw[1]);
    if (sp) { const nx = Math.sin(sp.a), nz = Math.cos(sp.a); g.strokeStyle = 'rgba(143,180,217,.5)'; g.lineWidth = .22;
      line(sp.x + nx * .3 - nz * FRAME_W / 2, sp.z + nz * .3 + nx * FRAME_W / 2, sp.x + nx * .3 + nz * FRAME_W / 2, sp.z + nz * .3 - nx * FRAME_W / 2); }
  }
  const pv = preview();
  if (pv) { path(pv); g.fillStyle = 'rgba(143,180,217,.25)'; g.fill(); g.strokeStyle = '#8fb4d9'; g.lineWidth = 2 / s; g.stroke(); }
  if (start && tool === 'wall' && hov) { g.strokeStyle = '#8fb4d9'; g.lineWidth = .3; g.globalAlpha = .6; line(start[0], start[1], hov[0], hov[1]); g.globalAlpha = 1; }
  if (pts.length) {
    g.strokeStyle = '#8fb4d9'; g.lineWidth = 2 / s; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); if (hov) g.lineTo(hov[0], hov[1]); g.stroke();
    g.fillStyle = '#8fb4d9'; pts.forEach(([x, z], i) => { g.beginPath(); g.arc(x, z, (i ? 4 : 7) / s, 0, 7); g.fill(); });
  }
  if (hov && tool !== 'pan' && tool !== 'del' && tool !== 'frame') { g.fillStyle = '#fff'; g.beginPath(); g.arc(hov[0], hov[1], 3 / s, 0, 7); g.fill(); }
}

// ---------- tombol & shortcut ----------
$('pgrid').onchange = e => { grid = +e.target.value; e.target.blur(); draw(); };
$('pmir').onchange = e => { mir = +e.target.value; e.target.blur(); };
$('prot').onclick = e => { rot = (rot + 1) % 4; e.currentTarget.blur(); draw(); };
$('pundo').onclick = e => { undo(); e.currentTarget.blur(); };
$('pcancel').onclick = () => planKey({ code: 'Escape' });
$('psave').onclick = async () => {
  const mm = analyze(work); if (!mm.walls.length) { toast('Gambar minimal satu ruangan'); return; }
  const keep = work.frames.filter(f => frameOnWall(f, mm)), dropped = work.frames.length - keep.length;
  if (dropped && !confirm(`${dropped} bingkai tidak menempel di dinding dan akan dihapus beserta fotonya. Lanjutkan?`)) return;
  work.frames = keep;
  if (await commitLayout(work)) toggleModal(el);
};
export function planKey(e) {
  if (e.code === 'Escape') {
    if (start || pts.length) { start = null; pts = []; draw(); }
    else if (!hist.length || confirm('Tutup tanpa menyimpan perubahan denah?')) toggleModal(el);
  } else if (e.code === 'KeyR') { rot = (rot + 1) % 4; draw(); }
  else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) undo();
  else if (e.code === 'Enter') closePoly();
}
