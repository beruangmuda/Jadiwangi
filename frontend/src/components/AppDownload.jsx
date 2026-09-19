import { motion } from "framer-motion";
import { BadgePercent, BellRing, MapPinned, Smartphone } from "lucide-react";
import { LOGO_URL, trackEvent, waLink } from "@/data/laundry";

const BENEFITS = [
  { icon: BadgePercent, text: "Diskon khusus member & promo lebih dulu sebelum diumumkan" },
  { icon: MapPinned, text: "Lacak status cucianmu langsung dari aplikasi" },
  { icon: BellRing, text: "Notifikasi penawaran menarik setiap bulan" },
];

export default function AppDownload() {
  return (
    <section id="aplikasi" data-testid="app-section" className="relative py-24 lg:py-36 overflow-hidden">
      <div className="absolute -top-24 right-10 w-96 h-96 rounded-full bg-[#E9D5FF]/60 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Segera Hadir
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Jadiwangi App — <em className="text-[#7E22CE]">diskon & penawaran di genggamanmu.</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#645B72] leading-relaxed">
            Aplikasi resmi Jadiwangi Laundry sedang kami kembangkan. Nanti kamu bisa mengakses
            bermacam diskon dan penawaran menarik khusus pengguna aplikasi.
          </p>
          <ul className="mt-7 space-y-4">
            {BENEFITS.map((b) => (
              <li key={b.text} className="flex items-start gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                  <b.icon className="w-5 h-5 text-[#7E22CE]" />
                </span>
                <span className="text-sm sm:text-base text-[#1E1329] leading-relaxed pt-2">{b.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#1E1329] text-white text-sm font-semibold opacity-70">
              <Smartphone className="w-4.5 h-4.5 w-5 h-5" />
              Android — Segera
            </span>
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#1E1329] text-white text-sm font-semibold opacity-70">
              <Smartphone className="w-5 h-5" />
              iOS — Segera
            </span>
          </div>
          <a
            data-testid="app-notify-wa"
            href={waLink("Halo Jadiwangi Laundry! Kabari saya ya saat Jadiwangi App sudah rilis. Mau jadi yang pertama coba!")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("app_notify")}
            className="mt-6 inline-flex items-center gap-2.5 bg-[#7E22CE] hover:bg-[#581C87] text-white font-semibold px-7 py-3.5 rounded-full transition-colors duration-300 shadow-[0_12px_30px_rgba(126,34,206,0.3)]"
          >
            <BellRing className="w-5 h-5" />
            Kabari Saya Saat Rilis
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex justify-center"
        >
          <div className="relative w-64 sm:w-72 rounded-[2.8rem] border-[10px] border-[#1E1329] bg-gradient-to-b from-[#7E22CE] to-[#4C1D95] shadow-[0_30px_70px_rgba(88,28,135,0.35)] overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-7 flex justify-center">
              <span className="w-24 h-5 bg-[#1E1329] rounded-b-2xl" />
            </div>
            <div className="pt-16 pb-12 px-6 flex flex-col items-center text-center text-white min-h-[26rem]">
              <span className="bg-white rounded-2xl px-4 py-3 animate-float-soft">
                <img src={LOGO_URL} alt="Jadiwangi Laundry" className="h-12 w-auto" />
              </span>
              <p className="mt-6 font-display text-3xl leading-tight">Jadiwangi App</p>
              <p className="mt-2 text-xs font-mono-accent tracking-[0.25em] uppercase text-purple-200">
                Segera Hadir
              </p>
              <div className="mt-8 w-full space-y-2.5">
                {["Diskon member 15%", "Promo payday lebih dulu", "Tracking cucian live"].map((t) => (
                  <div key={t} className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-purple-100 text-left">
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <span className="absolute -top-4 right-8 sm:right-16 bg-[#F59E0B] text-[#1E1329] text-xs font-bold px-4 py-2 rounded-full rotate-6 shadow-lg animate-float-soft">
            SEGERA HADIR
          </span>
        </motion.div>
      </div>
    </section>
  );
}
