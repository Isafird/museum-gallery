import { DEFAULT_LOOK } from './config.js';

// Status bersama yang dipakai semua modul.
export const state = {
  P: { x: -12, z: 7, y: 0, vy: 0 },   // posisi pemain (y = tinggi loncatan, vy = kecepatan naik/turun)
  y: 0, vy: 0, jumpReq: false,   // ketinggian lompat, kecepatan vertikal, permintaan lompat
  yaw: 0, pitch: 0,
  active: false,         // sudah masuk galeri?
  viewing: false,        // sedang melihat foto besar?
  third: false,          // kamera orang ketiga?
  target: -1,            // indeks bingkai yang sedang dibidik
  access: { role: 'local', canEdit: true, canManage: true, visibility: 'public' }, // hak akses galeri
  layout: null,          // denah yang sedang dipakai
  online: false,         // sedang di galeri online?
  user: null,            // akun Google (kalau masuk)
  typing: false,         // sedang mengetik chat?
  cursorFree: false,     // pemain memilih kursor tampil
  relock: false,         // kunci kursor lagi setelah editor ditutup
  look: { ...DEFAULT_LOOK },
  name: 'Pengunjung',
};

try {
  const s = JSON.parse(localStorage.getItem('museum-char'));
  if (s) { state.look = s.look; state.name = s.name; }
} catch (e) {}

export function saveChar() {
  try { localStorage.setItem('museum-char', JSON.stringify({ look: state.look, name: state.name })); } catch (e) {}
}
