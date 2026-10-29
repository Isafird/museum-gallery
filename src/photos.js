import { entries, ensureEntry, defTitle, setFrameStyle, drawPlaque } from './gallery.js';
import { state } from './state.js';
import { MAX_IMG, DEFAULT_PHOTO, MAX_VIDEO_S, MAX_VIDEO_BYTES } from './config.js';
import { applyFilter } from './filters.js';
import * as db from './db.js';
import { toast } from './toast.js';

// Foto disimpan non-destruktif: file asli + pengaturan (crop, filter, frame).
// Penyimpanan ("store") bisa db.js (lokal) atau cloud.js (online), antarmukanya sama.
let store = db;
export const useStore = s => { store = s; };
const canEdit = () => { if (state.access.canEdit) return true; toast('Kamu hanya punya akses lihat'); return false; };
// Putar foto (derajat, boleh miring): hasilnya kanvas yang diperbesar supaya tidak ada bagian yang terpotong. Sudut kosong diisi warna matte.
function rotated(e, base, deg) {
  if (e.rc && e.rc.base === base && e.rc.deg === deg) return e.rc.canvas;
  const a = deg * Math.PI / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  let W = base.width * cs + base.height * sn, H = base.width * sn + base.height * cs; const k = Math.min(1, 2400 / Math.max(W, H));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
  const g = c.getContext('2d'); g.fillStyle = '#e9e7e2'; g.fillRect(0, 0, c.width, c.height);
  g.translate(c.width / 2, c.height / 2); g.rotate(a); g.scale(k, k); g.drawImage(base, -base.width / 2, -base.height / 2);
  e.rc = { base, deg, canvas: c }; return c;
}
export const getSource = i => { const e = entries[i], base = e.bmp || e.art, r = (e.data && e.data.rot) || 0; return r && !e.vid ? rotated(e, base, r) : base; };
// Putaran disimpan di dalam kolom crop yang sudah ada (field r), jadi database tidak perlu diubah
const packCrop = d => { const r = d.rot || 0; return !d.crop && !r ? null : r ? { ...(d.crop || { x: 0, y: 0, w: 1, h: 1 }), r } : d.crop; };
const unpackCrop = c => { if (!c || c.video) return { crop: null, rot: 0 }; const { r, ...crop } = c; return { crop: crop.w ? crop : null, rot: r || 0 }; };
const notify = i => dispatchEvent(new CustomEvent('frame-remote', { detail: i }));

export function applyFrame(i) { setFrameStyle(i); }

// Gambar ulang isi bingkai di 3D (crop + filter, di atas matte putih)
export function render(i) {
  const e = entries[i], d = e.data, c = e.canvas, g = c.getContext('2d', { willReadFrequently: true }), src = getSource(i);
  const cr = d.crop || { x: 0, y: 0, w: 1, h: 1 };
  const sx = cr.x * src.width, sy = cr.y * src.height, sw = cr.w * src.width, sh = cr.h * src.height;
  const m = 26, k = Math.min((c.width - 2 * m) / sw, (c.height - 2 * m) / sh), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const dx = Math.round((c.width - w) / 2), dy = Math.round((c.height - h) / 2);
  g.fillStyle = '#e9e7e2'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, sx, sy, sw, sh, dx, dy, w, h);
  try { applyFilter(g, dx, dy, w, h, d.filter); } catch (err) {}           // filter dihitung per piksel hanya pada area foto (matte tidak ikut)
  e.tex.needsUpdate = true; e.rendered = true; drawPlaque(i);
}

const timers = {}, inflight = new Set();
const status = st => dispatchEvent(new CustomEvent('save-status', { detail: st }));   // 'pending' | 'saving' | 'saved' | 'error'
const busy = () => Object.keys(timers).length > 0 || inflight.size > 0;
async function doSave(i) {
  const e = entries[i]; if (!e) return true;
  const d = e.data, changed = !!e.dirtyPhoto, oldPh = e.ph || 0, ph = changed ? Date.now() : oldPh;
  if (changed) e.ph = ph;                      // tandai dulu supaya gema dari server tidak mengunduh ulang
  inflight.add(i); status('saving');
  const ext = d.video ? d.video.ext : 'jpg', oldExt = e.pext || 'jpg';
  const crop = d.video ? { video: d.video.ext, dur: d.video.dur } : packCrop(d);          // video ditandai di kolom crop (tanpa mengubah database)
  const ok = await store.save({ id: i, blob: d.blob, crop, filter: d.filter, frame: d.frame, title: e.title, ph, oldPh, photoChanged: changed, ext, oldExt });
  inflight.delete(i);
  if (ok && changed) { e.dirtyPhoto = false; e.pext = ext; } else if (!ok && changed) e.ph = oldPh;
  status(!ok ? 'error' : busy() ? 'pending' : 'saved');
  return ok;
}
function persist(i) {                          // simpan otomatis 0,8 detik setelah perubahan terakhir
  clearTimeout(timers[i]); status('pending');
  timers[i] = setTimeout(async () => { delete timers[i]; if (!(await doSave(i))) toast('Gagal menyimpan (periksa koneksi atau hak akses)'); }, 800);
}
export const hasPending = busy;
// Simpan sekarang juga semua perubahan yang masih menunggu
export async function flushSaves() {
  const ids = Object.keys(timers).map(Number); ids.forEach(i => { clearTimeout(timers[i]); delete timers[i]; });
  const ok = (await Promise.all(ids.map(doSave))).every(Boolean);
  while (inflight.size) await new Promise(r => setTimeout(r, 50));     // tunggu penyimpanan yang sedang berjalan
  status(ok ? 'saved' : 'error'); return ok;
}
export async function saveAll() {
  const ok = await flushSaves(); toast(ok ? 'Tersimpan' : 'Gagal menyimpan (periksa koneksi atau hak akses)'); return ok;
}
addEventListener('beforeunload', e => { if (busy()) { e.preventDefault(); e.returnValue = ''; } });   // jangan tutup halaman saat belum tersimpan

export function update(i, patch) {
  if (!canEdit()) return;
  Object.assign(entries[i].data, patch);
  if ('frame' in patch) applyFrame(i);
  render(i); persist(i);
}
export function updateTitle(i, title) {
  if (!canEdit()) return;
  entries[i].title = title.trim().slice(0, 40) || defTitle(i); drawPlaque(i); persist(i);
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
// ---- video ----
const EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
const isVideo = f => (f.type || '').startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(f.name || '');
const extOf = f => EXT[f.type] || ((f.name || '').match(/\.(webm|mov)$/i) || [, 'mp4'])[1].toLowerCase();
const once = (el, ev, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('waktu habis')), ms); el.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true }); el.addEventListener('error', () => { clearTimeout(t); rej(new Error('video error')); }, { once: true }); });
// Buka video dari blob: elemen <video>, gambar pembuka (poster) dan durasi
async function openVideo(blob) {
  const url = URL.createObjectURL(blob), vid = document.createElement('video');
  vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'auto'; vid.setAttribute('playsinline', ''); vid.setAttribute('muted', '');
  vid.src = url;
  try {
    await once(vid, 'loadeddata', 10000);
    const dur = vid.duration || 0, k = Math.min(1, 960 / Math.max(vid.videoWidth, vid.videoHeight));
    try { vid.currentTime = Math.min(.1, dur / 2); await once(vid, 'seeked', 3000); } catch (e) {}
    const poster = document.createElement('canvas'); poster.width = Math.max(1, Math.round(vid.videoWidth * k)); poster.height = Math.max(1, Math.round(vid.videoHeight * k));
    poster.getContext('2d').drawImage(vid, 0, 0, poster.width, poster.height);
    return { vid, url, poster, dur };
  } catch (err) { URL.revokeObjectURL(url); throw err; }
}
export function clearVideo(e) {
  if (e.vid) { e.vid.pause(); e.vid.removeAttribute('src'); e.vid.load(); URL.revokeObjectURL(e.vurl); }
  e.vid = null; e.vurl = null; if (e.data) e.data.video = null;
}
function setVideo(e, o, ext) { clearVideo(e); e.vid = o.vid; e.vurl = o.url; e.bmp = o.poster; e.data.video = { ext, dur: Math.round(o.dur * 10) / 10 }; }
// Gambar bingkai video yang sedang diputar ke kanvas bingkai (dipanggil videos.js)
export function drawVideoFrame(i) {
  const e = entries[i], v = e && e.vid; if (!v || !v.videoWidth) return;
  const c = e.canvas, g = c.getContext('2d'), m = 26, k = Math.min((c.width - 2 * m) / v.videoWidth, (c.height - 2 * m) / v.videoHeight);
  const w = Math.max(1, Math.round(v.videoWidth * k)), h = Math.max(1, Math.round(v.videoHeight * k));
  g.drawImage(v, Math.round((c.width - w) / 2), Math.round((c.height - h) / 2), w, h); e.tex.needsUpdate = true;
}
async function replaceVideo(i, file) {
  if (file.size > MAX_VIDEO_BYTES) { toast(`Video terlalu besar (maks ${MAX_VIDEO_BYTES / 1048576} MB, maks ${MAX_VIDEO_S} detik). Potong atau kecilkan dulu.`); return false; }
  let o; toast('Memuat video...');
  try { o = await openVideo(file); } catch (err) { toast('Video ini tidak bisa diputar di browser (coba format MP4)'); return false; }
  if (!(o.dur > 0) || o.dur > MAX_VIDEO_S + .3) { toast(`Video terlalu panjang (${Math.round(o.dur)} detik). Maksimal ${MAX_VIDEO_S} detik.`); URL.revokeObjectURL(o.url); return false; }
  const e = entries[i], ext = extOf(file);
  setVideo(e, o, ext); e.data.rot = 0; e.data.blob = file.type ? file : new Blob([file], { type: MIME[ext] }); e.data.crop = null; e.data.filter = 'none'; e.dirtyPhoto = true;
  e.title = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
  render(i); persist(i); toast('Video terpasang'); return true;
}
// ---- membuka berbagai format gambar (JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC/HEIF dari iPhone). Orientasi EXIF ikut diterapkan. ----
const isHeic = f => /image\/hei[cf]/i.test(f.type || '') || /\.(heic|heif)$/i.test(f.name || '');
async function openImg(blob) {
  const url = URL.createObjectURL(blob), img = new Image(); img.src = url;
  try { await img.decode(); if (!img.naturalWidth) throw new Error('kosong'); return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) }; }
  catch (err) {
    URL.revokeObjectURL(url);
    let b; try { b = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e2) { b = await createImageBitmap(blob); }
    return { src: b, w: b.width, h: b.height, done: () => b.close && b.close() };
  }
}
async function decodeImage(file) {
  if (isHeic(file)) {
    try { return await openImg(file); } catch (err) {}                     // Safari / iPhone bisa membuka HEIC langsung
    toast('Mengubah HEIC, tunggu sebentar...');
    const { heicTo } = await import('heic-to');                            // dimuat hanya saat dibutuhkan (besar)
    return openImg(await heicTo({ blob: file, type: 'image/jpeg', quality: .92 }));
  }
  return openImg(file);
}
export async function replacePhoto(i, file) {
  if (!canEdit()) return false;
  if (isVideo(file)) return replaceVideo(i, file);
  let im;
  try { im = await decodeImage(file); } catch (e) { toast(isHeic(file) ? 'File HEIC ini tidak bisa dibuka. Coba simpan sebagai JPEG dulu.' : 'File ini bukan gambar yang bisa dibuka'); return false; }
  const k = Math.min(1, MAX_IMG / Math.max(im.w, im.h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.w * k)); c.height = Math.max(1, Math.round(im.h * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im.src, 0, 0, c.width, c.height);
  im.done();
  const { blob, canvas } = await encode(c, 0);
  const e = entries[i]; clearVideo(e); e.bmp = canvas; e.data.blob = blob; e.data.crop = null; e.data.rot = 0; e.dirtyPhoto = true;
  e.title = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
  render(i); persist(i); return true;
}

// Kembalikan tampilan bingkai ke bawaan (tanpa menyentuh penyimpanan)
export function clearView(i) {
  const e = entries[i]; clearVideo(e); e.bmp = null; e.data = { ...DEFAULT_PHOTO }; e.title = defTitle(i); e.ph = 0; e.pext = 'jpg'; e.dirtyPhoto = false;
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
  const vd = rec.crop && rec.crop.video ? { ext: rec.crop.video, dur: rec.crop.dur || 0 } : null;
  const up = unpackCrop(rec.crop); e.data = { ...e.data, crop: up.crop, rot: up.rot, filter: rec.filter || 'none', frame: rec.frame || 'kayu' };
  e.title = rec.title || defTitle(i);
  if (!ph) { clearVideo(e); e.bmp = null; e.data.blob = null; e.ph = 0; e.pext = 'jpg'; }
  else if (!vd && e.vid) clearVideo(e);
  applyFrame(i); render(i); notify(i);
  if (ph && ph !== e.ph) {
    try {
      const blob = await store.loadPhoto(i, ph, vd ? vd.ext : 'jpg');
      if (blob && vd) { const o = await openVideo(blob); setVideo(e, o, vd.ext); e.data.blob = blob; e.ph = ph; e.pext = vd.ext; render(i); notify(i); }
      else if (blob) { clearVideo(e); e.bmp = await createImageBitmap(blob); e.data.blob = blob; e.ph = ph; e.pext = 'jpg'; render(i); notify(i); }
    } catch (err) {}
  }
}

// Render awal, lalu muat foto tersimpan dari database lokal
export async function initPhotos() {
  for (const rec of await db.loadAll()) {
    if (store !== db) return;                       // sudah pindah ke galeri online
    if (rec.id < 0) continue;                       // rekaman denah
    const e = ensureEntry(rec.id);
    const vd = rec.crop && rec.crop.video ? { ext: rec.crop.video, dur: rec.crop.dur || 0 } : null;
    const up = unpackCrop(rec.crop); e.data = { blob: rec.blob || null, crop: up.crop, rot: up.rot, filter: rec.filter || 'none', frame: rec.frame || 'kayu', video: null };
    if (rec.title) e.title = rec.title;
    e.pext = vd ? vd.ext : 'jpg';
    if (rec.blob && vd) { try { setVideo(e, await openVideo(rec.blob), vd.ext); } catch (err) {} }
    else if (rec.blob) { try { e.bmp = await createImageBitmap(rec.blob); } catch (err) {} }
    applyFrame(rec.id); render(rec.id);
  }
}
