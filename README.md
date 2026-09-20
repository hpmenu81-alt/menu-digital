# Menu Happy Puppy Panjaitan

## Operasional admin — 20 September 2026

- **Ringkasan**: menu aktif, siap dipesan, habis, nonaktif, promo berjalan sesuai jadwal, dan room aktif. Gunakan Muat ulang untuk mengambil kondisi terbaru.
- **Kelola Menu → Tandai habis / Tersedia lagi**: menu habis tetap tampil tanpa tombol tambah. Paket yang memiliki bahan/menu habis tidak ditawarkan. Keranjang diperiksa kembali sebelum WhatsApp; item yang menjadi habis dikeluarkan dan pelanggan diminta memeriksa ulang. Status bukan perhitungan stok otomatis.
- **Promo → Arsipkan**: promo dinonaktifkan dan dipindahkan ke Arsip promo. Pemulihan mengembalikan promo dalam keadaan nonaktif, agar admin dapat memeriksa harga dan jadwal sebelum mengaktifkannya.
- **Room & QR**: tambah room, ubah nama/kelompok/urutan, aktifkan/nonaktifkan, dan unduh QR PNG. Semua 28 kode room lama dipertahankan. Kode tidak bisa diganti setelah disimpan; QR lama tetap mengacu pada kode yang sama. Room nonaktif tidak muncul dalam pilihan pelanggan. Saat checkout, daftar room diperiksa lagi. QR berisi alamat produksi menu digital dan dibuat di perangkat, tanpa layanan gambar eksternal.
- **Riwayat perubahan**: otomatis merekam perubahan menu, promo, pengaturan toko, serta room sejak pemasangan. Menampilkan akun admin, waktu WITA, dan nilai sebelum/sesudah; dilengkapi filter dan pemuatan bertahap. Riwayat hanya dapat dibaca admin. Browser tidak diberi hak menulis, mengedit, atau menghapus log. Perubahan SQL tanpa akun pengguna ditandai Sistem / SQL.
- Migrasi `supabase/migrations/20260920130646_admin_operations.sql` sudah diterapkan dan diuji dalam transaksi rollback. Tidak perlu menjalankan ulang pemulihan backup. RLS melindungi room dan riwayat. Fungsi pencatat menggunakan trigger privat; tidak tersedia sebagai RPC publik.
- Perubahan admin terlihat setelah halaman pelanggan dimuat ulang, dengan pemeriksaan ulang harga/ketersediaan/room sebelum WhatsApp. Pengujian: `node --test tests/operations.test.cjs` dan `node tests/operations.browser.cjs` (Playwright/Edge dan `jsqr@1.4.0`; data simulasi). QR hasil aplikasi diuji dengan decoder terpisah. Pustaka QR lokal dipatok pada `qrcode-generator@2.0.4`; lihat `THIRD-PARTY.md`.

## Tampilan pelanggan — 19 September 2026

- Foto memenuhi bagian atas kartu; katalog memakai 2 kolom di HP, 3 di tablet, dan 4 di desktop. Navigasi bawah lebih besar dan tombol jumlah minimal 44 piksel.
- Paket kosong menampilkan penjelasan serta tombol kembali ke semua menu.
- Menu yang namanya mencantumkan **panas dan dingin** meminta jumlah masing-masing di keranjang. Jumlah harus sesuai total gelas sebelum WhatsApp dapat dilanjutkan. Pilihan tersimpan bersama keranjang, diperiksa ulang saat harga/menu berubah, dan masuk ke pesan WhatsApp. Untuk bundling, jumlah minuman dikalikan jumlah paket. Harga mengikuti menu/paket yang sama; tidak ada tambahan harga untuk suhu.
- Admin → Promo: unggah gambar banner JPG/PNG/WebP maksimal 5 MB, atur **Urutan banner** (angka terkecil dahulu), dan lihat pratinjau. Gambar mendatar 1200 × 600 disarankan; gambar ditampilkan utuh tanpa memotong teks poster. **Gunakan foto menu** mengembalikan gambar bawaan. Gambar baru disimpan saat Simpan promo, dengan akses admin dan pemeriksaan versi seperti promo lainnya.
- Migrasi `supabase/migrations/20260919121202_banner_presentation.sql` sudah diterapkan. Tidak perlu memulihkan backup lagi. Gambar menggunakan bucket `menu-images` dengan kebijakan admin yang sudah ada. Berkas unggahan tidak dihapus otomatis saat respons simpan gagal karena transaksi mungkin sudah berhasil.
- Pengujian tambahan: `node --test tests/customer-display.test.cjs`, `node tests/customer-display.browser.cjs`, dan `node tests/banner-display.browser.cjs` (Playwright/Edge; data simulasi, tanpa menulis produksi).

## Perbaikan prioritas 1 — 18 September 2026

- Keranjang, jumlah, catatan dan room tersimpan di perangkat selama 12 jam sejak pembaruan terakhir. Harga tidak diambil dari penyimpanan perangkat; menu serta harga terbaru digunakan saat pemulihan. Keranjang lama dibersihkan jika QR mengarah ke room berbeda. Jika penyimpanan perangkat diblokir, situs tetap dapat digunakan dengan pemberitahuan.
- Room dapat dipilih langsung di keranjang dan tersinkron dengan pemilih di bagian atas.
- Kelola Menu menampilkan harga normal/promo yang sama dengan katalog. Filter **Promo berjalan** mencakup diskon dan bundling yang sedang berlaku. Edit menu tetap menggunakan harga dasar. Label promo lama tidak lagi menjadi sumber promo pelanggan; pengaturan dilakukan di tab Promo.
- Jadwal mulai/selesai promo menggunakan WITA (UTC+8), dengan waktu acuan server. Batas awal termasuk, batas akhir tidak termasuk. Kosong berarti tidak dibatasi pada sisi tersebut. Promo harus diaktifkan agar jadwal berlaku. Halaman yang terbuka memperbarui harga saat batas jadwal terlewati dan memeriksa kembali harga sebelum WhatsApp.

Migrasi tambahan `supabase/migrations/20260918134526_promotion_schedule.sql` sudah diterapkan. Tidak perlu menjalankan ulang pemulihan data. Tes tambahan: `node tests/priority.browser.cjs` dan `node --test tests/priority.test.cjs`.

## Banner, diskon, dan bundling

Migrasi `supabase/migrations/20260916124509_menu_promotions.sql` sudah diterapkan ke proyek produksi pada 16 September 2026. Untuk instalasi baru, jalankan setelah migrasi keamanan dan pengaturan toko.

Admin → **Promo** → **Promo baru**. Isi judul, pilih menu, lalu tentukan diskon persen/rupiah atau harga satu paket beserta jumlah setiap menu. Centang **Aktifkan promo** dan **Tampilkan di banner atas**, lalu simpan. Banner memakai foto menu pilihan. Tidak ada promo contoh yang diaktifkan otomatis.

Harga normal tetap tersimpan; pelanggan melihat harga normal tercoret dan harga promo. Diskon tidak ditumpuk: potongan terbaik per menu digunakan. Bundling memakai harga paket sendiri tanpa diskon tambahan; harga normalnya adalah total harga dasar isi paket. Diskon persen dibulatkan ke rupiah terdekat. Paket tidak tersedia jika salah satu menu nonaktif/hilang atau harga paket tidak lagi lebih rendah dari total normal. Perubahan terlihat setelah halaman pelanggan dimuat ulang. Harga dan ketersediaan diperiksa kembali sebelum pindah ke WhatsApp; perubahan meminta pelanggan meninjau keranjang. WhatsApp dibuka pada tab yang sama untuk menghindari pemblokiran pop-up setelah pemeriksaan harga.

Hanya admin terdaftar yang dapat membuat/mengubah promo; pengunjung hanya dapat membaca promo aktif. Validasi database menolak referensi menu tidak valid, jumlah tidak valid, dan potongan yang menghasilkan harga nol/negatif. Penyimpanan promo memakai versi untuk mencegah penimpaan edit bersamaan. Pesanan tetap berupa draf WhatsApp dan perlu konfirmasi staf.

Tes: `node --test tests/*.test.cjs`, `node tests/settings.browser.cjs`, dan `node tests/promotions.browser.cjs` (Playwright dan Edge). Tes browser memakai data simulasi. Uji akses database dilakukan dalam transaksi yang di-rollback.

## Fitur pengaturan toko dan urutan menu

Sebelum mengunggah versi ini, jalankan **hanya migrasi tambahan**
`supabase/migrations/202609160001_menu_settings.sql` melalui SQL Editor.
Migrasi ini menambahkan satu tabel pengaturan; data menu dan foto tetap dipakai.
Jangan menjalankan ulang SQL pemulihan backup.

Setelah migrasi berhasil, unggah file situs versi ini. Masuk ke admin, buka tab
**Pengaturan**, lalu isi nama toko, WhatsApp, alamat, jam buka, dan informasi
tambahan. Gunakan tombol naik/turun untuk kategori dan menu dalam kategori,
lalu tekan **Simpan pengaturan & urutan**. Urutan ini berlaku di katalog,
tab kategori, daftar favorit, dan daftar admin. Menu/kategori baru yang belum
diurutkan ditempatkan setelah yang sudah diatur.

Nomor lokal 08 dinormalisasi menjadi 628; nomor internasional harus memakai
kode negara. Pesanan, minta bill, dan panggil staf menggunakan nomor yang sama.
Jam buka adalah teks informasi, bukan jadwal penutupan otomatis.
Perubahan terlihat pada pelanggan setelah halaman dimuat ulang. Jika pengaturan
gagal dimuat, katalog tetap ditampilkan tetapi pengiriman WhatsApp dinonaktifkan
agar tidak mengirim ke nomor lama. Tombol Coba lagi memuat ulang pengaturan.

Pengaturan hanya dapat ditulis admin terdaftar. Penyimpanan menggunakan nomor
versi; jika admin lain lebih dulu menyimpan, muat ulang pengaturan sebelum
mencoba lagi. Tombol muat ulang meminta konfirmasi jika ada perubahan lokal.

Uji fitur: `node --test tests/regression.test.cjs tests/settings.test.cjs`.
Pengujian browser opsional: instal Playwright, kemudian jalankan
`node tests/settings.browser.cjs` (default Edge; BROWSER_CHANNEL dapat diatur).
Tes browser menggunakan data simulasi, tidak menulis database produksi.
SQL perlu diuji pada Supabase: pengunjung/akun biasa hanya membaca pengaturan,
admin dapat memperbarui pengaturan, dan data menu lama tetap utuh.

Halaman statis pelanggan (index.html) dan admin (admin.html), menggunakan Supabase.
Katalog dipulihkan dari riwayat commit a964a66c, dengan renderer DOM baru dan keranjang berdasarkan ID menu. Nomor WhatsApp mengikuti konfigurasi lama: 6281255763976.

## Pasang keamanan sebelum deploy

1. Di Supabase SQL Editor, jalankan supabase/migrations/202609150001_secure_menus.sql sebagai pemilik database. File ini mengatur tabel menus yang sudah ada dan bucket menu-images; tidak menghapus data menu. Simpan salinan konfigurasi kebijakan lama sebelum perubahan.
2. Buat akun pengelola lewat Supabase Authentication > Users. Gunakan email/password dan pastikan email akun sudah terkonfirmasi.
3. Salin UUID akun tersebut lalu jalankan SQL berikut (ganti placeholder):

   ```sql
   insert into menu_private.admins (user_id)
   values ('UUID-AKUN-ADMIN'::uuid)
   on conflict do nothing;
   ```

4. Uji menggunakan checklist di bawah, kemudian merge/deploy file statis. Admin masuk menggunakan akun tadi. Akun biasa tidak mendapat akses admin hanya karena berhasil login.

Publishable key di common.js memang digunakan browser. Jangan memasukkan service-role key, password, atau kredensial database ke kode. Pembatasan akses diterapkan di database, bukan hanya tampilan login.

Kebijakan restrictive menutup akses yang terlalu luas dari kebijakan permissive lama. Kebijakan restrictive lain yang sudah ada mungkin tetap membatasi admin; periksa jika akses admin ditolak. Migrasi menjaga aturan bucket lain. Foto menu tetap publik, sesuai penggunaan sebelumnya.

Harga wajib bilangan bulat positif, nama/kategori wajib terisi. Constraint NOT VALID tidak mengubah data lama; perbaiki data yang tidak valid sebelum memvalidasi constraint:

```sql
select id, nama, harga, kategori from public.menus
where harga is null or harga <= 0 or harga > 9007199254740991
   or harga <> trunc(harga::numeric)
   or nama is null or btrim(nama) = ''
   or kategori is null or btrim(kategori) = '';
-- Setelah data diperbaiki:
alter table public.menus validate constraint menus_positive_integer_price;
alter table public.menus validate constraint menus_required_text;
```

Untuk mencabut admin, hapus UUID-nya dari menu_private.admins lewat SQL Editor.

## Pengujian

Jalankan `node --test tests/regression.test.cjs` (Node 18+; tanpa instalasi paket).
Preview: jalankan server HTTP statis dari direktori repo, lalu buka index.html/admin.html.

Checklist integrasi pada proyek Supabase uji sebelum produksi:

- Tanpa login: hanya menu aktif terbaca; insert/update menus dan upload/update/delete menu-images ditolak.
- Akun biasa: tidak dapat membuka pengelolaan atau mengubah menu lewat API langsung.
- Admin terdaftar: melihat menu nonaktif, membuat/mengedit menu dan mengunggah gambar.
- Nonaktifkan menu, edit harganya, simpan: menu tetap nonaktif.
- Nama Chef's Special dan teks berisi tanda < > ditampilkan sebagai teks; tombol Edit berfungsi.
- Harga -1, 0, pecahan dan kosong ditolak; cek juga penolakan melalui API langsung.
- Pilih foto pada menu A lalu edit menu B: foto pilihan A dibersihkan.
- Upload >5 MB / tipe tidak didukung ditolak.
- Logout menyembunyikan daftar dan form; sesi kedaluwarsa tidak dapat menulis data.
- Pelanggan: pencarian, kategori, keranjang, room dari QR dan WhatsApp dengan catatan &/# berfungsi.
- WhatsApp hanya membuka draf; pelanggan masih harus menekan Kirim. Keranjang dipertahankan untuk mencoba lagi.

Tidak ada pengiriman pesanan otomatis atau status penerimaan staf. Tidak ada perubahan langsung pada database melalui pengujian lokal. Foto lama atau unggahan dari request yang gagal tidak dihapus otomatis, untuk menghindari menghapus foto yang mungkin sudah dipakai setelah respons jaringan terputus.
