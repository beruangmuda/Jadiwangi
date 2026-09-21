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

## Update (2026-06, iterasi 5)
- [x] Pricelist per outlet dimasukkan ke DB (Depok/Kalimulya 41, Jakarta/Pulomas 43, Bandung/Ujungberung 43 layanan) sesuai gambar pricelist resmi.
- [x] Tabel services ditambah kolom: outlet_id, price_express, duration, duration_express, min_kg. Endpoint /services bisa difilter per outlet.
- [x] Model 1 item = 2 harga (Reguler & Express) + toggle saat Buat Order; kategori dikelompokkan (Kiloan, Add-on, Bed Cover, Selimut, dst).
- [x] Layar Produk & Layanan: tab outlet, tampil 2 harga + durasi, form lengkap (harga reg/express, durasi, min kg).
- [x] Data contoh (order/transaksi/pengeluaran) di-reset & di-generate ulang per outlet dengan pricelist baru (guard pricelist_v).

## Update (2026-06, iterasi 6)
- [x] Laporan Keuangan: filter rentang tanggal KUSTOM (kalender DateRangeSheet, from–to) + kartu "Uang Masuk per Metode" (Tunai/QRIS/E-Money/Saldo Deposit).
- [x] Laporan Transaksi: total transaksi + Total Kiloan (kg) + Total Satuan (pcs) + Total Meter (m).
- [x] Laporan Pegawai: produksi per-pegawai (cuci kg, setrika kg, jumlah nota) dari work_logs + input "Upah per Kg" untuk estimasi gaji kiloan (disimpan lokal jw_wage_per_kg).
- [x] Buat Order: pemilih metode bayar Tunai/QRIS/E-Money.
- [x] Pipeline Pegawai: saat pegawai menuntaskan tahap cuci/setrika, kiloan nota diatribusikan ke pegawai tsb (work_logs) → dasar penggajian.
- [x] Reseed pricelist_v=5 menghasilkan metode bayar bervariasi + work_logs contoh. Teruji backend 9/9 + regресi 17/17 + alur frontend semua PASS.

## Update (2026-06, iterasi 7)
- [x] Laporan Pegawai: "Upah per Kg" dihapus — kartu "Produksi per Pegawai" kini hanya menampilkan kg cuci & kg setrika + jumlah nota.
- [x] Menu baru Setelan → Keuangan → **Gaji Pegawai** (/manage/gaji): tab outlet + pilih bulan + kartu gaji per pegawai (breakdown lengkap) + modal ubah Lembur & Perjalanan Dinas.
- [x] Backend GET /api/payroll & POST /api/payroll/manual. Komponen: gaji pokok, tunjangan kasir, kehadiran (dari login pegawai), uang makan=15rb×(hadir+lembur), bonus cuci=((kg)+(pcs×5))/10×3000, bonus setrika=(kg+pcs)×1000, antar jemput=5rb×trip, kasbon (potongan), perjalanan dinas.
- [x] Pegawai: field Gaji Pokok & Tunjangan Kasir (Setelan → Pegawai). Login pegawai mencatat kehadiran (1/hari). advance() simpan unit_qty + log trip kurir (pickup/delivery).
- [x] Reseed pricelist_v=7: gaji contoh, kehadiran bulan berjalan, work_logs+unit_qty, trip kurir. Teruji backend 11/11 + regресi 26/26 + frontend semua PASS. Bug sinkron outlet awal di /manage/gaji sudah difix (useEffect).

## Update (2026-06, iterasi 8)
- [x] Beranda: TrendChart diberi label & angka sumbu Y (rupiah, interval 0–100%) + angka tanggal sumbu X; judul dinamis "Trend <bulan>".
- [x] Beranda: badge "X pelanggan" bisa diklik → layar Transaksi Hari Ini (/hari-ini) berisi nota masuk hari ini + ringkasan omzet. Pembatalan nota HANYA untuk owner (pegawai tidak bisa; OrdersPipeline canCancel=false).
- [x] Beranda: kartu Top 3 Pelanggan bulan ini (nama, kiloan, biaya).
- [x] Setelan → Database Pelanggan: kelola pelanggan (cari, tambah/edit dgn Alamat) + statistik per pelanggan (total kg, jumlah transaksi, total belanja) + detail (poin, deposit, transaksi pertama & terakhir, riwayat order).
- [x] Backend: kolom address di customers, agregat di /customers, /customers/{id}/detail, filter today di /orders, top_customers di /dashboard. Teruji 13/13 + regresi 37/37 PASS.

## Update (2026-06, iterasi 9) — Tampilan Pelanggan (bertahap 1→5)
- [x] FASE 1 — Buat Permintaan Awal: layar /permintaan (pilih kategori layanan multi + estimasi jumlah stepper, metode Antar Sendiri/Dijemput/Diantar + alamat, catatan). Backend: status baru 'requested' (Menunggu Ditimbang) & 'quoted' (Menunggu Persetujuan), kolom orders.is_request/request_items/address, outlets.review_url (diisi link Google review per outlet), POST /orders/request, filter customer_id di /orders. Customer home: CTA "Buat Permintaan Laundry" + bagian "Pesanan Saya" (tracking dasar). Verified end-to-end.
- [ ] FASE 2 — Persetujuan Nota & Bayar (pegawai timbang+quote → customer approve → QRIS/Cash/Coin)
- [ ] FASE 3 — Tracking detail & Riwayat
- [ ] FASE 4 — Coin/Deposit (top up 50/100/250/500rb→530rb, 1rp=1coin, diskon 10% pakai coin, kadaluarsa 3 bln)
- [x] FASE 5 — Rating (Google review link 4-5★ + promo pelanggan pertama; 1-2★ komplain ke owner) + Promo dikelola owner

## Update (2026-06, iterasi 10) — Struktur Pelanggan: Outlet, Tab Bar, Peringkat, Bayar
- [x] Pendaftaran pelanggan WAJIB pilih outlet (OutletPicker di /login mode Daftar; POST /auth/register menolak tanpa outlet_id valid). Harga/pricelist selalu mengikuti outlet pelanggan — pelanggan tidak bisa membandingkan outlet lain.
- [x] Pelanggan lama tanpa outlet: gate "Pilih Outlet" muncul sebelum halaman order (PATCH /api/customers/{id}/outlet), pricelist tidak diperlihatkan lebih dulu.
- [x] Menu bar bawah pelanggan = 3 tab (grup `app/(customer)`): **Home** (Promo saat ini, Saldo Coin, Pantau Ordermu, Klasemen), **Bayar**, **Pickup/Delivery**. Layar lama /customer & /permintaan dihapus.
- [x] Peringkat: hanya posisi saya (#N dari M pelanggan di outlet) + Poin + Total Kg; peserta lain nama/poin disamarkan (mask '•' dari backend + opacity). Nominal total belanja tidak lagi ditampilkan.
- [x] Aturan poin: 1 kg = 1 poin, 1 satuan = 2 poin, Bed Cover = 1 poin, order express bonus +2 poin (kolom orders.express). /api/leaderboard dihitung dinamis dari order_items.
- [x] Tab Bayar: daftar tagihan (GET /orders?unpaid=true), rincian item + total, tombol "Setujui Nota" (status quoted), metode QRIS / Tunai / Coin. Coin otomatis diskon 10% & memotong saldo (kolom orders.discount/paid_amount). Empty state "Belum ada tagihan".
- [x] Promo: tabel `promos` + GET/POST/PUT/DELETE /api/promos (2 promo contoh per outlet), tampil di Home pelanggan. UI kelola promo untuk owner masih backlog.
- Teruji: backend 17/17 baru + 37/37 regresi PASS, frontend semua flow PASS (iteration_7.json).

## Update (2026-06, iterasi 11) — Coin Top-up, Promo Owner, Ulasan & Riwayat
- [x] **Top-up Coin**: paket 50rb/100rb/250rb/500rb (500rb → 530.000 coin, bonus 30rb). Alur: pelanggan ajukan (status `pending`) → bayar tunai/QRIS di outlet → pegawai/owner konfirmasi → saldo masuk & `deposit_expires_at = hari ini + 3 bulan`. Transaksi dicatat `type='deposit'` supaya tidak menambah pendapatan. Coin hangus otomatis (fungsi `expire_deposits`) bila lewat masa berlaku. Layar: `/topup` (pelanggan), `/manage/topup` (owner via Setelan, pegawai via ikon coin di header).
- [x] **Kelola Promo (owner)**: Setelan → Pelanggan & Promosi → Promo & Voucher (`/manage/promo`): buat, ubah, aktif/nonaktif, hapus promo per outlet; langsung tampil di Home pelanggan.
- [x] **Nilai & Ulas**: di detail order berstatus `completed`, pelanggan beri bintang 1-5. Bintang 5 (ulasan pertama) → voucher **diskon 20% untuk order berikutnya** + tombol buka Google Maps review outlet. Bintang 1-2 → wajib isi kolom keluhan → jadi **notifikasi di Beranda owner** + daftar `/manage/pengaduan` (bisa ditandai Selesai).
- [x] **Voucher saat bayar**: `POST /orders/{id}/pay` menerima `voucher_id`; diskon voucher 20% lalu tambahan 10% bila bayar dengan coin; voucher ditandai terpakai.
- [x] **Riwayat Pesanan**: tab ke-4 di menu bawah pelanggan (`/(customer)/riwayat`) + layar detail order `/order-detail/[id]` (timeline status, rincian nota, total, tombol bayar). Kartu di "Pantau Ordermu" juga bisa diklik ke detail.
- [x] Tabel baru: `topups`, `reviews`, `vouchers`; kolom `customers.deposit_expires_at`. Dashboard menambah `pending_topups` & `complaints`.
- Teruji: backend 17/17 baru + regresi PASS (iteration_8.json), coin-expiry diverifikasi manual, seluruh flow frontend PASS.

## Update (2026-06, iterasi 12) — UI/UX Pelanggan & Alur Pegawai
### Pelanggan
- [x] Home: kartu hero peringkat dihapus; kini sapaan + **sorotan "Laundry siap diambil"** (makin urgent bila >2 hari), kartu **JW Coin** (tombol Isi Saldo), Promo, Pantau Ordermu (kartu bisa diklik → `/order-detail/[id]`), dan **Ranking Kamu** = 3 besar (nama lain disamarkan) + posisi pelanggan.
- [x] Tab Bayar: notifikasi "N nota sudah ditimbang", **section Kode Promo** (`GET /api/promos/validate`, dipakai saat bayar via `promo_code`), 2 opsi bayar (JW Coin -10% / QRIS-Cash), foto pakaian dari pegawai tampil di nota, keterangan tunai "Bayar tunai diawal atau setelah pakaian ditimbang".
- [x] Tab Pesan: tombol berubah jadi **"Pesan Sekarang"** setelah layanan dipilih.
- [x] Detail order: timeline, rincian nota + foto, info antar/jemput, tombol **Konfirmasi Laundry Sudah Diterima** (`POST /orders/{id}/confirm-receipt`), form Nilai & Ulas.
- [x] BUG FIX: klik order di "Pantau Ordermu" sempat error → `request_items`/`photos` kini selalu array dari backend.
### Pegawai (2 tab: Antrian, Antar Jemput)
- [x] **Antrian**: order antrian (hari ini WIB + semua yang masih aktif, param `queue=true`) dibagi 2 baris **⚡ Express** (atas) dan **Reguler**, masing-masing **FIFO** (`sort=fifo`). Kartu ringkas → klik untuk detail: ringkasan item, berat, SLA, **Konfirmasi Pembayaran** (Tunai/QRIS/JW Coin → Tandai Lunas) dan tombol lanjut status. Tab "Bayar"/verifikasi terpisah dihapus.
- [x] **Antar Jemput** (digabung dengan Permintaan): chip Semua/Permintaan/Jemput/Antar. Konfirmasi Dijemput/Diantar (`POST /orders/{id}/trip`) → tercatat di `work_logs` stage `trip` dan masuk **trip_kurir** pada gaji owner. Setelah dijemput muncul tombol **Timbang Pakaian & Foto**.
- [x] **Layar Timbang** `/timbang/[id]`: pilih layanan dari pricelist outlet, input berat/jumlah, toggle Regular/Express (harga ikut berubah), **unggah foto pakaian** (kamera/galeri, izin kontekstual) ke **Emergent Object Storage** (`POST /api/upload`, `GET /api/files/{path}`), lalu "Kirim Nota ke Pelanggan" (`POST /orders/{id}/weigh` → status `quoted`).
- [x] Zona waktu: semua perhitungan "hari ini" memakai Asia/Jakarta.
- Teruji: backend 20/20 PASS + regresi (iteration_9.json), frontend runtime PASS (bug klik order terverifikasi), konfirmasi pembayaran dari kartu antrian diverifikasi manual.
- Google review links: Depok/Kalimulya https://g.page/r/CUv3jO9Cz4aAEBM/review ; Jakarta/Pulomas https://g.page/r/CT1ETVEE3zn5EBM/review ; Bandung/Ujungberung https://g.page/r/CQUtr3hTOpEbEBM/review

## Update (2026-09, iterasi 13) — Struk WhatsApp & Kasbon Pegawai
- [x] **Struk WhatsApp**: dari detail kartu pesanan Owner/Pegawai dapat membuka WhatsApp pelanggan dengan struk siap kirim berisi kode nota, nama pelanggan, rincian layanan, total, pembayaran, dan status.
- [x] **Format nomor WA aman**: helper tunggal `src/whatsapp.ts` menormalkan format `08…`, `8…`, `+62…`, dan `62…` menjadi tautan `wa.me` yang valid.
- [x] **Kasbon Pegawai**: di tab Gaji Owner, setiap rincian pegawai memiliki tombol **Catat Kasbon** (nominal + catatan). Kasbon otomatis mengurangi **Total Diterima** pada periode gaji saat dicatat.
- [x] Backend: `GET/POST/DELETE /api/kasbon`, validasi nominal positif, filter outlet/periode, dan indeks query. `GET /api/payroll` dioptimalkan dari query per-pegawai menjadi agregasi batch agar tetap responsif saat jumlah pegawai bertambah.
- [x] Teruji: kasbon invalid (422), pengurangan payroll tepat nominal, cleanup data uji, UI modal kasbon dan CTA WhatsApp owner, serta isi/normalisasi tautan WhatsApp secara deterministik.

## Update (2026-09, iterasi 14) — Buat Order Pegawai & Pelanggan Baru
- [x] **Pelanggan Baru**: dari Buat Order Pegawai → Pilih Pelanggan → Pelanggan Baru, pegawai dapat mengisi nama, nomor WhatsApp, dan alamat. Pelanggan otomatis dipilih setelah tersimpan.
- [x] **Kontak perangkat**: nomor disimpan dalam format `+62` yang siap untuk WhatsApp. Setelah pelanggan sukses dibuat, aplikasi meminta izin kontak dan menambahkan kontak ke perangkat Android/iOS bila izin diberikan; web dan izin yang ditolak tetap aman tanpa menggagalkan penyimpanan pelanggan.
- [x] **Validasi pelanggan**: backend menolak nama/nomor tidak valid, mengkanonisasi `08…` / `8…` ke `+62…`, serta mencegah nomor pelanggan ganda lintas format.
- [x] **Layanan ringkas**: kartu layanan di Buat Order dikelompokkan dalam accordion kategori. Hanya kategori Kiloan terbuka awalnya; Add-on dan kategori lain dibuka saat diketuk.
- [x] **Minimum pesanan**: memilih layanan kiloan langsung mengisi minimum yang diatur owner; pengurangan dari minimum menghapus layanan sehingga tidak terbentuk kuantitas di bawah batas.
- [x] **Pengaturan owner**: setiap kartu pada Produk & Layanan dapat diketuk untuk mengubah kategori, harga reguler/express, durasi, dan minimum order; status aktif tetap bisa diubah langsung.
- [x] Teruji iterasi 11: backend 4/4 PASS, alur web Pegawai/Owner PASS, konfigurasi izin kontak serta fallback web PASS; seluruh data uji dibersihkan.

## Update (2026-09, iterasi 15) — Perbaikan Order Pegawai & Struk QRIS
- [x] **Simpan pelanggan baru**: nomor WhatsApp yang sudah terdaftar tidak lagi menghentikan proses; aplikasi mencari lintas format (`08…` / `+62…`) lalu otomatis memilih pelanggan lama. Pelanggan dengan nomor baru tetap tersimpan normal.
- [x] **Antrian Express**: pilihan Express kini dikirim dan disimpan sebagai `orders.express=true`, sehingga langsung muncul di queue **Express** hari ini. Order lama dengan label `(Express)` juga diperbaiki melalui migrasi aman.
- [x] **Transaksi Hari Ini**: kartu ringkasan pada dashboard Pegawai dapat diketuk untuk membuka daftar transaksi hari ini; setiap kartu dapat diketuk lagi menuju detail nota.
- [x] **Struk setelah QRIS**: tombol WhatsApp dihapus dari detail/antrian dan dipindahkan ke modal **Pembayaran QRIS Berhasil**, tepat setelah konfirmasi bayar, agar pegawai tidak lupa mengirim nota.
- [x] **Modal mobile web**: picker pelanggan dan QRIS distabilkan dengan area scroll/flex eksplisit, ukuran tombol pembayaran pasti, dan container non-collapsable. Uji ulang form pelanggan baru serta pilihan QRIS PASS.
- [x] Teruji iterasi 12: backend express/customer PASS; screenshot end-to-end menunjukkan simpan pelanggan, Express → QRIS → CTA struk, dan detail Transaksi Hari Ini. Semua data uji dibersihkan.

## Backlog (prioritized)
- P1: Filter tanggal pada Laporan (rentang custom), export/print laporan.
- P1: Saldo deposit pelanggan (pakai untuk bayar).
- P2: QRIS dinamis via gateway (Midtrans) menggantikan statis.
- P2: Notifikasi status order untuk pelanggan.
- P2: Sinkronisasi kontak perangkat ke akun cloud pelanggan (opsional).
- P2: Riwayat pengiriman nota WhatsApp per order (opsional).
- P3: Dark mode.

## Notes
- Kredensial uji: `/app/memory/test_credentials.md`.
- shadow* RN Web deprecation warning — kosmetik, tidak memengaruhi fungsi.
