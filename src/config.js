// Semua pengaturan yang sering diubah ada di sini.
export const ROOM = { H: 4.5 };                   // tinggi ruangan (meter). Bentuk dan luas ada di denah (layout.js)
export const SPEED = 3.6;                          // kecepatan jalan
export const PEER_PREFIX = 'museumfoto-';          // awalan ID room multiplayer
export const DEFAULT_LOOK = { skin: '#e0ac84', shirt: '#3b6ea5', pants: '#2c2f3a', hat: 0, hatc: '#c0392b', top: 0, bottom: 0, body: 0, face: 0 };

// Judul bawaan bingkai ke-1, ke-2, dst.
export const TITLES = ['Fajar di Atas Kabut','Sawah Bertingkat','Pelabuhan Senja','Hutan Pagi','Lorong Kota Tua','Danau Sunyi','Gunung dan Awan','Pasar Terapung','Kebun Teh','Pantai Karang','Jembatan Lama','Langit Malam'];

// ---- Editor foto ----
export const MAX_IMG = 2400;   // sisi terpanjang foto yang disimpan di browser (px)
export const DEFAULT_PHOTO = { blob: null, crop: null, filter: 'none', frame: 'kayu', video: null, rot: 0 };
export const MAX_VIDEO_S = 10, MAX_VIDEO_BYTES = 12 * 1024 * 1024;   // video di bingkai: maksimal 10 detik dan 12 MB
// Setiap filter = parameter (lihat filters.js): b kecerahan, c kontras, s saturasi, w suhu, t warna (hijau-magenta), f pudar, v vinyet, g butiran, n ketajaman, sep sepia
export const FILTERS = [
  { id: 'none',    name: 'Asli',          p: {} },
  { id: 'bw',      name: 'Hitam putih',   p: { s: -100, c: 12 } },
  { id: 'sepia',   name: 'Sepia',         p: { sep: 85, c: 5 } },
  { id: 'vivid',   name: 'Cerah',         p: { s: 55, c: 12 } },
  { id: 'cool',    name: 'Dingin',        p: { w: -35, s: 10, b: 4 } },
  { id: 'warm',    name: 'Hangat',        p: { w: 35, s: 15, b: 4 } },
  { id: 'fade',    name: 'Pudar',         p: { f: 45, c: -15, b: 8, s: -20 } },
  { id: 'vintage', name: 'Vintage',       p: { sep: 35, w: 20, f: 25, c: -8, v: 35, g: 25 } },
  { id: 'noir',    name: 'Noir',          p: { s: -100, c: 45, b: -8, v: 45 } },
  { id: 'drama',   name: 'Dramatis',      p: { c: 40, s: 20, b: -10, v: 30 } },
  { id: 'matte',   name: 'Matte',         p: { f: 55, c: -25, s: -10 } },
  { id: 'golden',  name: 'Senja emas',    p: { w: 55, s: 25, b: 8, c: 8 } },
  { id: 'cinema',  name: 'Sinematik',     p: { c: 20, s: -5, w: -15, t: -10, v: 35 } },
  { id: 'polaroid',name: 'Polaroid',      p: { w: 18, f: 20, c: -5, s: 15, v: 25 } },
  { id: 'forest',  name: 'Hijau segar',   p: { t: -25, s: 25, c: 8 } },
  { id: 'bright',  name: 'Terang',        p: { b: 25, c: -8, s: 10 } },
  { id: 'crisp',   name: 'Tajam',         p: { n: 60, c: 10, s: 8 } },
  { id: 'soft',    name: 'Lembut',        p: { f: 20, c: -12, b: 8, w: 8 } },
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
