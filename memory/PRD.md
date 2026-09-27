# PRD — Dashboard Analisa Pelanggan Jadiwangi

## Pernyataan Masalah Asli
Ak ingin membuat dashboard untuk analisa pelanggan di jadiwangi. masuknya dari tombol "login pengelola" di jadiwangilaundry.com. Ak ingin 1 fitur dulu yaitu dapat melihat pelanggan yang sudah lama tidak kembali, kemudian dapat di sortir 10 teratas dan ada tombol klik untuk draft Whatsapp blast whatsapp.

## Keputusan Arsitektur
- React untuk portal, login, dashboard, dan draft WhatsApp; FastAPI untuk autentikasi, impor, analisis, dan penyimpanan; MongoDB menyimpan satu set data transaksi pengelola.
- Login memakai sesi JWT dan satu akun pengelola berbasis email/kata sandi.
- File CSV/XLS/XLSX diproses di backend, dikelompokkan menurut pelanggan, dan diurutkan berdasarkan hari sejak transaksi terakhir.
- WhatsApp dibuka melalui tautan WhatsApp Web dengan pesan personal siap kirim; pengiriman tidak dilakukan otomatis.

## Persona Pengguna
- Pemilik/pengelola operasional Jadiwangi Laundry yang ingin mengaktifkan kembali pelanggan lama secara cepat.

## Kebutuhan Inti (Statis)
- Login pengelola dengan email dan kata sandi.
- Unggah riwayat transaksi dalam CSV atau Excel.
- Menemukan dan menampilkan maksimal 10 pelanggan yang tidak kembali, dengan ambang hari yang dapat diubah.
- Menyediakan draft WhatsApp personal dan membuka WhatsApp Web per pelanggan.

## Yang Telah Diimplementasikan — 27 September 2026
- Portal masuk dengan tombol Login Pengelola dan identitas visual Jadiwangi.
- Login terlindungi, dashboard KPI, data contoh, impor CSV/XLS/XLSX, serta pemetaan kolom transaksi umum.
- Tabel 10 pelanggan dormant, filter 15–120 hari, status kontak, dan nilai pelanggan.
- Modal dengan tiga template WhatsApp, pratinjau pesan, salin pesan, dan buka WhatsApp Web.
- Pengujian alur portal, login, tabel, filter, draft WhatsApp, serta impor CSV berhasil. Variasi header Nomor HP/WhatsApp telah didukung.

## Backlog Prioritas
### P0
- Hubungkan tombol Login Pengelola ini ke situs produksi jadiwangilaundry.com saat kode situs tersebut tersedia.
### P1
- Tambahkan pilihan outlet dan filter periode transaksi.
- Tambahkan log kampanye dan hasil respons pelanggan.
### P2
- Otomatisasi penjadwalan reminder winback dengan persetujuan pelanggan.
- Tambahkan ringkasan grafik retensi per outlet.

## Next Tasks
- Ganti kredensial awal pengelola sebelum digunakan tim operasional.
- Unggah file transaksi asli dan validasi pemetaan kolom pada data operasional.
