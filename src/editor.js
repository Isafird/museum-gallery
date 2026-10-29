import { state } from './state.js';
import { entries } from './gallery.js';
import { FILTERS, FRAME_STYLES } from './config.js';
import { ADJ, parseFilter, stringifyFilter } from './filters.js';
import { renderFramed } from './framepreview.js';
import { setFrameOrient } from './world.js';
import { getSource, update, updateTitle, replacePhoto, resetEntry, saveAll, hasPending } from './photos.js';
import { isLocked, lockCursor } from './cursor.js';
import { frameSwatch } from './frametex.js';
import { toast } from './toast.js';

const $ = id => document.getElementById(id);
const ed = $('editor'), stage = $('stage'), wrap = $('wrap'), cv = $('edc'), cropEl = $('crop'), ttl = $('ttl');
const ASPECTS = [{ name: 'Bebas', r: 0 }, { name: '1:1', r: 1 }, { name: '4:3', r: 4 / 3 }, { name: '16:9', r: 16 / 9 }, { name: '3:4', r: 3 / 4 }];
const hex = n => '#' + n.toString(16).padStart(6, '0');
let idx = -1, tab = '', cropping = false, sel = null, prevSel = null, aspect = 0, fitS = 1, v = { s: 1, tx: 0, ty: 0 };
const data = () => entries[idx].data;

// ---------- buka / tutup ----------
export function openEditor(i) {
  idx = i; state.viewing = true; state.relock = isLocked(); if (state.relock) document.exitPointerLock();
  ed.classList.add('open'); ttl.value = entries[i].title; tab = ''; cropping = false; sel = null; showSel();
  const can = state.access.canEdit; $('tools').style.display = can ? '' : 'none'; $('ro').style.display = can ? 'none' : ''; ttl.readOnly = !can;
  $('edsave').style.display = can ? '' : 'none'; $('edstat').style.display = can ? '' : 'none'; setStat(hasPending() ? 'pending' : 'saved');
  draw(); fit(); panel();
}
export function closeEditor() {
  if (!state.viewing) return;
  cropping = false; ed.classList.remove('open'); $('adj').classList.remove('open'); state.viewing = false;
  if (hasPending()) saveAll();                       // simpan yang belum tersimpan
  if (state.relock) lockCursor();
}

// ---------- status simpan ----------
const LABEL = { saved: 'Tersimpan ✓', pending: 'Belum tersimpan...', saving: 'Menyimpan...', error: 'Gagal menyimpan' };
function setStat(st) { const el = $('edstat'); el.textContent = LABEL[st] || ''; el.dataset.s = st; }
addEventListener('save-status', e => setStat(e.detail));
$('edsave').onclick = () => saveAll();

// ---------- gambar di editor ----------
function drawRaw() {
  const src = getSource(idx), cr = (cropping || !data().crop) ? { x: 0, y: 0, w: 1, h: 1 } : data().crop;
  const sw = src.width * cr.w, sh = src.height * cr.h, k = Math.min(1, 1800 / Math.max(sw, sh));
  cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
  cv.getContext('2d').drawImage(src, src.width * cr.x, src.height * cr.y, sw, sh, 0, 0, cv.width, cv.height);
}
// Tampilan utama: bingkai 3D yang sama dengan di galeri + foto dengan filter. Saat crop, foto mentah yang ditampilkan.
function drawFramed() {
  const out = renderFramed(entries[idx]);
  if (!out) { drawRaw(); return; }
  cv.width = out.width; cv.height = out.height; cv.getContext('2d').drawImage(out, 0, 0);
}
function draw() { cropping ? drawRaw() : drawFramed(); }
function preview() {   // setelah filter / bingkai / orientasi berubah: gambar ulang, dan sesuaikan zoom kalau ukuran gambar berubah
  if (cropping) return;
  const w = cv.width, h = cv.height; drawFramed(); if (cv.width !== w || cv.height !== h) fit();
}
function apply() {
  wrap.style.transform = `translate(${v.tx}px,${v.ty}px) scale(${v.s})`;
  cropEl.style.borderWidth = (2 / v.s) + 'px'; cropEl.style.setProperty('--hs', (14 / v.s) + 'px'); cropEl.style.setProperty('--lw', (1 / v.s) + 'px');
}
function fit() {
  const sw = stage.clientWidth, sh = stage.clientHeight; fitS = Math.min(sw / cv.width, sh / cv.height) * .88;
  v = { s: fitS, tx: (sw - cv.width * fitS) / 2, ty: (sh - cv.height * fitS) / 2 }; apply();
}
function zoomAt(px, py, f) {
  const ns = Math.max(fitS * .5, Math.min(fitS * 12, v.s * f));
  v.tx = px - (px - v.tx) * ns / v.s; v.ty = py - (py - v.ty) * ns / v.s; v.s = ns; apply();
}
const zoomBtn = f => zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, f);
$('zin').onclick = () => zoomBtn(1.25); $('zout').onclick = () => zoomBtn(.8); $('zfit').onclick = fit;
addEventListener('resize', () => { if (state.viewing) fit(); });

// ---------- geser, zoom (roda, cubit, klik dua kali), dan pilih area crop ----------
const ptr = new Map(); let pinch = 0, start = null, drag = null;
const loc = e => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const cpt = e => { const p = loc(e); return { x: Math.max(0, Math.min(cv.width, (p.x - v.tx) / v.s)), y: Math.max(0, Math.min(cv.height, (p.y - v.ty) / v.s)) }; };
const two = () => { const [a, b] = [...ptr.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('#zoom')) return;
  stage.setPointerCapture(e.pointerId); ptr.set(e.pointerId, loc(e));
  if (ptr.size === 2) { start = null; pinch = two().d; }
  else if (cropping) {
    const h = hitCrop(e);
    if (h) drag = { ...h, o: { ...sel }, p0: cpt(e) };                       // tarik pegangan / geser kotak crop
    else { prevSel = sel; start = cpt(e); sel = { ...start, w: 0, h: 0 }; showSel(); }   // di luar kotak: buat pilihan baru
  }
});
stage.addEventListener('pointermove', e => {
  if (cropping && !ptr.size && e.pointerType === 'mouse') { const h = hitCrop(e); stage.style.cursor = h ? (h.t === 'h' ? CUR[h.h] : 'move') : 'crosshair'; }
  const o = ptr.get(e.pointerId); if (!o) return; const p = loc(e); ptr.set(e.pointerId, p);
  if (ptr.size === 2) { const t = two(); zoomAt(t.x, t.y, t.d / pinch); pinch = t.d; }
  else if (cropping && drag) { sel = dragRect(drag, cpt(e)); showSel(); }
  else if (cropping && start) { sel = selRect(start, cpt(e)); showSel(); }
  else if (!cropping) { v.tx += p.x - o.x; v.ty += p.y - o.y; apply(); }
});
const up = e => {
  ptr.delete(e.pointerId); if (ptr.size < 2) pinch = 0; drag = null;
  if (start) { start = null; if (!sel || sel.w < 8 || sel.h < 8) { sel = prevSel; showSel(); } }
};
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
stage.addEventListener('wheel', e => { e.preventDefault(); const p = loc(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
stage.addEventListener('dblclick', e => { if (cropping || e.target.closest('#zoom')) return; const p = loc(e); v.s > fitS * 1.5 ? fit() : zoomAt(p.x, p.y, 2.5); });

// ---------- crop ----------
function selRect(a, b) {
  let w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y); const sx = b.x >= a.x ? 1 : -1, sy = b.y >= a.y ? 1 : -1;
  if (aspect) { h = w / aspect; const mh = sy > 0 ? cv.height - a.y : a.y; if (h > mh) { h = mh; w = h * aspect; } }
  return { x: sx > 0 ? a.x : a.x - w, y: sy > 0 ? a.y : a.y - h, w, h };
}
// Pegangan crop: sudut dulu (supaya menang kalau berdekatan), lalu sisi
const HANDLES = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]], MINSZ = 16;
const CUR = { '-1,-1': 'nwse-resize', '1,1': 'nwse-resize', '1,-1': 'nesw-resize', '-1,1': 'nesw-resize', '0,-1': 'ns-resize', '0,1': 'ns-resize', '-1,0': 'ew-resize', '1,0': 'ew-resize' };
HANDLES.forEach(([hx, hy]) => { const i = document.createElement('i'); i.style.left = (hx + 1) * 50 + '%'; i.style.top = (hy + 1) * 50 + '%'; cropEl.append(i); });
function hitCrop(e) {   // pegangan di dekat kursor / jari, atau di dalam kotak (geser)
  if (!sel) return null; const p = loc(e), R = e.pointerType === 'mouse' ? 14 : 28; let best = null, bd = R;
  HANDLES.forEach(h => { const x = v.tx + (sel.x + (h[0] + 1) / 2 * sel.w) * v.s, y = v.ty + (sel.y + (h[1] + 1) / 2 * sel.h) * v.s, d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = h; } });
  if (best) return { t: 'h', h: best };
  const cx = (p.x - v.tx) / v.s, cy = (p.y - v.ty) / v.s;
  return cx >= sel.x && cx <= sel.x + sel.w && cy >= sel.y && cy <= sel.y + sel.h ? { t: 'move' } : null;
}
function dragRect(d, p) {
  const o = d.o, W = cv.width, H = cv.height, dx = p.x - d.p0.x, dy = p.y - d.p0.y, cl = (x, a, b) => Math.max(a, Math.min(b, x));
  if (d.t === 'move') return { x: cl(o.x + dx, 0, W - o.w), y: cl(o.y + dy, 0, H - o.h), w: o.w, h: o.h };
  const [hx, hy] = d.h; let l = o.x, r = o.x + o.w, t = o.y, b = o.y + o.h;
  if (hx < 0) l = cl(o.x + dx, 0, r - MINSZ); if (hx > 0) r = cl(o.x + o.w + dx, l + MINSZ, W);
  if (hy < 0) t = cl(o.y + dy, 0, b - MINSZ); if (hy > 0) b = cl(o.y + o.h + dy, t + MINSZ, H);
  if (!aspect) return { x: l, y: t, w: r - l, h: b - t };
  const ax = hx > 0 ? l : r, ay = hy > 0 ? t : b;                      // titik tetap = sudut / sisi seberang pegangan
  let w, h;
  if (hx && hy) { w = Math.max(r - l, (b - t) * aspect); w = Math.min(w, hx > 0 ? W - ax : ax, (hy > 0 ? H - ay : ay) * aspect); w = Math.max(w, MINSZ); h = w / aspect; return { x: hx > 0 ? ax : ax - w, y: hy > 0 ? ay : ay - h, w, h }; }
  if (hx) { w = Math.min(r - l, hx > 0 ? W - ax : ax, H * aspect); h = w / aspect; return { x: hx > 0 ? ax : ax - w, y: cl(o.y + o.h / 2 - h / 2, 0, H - h), w, h }; }
  h = Math.min(b - t, hy > 0 ? H - ay : ay, W / aspect); w = h * aspect; return { x: cl(o.x + o.w / 2 - w / 2, 0, W - w), y: hy > 0 ? ay : ay - h, w, h };
}
function setAspect(r) {   // ubah rasio: kotak yang ada dikecilkan ke rasio itu (tetap di tengahnya)
  aspect = r;
  if (r && sel) { let w = sel.w, h = w / r; if (h > sel.h) { h = sel.h; w = h * r; } sel = { x: sel.x + (sel.w - w) / 2, y: sel.y + (sel.h - h) / 2, w, h }; showSel(); }
  panel();
}
function showSel() {
  cropEl.style.display = sel && cropping ? 'block' : 'none';
  if (sel) Object.assign(cropEl.style, { left: sel.x + 'px', top: sel.y + 'px', width: sel.w + 'px', height: sel.h + 'px' });
}
function enterCrop() {
  cropping = true; tab = 'crop'; stage.style.cursor = 'crosshair'; draw(); fit();
  const c = data().crop; sel = c ? { x: c.x * cv.width, y: c.y * cv.height, w: c.w * cv.width, h: c.h * cv.height } : { x: 0, y: 0, w: cv.width, h: cv.height };
  showSel(); panel();
}
function exitCrop() { cropping = false; sel = null; tab = ''; stage.style.cursor = ''; showSel(); draw(); fit(); panel(); }
function applyCrop() {
  if (!sel || sel.w < 8 || sel.h < 8) return;
  const c = { x: sel.x / cv.width, y: sel.y / cv.height, w: sel.w / cv.width, h: sel.h / cv.height };
  cropping = false; update(idx, { crop: c }); exitCrop();
}

// ---------- panel pilihan ----------
function setTab(n) {
  if (entries[idx].vid && (n === 'crop' || n === 'filter' || n === 'rotate')) { toast('Crop, putar, dan filter hanya untuk foto, tidak untuk video'); return; }
  if (cropping && n !== 'crop') exitCrop();
  if (n === 'crop') { cropping ? exitCrop() : enterCrop(); return; }
  tab = tab === n ? '' : n; panel();
}
function pick(key, val) { update(idx, { [key]: val }); preview(); panel(); }
function cycle(kind) {
  if (kind === 'filter' && entries[idx].vid) { toast('Filter hanya untuk foto, tidak untuk video'); return; }
  if (cropping) exitCrop(); tab = kind;
  const list = kind === 'filter' ? FILTERS : FRAME_STYLES, d = kind === 'filter' ? parseFilter(data().filter).id : data()[kind], i = list.findIndex(x => x.id === d);
  pick(kind, list[(i + 1) % list.length].id);
}
// ---------- penyesuaian manual filter ----------
let adjOpen = false, adjRaf = 0, adjSpec = '';
function setSpec(id, adj) {      // gabungkan banyak gerakan slider jadi satu gambar ulang per frame
  adjSpec = stringifyFilter(id, adj);
  if (!adjRaf) adjRaf = requestAnimationFrame(() => { adjRaf = 0; update(idx, { filter: adjSpec }); preview(); });
}
function renderAdj() {
  const box = $('adj'), grid = $('adjgrid'), show = tab === 'filter' && adjOpen && !cropping;
  box.classList.toggle('open', show); if (!show) return;
  grid.textContent = ''; const { id, adj } = parseFilter(data().filter);
  ADJ.forEach(([k, name, min, max]) => {
    const lab = document.createElement('label'), top = document.createElement('span'), val = document.createElement('b'), inp = document.createElement('input');
    val.textContent = adj[k] || 0; top.append(name + ' ', val);
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = 1; inp.value = adj[k] || 0; inp.setAttribute('aria-label', name);
    inp.oninput = () => { adj[k] = +inp.value; val.textContent = inp.value; setSpec(id, adj); };
    inp.ondblclick = () => { inp.value = 0; inp.oninput(); };
    lab.append(top, inp); grid.append(lab);
  });
}
$('adjreset').onclick = () => { update(idx, { filter: parseFilter(data().filter).id }); preview(); renderAdj(); };
// ---------- putar / luruskan ----------
let rotRaf = 0, rotVal = 0;
const norm = a => { a = Math.round(a * 10) / 10 % 360; return a < 0 ? a + 360 : a; };
function setRot(deg) {   // gabungkan banyak gerakan slider jadi satu gambar ulang per frame; crop lama dibatalkan karena ukuran foto berubah
  rotVal = norm(deg);
  if (!rotRaf) rotRaf = requestAnimationFrame(() => { rotRaf = 0; const had = !!data().crop; update(idx, { rot: rotVal, crop: null }); if (had) toast('Crop dibatalkan karena foto diputar'); preview(); panel(); });
}
async function orient(vert) {
  if (!!entries[idx].vert === vert) return;
  if (await setFrameOrient(idx, vert)) { draw(); fit(); panel(); }
}

function panel() {
  const p = $('panel'); p.innerHTML = ''; const d = data();
  document.querySelectorAll('#tools [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const chip = (label, on, fn, color) => {
    const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : '');
    if (color) { const s = document.createElement('span'); s.className = 'sw'; s.style.background = color.startsWith('url(') ? color + ' center/cover' : color; b.append(s); }
    b.append(label); b.onclick = fn; p.append(b); return b;
  };
  if (tab === 'filter') {
    chip('Atur manual', adjOpen, () => { adjOpen = !adjOpen; panel(); }).classList.add('primary');
    const cur = parseFilter(d.filter).id; FILTERS.forEach(f => chip(f.name, cur === f.id, () => pick('filter', f.id)));
  }
  if (tab === 'frame' && state.access.canManage) {     // orientasi disimpan di denah, jadi hanya yang boleh mengatur denah
    const vert = !!entries[idx].vert;
    chip('Mendatar', !vert, () => orient(false)); chip('Tegak', vert, () => orient(true));
    const sep = document.createElement('span'); sep.className = 's'; sep.textContent = '|'; p.append(sep);
  }
  if (tab === 'frame') FRAME_STYLES.forEach(f => chip(f.name, d.frame === f.id, () => pick('frame', f.id), frameSwatch(f.id) || hex(f.color)));
  if (tab === 'rotate') {
    const cur = d.rot || 0, base = Math.round(cur / 90) * 90, fine = Math.round((cur - base) * 10) / 10;
    chip('⟲ 90°', false, () => setRot(cur - 90)); chip('⟳ 90°', false, () => setRot(cur + 90));
    const lab = document.createElement('label'); lab.className = 'rotl';
    const val = document.createElement('b'); val.textContent = fine + '°'; lab.append('Luruskan ', val);
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = -45; inp.max = 45; inp.step = .5; inp.value = fine; inp.setAttribute('aria-label', 'Luruskan foto');
    inp.oninput = () => { val.textContent = inp.value + '°'; setRot(base + +inp.value); }; inp.ondblclick = () => { inp.value = 0; inp.oninput(); };
    lab.append(inp); p.append(lab);
    if (cur) chip('Setel ulang', false, () => setRot(0));
  }
  if (tab === 'crop') {
    ASPECTS.forEach(a => chip(a.name, aspect === a.r, () => setAspect(a.r)));
    chip('Terapkan [Enter]', false, applyCrop).classList.add('primary');
    chip('Batal', false, exitCrop);
    chip('Hapus crop', false, () => { update(idx, { crop: null }); exitCrop(); });
    const h = document.createElement('span'); h.className = 's'; h.textContent = 'Geser kotak atau tarik pegangannya. Di luar kotak = pilih area baru.'; p.append(h);
  }
  p.style.display = tab ? 'flex' : 'none';
  renderAdj();
}
document.querySelectorAll('#tools [data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$('t-pick').onclick = () => $('pick').click();
$('t-reset').onclick = () => {
  if (!confirm('Kembalikan bingkai ini ke foto bawaan? Foto dan pengaturannya akan dihapus dari penyimpanan.')) return;
  resetEntry(idx); cropping = false; tab = ''; sel = null; showSel(); ttl.value = entries[idx].title; draw(); fit(); panel();
};
$('pick').onchange = async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  if (await replacePhoto(idx, f)) { cropping = false; tab = ''; sel = null; showSel(); ttl.value = entries[idx].title; draw(); fit(); panel(); }
};
ttl.onchange = () => { updateTitle(idx, ttl.value); ttl.value = entries[idx].title; };
$('edclose').onclick = closeEditor;

// ---------- shortcut saat editor terbuka ----------
addEventListener('frame-remote', e => {   // pemain lain mengubah foto yang sedang dibuka
  if (state.viewing && idx === e.detail && !cropping && ed.classList.contains('open')) { ttl.value = entries[idx].title; draw(); fit(); panel(); }
});

export function editorKey(e) {
  const k = e.code;
  if (!state.access.canEdit && ['KeyU', 'KeyF', 'KeyB', 'KeyC', 'KeyR', 'Enter'].includes(k)) return;
  if (k === 'Escape') cropping ? exitCrop() : closeEditor();
  else if (k === 'KeyU') $('pick').click();
  else if (k === 'KeyF') cycle('filter');
  else if (k === 'KeyB') cycle('frame');
  else if (k === 'KeyC') setTab('crop');
  else if (k === 'KeyR') setTab('rotate');
  else if (k === 'Enter' && cropping) applyCrop();
  else if (k === 'Equal' || k === 'NumpadAdd') zoomBtn(1.25);
  else if (k === 'Minus' || k === 'NumpadSubtract') zoomBtn(.8);
  else if (k === 'Digit0' || k === 'Numpad0') fit();
}
