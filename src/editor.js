import { state } from './state.js';
import { entries } from './gallery.js';
import { FILTERS, FRAME_STYLES } from './config.js';
import { getSource, update, updateTitle, replacePhoto, resetEntry, saveAll, hasPending } from './photos.js';
import { isLocked, lockCursor } from './cursor.js';
import { frameSwatch } from './frametex.js';

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
  cropping = false; ed.classList.remove('open'); state.viewing = false;
  if (hasPending()) saveAll();                       // simpan yang belum tersimpan
  if (state.relock) lockCursor();
}

// ---------- status simpan ----------
const LABEL = { saved: 'Tersimpan ✓', pending: 'Belum tersimpan...', saving: 'Menyimpan...', error: 'Gagal menyimpan' };
function setStat(st) { const el = $('edstat'); el.textContent = LABEL[st] || ''; el.dataset.s = st; }
addEventListener('save-status', e => setStat(e.detail));
$('edsave').onclick = () => saveAll();

// ---------- gambar di editor ----------
function draw() {
  const src = getSource(idx), cr = (cropping || !data().crop) ? { x: 0, y: 0, w: 1, h: 1 } : data().crop;
  const sw = src.width * cr.w, sh = src.height * cr.h, k = Math.min(1, 1800 / Math.max(sw, sh));
  cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
  cv.getContext('2d').drawImage(src, src.width * cr.x, src.height * cr.y, sw, sh, 0, 0, cv.width, cv.height);
  preview();
}
function preview() {   // filter + warna bingkai ditampilkan lewat CSS
  const f = FILTERS.find(x => x.id === data().filter), s = FRAME_STYLES.find(x => x.id === data().frame) || FRAME_STYLES[0];
  cv.style.filter = f ? f.css : 'none'; cv.style.outlineColor = hex(s.color);
}
function apply() {
  wrap.style.transform = `translate(${v.tx}px,${v.ty}px) scale(${v.s})`;
  cv.style.outlineWidth = (cropping ? 0 : 14 / v.s) + 'px'; cropEl.style.borderWidth = (2 / v.s) + 'px';
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
const ptr = new Map(); let pinch = 0, start = null;
const loc = e => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const cpt = e => { const p = loc(e); return { x: Math.max(0, Math.min(cv.width, (p.x - v.tx) / v.s)), y: Math.max(0, Math.min(cv.height, (p.y - v.ty) / v.s)) }; };
const two = () => { const [a, b] = [...ptr.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('#zoom')) return;
  stage.setPointerCapture(e.pointerId); ptr.set(e.pointerId, loc(e));
  if (ptr.size === 2) { start = null; pinch = two().d; }
  else if (cropping) { prevSel = sel; start = cpt(e); sel = { ...start, w: 0, h: 0 }; showSel(); }
});
stage.addEventListener('pointermove', e => {
  const o = ptr.get(e.pointerId); if (!o) return; const p = loc(e); ptr.set(e.pointerId, p);
  if (ptr.size === 2) { const t = two(); zoomAt(t.x, t.y, t.d / pinch); pinch = t.d; }
  else if (cropping && start) { sel = selRect(start, cpt(e)); showSel(); }
  else if (!cropping) { v.tx += p.x - o.x; v.ty += p.y - o.y; apply(); }
});
const up = e => {
  ptr.delete(e.pointerId); if (ptr.size < 2) pinch = 0;
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
function showSel() {
  cropEl.style.display = sel && cropping ? 'block' : 'none';
  if (sel) Object.assign(cropEl.style, { left: sel.x + 'px', top: sel.y + 'px', width: sel.w + 'px', height: sel.h + 'px' });
}
function enterCrop() {
  cropping = true; tab = 'crop'; draw(); fit();
  const c = data().crop; sel = c ? { x: c.x * cv.width, y: c.y * cv.height, w: c.w * cv.width, h: c.h * cv.height } : { x: 0, y: 0, w: cv.width, h: cv.height };
  showSel(); panel();
}
function exitCrop() { cropping = false; sel = null; tab = ''; showSel(); draw(); fit(); panel(); }
function applyCrop() {
  if (!sel || sel.w < 8 || sel.h < 8) return;
  const c = { x: sel.x / cv.width, y: sel.y / cv.height, w: sel.w / cv.width, h: sel.h / cv.height };
  cropping = false; update(idx, { crop: c }); exitCrop();
}

// ---------- panel pilihan ----------
function setTab(n) {
  if (cropping && n !== 'crop') exitCrop();
  if (n === 'crop') { cropping ? exitCrop() : enterCrop(); return; }
  tab = tab === n ? '' : n; panel();
}
function pick(key, val) { update(idx, { [key]: val }); preview(); panel(); }
function cycle(kind) {
  if (cropping) exitCrop(); tab = kind;
  const list = kind === 'filter' ? FILTERS : FRAME_STYLES, d = data()[kind], i = list.findIndex(x => x.id === d);
  pick(kind, list[(i + 1) % list.length].id);
}
function panel() {
  const p = $('panel'); p.innerHTML = ''; const d = data();
  document.querySelectorAll('#tools [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const chip = (label, on, fn, color) => {
    const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : '');
    if (color) { const s = document.createElement('span'); s.className = 'sw'; s.style.background = color.startsWith('url(') ? color + ' center/cover' : color; b.append(s); }
    b.append(label); b.onclick = fn; p.append(b); return b;
  };
  if (tab === 'filter') FILTERS.forEach(f => chip(f.name, d.filter === f.id, () => pick('filter', f.id)));
  if (tab === 'frame') FRAME_STYLES.forEach(f => chip(f.name, d.frame === f.id, () => pick('frame', f.id), frameSwatch(f.id) || hex(f.color)));
  if (tab === 'crop') {
    ASPECTS.forEach(a => chip(a.name, aspect === a.r, () => { aspect = a.r; panel(); }));
    chip('Terapkan [Enter]', false, applyCrop).classList.add('primary');
    chip('Batal', false, exitCrop);
    chip('Hapus crop', false, () => { update(idx, { crop: null }); exitCrop(); });
    const h = document.createElement('span'); h.className = 's'; h.textContent = 'Geser di atas foto untuk memilih area.'; p.append(h);
  }
  p.style.display = tab ? 'flex' : 'none';
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
  if (!state.access.canEdit && ['KeyU', 'KeyF', 'KeyB', 'KeyC', 'Enter'].includes(k)) return;
  if (k === 'Escape') cropping ? exitCrop() : closeEditor();
  else if (k === 'KeyU') $('pick').click();
  else if (k === 'KeyF') cycle('filter');
  else if (k === 'KeyB') cycle('frame');
  else if (k === 'KeyC') setTab('crop');
  else if (k === 'Enter' && cropping) applyCrop();
  else if (k === 'Equal' || k === 'NumpadAdd') zoomBtn(1.25);
  else if (k === 'Minus' || k === 'NumpadSubtract') zoomBtn(.8);
  else if (k === 'Digit0' || k === 'Numpad0') fit();
}
