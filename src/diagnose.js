import { createClient } from '@supabase/supabase-js';
import { supabaseConfig as C } from './supabase-config.js';

// Halaman diagnosis: buka alamat game dengan ?cek di belakangnya. Memeriksa konfigurasi Supabase satu per satu.
const rows = [];
let box;
function render() {
  if (!box) {
    box = document.createElement('div'); box.id = 'diag';
    box.innerHTML = '<div class="dg"><h1>Cek koneksi Supabase</h1><div id="dgl"></div><p class="s" id="dgs"></p><button id="dgx" class="tool">Tutup</button></div>';
    document.body.append(box); box.querySelector('#dgx').onclick = () => { location.search = ''; };
  }
  const l = box.querySelector('#dgl'); l.textContent = '';
  rows.forEach(r => {
    const d = document.createElement('div'); d.className = 'dr ' + (r.ok === true ? 'ok' : r.ok === false ? 'bad' : 'info');
    const t = document.createElement('b'); t.textContent = (r.ok === true ? '✔ ' : r.ok === false ? '✖ ' : 'ℹ ') + r.title; d.append(t);
    if (r.hint) { const h = document.createElement('div'); h.className = 's'; h.textContent = r.hint; d.append(h); }
    l.append(d);
  });
}
const add = (ok, title, hint) => { rows.push({ ok, title, hint }); render(); };
const b64 = s => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));

export async function run() {
  const url = (C.url || '').trim(), key = (C.anonKey || '').trim();
  if (!url || !key) { add(false, 'Config belum diisi', 'Isi url dan anonKey di src/supabase-config.js, simpan, lalu muat ulang halaman ini.'); return done(); }
  add(true, 'Config terisi');

  let origin;
  try { origin = new URL(url).origin; } catch (e) { add(false, 'URL tidak valid', 'Harus berbentuk https://xxxxx.supabase.co'); return done(); }
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(origin)) add(false, 'URL tidak terlihat seperti alamat project Supabase', `Terbaca: ${origin}. Seharusnya https://PROJECT-ID.supabase.co (Project Settings > Data API).`);
  else if (url.replace(/\/+$/, '') !== origin) add(null, 'URL berisi jalur tambahan', `Bagian setelah ${origin} diabaikan oleh game, tapi sebaiknya dihapus dari config.`);
  else add(true, 'Format URL benar', origin);

  if (key.startsWith('sb_secret_')) { add(false, 'Ini SECRET key, jangan dipakai di web!', 'Segera ganti dengan Publishable key (sb_publishable_...). Karena kunci ini sudah terlanjur terlihat, buat ulang di Project Settings > API Keys.'); return done(); }
  if (key.startsWith('eyJ')) {
    try { const role = b64(key.split('.')[1]).role; if (role === 'service_role') { add(false, 'Ini kunci service_role, jangan dipakai di web!', 'Ganti dengan Publishable key atau kunci anon, lalu reset kunci service_role di dashboard.'); return done(); } add(true, 'Kunci anon lama (role: ' + role + ')', 'Masih bisa dipakai. Disarankan pindah ke Publishable key.'); } catch (e) { add(false, 'Kunci rusak (terpotong saat disalin?)'); return done(); }
  } else if (key.startsWith('sb_publishable_')) add(true, 'Publishable key');
  else { add(false, 'Bentuk kunci tidak dikenali', 'Harus diawali sb_publishable_ (atau eyJ untuk kunci anon lama). Salin ulang dari Project Settings > API Keys.'); return done(); }

  let settings;
  try {
    const res = await fetch(`${origin}/auth/v1/settings`, { headers: { apikey: key } });
    if (res.status === 401 || res.status === 403) { add(false, 'Server menolak kunci ini', 'Kunci tidak cocok dengan project ini, atau sudah dihapus. Salin ulang URL dan kunci dari project yang sama.'); return done(); }
    if (!res.ok) { add(false, 'Server membalas error ' + res.status, 'Periksa apakah project sedang dijeda (paused) di dashboard Supabase.'); return done(); }
    settings = await res.json(); add(true, 'Terhubung ke Supabase, kunci diterima');
  } catch (e) { add(false, 'Tidak bisa menghubungi server', 'URL salah, internet bermasalah, atau project dijeda. Buka dashboard dan klik Restore kalau statusnya Paused.'); return done(); }

  if (settings.external && settings.external.google) add(true, 'Login Google aktif');
  else add(false, 'Login Google belum aktif', 'Authentication > Sign In / Providers > Google: aktifkan, isi Client ID dan Client Secret, lalu Save.');

  const sb = createClient(origin, key);
  const t = await sb.from('rooms').select('id').limit(1);
  if (!t.error) add(true, 'Tabel rooms bisa diakses');
  else if (t.error.code === '42501') add(false, 'Tabel ada tapi izin (GRANT) belum diberikan', 'Jalankan ulang bagian "Izin dasar (GRANT)" dari supabase.sql di SQL Editor.');
  else if (['PGRST205', '42P01', 'PGRST106'].includes(t.error.code)) add(false, 'Tabel belum dibuat', 'Jalankan seluruh isi supabase.sql di SQL Editor.');
  else add(false, 'Tabel rooms bermasalah', t.error.code + ': ' + t.error.message);
  const f = await sb.from('frames').select('id').limit(1);
  add(!f.error, f.error ? 'Tabel frames bermasalah' : 'Tabel frames bisa diakses', f.error ? f.error.code + ': ' + f.error.message : '');
  const s = await sb.storage.from('photos').list('', { limit: 1 });
  add(!s.error, s.error ? 'Bucket foto belum ada atau tidak bisa diakses' : 'Bucket foto ada', s.error ? 'Jalankan bagian "Penyimpanan foto" dari supabase.sql. Pesan: ' + s.error.message : '');

  add(null, 'Cek manual: Redirect URLs', `Authentication > URL Configuration > Redirect URLs harus berisi: ${location.origin}${location.pathname}  (disarankan juga dengan ** di akhir).`);
  add(null, 'Cek manual: Site URL', `Site URL harus alamat game ini (${location.origin}${location.pathname}), BUKAN alamat supabase.co. Site URL yang salah menyebabkan pesan "No API key found in request" setelah login.`);
  add(null, 'Cek manual: Google Cloud', `Authorized redirect URI di Google Cloud harus persis: ${origin}/auth/v1/callback`);
  done();
}
function done() {
  const bad = rows.filter(r => r.ok === false).length;
  box.querySelector('#dgs').textContent = bad ? `${bad} masalah. Perbaiki dari atas ke bawah, lalu muat ulang halaman ini.` : 'Semua pemeriksaan otomatis lolos. Lanjut cek tiga poin manual di atas, lalu coba login.';
}
