# Museum Foto 3D

Galeri 3D: jalan keliling, lihat foto, ganti dengan foto sendiri, karakter custom, kamera orang pertama/ketiga, dan multiplayer lewat kode room.

Dibuat dengan Vite + Three.js + PeerJS.

## Menjalankan di komputer
```
npm install
npm run dev
```

## Deploy ke GitHub Pages
1. Buat repo baru di GitHub, lalu upload seluruh isi folder ini (tanpa `node_modules` dan `dist`).
2. Buka Settings > Pages, pada Source pilih **GitHub Actions**.
3. Setiap push ke branch `main` akan build dan deploy otomatis. Alamat: `https://USERNAME.github.io/NAMA-REPO/`

## Peta file
| File | Isi |
|---|---|
| `src/config.js` | Tinggi ruangan, kecepatan, filter, gaya frame, judul bawaan |
| `src/gallery.js` | Membangun museum 3D dari denah |
| `src/avatar.js` | Bentuk karakter, daftar topi, animasi jalan |
| `src/network.js` | Multiplayer (host + relay lewat PeerJS) |
| `src/controls.js` | Keyboard, mouse, sentuh |
| `src/ui.js` | Formulir karakter, tombol atas, bantuan |
| `src/editor.js` | Editor foto: ganti foto, filter, frame, crop, zoom |
| `src/photos.js` | Menggambar foto ke bingkai 3D dan menyimpannya |
| `src/layout.js` | Model denah dan geometri (bentuk, dinding, tabrakan, snap bingkai) |
| `src/plan.js` | Editor denah 2D (grid, bentuk, simetri) |
| `src/world.js` | Memasang dan menyimpan denah |
| `src/cloud.js` | Galeri online (Supabase): login, peran, sinkron denah dan foto |
| `src/online.js` | Menghubungkan galeri online ke UI, panel anggota |
| `src/modal.js` | Kotak dialog (bantuan, anggota) |
| `src/supabase-config.js` | Isi dengan URL dan anon key Supabase milikmu |
| `supabase.sql` | Tabel, aturan akses (RLS), dan bucket foto untuk dijalankan di Supabase |
| `src/db.js` | Database (IndexedDB). Ganti isinya untuk database online |
| `src/cursor.js` | Kunci / tampilkan kursor |
| `src/toast.js` | Pesan singkat "Tersimpan" |
| `src/main.js` | Loop game dan posisi kamera |
| `src/style.css` | Tampilan |

## Shortcut
| Tombol | Fungsi |
|---|---|
| W A S D / panah | Jalan |
| Shift | Lari |
| V | Ganti kamera orang pertama / ketiga |
| Tab | Tampilkan / sembunyikan kursor |
| E atau klik | Buka foto yang dibidik |
| L | Editor denah |
| Q | Kembali ke menu awal (perubahan disimpan dulu) |
| Ctrl+S | Simpan semua perubahan sekarang |
| H | Bantuan |

Di editor foto: `U` ganti foto, `F` filter berikutnya, `B` frame berikutnya, `C` crop (Enter untuk menerapkan), `+` `-` `0` zoom, `Esc` tutup.

## Database
Foto asli (maksimal 2400 px) dan pengaturannya (crop, filter, frame, judul) disimpan di IndexedDB browser, jadi tetap ada setelah halaman ditutup. Tersimpan per browser dan per alamat situs.

## Denah museum
Tekan **L** (atau tombol "Denah") untuk membuka editor denah. Pada galeri online hanya pemilik yang bisa mengubah denah.

- **Bentuk ruangan:** Kotak, Lingkaran, Elips, Segitiga, Segi enam, Bentuk L, T, Plus. Seret di kanvas untuk menentukan ukuran. Tekan **R** untuk memutar bentuk 90 derajat.
- **Bebas:** klik titik-titik sudut, lalu klik titik awal atau tekan Enter untuk menutup.
- **Menggabung:** bentuk yang bertumpuk atau bersebelahan menyatu menjadi satu ruang. Tinggalkan jarak kalau ingin ruangan terpisah.
- **Dinding:** seret untuk membuat dinding pembatas di dalam ruangan.
- **Bingkai:** pilih alat Bingkai, arahkan ke dinding, lalu klik. Bingkai otomatis menempel dan menghadap ke dalam ruangan (dinding pembatas bisa di kedua sisi). Maksimal 40 bingkai.
- **Hapus:** klik bingkai, dinding, atau ruangan.
- **Grid:** 0,5 / 1 / 2 meter. Semua titik menempel ke grid, dan garis biru adalah sumbu tengah.
- **Simetri:** Kiri-kanan, Atas-bawah, atau Keduanya akan membuat salinan cermin terhadap sumbu tengah secara otomatis, termasuk bingkai.
- Foto tetap ikut bingkainya (berdasarkan nomor bingkai) walaupun posisinya dipindah. Bingkai yang dihapus dari denah ikut menghapus fotonya.

## Galeri online (Supabase + login Google)
Tanpa config Supabase, game tetap jalan dalam mode lokal. Untuk galeri online, kerjakan urut dan cek tiap langkah.

**Tips:** setelah mengisi config, buka game dengan `?cek` di belakang alamatnya (contoh `http://localhost:5173/?cek`). Halaman itu memeriksa URL, kunci, login Google, tabel, dan bucket foto, lalu menunjukkan mana yang salah.

1. **Project.** Buat project di supabase.com (Free, region Singapore). Tunggu sampai siap.
2. **Database.** SQL Editor > New query > tempel seluruh `supabase.sql` > Run. Harus muncul Success. Cek: Table Editor berisi `rooms`, `members`, `frames`; Storage berisi bucket `photos`.
3. **URL dan kunci.** Project URL ada di Project Settings > Data API (bentuknya `https://xxxx.supabase.co`, tanpa `/rest/v1`). Publishable key ada di Project Settings > API Keys (`sb_publishable_...`). Jangan pakai secret key. Isi `src/supabase-config.js`, lalu jalankan `npm run dev` dan buka `?cek`. Dua poin pertama harus hijau.
4. **Google Cloud.** Buat project, isi Google Auth Platform (External), buat OAuth client bertipe Web application. Authorized redirect URI diisi `https://xxxx.supabase.co/auth/v1/callback`. Salin Client ID dan Client secret. Tambahkan emailmu di Audience > Test users.
5. **Supabase: Google.** Authentication > Sign In / Providers > Google: aktifkan, tempel Client ID dan Client secret, Save.
6. **Supabase: URL.** Authentication > URL Configuration. **Site URL** = alamat game (bukan alamat supabase.co). **Redirect URLs** = `http://localhost:5173/**` dan `https://USERNAME.github.io/NAMA-REPO/**`.
7. **Tes.** Muat ulang `?cek` (semua hijau), lalu buka game, klik Masuk dengan Google, isi kode room, Masuk galeri.
8. **Deploy.** Commit dan push, aktifkan Pages (Source: GitHub Actions). Uji lagi di alamat GitHub Pages.

Mulai ulang: jalankan `supabase-reset.sql` di SQL Editor (menghapus tabel dan aturan lama), kosongkan Storage > photos lewat dashboard, lalu jalankan lagi `supabase.sql`.

Pesan `No API key found in request` setelah login biasanya berarti Site URL atau Redirect URL salah (berisi alamat supabase.co), atau URL di config berisi `/rest/v1`.

### Peran
| Peran | Boleh |
|---|---|
| Pemilik | Semuanya: ubah denah, atur anggota dan publik/privat (tekan **M**) |
| Editor | Ganti foto, filter, frame, crop, judul |
| Hanya lihat | Melihat saja. Berguna untuk room privat |

- Satu kode room = satu galeri online = satu room multiplayer.
- Orang pertama yang masuk (dengan Google) ke kode room yang belum ada menjadi pemilik. Pilih kode yang unik.
- Room **publik**: siapa saja yang tahu kodenya bisa melihat tanpa login. Room **privat**: hanya anggota.
- Pemilik menambah anggota lewat email Google mereka. Peran dicek oleh aturan RLS di database, bukan hanya oleh tombol di layar.
- Foto disimpan di Supabase Storage (maksimal 2400 px), pengaturannya di tabel `frames`, denah di tabel `rooms`.
- Jika dua orang mengedit bingkai yang sama bersamaan, yang terakhir menyimpan yang dipakai.
- Project Supabase gratis di-pause otomatis setelah sekitar seminggu tidak dipakai. Buka dashboard dan klik Restore untuk mengaktifkannya lagi.

## Batasan
Kalau host keluar, room berakhir. Pada mode lokal, foto dan edit hanya ada di browser sendiri. Foto lokal tidak otomatis diunggah ke galeri online.
