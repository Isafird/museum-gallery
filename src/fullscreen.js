import { toast } from './toast.js';

// Layar penuh. Chrome/Android, iPad, dan desktop memakai Fullscreen API.
// Safari iPhone tidak menyediakannya: cara lainnya adalah "Tambah ke Layar Utama" (lihat manifest dan meta di index.html).
const de = document.documentElement;
const reqFs = de.requestFullscreen || de.webkitRequestFullscreen;
const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
const current = () => document.fullscreenElement || document.webkitFullscreenElement;
const standalone = () => navigator.standalone === true || ['standalone', 'fullscreen'].some(m => matchMedia(`(display-mode: ${m})`).matches);

export function toggleFullscreen() {
  if (current()) { if (exitFs) exitFs.call(document); return; }
  if (!reqFs) {
    toast(/iPhone|iPod/.test(navigator.userAgent)
      ? 'Safari di iPhone tidak mendukung layar penuh. Ketuk tombol Bagikan, pilih "Tambah ke Layar Utama", lalu buka game dari ikon itu.'
      : 'Browser ini tidak mendukung layar penuh.', 7000);
    return;
  }
  try { const p = reqFs.call(de, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => toast('Browser menolak layar penuh', 3000)); } catch (e) { toast('Browser menolak layar penuh', 3000); }
}

function sync() {
  const on = !!current();
  document.body.classList.toggle('isfs', on);
  document.querySelectorAll('.fsbtn').forEach(b => { b.textContent = on ? b.dataset.off : b.dataset.on; });
}
export function initFullscreen() {
  if (standalone()) document.body.classList.add('standalone');   // sudah dibuka dari ikon layar utama: tombol tidak perlu
  document.querySelectorAll('.fsbtn').forEach(b => { b.onclick = e => { toggleFullscreen(); e.currentTarget.blur(); }; });
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  sync();
}
