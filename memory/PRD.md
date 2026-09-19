# Jadiwangi App — PRD

## Problem Statement
Aplikasi POS untuk Jadiwangi Laundry ("Jadiwangi App") dengan 3 peran: Owner (akses penuh), Pegawai (antrian/produksi + antar-jemput), Pelanggan (order + QRIS + ranking). Mulai dari tampilan Owner.

## Tech & Architecture
- Frontend: Expo Router (React Native), react-query, reanimated, react-native-svg (charts), MDI icons, Fredoka + Nunito fonts. Theme lavender (#A78BFA) + vivid azure (#0096FF).
- Backend: FastAPI + asyncpg → **Supabase Postgres** (transaction pooler ap-southeast-1). Semua route `/api/*`. Skema dibuat & data contoh di-seed otomatis saat start.
- Auth: peran + PIN (disimpan di local storage). QRIS: gambar statis + konfirmasi manual.

## User Personas
1. Owner — pantau performa, laporan, keuangan, kelola master data & outlet.
2. Pegawai (admin/produksi/kurir) — terima order, jalankan pipeline, antar-jemput.
3. Pelanggan — buat order, bayar QRIS, lihat ranking.

## Core Requirements (static)
- Owner Home: transaksi hari ini (kg/pcs + pelanggan), pendapatan & omzet, grafik trend bulan ini, antrian (dikerjakan/siap/lewat SLA), Top Layanan.
- Buat Order (Owner & Pegawai), Laporan (Keuangan/Transaksi/Pegawai/Pelanggan), Keuangan (pengeluaran, koreksi), Setting (pelanggan, outlet, produk, pegawai+hak akses, ganti outlet).
- Pegawai: hitung transaksi, pipeline cuci→pengering→setrika→lipat&packing→siap→selesai, antar-jemput.
- Pelanggan: order, QRIS, ranking/leaderboard.

## Implemented (2026-06)
- [x] Login peran + PIN (Owner/Pegawai/Pelanggan) dengan keypad & animasi.
- [x] Owner tabs: Beranda (dashboard lengkap + chart SVG), Order (pipeline + FAB), Laporan (4 segmen), Setelan (hub + ganti outlet + logout).
- [x] Buat Order modal: pilih pelanggan/outlet, layanan +/- stepper, jenis pengambilan, sheet QRIS statis (bayar sekarang / nanti).
- [x] Pipeline order: advance stage, bayar, batal (dengan alasan), SLA timer & badge overdue.
- [x] Manage screens: Tambah Pelanggan, Produk & Layanan (add/edit/toggle), Pegawai + hak akses, Edit Outlet (3 cabang), Pencatatan Pengeluaran, Koreksi Keuangan.
- [x] Pegawai tabs: Antrian (statistik + pipeline) + Antar Jemput (pickup/delivery).
- [x] Pelanggan: leaderboard (podium top 3 + klasemen + my rank) + Order Sekarang.
- [x] Backend: outlets/services/customers/employees/orders/transactions/expenses/adjustments/leaderboard/dashboard/reports. Data contoh: 3 outlet, 8 layanan, 25 pelanggan, 6 pegawai, ~250 order sebulan, pengeluaran.
- [x] Testing: 28/28 backend pytest + smoke frontend semua peran PASS.

## Update (2026-06, iterasi 2)
- [x] Logo image Jadiwangi tampil di header (Login, Beranda Owner, Setelan, Pelanggan) — branding konsisten.
- [x] Tombol Keluar kembali ke halaman login untuk semua peran.
- [x] Filter periode Laporan: Hari Ini / Minggu Ini / Bulan Ini (frm/to diteruskan ke 4 endpoint laporan; angka berubah sesuai periode).
- [x] Bayar dengan Saldo Deposit di Buat Order: tombol muncul bila deposit cukup; deduksi + transaksi atomik (rollback bila gagal); saldo tidak cukup → error 400.
- [x] Robustness: validasi format tanggal (400), transaksi DB atomik untuk pembayaran.
- [x] Testing iterasi 2: 35/36 backend + semua alur frontend PASS.

## Update (2026-06, iterasi 3)
- [x] Login diganti: **satu form Username + Kata Sandi** (tanpa pilihan peran). Owner & pegawai pre-registered; ada **Daftar sebagai Pelanggan** (registrasi mandiri).
- [x] Auth aman: bcrypt (rounds=12) di Supabase; endpoint /api/auth/login & /api/auth/register; hash tidak pernah dikirim ke klien; kredensial di-backfill otomatis (owner/owner123, pegawai username+pegawai123, pelanggan seed +pelanggan123).
- [x] Manage Pegawai: input Username + Kata Sandi (bukan PIN lagi).
- [x] Font diganti ke **Poppins** (heading/angka) + Nunito (body) → angka tidak lagi terpotong; ditambah adjustsFontSizeToFit pada nominal besar.
- [x] Grafik Trend: legend jelas, garis **Omzet = merah**, **Pendapatan = biru**, garis lebih rapi + titik data.
- [x] Verifikasi e2e: login owner, registrasi+login pelanggan, dashboard, chart — semua OK.

## Update (2026-06, iterasi 4)
- [x] Ukuran angka nominal dikecilkan & diproporsionalkan agar tidak terpotong: Beranda Pendapatan (17px) & Omzet (15px); Laporan tileValue (15px) & Laba Bersih (22px). Tambah minimumFontScale pada adjustsFontSizeToFit. Verifikasi: Rp13.892.000 dst tampil penuh.

## Backlog (prioritized)
- P1: Filter tanggal pada Laporan (rentang custom), export/print laporan.
- P1: Kasbon pegawai (tabel sudah ada, UI belum) & saldo deposit pelanggan (pakai untuk bayar).
- P2: QRIS dinamis via gateway (Midtrans) menggantikan statis.
- P2: Detail order (rincian item) & struk.
- P2: Notifikasi status order untuk pelanggan.
- P3: Dark mode.

## Notes
- Kredensial uji: `/app/memory/test_credentials.md`.
- shadow* RN Web deprecation warning — kosmetik, tidak memengaruhi fungsi.
