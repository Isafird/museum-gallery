import { entries } from './gallery.js';
import { getSource } from './photos.js';
import { applyFilter } from './filters.js';
import { renderFramed } from './framepreview.js';
import { renderer, scene, camera } from './scene.js';
import { toast } from './toast.js';

// Unduh gambar / video yang ada di museum, dan foto layar tampilan 3D.
export const safeName = s => (String(s || 'foto').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 60) || 'foto');
export function saveBlob(blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const toBlob = (c, type = 'image/png', q = .92) => new Promise(r => c.toBlob(r, type, q));

// Foto/video asli seperti yang diunggah (foto sudah dikecilkan maks 2400 px). Foto bawaan digambar ulang jadi JPEG.
export async function downloadOriginal(i) {
  const e = entries[i]; if (!e) return;
  if (e.vid && e.data.blob) { saveBlob(e.data.blob, `${safeName(e.title)}.${e.data.video.ext}`); return; }
  const blob = e.data.blob || await toBlob(e.bmp || e.art, 'image/jpeg');
  saveBlob(blob, `${safeName(e.title)}.jpg`);
}
// Foto setelah crop, putar, dan filter (tanpa bingkai)
export async function downloadEdited(i) {
  const e = entries[i]; if (!e || e.vid) return downloadOriginal(i);
  const src = getSource(i), cr = e.data.crop || { x: 0, y: 0, w: 1, h: 1 };
  const sw = Math.max(1, Math.round(src.width * cr.w)), sh = Math.max(1, Math.round(src.height * cr.h));
  const c = document.createElement('canvas'); c.width = sw; c.height = sh; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, src.width * cr.x, src.height * cr.y, src.width * cr.w, src.height * cr.h, 0, 0, sw, sh);
  try { applyFilter(g, 0, 0, sw, sh, e.data.filter); } catch (err) {}
  saveBlob(await toBlob(c, 'image/jpeg'), `${safeName(e.title)}-edit.jpg`);
}
// Gambar lengkap dengan bingkainya
export async function downloadFramed(i) {
  const e = entries[i]; if (!e) return; const out = renderFramed(e, 2000);
  if (!out) { toast('Gagal membuat gambar berbingkai'); return; }
  saveBlob(await toBlob(out), `${safeName(e.title)}-bingkai.png`);
}
// Foto layar tampilan 3D saat ini
export function takeShot() {
  renderer.render(scene, camera);                                  // gambar ulang lalu langsung salin (buffer belum dibersihkan)
  renderer.domElement.toBlob(b => { if (!b) { toast('Gagal mengambil foto layar'); return; } saveBlob(b, `museum-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`); toast('Foto layar tersimpan'); }, 'image/png');
}
