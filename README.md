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
| `src/gallery.js` | Membangun museum 3D dari denah (dinding, pintu, lampu, bingkai, papan nama, lampu sorot) |
| `src/avatar.js` | Bentuk karakter, daftar topi, animasi jalan |
| `src/network.js` | Multiplayer (host + relay lewat PeerJS) |
| `src/fullscreen.js` | Tombol layar penuh (iPhone: lewat Tambah ke Layar Utama, lihat `public/manifest.webmanifest`) |
| `src/frametex.js` | Tekstur motif bingkai (serat kayu, emas berukir, bintik, dll), digambar dengan canvas |
| `src/filters.js` | Filter foto per-piksel + penyesuaian manual (kecerahan, kontras, suhu, dll.) |
| `src/framepreview.js` | Pratinjau bingkai asli (3D) di editor foto |
| `src/chat.js` | Kotak chat dan riwayat (gelembung di atas kepala ada di `avatar.js`, pengiriman di `network.js`) |
| `src/controls.js` | Keyboard, mouse, sentuh |
| `src/ui.js` | Formulir karakter, tombol atas, bantuan |
| `src/editor.js` | Editor foto: ganti foto, filter, frame, crop, zoom |
| `src/photos.js` | Menggambar foto ke bingkai 3D dan menyimpannya |
| `src/layout.js` | Model denah dan geometri (bentuk, dinding, pintu, lampu, tabrakan, snap bingkai) |
| `src/frames3d.js` | Bentuk 3D tiap gaya bingkai |
| `src/plan.js` | Editor denah 2D (bentuk, pilih/putar/pindah, pintu, lampu, simetri) |
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
| F | Layar penuh |
| Spasi | Loncat (di HP: tombol Loncat) |
| T atau Enter | Chat: ketik lalu Enter. Esc menutup. Riwayat lewat tombol Chat |
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

**Alat gambar**
- **Bentuk ruangan:** Kotak, Lingkaran, Setengah lingkaran, Segi enam, Bentuk L, T, Plus. Seret di kanvas untuk menentukan ukuran. Sebelum menggambar, **R** memutar arah bentuk (misalnya arah kubah setengah lingkaran). Lingkaran selalu bulat dan setengah lingkaran selalu berbanding 2:1.
- **Bebas:** klik titik-titik sudut, lalu klik titik awal atau tekan Enter untuk menutup.
- **Menggabung:** bentuk yang bertumpuk atau bersebelahan menyatu menjadi satu ruang.
- **Dinding:** seret untuk membuat dinding pembatas di dalam ruangan.
- **Pintu:** arahkan ke dinding lalu klik. Pintu selebar 2,4 m membuka dinding dan menyambung dua ruangan yang hanya bersentuhan (misalnya lingkaran yang hanya menempel di ujung dinding). Pintu juga bisa dipasang di dinding pembatas.
- **Bingkai:** arahkan ke dinding lalu klik. Bingkai menempel otomatis dan menghadap ke dalam ruangan. Maksimal 100 bingkai.
- **Lampu:** klik di lantai untuk menaruh lampu ruangan (maksimal 30; tampilan 3D memakai cahaya asli untuk maksimal 12 lampu terdekat, otomatis dikurangi kalau perangkat berat).
- **Hapus:** klik bingkai, pintu, lampu, dinding, atau ruangan.

**Memilih dan mengubah objek yang sudah dibuat (alat Pilih)**
- Klik ruangan atau dinding untuk memilihnya. **R** memutarnya 90°, seret untuk memindahkan, **Delete** untuk menghapus. Bingkai, pintu, dan lampu yang menempel ikut berputar dan berpindah.
- Klik sebuah **bingkai** untuk mengatur **papan nama** (di bawah, di atas, atau tanpa) dan **lampu sorot** (lampu langit-langit dengan berkas cahaya ke lukisan).
- Klik sebuah **lampu ruangan** lalu tekan **Spasi** (atau klik tombolnya) untuk menyala atau mematikannya satu per satu. Lampu yang mati tampil sebagai fitting gelap dan ruangannya lebih redup.
- Papan nama menampilkan judul foto. Judul diubah di editor foto.

**Lainnya:** Grid 0,5 / 1 / 2 m (semua titik menempel ke grid, garis biru adalah sumbu tengah), Simetri (Kiri-kanan, Atas-bawah, atau Keduanya membuat salinan cermin otomatis), Urungkan (Ctrl+Z), geser dan zoom, dan info luas lantai.
Foto ikut bingkainya (berdasarkan nomor bingkai) walaupun posisinya dipindah. Bingkai yang dihapus dari denah ikut menghapus fotonya, dengan konfirmasi dulu.

**Gaya bingkai** (dipilih di editor foto, tombol B): Kayu, Emas, Putih, Hitam, Tipis, Ornamen kayu, Kerajaan, Lucu, Fun, Minimalis, Modern, Neon. Bentuk 3D-nya ada di `src/frames3d.js`, mudah ditambah.

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
- Denah: Ctrl+C / Ctrl+V / Ctrl+D (salin, tempel di kursor, duplikat) untuk ruangan, dinding, bingkai, pintu, dan lampu. Ruangan yang disalin membawa bingkai, pintu, dan lampu yang menempel (foto bingkai tidak ikut).
- Dari sudut pandang orang pertama (pemilik): G pasang bingkai di dinding yang dibidik (Shift+G tegak), X hapus bingkai yang dibidik. V mengganti kamera: orang pertama, orang ketiga, dari depan. O foto layar. Di editor foto, tombol Unduh menyimpan foto/video asli, hasil edit, atau gambar berbingkai (`src/download.js`).
- Karakter: 9 topi (termasuk topi pantai, kupluk, koboi, mahkota), 8 model baju, 5 model celana/rok, 6 bentuk tubuh, 10 wajah, warna topi, dan tombol Acak, hiasan topi dan baju (bunga, pita, bulu, bintang, telinga kucing, tanduk, antena, dasi, syal, kalung bunga, tas, jubah), serta tombol ↺ untuk mengembalikan tiap warna ke bawaan. Semua topi bisa diwarnai. Daftarnya ada di bagian atas `src/avatar.js`; tambah item baru di akhir daftar lalu buat bentuknya di fungsi `makeAvatar` / `addHat`. Pilihan lama yang tersimpan tetap terbaca.
- Format foto: JPEG, PNG, WebP, GIF, BMP, AVIF, dan HEIC/HEIF dari iPhone (HEIC diubah otomatis di browser memakai pustaka `heic-to`, dimuat hanya saat dibutuhkan). Orientasi EXIF ikut diterapkan.
- Editor foto: tombol Putar (R) untuk memutar 90° dan meluruskan foto miring (±45°); Crop (C) punya pegangan di sudut/sisi dan kotaknya bisa digeser. Putaran disimpan di dalam kolom `crop` (field `r`), tanpa mengubah database.
- Video di bingkai: maksimal 10 detik dan 12 MB (mp4 / webm / mov), tanpa suara, hanya 2 video terdekat yang diputar. Untuk galeri online lama, jalankan `supabase-video.sql` sekali di SQL Editor.
- Foto disimpan di Supabase Storage (maksimal 2400 px), pengaturannya di tabel `frames`, denah di tabel `rooms`.
- Jika dua orang mengedit bingkai yang sama bersamaan, yang terakhir menyimpan yang dipakai.
- Project Supabase gratis di-pause otomatis setelah sekitar seminggu tidak dipakai. Buka dashboard dan klik Restore untuk mengaktifkannya lagi.

## Batasan
Kalau host keluar, room berakhir. Pada mode lokal, foto dan edit hanya ada di browser sendiri. Foto lokal tidak otomatis diunggah ke galeri online.
