import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { IMG_IRON, IMG_SHIRTS, IMG_TOWELS } from "@/data/laundry";

const GROUPS = [
  {
    tag: "Paling Populer",
    title: "Laundry Kiloan Harian",
    desc: "Cuci, kering, setrika, lipat rapi — mulai dari Rp 5.900/kg tergantung outlet.",
    img: IMG_IRON,
    items: ["Cuci Kering Setrika", "Cuci Lipat Hemat", "Setrika Uap Saja", "Express 6 Jam"],
  },
  {
    tag: "Perawatan Khusus",
    title: "Premium Care & Satuan",
    desc: "Perawatan satu-per-satu untuk barang kesayangan yang butuh sentuhan ekstra.",
    img: IMG_TOWELS,
    items: ["Bed Cover, Selimut & Sprei", "Bantal, Guling & Boneka", "Karpet, Gorden & Kasur", "Keset & Perlengkapan Ibadah"],
  },
  {
    tag: "Detail Presisi",
    title: "Sepatu, Tas & Pakaian Satuan",
    desc: "Sneakers, tas branded, jas, kebaya hingga jubah toga ditangani terpisah.",
    img: IMG_SHIRTS,
    items: ["Sepatu & Sandal", "Tas Branded", "Kemeja, Jas & Dress", "Kebaya, Songket & Jubah"],
  },
];

export default function Services({ onNavigate }) {
  return (
    <section id="layanan" className="relative py-24 lg:py-36 bg-[#F3EBF9]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-6 mb-14"
        >
          <div className="max-w-xl">
            <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
              Layanan & Produk
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
              Dari kaos harian sampai <em className="text-[#7E22CE]">karpet masjid.</em>
            </h2>
          </div>
          <button
            data-testid="services-btn-pricelist"
            onClick={(e) => onNavigate(e, "#pricelist")}
            className="group inline-flex items-center gap-2 text-sm font-semibold text-[#7E22CE] hover:text-[#581C87] transition-colors"
          >
            Lihat semua harga
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {GROUPS.map((g, i) => (
            <motion.article
              key={g.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.85, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="group bg-white rounded-3xl overflow-hidden border border-purple-100 shadow-[0_4px_25px_rgba(126,34,206,0.06)] hover:shadow-[0_16px_40px_rgba(126,34,206,0.14)] hover:border-purple-300 transition-all duration-300"
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={g.img}
                  alt={g.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <span className="absolute top-4 left-4 inline-flex px-3 py-1 rounded-full text-xs font-mono-accent font-medium tracking-wide bg-white/90 backdrop-blur text-[#581C87] border border-purple-200">
                  {g.tag}
                </span>
              </div>
              <div className="p-7">
                <h3 className="font-display text-2xl tracking-tight text-[#1E1329]">{g.title}</h3>
                <p className="mt-2 text-sm text-[#645B72] leading-relaxed">{g.desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {g.items.map((it) => (
                    <li key={it} className="flex items-center gap-2.5 text-sm text-[#1E1329]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7E22CE] shrink-0" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
