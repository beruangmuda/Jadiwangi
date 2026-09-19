export const WA_CENTRAL = "6285770706467";
export const WA_DISPLAY = "0857 7070 6467";
export const IG_URL = "https://instagram.com/jadiwangilaundry";
export const LOGO_URL =
  "https://customer-assets-rejwkqb3.emergentagent.net/job_307e2abc-0d5f-4f42-a8d4-2c090b6b8405/artifacts/9rizptxp_Logo%20Jadiwangi%20transparan.png";

export const rp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

export const waLink = (message) =>
  `https://wa.me/${WA_CENTRAL}?text=${encodeURIComponent(message)}`;

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

// Estimasi ongkir antar-jemput: < 2 km GRATIS, 2-5 km Rp 3.000/km (dari km ke-3)
export const deliveryFee = (km) => {
  if (km == null) return null;
  if (km <= 2) return 0;
  if (km <= 5) return Math.ceil(km - 2) * 3000;
  return -1; // di luar radius
};

export const OUTLETS = [
  {
    id: "pulomas",
    name: "Pulomas",
    region: "Jakarta Timur",
    label: "Pulomas — Jakarta",
    lat: -6.1866679,
    lng: 106.8867307,
    mapsUrl: "https://maps.app.goo.gl/22KBfJEZxmseseVh9",
    hours: "Buka Setiap Hari",
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
    label: "Ujungberung — Bandung",
    lat: -6.9174122,
    lng: 107.6986498,
    mapsUrl: "https://maps.app.goo.gl/nQz9hnHtAauVT8Q66",
    hours: "Buka Setiap Hari",
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
    label: "Kalimulya — Depok",
    lat: -6.4373379,
    lng: 106.8214778,
    mapsUrl: "https://maps.app.goo.gl/GMsodebyyefpKHEt5",
    hours: "Buka Setiap Hari",
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
    desc: "Butuh kemeja buat acara mendadak? Layanan express kami selesai dalam 6 jam — cuci, kering, setrika, rapi dan wangi.",
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
    title: "Antar Jemput, < 2 KM Gratis Ongkir",
    desc: "Kurir kami jemput dan antar sampai depan rumah dalam radius 5 KM dari outlet. Jarak di bawah 2 KM? Ongkirnya gratis.",
  },
];

// CONTOH — akan diganti dengan ulasan asli Google Maps ★5 dari pemilik bisnis
export const TESTIMONIALS = [
  { name: "Dewi Lestari", outlet: "pulomas", text: "Baru kali ini nemu laundry yang wanginya awet berhari-hari. Setrikaan rapi banget, kemeja kantor langsung siap pakai. Langganan tetap!" },
  { name: "Rizky Pratama", outlet: "pulomas", text: "Adminnya fast respon di WhatsApp, antar jemputnya juga on time. Harga sesuai pricelist, nggak ada biaya aneh-aneh." },
  { name: "Intan Permata", outlet: "ujungberung", text: "Sepatu putihku balik kinclong kayak baru beli. Buat harga segini sih worth it banget, bakal balik lagi sih pasti." },
  { name: "Budi Santoso", outlet: "ujungberung", text: "Udah coba banyak laundry di daerah Ujungberung, ini yang paling rapi dan paling wangi. Mukena juga dicuci terpisah. Recommended!" },
  { name: "Maya Anggraini", outlet: "kalimulya", text: "Cuci bed cover queen di sini hasilnya bersih dan wangi banget. Bisa pantau status cucian dari link di nota, transparan banget." },
  { name: "Fajar Nugroho", outlet: "kalimulya", text: "Express 6 jam beneran kelar! Ngebantu banget pas butuh batik buat acara mendadak. Pelayanannya ramah pula." },
];

export const HERO_IMG =
  "https://images.pexels.com/photos/8581380/pexels-photo-8581380.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
export const IMG_TOWELS =
  "https://images.pexels.com/photos/45980/pexels-photo-45980.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
export const IMG_IRON =
  "https://images.pexels.com/photos/5901627/pexels-photo-5901627.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
export const IMG_SHIRTS =
  "https://images.unsplash.com/photo-1603252109303-2751441dd157?crop=entropy&cs=srgb&fm=jpg&q=85&w=940";
