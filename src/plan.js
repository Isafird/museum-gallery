import { state } from './state.js';
import { analyze, shapePoly, snapToWall, frameOnWall, floorArea, inFloor, pip, segD, doorPoly, MAX_FRAMES, MAX_LIGHTS, FRAME_W, DOOR_W } from './layout.js';
import { toggleModal } from './modal.js';
import { toast } from './toast.js';
import { commitLayout } from './world.js';

const $ = id => document.getElementById(id);
const el = $('plan'), cv = $('plc'), g = cv.getContext('2d');
const TOOLS = [['pan', 'Geser'], ['sel', 'Pilih'], ['rect', 'Kotak'], ['circle', 'Lingkaran'], ['semi', 'Setengah lingkaran'], ['hex', 'Segi enam'],
  ['ell', 'Bentuk L'], ['tee', 'Bentuk T'], ['plus', 'Plus'], ['poly', 'Bebas'], ['wall', 'Dinding'], ['door', 'Pintu'], ['frame', 'Bingkai'], ['light', 'Lampu'], ['del', 'Hapus']];
const HINT = {
  pan: 'Seret untuk menggeser. Roda mouse untuk zoom.',
  sel: 'Klik objek untuk memilih. Seret untuk memindahkan. Tarik kotak kecil di tepi ruangan untuk mengubah ukuran. R memutar, Delete menghapus.',
  poly: 'Klik titik-titik sudut. Klik titik awal atau tekan Enter untuk menutup.',
  wall: 'Seret untuk membuat dinding pembatas.', frame: 'Arahkan ke dinding lalu klik untuk menaruh bingkai.',
  door: 'Arahkan ke dinding lalu klik untuk membuat pintu. Pintu juga menyambung dua ruangan yang hanya bersentuhan.',
  light: 'Klik di lantai untuk menaruh lampu ruangan.', del: 'Klik bingkai, pintu, lampu, dinding, atau ruangan untuk menghapus.',
};
const KEYS = { frame: 'frames', door: 'doors', light: 'lights', div: 'dividers', shape: 'shapes' };
let work, m, tool = 'rect', rot = 0, grid = 1, mir = 0, view = { cx: 0, cz: 0, s: 20 };
let start = null, pts = [], hov = null, raw = null, hist = [], pan = null, W = 1, H = 1, dpr = 1, sel = null, drag = null;

TOOLS.forEach(([id, name]) => {
  const b = document.createElement('button'); b.className = 'chip'; b.dataset.tool = id; b.textContent = name; b.onclick = () => setTool(id); $('pltools').append(b);
});
function setTool(t) {
  tool = t; start = null; pts = []; drag = null; if (t !== 'sel') sel = null;
  document.querySelectorAll('#pltools .chip').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); renderProps(); info(); draw();
}

// ---------- buka / tutup ----------
export function openPlan() {
  if (!state.access.canManage) { toast('Hanya pemilik yang bisa mengubah denah'); return; }
  work = JSON.parse(JSON.stringify(state.layout)); work.doors = work.doors || []; hist = []; rot = 0; sel = null; drag = null;
  toggleModal(el); resize(); m = analyze(work); if (!work.lights) work.lights = m.lights.map(l => ({ ...l }));    // lampu otomatis jadi lampu yang bisa diatur
  reanalyze(); fit(); setTool('rect');
}
function resize() { dpr = devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; }
// Ukuran kanvas bisa berubah (jendela, baris alat yang membungkus): sesuaikan resolusi gambar supaya klik tetap tepat
new ResizeObserver(() => { if (el.classList.contains('open')) { resize(); draw(); } }).observe(cv);
function fit() {
  const b = m.bounds, bw = b.maxx - b.minx + 6, bh = b.maxz - b.minz + 6;
  view = { cx: (b.minx + b.maxx) / 2, cz: (b.minz + b.maxz) / 2, s: Math.max(4, Math.min(80, Math.min(W / bw, H / bh))) };
}
function reanalyze() { m = analyze(work); info(); renderProps(); }
function info() {
  const hp = hov ? `   x ${hov[0]}, z ${hov[1]}` : '', stamp = ['rect', 'circle', 'semi', 'hex', 'ell', 'tee', 'plus'].includes(tool) ? `  Putaran bentuk: ${rot * 90}°.` : '';
  $('pinfo').textContent = `Luas ±${floorArea(m)} m², ${work.frames.length}/${MAX_FRAMES} bingkai, ${work.lights.length}/${MAX_LIGHTS} lampu${hp}. ${HINT[tool] || 'Seret di kanvas untuk menggambar. R untuk memutar.'}${stamp}`;
}
function commit(fn) { hist.push(JSON.stringify(work)); if (hist.length > 60) hist.shift(); fn(); reanalyze(); draw(); }
function undo() { if (hist.length) { work = JSON.parse(hist.pop()); sel = null; drag = null; reanalyze(); draw(); } }

// ---------- simetri (cermin terhadap garis tengah x=0 dan z=0) ----------
const flips = () => { const r = [[1, 1]]; if (mir & 1) r.push([-1, 1]); if (mir & 2) r.push([1, -1]); if (mir === 3) r.push([-1, -1]); return r; };
const key = p => p.map(q => q.map(v => Math.round(v * 100)).join(',')).sort().join(';');
const mirA = (a, fx, fz) => +Math.atan2(fx * Math.sin(a), fz * Math.cos(a)).toFixed(4);
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
const noDoors = () => analyze({ ...work, doors: [] });       // dinding tanpa lubang pintu (untuk memeriksa pintu menempel di dinding)
function addFrame(p) {
  flips().forEach(([fx, fz]) => {
    const f = { x: fx * p.x, z: fz * p.z, a: mirA(p.a, fx, fz) };
    if (work.frames.length >= MAX_FRAMES || !frameOnWall(f, m)) return;
    if (work.frames.some(o => Math.hypot(o.x - f.x, o.z - f.z) < FRAME_W * .9 && Math.cos(o.a - f.a) > .5)) return;   // terlalu dekat dengan bingkai lain yang searah
    let id = 0; while (work.frames.some(o => o.id === id)) id++;
    work.frames.push({ id, ...f, pl: 'b', sp: false });
  });
}
function addDoor(p) {
  const base = noDoors();
  flips().forEach(([fx, fz]) => {
    const d = { x: fx * p.x, z: fz * p.z, a: mirA(p.a, fx, fz) };
    if (!frameOnWall(d, base) || work.doors.some(o => Math.hypot(o.x - d.x, o.z - d.z) < DOOR_W && Math.abs(Math.sin(o.a - d.a)) < .05)) return;
    work.doors.push(d);
  });
}
function addLight(p) {
  const seen = new Set(work.lights.map(l => l.x + ',' + l.z));
  flips().forEach(([fx, fz]) => {
    const l = { x: fx * p[0], z: fz * p[1], on: true };
    if (work.lights.length >= MAX_LIGHTS || !inFloor(m, l.x, l.z) || seen.has(l.x + ',' + l.z)) return; seen.add(l.x + ',' + l.z); work.lights.push(l);
  });
  if (work.lights.length >= MAX_LIGHTS) toast(`Maksimal ${MAX_LIGHTS} lampu ruangan`);
}

// ---------- memilih, memindahkan, memutar ----------
function hit(p) {
  const [x, z] = p; let i;
  if ((i = work.frames.findIndex(f => Math.hypot(f.x - x, f.z - z) < 1.3)) >= 0) return { t: 'frame', i };
  if ((i = work.doors.findIndex(d => Math.hypot(d.x - x, d.z - z) < 1.3)) >= 0) return { t: 'door', i };
  if ((i = work.lights.findIndex(l => Math.hypot(l.x - x, l.z - z) < .7)) >= 0) return { t: 'light', i };
  if ((i = work.dividers.findIndex(d => segD(x, z, d[0], d[1], d[2], d[3]) < .5)) >= 0) return { t: 'div', i };
  for (let k = work.shapes.length - 1; k >= 0; k--) if (pip(p, shapePoly(work.shapes[k]))) return { t: 'shape', i: k };
  return null;
}
const onEdge = (poly, x, z) => poly.some((a, i) => { const b = poly[(i + 1) % poly.length]; return segD(x, z, a[0], a[1], b[0], b[1]) < .06; });
// Bingkai, pintu, dan lampu yang menempel pada objek ikut berpindah / berputar bersamanya
function attachedTo(h) {
  const o = { frames: [], doors: [], lights: [], divs: [] }; let on, inside = () => false;
  if (h.t === 'shape') { const poly = shapePoly(work.shapes[h.i]); on = (x, z) => onEdge(poly, x, z); inside = (x, z) => pip([x, z], poly); }
  else if (h.t === 'div') { const d = work.dividers[h.i]; on = (x, z) => segD(x, z, d[0], d[1], d[2], d[3]) < .06; }
  else return o;
  work.frames.forEach((f, i) => { if (on(f.x, f.z)) o.frames.push(i); });
  work.doors.forEach((d, i) => { if (on(d.x, d.z)) o.doors.push(i); });
  work.lights.forEach((l, i) => { if (inside(l.x, l.z)) o.lights.push(i); });
  if (h.t === 'shape') work.dividers.forEach((d, i) => { if (on(d[0], d[1]) && on(d[2], d[3])) o.divs.push(i); });   // dinding di tepi / diameter ikut
  return o;
}
const r3 = v => Math.round(v * 1000) / 1000;
function applyMove(w, h, att, dx, dz) {
  if (h.t === 'shape') { const s = w.shapes[h.i]; if (s.k === 'poly') s.pts = s.pts.map(([x, z]) => [r3(x + dx), r3(z + dz)]); else { s.x = r3(s.x + dx); s.z = r3(s.z + dz); } }
  else if (h.t === 'div') { const d = w.dividers[h.i]; w.dividers[h.i] = [r3(d[0] + dx), r3(d[1] + dz), r3(d[2] + dx), r3(d[3] + dz)]; }
  else if (h.t === 'light') { const l = w.lights[h.i]; l.x = r3(l.x + dx); l.z = r3(l.z + dz); }
  ['frames', 'doors', 'lights'].forEach(k => att[k].forEach(i => { const o = w[k][i]; o.x = r3(o.x + dx); o.z = r3(o.z + dz); }));
  att.divs.forEach(i => { const d = w.dividers[i]; w.dividers[i] = [r3(d[0] + dx), r3(d[1] + dz), r3(d[2] + dx), r3(d[3] + dz)]; });
}
function rotateSel() {
  if (!sel || (sel.t !== 'shape' && sel.t !== 'div')) { toast('Pilih ruangan atau dinding dulu (alat Pilih)'); return; }
  commit(() => {
    const h = sel, att = attachedTo(h); let cx, cz;
    if (h.t === 'shape') { const s = work.shapes[h.i], b = s.k === 'poly' ? polyBounds(s.pts) : { x0: s.x, x1: s.x + s.w, z0: s.z, z1: s.z + s.h }; cx = (b.x0 + b.x1) / 2; cz = (b.z0 + b.z1) / 2; }
    else { const d = work.dividers[h.i]; cx = (d[0] + d[2]) / 2; cz = (d[1] + d[3]) / 2; }
    cx = Math.round(cx * 2) / 2; cz = Math.round(cz * 2) / 2;                                   // pusat putar di grid 0,5 m agar tetap rapi
    const T = (x, z) => [r3(cx + cz - z), r3(cz - cx + x)];                                    // putar 90° searah jarum jam
    if (h.t === 'shape') {
      const s = work.shapes[h.i];
      if (s.k === 'poly') s.pts = s.pts.map(([x, z]) => T(x, z));
      else { const nx = cx + cz - (s.z + s.h), nz = cz - cx + s.x; [s.w, s.h] = [s.h, s.w]; s.x = r3(nx); s.z = r3(nz); s.r = ((s.r || 0) + 1) % 4; }
    } else { const d = work.dividers[h.i], a = T(d[0], d[1]), b = T(d[2], d[3]); work.dividers[h.i] = [a[0], a[1], b[0], b[1]]; }
    const rotA = a => +Math.atan2(-Math.cos(a), Math.sin(a)).toFixed(4);
    att.frames.forEach(i => { const f = work.frames[i]; [f.x, f.z] = T(f.x, f.z); f.a = rotA(f.a); });
    att.doors.forEach(i => { const d = work.doors[i]; [d.x, d.z] = T(d.x, d.z); d.a = rotA(d.a); });
    att.lights.forEach(i => { const l = work.lights[i]; [l.x, l.z] = T(l.x, l.z); });
    att.divs.forEach(i => { const d = work.dividers[i], a = T(d[0], d[1]), b = T(d[2], d[3]); work.dividers[i] = [a[0], a[1], b[0], b[1]]; });
  });
}
// ---------- ubah ukuran ruangan yang sudah terpasang ----------
// Kotak kecil di sudut dan tengah sisi kotak pembatas ruangan yang dipilih. [ix, iz]: -1 = sisi min, 1 = sisi maks, 0 = tengah.
const HID = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const boxOf = s => { const b = polyBounds(shapePoly(s)); return { x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 }; };
const handlesOf = s => s.k === 'semi' ? HID.filter(h => h[0] && h[1]) : HID;      // setengah lingkaran: hanya sudut (bentuknya tetap 2:1)
const handlePos = (b, [ix, iz]) => [ix < 0 ? b.x0 : ix > 0 ? b.x1 : (b.x0 + b.x1) / 2, iz < 0 ? b.z0 : iz > 0 ? b.z1 : (b.z0 + b.z1) / 2];
function hitHandle(p, px) {
  if (tool !== 'sel' || !sel || sel.t !== 'shape' || !work.shapes[sel.i]) return null;
  const s = work.shapes[sel.i], b = boxOf(s); let best = null, bd = px / view.s;
  handlesOf(s).forEach(h => { const q = handlePos(b, h), d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = h; } });
  return best && { h: best, b, semi: s.k === 'semi' };
}
// Kotak baru setelah pegangan d.h ditarik ke titik q (sudah di-snap ke grid). Sisi di seberang pegangan tetap diam.
function resizedBox(d, q) {
  const [ix, iz] = d.h, b = d.b0, ax = ix < 0 ? b.x1 : b.x0, az = iz < 0 ? b.z1 : b.z0;
  let { x0, z0, x1, z1 } = b;
  if (d.semi) {                                                  // skala seragam; diameter (sisi panjang) kelipatan 1 grid
    const ratio = (b.x1 - b.x0) / (b.z1 - b.z0), dx = Math.abs(q[0] - ax), dz = Math.abs(q[1] - az);
    let long = ratio >= 1 ? Math.max(dx, dz * ratio) : Math.max(dz, dx / ratio);
    long = Math.max(grid, Math.round(long / grid) * grid);
    const w = ratio >= 1 ? long : long * ratio, h = ratio >= 1 ? long / ratio : long;
    x0 = ix < 0 ? ax - w : ax; x1 = ix < 0 ? ax : ax + w; z0 = iz < 0 ? az - h : az; z1 = iz < 0 ? az : az + h;
    return { x0, z0, x1, z1 };
  }
  if (ix) { let n = q[0]; if (Math.abs(n - ax) < grid) n = ax + (ix < 0 ? -grid : grid); x0 = Math.min(ax, n); x1 = Math.max(ax, n); }
  if (iz) { let n = q[1]; if (Math.abs(n - az) < grid) n = az + (iz < 0 ? -grid : grid); z0 = Math.min(az, n); z1 = Math.max(az, n); }
  return { x0, z0, x1, z1 };
}
// Terapkan kotak baru: bentuk diskalakan, bingkai / pintu / lampu yang menempel ikut bergeser (bingkai dan pintu ditempel ulang ke dinding terdekat)
function applyResize(w, d, nb) {
  const b = d.b0, sx = (nb.x1 - nb.x0) / (b.x1 - b.x0), sz = (nb.z1 - nb.z0) / (b.z1 - b.z0);
  const fx = x => r3(nb.x0 + (x - b.x0) * sx), fz = z => r3(nb.z0 + (z - b.z0) * sz), s = w.shapes[d.sel.i];
  if (s.k === 'poly') s.pts = s.pts.map(([x, z]) => [fx(x), fz(z)]);
  else { s.x = r3(nb.x0); s.z = r3(nb.z0); s.w = r3(nb.x1 - nb.x0); s.h = r3(nb.z1 - nb.z0); }
  d.att.lights.forEach(i => { const o = w.lights[i]; o.x = fx(o.x); o.z = fz(o.z); });
  d.att.divs.forEach(i => { const v = w.dividers[i]; w.dividers[i] = [fx(v[0]), fz(v[1]), fx(v[2]), fz(v[3])]; });
  const mm = analyze(w), base = analyze({ ...w, doors: [] });
  d.att.frames.forEach(i => { const f = w.frames[i], x = fx(f.x), z = fz(f.z), sp = snapToWall(mm, x, z, .5); if (sp && sp.d < .8) { f.x = sp.x; f.z = sp.z; f.a = sp.a; } else { f.x = x; f.z = z; } });
  d.att.doors.forEach(i => { const o = w.doors[i], x = fx(o.x), z = fz(o.z), sp = snapToWall(base, x, z, .5, DOOR_W / 2 + .05); if (sp && sp.d < .8) { o.x = sp.x; o.z = sp.z; o.a = sp.a; } else { o.x = x; o.z = z; } });
}
const CURSORS = { '-1,-1': 'nwse-resize', '1,1': 'nwse-resize', '1,-1': 'nesw-resize', '-1,1': 'nesw-resize', '0,-1': 'ns-resize', '0,1': 'ns-resize', '-1,0': 'ew-resize', '1,0': 'ew-resize' };

function polyBounds(p) { const xs = p.map(q => q[0]), zs = p.map(q => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; }
function delSel() { if (!sel) return; const h = sel; sel = null; commit(() => { work[KEYS[h.t]].splice(h.i, 1); }); }
function toggleLight() { if (sel && sel.t === 'light') commit(() => { const l = work.lights[sel.i]; l.on = !l.on; }); }
const rotateAction = () => { if (tool === 'sel') rotateSel(); else { rot = (rot + 1) % 4; info(); draw(); } };

// Panel pengaturan untuk objek yang dipilih
function renderProps() {
  const box = $('plprops'); box.textContent = ''; if (!sel || !work) return;
  const label = t => { const s = document.createElement('span'); s.className = 's'; s.textContent = t; box.append(s); };
  const chip = (t, fn, on) => { const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : ''); b.textContent = t; b.onclick = e => { fn(); e.currentTarget.blur(); }; box.append(b); return b; };
  const o = work[KEYS[sel.t]][sel.i]; if (!o) return;
  if (sel.t === 'frame') {
    label(`Bingkai ${o.id + 1}`);
    const lab = document.createElement('label'); lab.textContent = 'Papan nama';
    const s = document.createElement('select'); [['b', 'Di bawah lukisan'], ['t', 'Di atas lukisan'], ['n', 'Tanpa papan nama']].forEach(([v, n]) => s.add(new Option(n, v)));
    s.value = o.pl || 'b'; s.onchange = () => { const v = s.value, i = sel.i; commit(() => { work.frames[i].pl = v; }); s.blur(); }; lab.append(s); box.append(lab);
    chip(o.sp ? 'Lampu sorot: nyala' : 'Lampu sorot: tidak ada', () => { const i = sel.i; commit(() => { work.frames[i].sp = !work.frames[i].sp; }); }, o.sp);
  } else if (sel.t === 'light') {
    label('Lampu ruangan'); chip(o.on ? 'Menyala (klik untuk mematikan)' : 'Mati (klik untuk menyalakan)', toggleLight, o.on); label('Spasi = nyala/mati');
  } else if (sel.t === 'door') label('Pintu (lebar 2,4 m)');
  else { label(sel.t === 'shape' ? 'Ruangan' : 'Dinding pembatas'); chip('Putar 90° [R]', rotateSel); label(sel.t === 'shape' ? 'Seret untuk memindahkan, tarik kotak kecil di tepinya untuk mengubah ukuran. Bingkai dan lampu yang menempel ikut.' : 'Seret untuk memindahkan. Bingkai dan lampu yang menempel ikut.'); }
  chip('Hapus [Del]', delSel);
}

// ---------- mouse / sentuh ----------
const wpt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - r.width / 2) / view.s + view.cx, (e.clientY - r.top - r.height / 2) / view.s + view.cz]; };
const sn = v => Math.round(v / grid) * grid, snp = p => [sn(p[0]), sn(p[1])];
// Ujung dinding menempel ke sudut / ujung dinding yang sudah ada (mis. ujung diameter setengah lingkaran yang tidak jatuh di grid); selain itu ikut grid
function wallPt(p) {
  let best = null, bd = 10 / view.s;
  m.walls.forEach(w => [[w.x1, w.z1], [w.x2, w.z2]].forEach(([x, z]) => { const d = Math.hypot(x - p[0], z - p[1]); if (d < bd) { bd = d; best = [r3(x), r3(z)]; } }));
  return best || snp(p);
}
const snapFor = p => tool === 'wall' ? wallPt(p) : snp(p);
function bbox(a, b) {   // kotak dari dua titik; lingkaran dipaksa persegi, setengah lingkaran dipaksa 2:1
  let w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
  if (tool === 'circle') w = h = Math.max(w, h);
  if (tool === 'semi') {
    if (rot % 2 === 0) { w = Math.max(grid, Math.round(w / grid) * grid); h = w / 2; } else { h = Math.max(grid, Math.round(h / grid) * grid); w = h / 2; }   // sisi datar (diameter) kelipatan 1 grid
  }
  return { x: b[0] >= a[0] ? a[0] : a[0] - w, z: b[1] >= a[1] ? a[1] : a[1] - h, w, h };
}
const kindOf = () => tool === 'circle' ? 'ellipse' : tool;
cv.oncontextmenu = e => e.preventDefault();
cv.onpointerdown = e => {
  cv.setPointerCapture(e.pointerId); const p = wpt(e), q = snapFor(p);
  if (tool === 'pan' || e.button === 1 || e.button === 2) { pan = { x: e.clientX, y: e.clientY, cx: view.cx, cz: view.cz }; return; }
  if (tool === 'sel') {
    const hh = hitHandle(p, e.pointerType === 'touch' ? 20 : 10);
    if (hh) { drag = { kind: 'resize', h: hh.h, b0: hh.b, semi: hh.semi, snap: JSON.stringify(work), sel, att: attachedTo(sel), moved: false, last: '' }; return; }
    sel = hit(p); renderProps();
    if (sel && ['shape', 'div', 'light'].includes(sel.t)) drag = { q0: q, snap: JSON.stringify(work), sel, att: attachedTo(sel), moved: false };
    draw(); return;
  }
  if (tool === 'poly') {
    if (pts.length > 2 && Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) < 1e-6) closePoly();
    else if (!pts.length || q[0] !== pts[pts.length - 1][0] || q[1] !== pts[pts.length - 1][1]) pts.push(q);
    draw(); return;
  }
  if (tool === 'frame' || tool === 'door') {
    const sp = snapToWall(m, p[0], p[1], .5, tool === 'door' ? DOOR_W / 2 + .05 : undefined);
    if (!sp) toast('Arahkan ke dinding'); else commit(() => (tool === 'door' ? addDoor(sp) : addFrame(sp)));
    return;
  }
  if (tool === 'light') { commit(() => addLight(q)); return; }
  if (tool === 'del') { const h = hit(p); if (h) { sel = h; delSel(); } return; }
  start = q; hov = q; draw();
};
cv.onpointermove = e => {
  raw = wpt(e); hov = snapFor(raw);
  if (pan) { view.cx = pan.cx - (e.clientX - pan.x) / view.s; view.cz = pan.cz - (e.clientY - pan.y) / view.s; }
  if (!drag && !pan && tool === 'sel') { const hh = hitHandle(raw, e.pointerType === 'touch' ? 20 : 10); cv.style.cursor = hh ? CURSORS[hh.h] : 'default'; }
  else if (!drag && !pan) cv.style.cursor = '';
  if (drag && drag.kind === 'resize') {
    const nb = resizedBox(drag, hov), key = [nb.x0, nb.z0, nb.x1, nb.z1].join();
    if (key !== drag.last) { drag.last = key; drag.moved = true; work = JSON.parse(drag.snap); applyResize(work, drag, nb); m = analyze(work); }
  } else if (drag) {
    const dx = hov[0] - drag.q0[0], dz = hov[1] - drag.q0[1];
    if ((dx || dz) && (dx !== drag.lx || dz !== drag.lz)) { drag.lx = dx; drag.lz = dz; drag.moved = true; work = JSON.parse(drag.snap); applyMove(work, drag.sel, drag.att, dx, dz); m = analyze(work); }
  }
  info(); draw();
};
cv.onpointerup = e => {
  pan = null;
  if (drag) { if (drag.moved) { hist.push(drag.snap); if (hist.length > 60) hist.shift(); } drag = null; reanalyze(); draw(); return; }
  if (!start) return; const q = snapFor(wpt(e)), a = start; start = null;
  if (tool === 'wall') { if (a[0] !== q[0] || a[1] !== q[1]) commit(() => addWall(a, q)); else draw(); return; }
  const b = bbox(a, q); if (Math.min(b.w, b.h) < (tool === 'semi' ? grid / 2 : grid)) { draw(); return; }
  commit(() => addShape({ k: kindOf(), ...b, r: rot }));
};
cv.ondblclick = () => { if (tool === 'poly' && pts.length > 2) closePoly(); };
cv.addEventListener('wheel', e => {
  e.preventDefault(); const p = wpt(e); view.s = Math.max(4, Math.min(80, view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  const q = wpt(e); view.cx += p[0] - q[0]; view.cz += p[1] - q[1]; draw();
}, { passive: false });
function closePoly() { if (pts.length < 3) return; const p = pts.slice(); pts = []; commit(() => addShape({ k: 'poly', pts: p })); }

// ---------- gambar ----------
const line = (x1, z1, x2, z2) => { g.beginPath(); g.moveTo(x1, z1); g.lineTo(x2, z2); g.stroke(); };
const path = poly => { g.beginPath(); poly.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); g.closePath(); };
const HL = '#ff9f43';
function preview() { return start && hov && tool !== 'wall' ? shapePoly({ k: kindOf(), ...bbox(start, hov), r: rot }) : null; }
function highlight(h) {
  const o = work[KEYS[h.t]][h.i]; if (!o) return; g.strokeStyle = HL; g.lineWidth = 3 / view.s;
  if (h.t === 'shape') { path(shapePoly(o)); g.stroke(); }
  else if (h.t === 'div') { g.lineWidth = .5; g.globalAlpha = .55; line(o[0], o[1], o[2], o[3]); g.globalAlpha = 1; }
  else { g.beginPath(); g.arc(o.x, o.z, h.t === 'light' ? .6 : 1.2, 0, 7); g.stroke(); }
}
let drawRaf = 0;
function draw() { if (!drawRaf) drawRaf = requestAnimationFrame(() => { drawRaf = 0; drawNow(); }); }   // gabungkan banyak permintaan jadi satu gambar per frame
function drawNow() {
  if (!m || !work) return;
  const s = view.s; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0f1115'; g.fillRect(0, 0, W, H);
  g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - view.cx * s), dpr * (H / 2 - view.cz * s));
  const x0 = view.cx - W / 2 / s, x1 = view.cx + W / 2 / s, z0 = view.cz - H / 2 / s, z1 = view.cz + H / 2 / s; let step = grid;
  while (step * s < 10) step *= 2;
  g.lineWidth = 1 / s;
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { g.strokeStyle = Math.abs(x) < 1e-9 ? '#3d6fa8' : Math.round(x / step) % 5 === 0 ? '#2b3039' : '#1b1f26'; line(x, z0, x, z1); }
  for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) { g.strokeStyle = Math.abs(z) < 1e-9 ? '#3d6fa8' : Math.round(z / step) % 5 === 0 ? '#2b3039' : '#1b1f26'; line(x0, z, x1, z); }
  g.fillStyle = '#2c3442'; m.polys.forEach(p => { path(p); g.fill(); });                       // lantai
  g.lineCap = 'round'; g.strokeStyle = '#e4e3df'; g.lineWidth = .3; m.walls.forEach(w => line(w.x1, w.z1, w.x2, w.z2));   // dinding
  work.doors.forEach(d => {                                                                    // pintu
    const nx = Math.sin(d.a), nz = Math.cos(d.a), tx = nz, tz = -nx, hw = DOOR_W / 2;
    g.strokeStyle = '#c9a56a'; g.lineWidth = .1; g.setLineDash([.22, .18]); line(d.x - tx * hw, d.z - tz * hw, d.x + tx * hw, d.z + tz * hw); g.setLineDash([]);
    g.lineWidth = .22; [-1, 1].forEach(k => line(d.x + tx * hw * k - nx * .4, d.z + tz * hw * k - nz * .4, d.x + tx * hw * k + nx * .4, d.z + tz * hw * k + nz * .4));
  });
  work.lights.forEach(l => {                                                                   // lampu ruangan
    const ok = inFloor(m, l.x, l.z); g.beginPath(); g.arc(l.x, l.z, .38, 0, 7); g.fillStyle = l.on ? '#ffd66b' : '#2a2e36'; g.fill();
    g.lineWidth = .08; g.strokeStyle = !ok ? '#e5484d' : l.on ? '#fff3c4' : '#6b7080'; g.stroke();
    if (l.on) { g.strokeStyle = 'rgba(255,230,150,.7)'; g.lineWidth = .07; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; line(l.x + Math.cos(a) * .52, l.z + Math.sin(a) * .52, l.x + Math.cos(a) * .72, l.z + Math.sin(a) * .72); } }
  });
  work.frames.forEach(f => {                                                                   // bingkai
    const nx = Math.sin(f.a), nz = Math.cos(f.a), tx = nz, tz = -nx, ok = frameOnWall(f, m), cx = f.x + nx * .3, cz = f.z + nz * .3;
    g.strokeStyle = ok ? '#8fb4d9' : '#e5484d'; g.lineWidth = .22; line(cx - tx * FRAME_W / 2, cz - tz * FRAME_W / 2, cx + tx * FRAME_W / 2, cz + tz * FRAME_W / 2);
    if (f.sp) { g.fillStyle = '#ffe066'; g.beginPath(); g.arc(f.x + nx * 1.05, f.z + nz * 1.05, .17, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.font = '.7px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.id + 1, f.x + nx * .72 + (f.sp ? tx * .55 : 0), f.z + nz * .72 + (f.sp ? tz * .55 : 0));
  });
  if ((tool === 'frame' || tool === 'door') && raw) {                                          // bayangan bingkai / pintu
    const sp = snapToWall(m, raw[0], raw[1], .5, tool === 'door' ? DOOR_W / 2 + .05 : undefined);
    if (sp) {
      const nx = Math.sin(sp.a), nz = Math.cos(sp.a);
      if (tool === 'door') { path(doorPoly(sp)); g.strokeStyle = 'rgba(201,165,106,.9)'; g.lineWidth = .1; g.stroke(); }
      else { g.strokeStyle = 'rgba(143,180,217,.5)'; g.lineWidth = .22; line(sp.x + nx * .3 - nz * FRAME_W / 2, sp.z + nz * .3 + nx * FRAME_W / 2, sp.x + nx * .3 + nz * FRAME_W / 2, sp.z + nz * .3 - nx * FRAME_W / 2); }
    }
  }
  if (sel) highlight(sel);
  if (sel && sel.t === 'shape' && tool === 'sel' && work.shapes[sel.i]) {                      // kotak pembatas + pegangan ubah ukuran
    const s0 = work.shapes[sel.i], b = boxOf(s0), hs = 5 / view.s;
    g.setLineDash([.35, .25]); g.strokeStyle = 'rgba(255,159,67,.8)'; g.lineWidth = 1.5 / view.s; g.strokeRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); g.setLineDash([]);
    handlesOf(s0).forEach(h => { const [x, z] = handlePos(b, h); g.fillStyle = '#fff'; g.strokeStyle = HL; g.lineWidth = 2 / view.s; g.beginPath(); g.rect(x - hs, z - hs, 2 * hs, 2 * hs); g.fill(); g.stroke(); });
  }
  const pv = preview();
  if (pv) { path(pv); g.fillStyle = 'rgba(143,180,217,.25)'; g.fill(); g.strokeStyle = '#8fb4d9'; g.lineWidth = 2 / s; g.stroke(); }
  if (start && tool === 'wall' && hov) { g.strokeStyle = '#8fb4d9'; g.lineWidth = .3; g.globalAlpha = .6; line(start[0], start[1], hov[0], hov[1]); g.globalAlpha = 1; }
  if (pts.length) {
    g.strokeStyle = '#8fb4d9'; g.lineWidth = 2 / s; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); if (hov) g.lineTo(hov[0], hov[1]); g.stroke();
    g.fillStyle = '#8fb4d9'; pts.forEach(([x, z], i) => { g.beginPath(); g.arc(x, z, (i ? 4 : 7) / s, 0, 7); g.fill(); });
  }
  if (hov && ['rect', 'circle', 'semi', 'hex', 'ell', 'tee', 'plus', 'poly', 'wall', 'light'].includes(tool)) { g.fillStyle = '#fff'; g.beginPath(); g.arc(hov[0], hov[1], 3 / s, 0, 7); g.fill(); }
}

// ---------- tombol & shortcut ----------
$('pgrid').onchange = e => { grid = +e.target.value; e.target.blur(); draw(); };
$('pmir').onchange = e => { mir = +e.target.value; e.target.blur(); };
$('prot').onclick = e => { rotateAction(); e.currentTarget.blur(); };
$('pundo').onclick = e => { undo(); e.currentTarget.blur(); };
$('pcancel').onclick = () => planKey({ code: 'Escape' });
$('psave').onclick = async () => {
  const mm = analyze(work); if (!mm.walls.length) { toast('Gambar minimal satu ruangan'); return; }
  const mND = analyze({ ...work, doors: [] });
  const keep = work.frames.filter(f => frameOnWall(f, mm)), dropped = work.frames.length - keep.length;
  if (dropped && !confirm(`${dropped} bingkai tidak menempel di dinding dan akan dihapus beserta fotonya. Lanjutkan?`)) return;
  work.frames = keep; work.doors = work.doors.filter(d => frameOnWall(d, mND));                    // pintu yang dindingnya sudah hilang dibuang
  if (await commitLayout(work)) toggleModal(el);
};
export function planKey(e) {
  if (e.code === 'Escape') {
    if (start || pts.length) { start = null; pts = []; draw(); }
    else if (sel) { sel = null; drag = null; renderProps(); draw(); }
    else if (!hist.length || confirm('Tutup tanpa menyimpan perubahan denah?')) toggleModal(el);
  } else if (e.code === 'KeyR') rotateAction();
  else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) undo();
  else if (e.code === 'Enter') closePoly();
  else if (e.code === 'Delete' || e.code === 'Backspace') delSel();
  else if (e.code === 'Space') { e.preventDefault(); toggleLight(); }
}

if (location.search.includes('debug')) window.__plan = { get work() { return work; }, get m() { return m; }, get view() { return view; }, snap: (x, z, mg) => snapToWall(m, x, z, .5, mg) };   // hook uji
