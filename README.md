# Menu Happy Puppy Panjaitan

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
