import { motion } from "framer-motion";
import { USP_CHAPTERS } from "@/data/laundry";

export default function Manifesto() {
  return (
    <section id="keunggulan" className="relative py-24 lg:py-36">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-16"
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Manifesto Kami
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Mengapa keluarga di 3 kota
            <em className="text-[#7E22CE]"> percaya Jadiwangi?</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#645B72] leading-relaxed">
            Kami bukan sekadar laundry kiloan. Setiap helai pakaianmu dihitung bersama di awal,
            dipilah sesuai warna & bahan, dan bisa dipantau statusnya lewat nota online.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5 lg:gap-6">
          {USP_CHAPTERS.map((c, i) => (
            <motion.article
              key={c.number}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className={`group relative rounded-3xl p-8 lg:p-10 border transition-shadow duration-300 ${
                i === 0
                  ? "bg-gradient-to-br from-[#7E22CE] to-[#4C1D95] text-white border-purple-400/30 shadow-[0_15px_40px_rgba(88,28,135,0.25)]"
                  : "bg-white/95 border-purple-100 hover:border-purple-300 shadow-[0_4px_25px_rgba(126,34,206,0.06)] hover:shadow-[0_12px_35px_rgba(126,34,206,0.12)]"
              }`}
            >
              <span
                className={`font-display text-6xl lg:text-7xl leading-none ${
                  i === 0 ? "text-white/25" : "text-stroke-lavender"
                }`}
              >
                {c.number}
              </span>
              <h3
                className={`mt-5 font-display text-2xl lg:text-3xl tracking-tight ${
                  i === 0 ? "text-white" : "text-[#1E1329]"
                }`}
              >
                {c.title}
              </h3>
              <p
                className={`mt-3 text-sm sm:text-base leading-relaxed ${
                  i === 0 ? "text-purple-100" : "text-[#645B72]"
                }`}
              >
                {c.desc}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
