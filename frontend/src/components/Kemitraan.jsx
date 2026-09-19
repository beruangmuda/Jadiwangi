import { motion } from "framer-motion";
import { GraduationCap, Handshake, Megaphone, Store } from "lucide-react";
import { trackEvent, waLink } from "@/data/laundry";

const BENEFITS = [
  {
    icon: Store,
    title: "Brand yang Sudah Dipercaya",
    desc: "3 outlet aktif di Jakarta, Bandung, dan Depok dengan ulasan bintang 5 dari pelanggan.",
  },
  {
    icon: GraduationCap,
    title: "SOP & Pelatihan Lengkap",
    desc: "Standar cuci, pewangi, dan pelayanan kami ajarkan sampai timmu siap jalan.",
  },
  {
    icon: Megaphone,
    title: "Dukungan Pemasaran",
    desc: "Materi promosi, kampanye bulanan, dan sistem nota online langsung kamu pakai.",
  },
];

export default function Kemitraan() {
  return (
    <section id="kemitraan" data-testid="kemitraan-section" className="relative py-24 lg:py-36 bg-[#F3EBF9] overflow-hidden">
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#E9D5FF]/70 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-14"
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Kemitraan & Franchise
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Buka Jadiwangi <em className="text-[#7E22CE]">di kotamu.</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#645B72] leading-relaxed">
            Kami membuka peluang kemitraan bagi kamu yang ingin membangun bisnis laundry dengan
            brand, sistem, dan resep wangi yang sudah terbukti.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-5 lg:gap-6 mb-12">
          {BENEFITS.map((b, i) => (
            <motion.article
              key={b.title}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-3xl border border-purple-100 shadow-[0_4px_25px_rgba(126,34,206,0.06)] hover:border-purple-300 hover:shadow-[0_12px_35px_rgba(126,34,206,0.12)] transition duration-300 p-7"
            >
              <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7E22CE] to-[#4C1D95] flex items-center justify-center">
                <b.icon className="w-6 h-6 text-white" />
              </span>
              <h3 className="mt-4 font-display text-xl lg:text-2xl tracking-tight text-[#1E1329]">{b.title}</h3>
              <p className="mt-2 text-sm text-[#645B72] leading-relaxed">{b.desc}</p>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="text-center"
        >
          <a
            data-testid="kemitraan-cta-wa"
            href={waLink("Halo Jadiwangi Laundry! Saya tertarik diskusi peluang kemitraan / franchise. Mohon info selengkapnya ya kak.")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("kemitraan_click")}
            className="inline-flex items-center gap-2.5 bg-[#7E22CE] hover:bg-[#581C87] text-white font-semibold px-8 py-4 rounded-full transition-colors duration-300 shadow-[0_12px_30px_rgba(126,34,206,0.3)]"
          >
            <Handshake className="w-5 h-5" />
            Diskusi Kemitraan via WhatsApp
          </a>
        </motion.div>
      </div>
    </section>
  );
}
