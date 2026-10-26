// Semua pengaturan yang sering diubah ada di sini.
export const ROOM = { H: 4.5 };                   // tinggi ruangan (meter). Bentuk dan luas ada di denah (layout.js)
export const SPEED = 3.6;                          // kecepatan jalan
export const PEER_PREFIX = 'museumfoto-';          // awalan ID room multiplayer
export const DEFAULT_LOOK = { skin: '#e0ac84', shirt: '#3b6ea5', pants: '#2c2f3a', hat: 0 };

// Judul bawaan bingkai ke-1, ke-2, dst.
export const TITLES = ['Fajar di Atas Kabut','Sawah Bertingkat','Pelabuhan Senja','Hutan Pagi','Lorong Kota Tua','Danau Sunyi','Gunung dan Awan','Pasar Terapung','Kebun Teh','Pantai Karang','Jembatan Lama','Langit Malam'];

// ---- Editor foto ----
export const MAX_IMG = 2400;   // sisi terpanjang foto yang disimpan di browser (px)
export const DEFAULT_PHOTO = { blob: null, crop: null, filter: 'none', frame: 'kayu' };
export const FILTERS = [
  { id: 'none',  name: 'Asli',        css: 'none' },
  { id: 'bw',    name: 'Hitam putih', css: 'grayscale(1) contrast(1.1)' },
  { id: 'sepia', name: 'Sepia',       css: 'sepia(.85)' },
  { id: 'vivid', name: 'Cerah',       css: 'saturate(1.7) contrast(1.08)' },
  { id: 'cool',  name: 'Dingin',      css: 'hue-rotate(-18deg) saturate(1.1) brightness(1.04)' },
  { id: 'warm',  name: 'Hangat',      css: 'sepia(.35) saturate(1.35) brightness(1.04)' },
  { id: 'fade',  name: 'Pudar',       css: 'contrast(.85) brightness(1.1) saturate(.8)' },
];
// sx/sy = skala bingkai (lebih kecil = bingkai lebih tipis)
export const FRAME_STYLES = [
  { id: 'kayu',  name: 'Kayu',  color: 0x2a2018, metal: 0,  rough: .5, sx: 1, sy: 1 },
  { id: 'emas',  name: 'Emas',  color: 0xc9a227, metal: .4, rough: .4, sx: 1, sy: 1 },
  { id: 'putih', name: 'Putih', color: 0xf2f1ed, metal: 0,  rough: .6, sx: 1, sy: 1 },
  { id: 'hitam', name: 'Hitam', color: 0x0f0f12, metal: .1, rough: .4, sx: 1, sy: 1 },
  { id: 'tipis', name: 'Tipis', color: 0x2a2018, metal: 0,  rough: .5, sx: .911, sy: .88 },
];
