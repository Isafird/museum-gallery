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
// Gaya bingkai. color = warna contoh di pilihan, ey / eyt = setengah tinggi bingkai bawah / atas (untuk posisi papan nama).
// Bentuk 3D-nya ada di frames3d.js.
export const FRAME_STYLES = [
  { id: 'kayu',      name: 'Kayu',         color: 0x2a2018, ey: 1.0 },
  { id: 'emas',      name: 'Emas',         color: 0xc9a227, ey: 1.0 },
  { id: 'putih',     name: 'Putih',        color: 0xf2f1ed, ey: 1.0 },
  { id: 'hitam',     name: 'Hitam',        color: 0x0f0f12, ey: 1.0 },
  { id: 'tipis',     name: 'Tipis',        color: 0x2a2018, ey: .93 },
  { id: 'ornamen',   name: 'Ornamen kayu', color: 0x8a5a2b, ey: 1.12 },
  { id: 'kerajaan',  name: 'Kerajaan',     color: 0xd4af37, ey: 1.15, eyt: 1.5 },
  { id: 'lucu',      name: 'Lucu',         color: 0xff8fb8, ey: 1.12, eyt: 1.4 },
  { id: 'fun',       name: 'Fun',          color: 0xffca3a, ey: 1.03 },
  { id: 'minimalis', name: 'Minimalis',    color: 0xe9e7e2, ey: 1.0 },
  { id: 'modern',    name: 'Modern',       color: 0x8a9099, ey: .95 },
  { id: 'neon',      name: 'Neon',         color: 0x00e5ff, ey: .97 },
];
