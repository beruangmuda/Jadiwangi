import { motion } from "framer-motion";
import { HeartHandshake, ShieldCheck, UserCheck } from "lucide-react";
import { PENGADUAN_MESSAGE, trackEvent, waLink } from "@/data/laundry";

const PESAN_PENGADUAN = PENGADUAN_MESSAGE;

const JANJI = [
  { icon: UserCheck, text: "Langsung diterima pemilik — bukan bot, bukan template" },
  { icon: HeartHandshake, text: "Setiap keluhan ditindaklanjuti serius sampai beres" },
  { icon: ShieldCheck, text: "Bau apek? Garansi cuci ulang gratis tetap berlaku" },
];

export default function Pengaduan() {
  return (
    <section id="pengaduan" data-testid="pengaduan-section" className="relative py-24 lg:py-32">
      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden bg-gradient-to-br from-[#7E22CE] to-[#4C1D95] text-white rounded-[2rem] border border-purple-400/30 shadow-[0_25px_60px_rgba(88,28,135,0.3)] p-8 lg:p-14"
        >
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-purple-200 font-semibold mb-4">
              Layanan Pengaduan
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.12] max-w-2xl">
              Ada yang kurang beres? <em className="text-[#D8B4FE]">Bilang langsung ke kami.</em>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-purple-100 leading-relaxed max-w-2xl">
              Kami manusia biasa — kalau ada cucian yang kurang wangi, barang tertinggal, atau
              pelayanan yang kurang ramah, sampaikan langsung ke pemilik lewat WhatsApp dengan
              topik <strong>Pengaduan</strong>. Jangan buru-buru kasih bintang 1 di Google dulu —
              beri kami kesempatan memperbaikinya sampai kamu puas.
            </p>

            <ul className="mt-8 grid sm:grid-cols-3 gap-4">
              {JANJI.map((j) => (
                <li key={j.text} className="flex items-start gap-3 bg-white/10 border border-white/15 rounded-2xl px-4 py-3.5">
                  <j.icon className="w-5 h-5 text-[#D8B4FE] shrink-0 mt-0.5" />
                  <span className="text-sm text-purple-50 leading-relaxed">{j.text}</span>
                </li>
              ))}
            </ul>

            <a
              data-testid="pengaduan-cta-wa"
              href={waLink(PESAN_PENGADUAN)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("pengaduan_click")}
              className="mt-9 inline-flex items-center gap-2.5 bg-white text-[#581C87] font-semibold px-8 py-4 rounded-full hover:bg-purple-50 transition-colors duration-300 shadow-lg"
            >
              <HeartHandshake className="w-5 h-5" />
              Sampaikan Pengaduan via WhatsApp
            </a>
            <p className="mt-4 text-xs text-purple-200">
              Pesan otomatis bertopik Pengaduan — tinggal isi outlet & keluhanmu.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
