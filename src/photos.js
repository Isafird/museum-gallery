import { entries, ensureEntry, defTitle } from './gallery.js';
import { state } from './state.js';
import { FILTERS, FRAME_STYLES, MAX_IMG, DEFAULT_PHOTO } from './config.js';
import * as db from './db.js';
import { toast } from './toast.js';

// Foto disimpan non-destruktif: file asli + pengaturan (crop, filter, frame).
// Penyimpanan ("store") bisa db.js (lokal) atau cloud.js (online), antarmukanya sama.
let store = db;
export const useStore = s => { store = s; };
const canEdit = () => { if (state.access.canEdit) return true; toast('Kamu hanya punya akses lihat'); return false; };
export const getSource = i => entries[i].bmp || entries[i].art;
const notify = i => dispatchEvent(new CustomEvent('frame-remote', { detail: i }));

export function applyFrame(i) {
  const e = entries[i]; if (!e || !e.frameMesh) return;
  const s = FRAME_STYLES.find(x => x.id === e.data.frame) || FRAME_STYLES[0], m = e.frameMesh.material;
  m.color.setHex(s.color); m.metalness = s.metal; m.roughness = s.rough; e.frameMesh.scale.set(s.sx, s.sy, 1);
}

// Gambar ulang isi bingkai di 3D (crop + filter, di atas matte putih)
export function render(i) {
  const e = entries[i], d = e.data, c = e.canvas, g = c.getContext('2d'), src = getSource(i);
  const cr = d.crop || { x: 0, y: 0, w: 1, h: 1 };
  const sx = cr.x * src.width, sy = cr.y * src.height, sw = cr.w * src.width, sh = cr.h * src.height;
  const m = 26, k = Math.min((c.width - 2 * m) / sw, (c.height - 2 * m) / sh), w = sw * k, h = sh * k;
  g.filter = 'none'; g.fillStyle = '#e9e7e2'; g.fillRect(0, 0, c.width, c.height);
  const f = FILTERS.find(x => x.id === d.filter);
  if ('filter' in g && f) g.filter = f.css;       // (browser tanpa ctx.filter menampilkan foto tanpa filter)
  g.drawImage(src, sx, sy, sw, sh, (c.width - w) / 2, (c.height - h) / 2, w, h);
  g.filter = 'none'; e.tex.needsUpdate = true;
}

const timers = {};
function persist(i) {
  clearTimeout(timers[i]);
  timers[i] = setTimeout(async () => {
    const e = entries[i], d = e.data, changed = !!e.dirtyPhoto, oldPh = e.ph || 0, ph = changed ? Date.now() : oldPh;
    if (changed) e.ph = ph;                      // tandai dulu supaya gema dari server tidak mengunduh ulang
    const ok = await store.save({ id: i, blob: d.blob, crop: d.crop, filter: d.filter, frame: d.frame, title: e.title, ph, oldPh, photoChanged: changed });
    if (ok && changed) e.dirtyPhoto = false; else if (!ok && changed) e.ph = oldPh;
    toast(ok ? 'Tersimpan' : 'Gagal menyimpan (periksa koneksi atau hak akses)');
  }, 300);
}

export function update(i, patch) {
  if (!canEdit()) return;
  Object.assign(entries[i].data, patch);
  if ('frame' in patch) applyFrame(i);
  render(i); persist(i);
}
export function updateTitle(i, title) {
  if (!canEdit()) return;
  entries[i].title = title.trim().slice(0, 40) || defTitle(i); persist(i);
}

// Kecilkan dan kompres foto sebelum disimpan
async function encode(c, maxBytes) {
  const toBlob = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
  let q = .9, blob = await toBlob(c, q);
  while (maxBytes && blob.size > maxBytes) {
    if (q > .5) q -= .1;
    else { const n = document.createElement('canvas'); n.width = Math.round(c.width * .8); n.height = Math.round(c.height * .8); n.getContext('2d').drawImage(c, 0, 0, n.width, n.height); c = n; }
    blob = await toBlob(c, q);
  }
  return { blob, canvas: c };
}
export async function replacePhoto(i, file) {
  if (!canEdit()) return false;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { toast('File ini bukan gambar yang bisa dibuka'); return false; }
  const k = Math.min(1, MAX_IMG / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  const { blob, canvas } = await encode(c, 0);
  const e = entries[i]; e.bmp = canvas; e.data.blob = blob; e.data.crop = null; e.dirtyPhoto = true;
  e.title = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
  render(i); persist(i); return true;
}

// Kembalikan tampilan bingkai ke bawaan (tanpa menyentuh penyimpanan)
export function clearView(i) {
  const e = entries[i]; e.bmp = null; e.data = { ...DEFAULT_PHOTO }; e.title = defTitle(i); e.ph = 0; e.dirtyPhoto = false;
  applyFrame(i); render(i);
}
export const saveLayout = l => store.saveLayout(l);
export function dropFrames(ids) { ids.forEach(id => { if (entries[id]) clearView(id); store.remove(id); }); }
export function resetEntry(i) {
  if (!canEdit()) return;
  clearView(i); store.remove(i); toast('Dikembalikan ke bawaan');
}

// Perubahan dari pemain lain (galeri online): pengaturan langsung, foto diunduh hanya kalau versinya baru
export async function applyRemote(i, rec) {
  const e = ensureEntry(i);
  const ph = rec.ph || 0;
  e.data = { ...e.data, crop: rec.crop || null, filter: rec.filter || 'none', frame: rec.frame || 'kayu' };
  e.title = rec.title || defTitle(i);
  if (!ph) { e.bmp = null; e.data.blob = null; e.ph = 0; }
  applyFrame(i); render(i); notify(i);
  if (ph && ph !== e.ph) {
    try {
      const blob = await store.loadPhoto(i, ph);
      if (blob) { e.bmp = await createImageBitmap(blob); e.data.blob = blob; e.ph = ph; render(i); notify(i); }
    } catch (err) {}
  }
}

// Render awal, lalu muat foto tersimpan dari database lokal
export async function initPhotos() {
  for (const rec of await db.loadAll()) {
    if (store !== db) return;                       // sudah pindah ke galeri online
    if (rec.id < 0) continue;                       // rekaman denah
    const e = ensureEntry(rec.id);
    e.data = { blob: rec.blob || null, crop: rec.crop || null, filter: rec.filter || 'none', frame: rec.frame || 'kayu' };
    if (rec.title) e.title = rec.title;
    if (rec.blob) { try { e.bmp = await createImageBitmap(rec.blob); } catch (err) {} }
    applyFrame(rec.id); render(rec.id);
  }
}
