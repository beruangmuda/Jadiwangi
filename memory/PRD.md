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
- Ongkir antar jemput: < 2 km GRATIS (resmi dari pricelist), 2–5 km ESTIMASI Rp 3.000/km (tarif belum dikonfirmasi user), > 5 km di luar radius.
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

## Backlog
- P0: Ganti TESTIMONIALS dengan ulasan asli Google Maps ★5 (user sedang mengumpulkan) — edit array di data/laundry.js.
- P0: Konfirmasi tarif ongkir 2–5 km (saat ini estimasi Rp 3.000/km) & alamat lengkap + jam operasional tiap outlet.
- P1: Embed Google Maps interaktif di kartu outlet.
- P1: Promo bulanan (banner/section) — pricelist menyebut promo tiap bulan via WA/IG.
- P2: SEO (OG image, schema LocalBusiness), mode gelap, animasi halaman ulasan asli terhubung Google Places API.

## Next Tasks
1. User kirim testimoni asli → ganti data TESTIMONIALS.
2. User konfirmasi tarif ongkir & jam operasional tiap outlet.
3. Tambah alamat lengkap outlet bila diberikan.
