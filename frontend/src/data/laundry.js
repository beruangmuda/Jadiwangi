export const WA_CENTRAL = "6285770706467";
export const WA_DISPLAY = "0857 7070 6467";
export const IG_URL = "https://instagram.com/jadiwangilaundry";
export const DETTOL_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/6/63/Dettol_logo.svg";
export const LOGO_URL =
  "https://customer-assets-rejwkqb3.emergentagent.net/job_307e2abc-0d5f-4f42-a8d4-2c090b6b8405/artifacts/9rizptxp_Logo%20Jadiwangi%20transparan.png";

export const rp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

export const waLink = (message) =>
  `https://wa.me/${WA_CENTRAL}?text=${encodeURIComponent(message)}`;

export const PENGADUAN_MESSAGE = [
  "Halo Jadiwangi Laundry! Saya mau menyampaikan *PENGADUAN* terkait layanan.",
  "",
  "• Outlet: ",
  "• Tanggal / No. Nota: ",
  "• Keluhan: ",
  "",
  "Mohon ditindaklanjuti ya kak. Terima kasih.",
].join("\n");

// Tracking interaksi untuk dashboard pengelola (fire-and-forget)
export const trackEvent = (type, outlet = null) => {
  try {
    const base = process.env.REACT_APP_BACKEND_URL;
    if (!base) return;
    fetch(`${base}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, outlet }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* abaikan */ }
};

export const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Tarif resmi antar-jemput: 0–2 km Rp 10.000, 3–5 km Rp 15.000
export const deliveryFee = (km) => {
  if (km == null) return null;
  if (km < 3) return 10000;
  if (km <= 5) return 15000;
  return -1; // di luar radius
};

// Jam operasional semua outlet: 07.00–21.00 WIB setiap hari
export const isOpenNow = () => {
  const hour = Number(
    new Intl.DateTimeFormat("id-ID", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(new Date())
  );
  return hour >= 7 && hour < 21;
};

export const OUTLETS = [
  {
    id: "pulomas",
    name: "Pulomas",
    region: "Jakarta Timur",
    address: "Jl. Angkur No. 26D (Ruko Biru), Kayu Putih, Pulogadung, Jakarta Timur",
    label: "Pulomas — Jakarta",
    lat: -6.1866679,
    lng: 106.8867307,
    mapsUrl: "https://maps.app.goo.gl/22KBfJEZxmseseVh9",
    hours: "07.00 – 21.00 WIB · Setiap Hari",
    waOutlet: "0856 9125 9381",
    pricelistImage:
      "https://customer-assets-rejwkqb3.emergentagent.net/job_307e2abc-0d5f-4f42-a8d4-2c090b6b8405/artifacts/94k7o4sx_Price%20List%20Jadiwangi%20Pulomas.webp",
    dettolKiloan: 1000,
    kiloan: [
      { name: "Cuci Kering Setrika", min: 5, reg: 10500, exp: 18000, regTime: "2 Hari", expTime: "6 Jam" },
      { name: "Cuci Lipat", min: 5, reg: 8000, exp: 13000, regTime: "2 Hari", expTime: "6 Jam" },
      { name: "Setrika", min: 5, reg: 9000, exp: 11000, regTime: "2 Hari", expTime: "6 Jam" },
    ],
    premium: [
      { title: "Bed Cover", mode: "dual", items: [
        { name: "Single (100-120)", reg: 40000, exp: 65000 },
        { name: "Queen (160-180)", reg: 56000, exp: 77000 },
        { name: "Super XL (200)", reg: 92000, exp: null },
      ]},
      { title: "Selimut", mode: "dual", note: "Add on Dettol + 2.000", items: [
        { name: "Tipis", reg: 26000, exp: 35000 },
        { name: "Tebal / Bulu", reg: 33000, exp: 55000 },
      ]},
      { title: "Bantal & Boneka", mode: "single", duration: "3 Hari", items: [
        { name: "Bantal", price: 40000 },
        { name: "Guling", price: 40000 },
        { name: "Bantal Leher", price: 30000 },
        { name: "Boneka Kecil", price: 25000 },
        { name: "Boneka Besar", price: 40000 },
      ]},
      { title: "Satuan — Atasan", mode: "dual", items: [
        { name: "Kemeja", reg: 19000, exp: 34000 },
        { name: "Kebaya", reg: 29000, exp: 53000 },
        { name: "Vest", reg: 19000, exp: 34000 },
        { name: "Jas", reg: 33000, exp: 53000 },
        { name: "Dress", reg: 57000, exp: 89000 },
        { name: "Jaket", reg: 30000, exp: 55000 },
        { name: "Selendang", reg: 15000, exp: 23000 },
        { name: "Coat", reg: 38000, exp: 70000 },
        { name: "Jubah / Toga", reg: 57000, exp: 89000 },
        { name: "Handuk", reg: 19000, exp: 35000 },
        { name: "Sprei Set", reg: 19000, exp: 35000 },
      ]},
      { title: "Satuan — Bawahan", mode: "dual", items: [
        { name: "Celana", reg: 23000, exp: 34000 },
        { name: "Rok", reg: 19000, exp: 32000 },
        { name: "Songket", reg: 29000, exp: 53000 },
      ]},
      { title: "Ibadah", mode: "dual", items: [
        { name: "Mukena", reg: 28000, exp: 40000 },
        { name: "Sarung", reg: 16000, exp: 30000 },
        { name: "Sajadah", reg: 18000, exp: 34000 },
      ]},
      { title: "Sepatu & Tas", mode: "single", items: [
        { name: "Sepatu", price: 40000, duration: "3 Hari" },
        { name: "Sandal", price: 22000, duration: "2 Hari" },
        { name: "Tas", price: 32000, duration: "2 Hari" },
      ]},
      { title: "Karpet & Gorden", mode: "single", unit: "/ m", duration: "7 Hari", items: [
        { name: "Karpet Tipis", price: 22000 },
        { name: "Karpet Tebal", price: 26000 },
        { name: "Gorden", price: 17000 },
        { name: "Vitrase Gorden", price: 11000 },
      ]},
      { title: "Kasur & Lainnya", mode: "single", duration: "7 Hari", items: [
        { name: "Kasur Palembang", price: 80000 },
        { name: "Baby Car Seat", price: 100000 },
        { name: "Stroller Anak", price: 100000 },
        { name: "Kasur Bayi", price: 55000 },
        { name: "Keset", price: 15000, duration: "2 Hari" },
      ]},
    ],
  },
  {
    id: "ujungberung",
    name: "Ujungberung",
    region: "Antapani — Bandung",
    address: "Jl. Rumah Sakit No. 50 (Ruko Orange sebelah Alfamart), Ujungberung, Bandung",
    label: "Ujungberung — Bandung",
    lat: -6.9174122,
    lng: 107.6986498,
    mapsUrl: "https://maps.app.goo.gl/nQz9hnHtAauVT8Q66",
    hours: "07.00 – 21.00 WIB · Setiap Hari",
    waOutlet: "0856 0198 4480",
    pricelistImage:
      "https://customer-assets-rejwkqb3.emergentagent.net/job_307e2abc-0d5f-4f42-a8d4-2c090b6b8405/artifacts/pmnjilvz_Price%20List%20Jadiwangi%20Ujungberung.webp",
    dettolKiloan: 2000,
    kiloan: [
      { name: "Cuci Kering Setrika", min: 3, reg: 6900, exp: 12000, regTime: "2 Hari", expTime: "6 Jam" },
      { name: "Cuci Lipat", min: 3, reg: 5900, exp: 7000, regTime: "2 Hari", expTime: "6 Jam" },
      { name: "Setrika", min: 5, reg: 6000, exp: 8000, regTime: "2 Hari", expTime: "6 Jam" },
    ],
    premium: [
      { title: "Bed Cover", mode: "dual", items: [
        { name: "Single (100-120)", reg: 28000, exp: 40000 },
        { name: "Queen (160-180)", reg: 40000, exp: 65000 },
        { name: "Super XL (200)", reg: 80000, exp: null },
      ]},
      { title: "Selimut", mode: "dual", note: "Add on Dettol + 2.000", items: [
        { name: "Tipis", reg: 20000, exp: 35000 },
        { name: "Tebal / Bulu", reg: 25000, exp: 52000 },
      ]},
      { title: "Bantal & Boneka", mode: "single", duration: "3 Hari", items: [
        { name: "Bantal", price: 30000 },
        { name: "Guling", price: 30000 },
        { name: "Bantal Leher", price: 20000 },
        { name: "Boneka Kecil", price: 20000 },
        { name: "Boneka Besar", price: 32000 },
      ]},
      { title: "Satuan — Atasan", mode: "dual", items: [
        { name: "Kemeja", reg: 14500, exp: 23000 },
        { name: "Kebaya", reg: 29000, exp: 53000 },
        { name: "Vest", reg: 14500, exp: 23000 },
        { name: "Jas", reg: 28000, exp: 45000 },
        { name: "Dress", reg: 35000, exp: 53000 },
        { name: "Jaket", reg: 30000, exp: 45000 },
        { name: "Selendang", reg: 10000, exp: 20000 },
        { name: "Coat", reg: 38000, exp: 70000 },
        { name: "Jubah / Toga", reg: 30000, exp: 45000 },
        { name: "Handuk", reg: 10000, exp: 17000 },
        { name: "Sprei Set", reg: 15000, exp: 25000 },
      ]},
      { title: "Satuan — Bawahan", mode: "dual", items: [
        { name: "Celana", reg: 19000, exp: 29000 },
        { name: "Rok", reg: 19000, exp: 29000 },
        { name: "Songket", reg: 29000, exp: 53000 },
      ]},
      { title: "Ibadah", mode: "dual", items: [
        { name: "Mukena", reg: 10000, exp: 18000 },
        { name: "Sarung", reg: 10000, exp: 15000 },
        { name: "Sajadah", reg: 15000, exp: 20000 },
      ]},
      { title: "Sepatu & Tas", mode: "single", items: [
        { name: "Sepatu", price: 50000, duration: "3 Hari" },
        { name: "Sandal", price: 30000, duration: "2 Hari" },
        { name: "Tas", price: 38000, duration: "2 Hari" },
      ]},
      { title: "Karpet & Gorden", mode: "single", unit: "/ m", duration: "7 Hari", items: [
        { name: "Karpet Tipis", price: 21000 },
        { name: "Karpet Tebal", price: 23000 },
        { name: "Gorden", price: 14000 },
        { name: "Vitrase Gorden", price: 10000 },
      ]},
      { title: "Kasur & Lainnya", mode: "single", duration: "7 Hari", items: [
        { name: "Kasur Palembang", price: 85000 },
        { name: "Baby Car Seat", price: 80000 },
        { name: "Stroller Anak", price: 80000 },
        { name: "Kasur Bayi", price: 55000 },
        { name: "Keset", price: 15000, duration: "2 Hari" },
      ]},
    ],
  },
  {
    id: "kalimulya",
    name: "Kalimulya",
    region: "Cilodong — Depok",
    address: "Jl. Raya Kalimulya No. 86B (Depan Sekolah Tunas Bangsa Islamic School), Cilodong, Depok",
    label: "Kalimulya — Depok",
    lat: -6.4373379,
    lng: 106.8214778,
    mapsUrl: "https://maps.app.goo.gl/GMsodebyyefpKHEt5",
    hours: "07.00 – 21.00 WIB · Setiap Hari",
    waOutlet: "0857 3535 0048",
    pricelistImage:
      "https://customer-assets-rejwkqb3.emergentagent.net/job_307e2abc-0d5f-4f42-a8d4-2c090b6b8405/artifacts/66m9uj6u_Price%20List%20Jadiwangi%20Depok.webp",
    dettolKiloan: 1000,
    kiloan: [
      { name: "Cuci Kering Setrika", min: 4, reg: 10000, exp: 18000, regTime: "2 Hari", expTime: "6 Jam" },
      { name: "Cuci Lipat", min: 5, reg: 7500, exp: 11000, regTime: "2 Hari", expTime: "6 Jam" },
      { name: "Setrika", min: 5, reg: 9000, exp: 10500, regTime: "2 Hari", expTime: "6 Jam" },
    ],
    premium: [
      { title: "Bed Cover", mode: "dual", items: [
        { name: "Single (100-120)", reg: 40000, exp: 55000 },
        { name: "Queen (160-180)", reg: 53000, exp: 75000 },
        { name: "Super XL (200)", reg: 88000, exp: null },
      ]},
      { title: "Selimut", mode: "dual", note: "Add on Dettol + 2.000", items: [
        { name: "Tipis", reg: 20000, exp: 34000 },
        { name: "Tebal", reg: 26000, exp: 35000 },
      ]},
      { title: "Bantal & Boneka", mode: "single", items: [
        { name: "Bantal", price: 40000 },
        { name: "Guling", price: 40000 },
        { name: "Bantal Leher", price: 20000 },
        { name: "Boneka Kecil", price: 25000 },
        { name: "Boneka Besar", price: 36000 },
      ]},
      { title: "Satuan — Atasan", mode: "dual", items: [
        { name: "Kemeja", reg: 18000, exp: 32000 },
        { name: "Kebaya", reg: 29000, exp: 51000 },
        { name: "Vest", reg: 18000, exp: 32000 },
        { name: "Jas", reg: 33000, exp: 53000 },
        { name: "Dress", reg: 38000, exp: 70000 },
        { name: "Jaket", reg: 30000, exp: 53000 },
        { name: "Selendang", reg: 10000, exp: 20000 },
        { name: "Coat", reg: 38000, exp: 70000 },
        { name: "Songket", reg: 29000, exp: 51000 },
        { name: "Jubah / Toga", reg: 45000, exp: 89000 },
        { name: "Sprei", reg: 19000, exp: 35000 },
      ]},
      { title: "Satuan — Bawahan", mode: "dual", items: [
        { name: "Celana", reg: 18000, exp: 32000 },
        { name: "Rok", reg: 18000, exp: 32000 },
      ]},
      { title: "Ibadah", mode: "dual", items: [
        { name: "Mukena", reg: 28000, exp: 40000 },
        { name: "Sarung", reg: 16000, exp: 30000 },
        { name: "Sajadah", reg: 18000, exp: 35000 },
      ]},
      { title: "Sepatu & Tas", mode: "single", items: [
        { name: "Sepatu", price: 40000, duration: "3 Hari" },
        { name: "Sandal", price: 22000, duration: "2 Hari" },
        { name: "Tas", price: 27000, duration: "2 Hari" },
      ]},
      { title: "Karpet & Gorden", mode: "single", unit: "/ m", duration: "7 Hari", items: [
        { name: "Karpet Tipis", price: 25000 },
        { name: "Karpet Tebal", price: 30000 },
        { name: "Gorden", price: 16000 },
        { name: "Vitrase Gorden", price: 10000 },
      ]},
      { title: "Kasur & Lainnya", mode: "single", duration: "7 Hari", items: [
        { name: "Kasur Palembang", price: 95000 },
        { name: "Baby Car Seat", price: 100000 },
        { name: "Stroller Anak", price: 100000 },
        { name: "Keset", price: 11000, duration: "2 Hari" },
      ]},
    ],
  },
];

export const getOutlet = (id) => OUTLETS.find((o) => o.id === id) || OUTLETS[0];

// USP nyata dari kebijakan resmi Jadiwangi (sesuai pricelist)
export const USP_CHAPTERS = [
  {
    number: "01",
    title: "Express 6 Jam Selesai",
    desc: "Order express yang masuk sebelum jam 10 pagi bisa diambil sore hari — pas banget dijemput pulang kantor. Cuci, kering, setrika, rapi dan wangi.",
  },
  {
    number: "02",
    title: "Garansi Cuci Ulang Gratis",
    desc: "Pakaian terima bau apek? Kami cuci ulang gratis, cukup lapor maksimal 1 hari dari nota pengambilan. Tanpa ribet.",
  },
  {
    number: "03",
    title: "Pantau Status via Nota Online",
    desc: "Setiap order mendapat nota berisi link pelacakan status pakaianmu. Tidak menerima nota dari staff? Kamu berhak cuci gratis.",
  },
  {
    number: "04",
    title: "Antar Jemput Sampai Depan Rumah",
    desc: "Kurir kami jemput dan antar cucianmu dalam radius 5 KM dari outlet. Ongkir flat & jujur: Rp 10.000 (0–2 km) dan Rp 15.000 (3–5 km).",
  },
];

// PROMO BULANAN — cukup edit object ini untuk ganti promo tiap bulan
export const PROMO = {
  active: true,
  badge: "Promo Jumat Berkah",
  text: "Diskon 10% setiap hari Jumat — semua layanan, semua outlet",
  cta: "Klaim via WA",
  waMessage:
    "Halo Jadiwangi Laundry! Saya mau klaim Promo Jumat Berkah diskon 10%. Mohon infonya ya kak.",
};

// Ulasan asli Google Maps ★5 — Outlet Pulomas (tertaut ke ulasan aslinya)
export const TESTIMONIALS = [
  {
    name: "Ganies Anggradini",
    outlet: "pulomas",
    time: "5 bulan lalu",
    text: "Selalu jadi andalan untuk laundry kiloan di daerah Rawamangun dan Pulomas. Bersih, dan pakai Dettol 👍",
    link: "https://maps.app.goo.gl/F6XX4nPm9Aa9foSQ9",
  },
  {
    name: "Denny Mactavish",
    outlet: "pulomas",
    time: "1 tahun lalu",
    text: "Pelayanan cepat dan tepat waktu. Ramah, hasilnya bersih dan wangi.",
    link: "https://maps.app.goo.gl/i13ocga8mSheo2Js8",
  },
  {
    name: "Hani Yulandani",
    outlet: "pulomas",
    time: "1 tahun lalu",
    text: "Pelayanan ramah. Hasil cuci dan setrikanya bagus.",
    link: "https://maps.app.goo.gl/14kKGyHVjwLa7MCS6",
  },
  {
    name: "Dorgis Bernando",
    outlet: "pulomas",
    time: "1 tahun lalu",
    text: "Pelayanan bagus, parfumnya wangi. Pelayanannya ramah.",
    link: "https://maps.app.goo.gl/PHQvCm47QfTNfdh89",
  },
  {
    name: "widya siagian",
    outlet: "pulomas",
    time: "1 tahun lalu",
    text: "Laundry recommended di Kayu Putih..",
    link: "https://maps.app.goo.gl/kdfkTxXSafeJbCgj8",
  },
];

// Foto asli outlet Jadiwangi (dinding ungu khas outlet)
export const HERO_IMG =
  "https://customer-assets-jt897jd0.emergentagent.net/job_jadiwangi-laundry/artifacts/2ao1u3d5_WhatsApp%20Image%202026-06-05%20at%2022.10.55.jpeg";
export const IMG_IRON =
  "https://customer-assets-jt897jd0.emergentagent.net/job_jadiwangi-laundry/artifacts/vnk82pl2_WhatsApp%20Image%202026-06-05%20at%2021.55.37.jpeg";
export const IMG_TOWELS =
  "https://customer-assets-jt897jd0.emergentagent.net/job_jadiwangi-laundry/artifacts/q6wdcycx_WhatsApp%20Image%202026-06-05%20at%2021.55.31.jpeg";
export const IMG_DETTOL_POUR =
  "https://customer-assets-jt897jd0.emergentagent.net/job_jadiwangi-laundry/artifacts/byo9thxu_WhatsApp%20Image%202026-06-05%20at%2021.55.32%20%281%29.jpeg";
export const IMG_OJEK =
  "https://customer-assets-jt897jd0.emergentagent.net/job_jadiwangi-laundry/artifacts/kf87wnbq_image.png";
export const IMG_SHIRTS =
  "https://images.unsplash.com/photo-1603252109303-2751441dd157?crop=entropy&cs=srgb&fm=jpg&q=85&w=940";
