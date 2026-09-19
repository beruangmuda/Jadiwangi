# PRD — Jadiwangi Laundry Landing Page

## Original Problem Statement
Landing page bisnis laundry Jadiwangi dengan 3 outlet (Pulomas - Jakarta, Ujungberung - Antapani, Kalimulya - Depok). Tema warna lavender & vivid purple, memakai logo Jadiwangi yang dilampirkan. Tujuan: menarik pelanggan baru. Fitur: overview bisnis (added value & USP), pricelist per outlet & wilayah, produk/layanan, testimoni Google Maps bintang 5, pilih outlet terdekat + jarak dari lokasi pengguna, order via chat WhatsApp bisnis.

## Arsitektur
- Frontend-only React SPA (Create React App + craco + Tailwind + framer-motion + lenis smooth scroll).
- Backend FastAPI template dibiarkan default (tidak dibutuhkan untuk landing page).
- Semua data (outlet, koordinat, harga, testimoni) di `/app/frontend/src/data/laundry.js` — sumber tunggal kebenaran harga.
- Komponen di `/app/frontend/src/components/`: Navbar, Hero, Marquee, Manifesto, Services, OutletFinder, Calculator, Pricelist, Testimonials, Faq, Footer, FloatingBar.

## Data Penting (diverifikasi dari input user)
- WA pusat semua order: 0857 7070 6467 → wa.me/6285770706467 (format order otomatis menyebut outlet pilihan).
- Koordinat asli dari link Google Maps user:
  - Pulomas: -6.1866679, 106.8867307 (https://maps.app.goo.gl/22KBfJEZxmseseVh9)
  - Ujungberung (JadiwangiLAH): -6.9174122, 107.6986498 (https://maps.app.goo.gl/nQz9hnHtAauVT8Q66)
  - Kalimulya Depok: -6.4373379, 106.8214778 (https://maps.app.goo.gl/GMsodebyyefpKHEt5)
- Harga per outlet: disalin persis dari 3 gambar pricelist yang dilampirkan user (kiloan + premium care).
- Ongkir antar jemput RESMI (aturan terbaru user, 19 Sep 2026): 0–2 km Rp 10.000, 3–5 km Rp 15.000, > 5 km di luar radius. TIDAK ada lagi gratis < 2 km — semua copy (hero chip, marquee, USP 04, FAQ, kalkulator, deteksi lokasi) sudah disesuaikan.
- Logo & gambar pricelist asli: customer-assets URL (lihat data/laundry.js).
- IG: @jadiwangilaundry.

## User Personas
- Ibu rumah tangga / pekerja sibuk di sekitar 3 wilayah outlet yang butuh antar jemput.
- Pelanggan mendadak butuh express 6 jam (acara, kantor).
- Pemilik barang premium (sepatu, tas, karpet, bed cover).

## Yang Sudah Diimplementasikan (19 Sep 2026)
- Hero kinetik (masked line reveal, tilt 3D, parallax, floating chips), marquee editorial, manifesto USP bernomor (diambil dari kebijakan asli pricelist), katalog layanan.
- Deteksi lokasi (geolocation + Haversine) → jarak & status ongkir per outlet, badge outlet terdekat, fallback manual.
- Kalkulator estimasi: outlet, layanan (kiloan & premium), qty, slider jarak, add-on Dettol, rincian biaya, tombol WA terisi otomatis.
- Pricelist per outlet (tab) lengkap kiloan + premium care + link gambar pricelist asli.
- Ulasan (filter per outlet), FAQ, footer CTA, floating order bar, favicon + meta title.
- Diverifikasi e2e: geolocation, kalkulator (Rp 34.500 Bandung CKS 5kg; ongkir 4km Rp 6.000), tab pricelist, filter ulasan, link WA.

## Update 19 Sep 2026 (iterasi 2)
- Testimoni ASLI Google Maps ★5 outlet Pulomas terpasang (5 ulasan: Ganies Anggradini, Denny Mactavish, Hani Yulandani, Dorgis Bernando, widya siagian), tiap kartu tertaut ke link ulasan aslinya. Ujungberung & Kalimulya: empty state + link ke Google Maps (menunggu user kirim ulasan asli).
- Tarif ongkir RESMI: < 2 km GRATIS, 2 km Rp 10.000, 3–5 km Rp 15.000 (dikonfirmasi user) — berlaku di deteksi lokasi & kalkulator.
- Strip promo bulanan di atas navbar: "Promo Jumat Berkah — Diskon 10% setiap hari Jumat" → klik langsung chat WA. Ganti promo cukup edit object PROMO di data/laundry.js.
- Jam operasional 07.00–21.00 WIB setiap hari + badge "Buka Sekarang" otomatis (zona Asia/Jakarta, refresh tiap menit) di semua kartu outlet.

## Update 19 Sep 2026 (iterasi 3)
- Section baru "Perlindungan Ekstra" (#antiseptik): USP add-on antiseptik Dettol — edukasi risiko virus/bakteri dari Gojek, KRL, motor + foto gerbong commuter padat (Pexels 36978293) + harga add-on per outlet + CTA scroll ke kalkulator (toggle Dettol).
- USP 01 & FAQ express diperbarui: order express masuk sebelum jam 10 pagi bisa diambil sore hari sepulang kantor.
- Marquee menambah pesan "ANTISEPTIK DETTOL LINDUNGI KELUARGA".
- Logo asli Dettol (perisai hijau, dari Wikimedia Commons) dipasang di kartu add-on antiseptik & toggle Dettol di kalkulator untuk membangun kepercayaan.

## Update 19 Sep 2026 (iterasi 4)
- Section baru "Cara Kerja Kami" (#proses): 4 kartu ilustrasi SVG beranimasi CSS murni — mesin cuci tersenyum (drum berputar, air bergoyang, gelembung naik), dryer (pakaian berputar), setrika geser dengan uap & percikan, dan pakaian yang melipat rapi. Ditutup banner "Sementara kami mencuci, kamu bebas bermain bersama keluarga" + CTA WA.
- Navbar menambah link "Cara Kerja". Keyframes animasi di index.css (drum-spin, water-slosh, bubble-rise, iron-slide, steam-puff, fold-flip, sparkle-twinkle).

## Update 19 Sep 2026 (iterasi 5)
- Section Cara Kerja diganti jadi LINE ART STORY stickman (permintaan user): 5 panel berurutan — (1) stickman jalan bawa keranjang ke mesin cuci (kaki bergantian + drum berputar), (2) dryer sampai kering sempurna + stickman bahagia melompat di bawah matahari, (3) setrika dengan happy (lengan menyetrika + nada musik), (4) tumpukan pakaian terlipat rapi muncul berlapis + stickman bangga, (5) animasi 5 bintang emas muncul berurutan. Keyframes baru: leg-swing, walk-drift, happy-bounce, stack-pop, star-pop.
- Panel 2 Cara Kerja: awan mendung + hujan beranimasi di atas dryer (tetes ungu tua di samping mesin), pesan "Di luar mendung & hujan pun, cucian tetap kering sempurna — anti apek".
- Banner keluarga diakhiri hashtag #BESOKSUDAHWANGI; hero juga punya chip #BESOKSUDAHWANGI (kampanye konsisten atas-bawah).
- Hero fokus "Masuk sebelum jam 10 pagi, sorenya sudah rapi dan siap diambil" + kartu apung "Masuk Pagi, Ambil Sore".

## Update 19 Sep 2026 (iterasi 6)
- FOTO ASLI OUTLET terpasang (4 foto dari user, customer-assets-jt897jd0): hero = jajaran mesin + dinding ungu neon; Layanan = interior mesin (Kiloan) & keranjang produk Rinso/Dettol/Downy (Premium Care); Antiseptik = foto overlay "Dettol asli, dituang di outlet" (staff menuang Dettol ke mesin LG).

## Update 19 Sep 2026 (iterasi 7)
- Brand awareness hero: watermark raksasa outline "JADIWANGI" (text-stroke lavender, 19vw) di belakang konten + logo diperbesar.
- LOGIN PENGELOLA: JWT auth (bcrypt + PyJWT, httpOnly cookie, brute-force lock 5x/15mnt, seed admin idempoten dari env ADMIN_EMAIL/ADMIN_PASSWORD). Halaman /admin (login) & /admin/dashboard (analisis: total interaksi, klik WA per jenis, per outlet, aktivitas terbaru). Tracking via POST /api/track dari tombol WA (navbar, hero, floating, footer, outlet, kalkulator), deteksi lokasi, minat app & kemitraan. Kredensial di /app/memory/test_credentials.md.
- Section "Jadiwangi App" (#aplikasi): segera hadir, mockup HP CSS, benefit diskon/tracking, CTA "Kabari Saya Saat Rilis" → WA.
- Section "Kemitraan & Franchise" (#kemitraan): 3 benefit + CTA diskusi kemitraan via WA.
- ALAMAT LENGKAP 3 outlet terpasang di kartu outlet & footer: Pulomas = Jl. Angkur No. 26D (Ruko Biru), Kayu Putih, Pulogadung, Jakarta Timur; Ujungberung = Jl. Rumah Sakit No. 50 (Ruko Orange sebelah Alfamart), Ujungberung, Bandung; Kalimulya = Jl. Raya Kalimulya No. 86B (Depan Sekolah Tunas Bangsa Islamic School), Cilodong, Depok.

## Backlog
- P0: Kirim ulasan asli Google Maps ★5 untuk outlet Ujungberung & Kalimulya (format: link share ulasan seperti yang Pulomas) — tambahkan ke TESTIMONIALS di data/laundry.js.
- P1: Embed Google Maps interaktif di kartu outlet.
- P2: SEO (OG image, schema LocalBusiness), mode gelap, animasi halaman ulasan asli terhubung Google Places API.

## Next Tasks
1. User kirim ulasan asli Ujungberung & Kalimulya → tambah ke TESTIMONIALS.
2. Ganti promo bulanan: edit object PROMO di /app/frontend/src/data/laundry.js.
3. Tambah alamat lengkap outlet bila diberikan.
