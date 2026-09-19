import { motion } from "framer-motion";
import { Heart, MessageCircle } from "lucide-react";
import { waLink } from "@/data/laundry";

const WasherSvg = () => (
  <svg viewBox="0 0 120 100" className="h-36 w-auto" aria-hidden="true">
    <defs>
      <clipPath id="washer-door"><circle cx="60" cy="58" r="21" /></clipPath>
    </defs>
    <circle cx="33" cy="14" r="3.5" fill="#D8B4FE" className="animate-bubble svg-origin" />
    <circle cx="87" cy="10" r="2.8" fill="#C084FC" className="animate-bubble svg-origin" style={{ animationDelay: "0.8s" }} />
    <circle cx="95" cy="20" r="3.2" fill="#E9D5FF" className="animate-bubble svg-origin" style={{ animationDelay: "1.5s" }} />
    <rect x="28" y="6" width="64" height="88" rx="12" fill="#7E22CE" />
    <rect x="28" y="6" width="64" height="16" rx="8" fill="#581C87" />
    <circle cx="37" cy="14" r="3" fill="#D8B4FE" />
    <rect x="74" y="11" width="13" height="6" rx="3" fill="#D8B4FE" />
    <circle cx="60" cy="58" r="23" fill="#F3E8FF" stroke="#581C87" strokeWidth="3" />
    <g clipPath="url(#washer-door)">
      <path
        d="M36 62 q6 -5 12 0 t12 0 t12 0 t12 0 V86 H36 Z"
        fill="#C084FC"
        opacity="0.85"
        className="animate-water svg-origin"
      />
    </g>
    <g className="animate-drum svg-origin">
      <circle cx="60" cy="58" r="14" fill="none" stroke="#7E22CE" strokeWidth="2.5" strokeDasharray="6 8" strokeLinecap="round" />
    </g>
    <circle cx="53" cy="52" r="2.2" fill="#1E1329" />
    <circle cx="67" cy="52" r="2.2" fill="#1E1329" />
    <path d="M54 63 q6 5 12 0" stroke="#1E1329" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

const DryerSvg = () => (
  <svg viewBox="0 0 120 100" className="h-36 w-auto" aria-hidden="true">
    <defs>
      <clipPath id="dryer-door"><circle cx="60" cy="58" r="21" /></clipPath>
    </defs>
    <path d="M34 2 q3 -6 6 0" stroke="#C084FC" strokeWidth="2.5" fill="none" strokeLinecap="round" className="animate-steam svg-origin" />
    <path d="M84 2 q3 -6 6 0" stroke="#C084FC" strokeWidth="2.5" fill="none" strokeLinecap="round" className="animate-steam svg-origin" style={{ animationDelay: "1s" }} />
    <rect x="28" y="6" width="64" height="88" rx="12" fill="#581C87" />
    <rect x="28" y="6" width="64" height="16" rx="8" fill="#3B0764" />
    <rect x="34" y="11" width="14" height="6" rx="3" fill="#A855F7" />
    <rect x="52" y="11" width="14" height="6" rx="3" fill="#A855F7" />
    <circle cx="60" cy="58" r="23" fill="#F3E8FF" stroke="#3B0764" strokeWidth="3" />
    <g clipPath="url(#dryer-door)">
      <g className="animate-drum svg-origin" style={{ animationDuration: "3.8s", animationDirection: "reverse" }}>
        <rect x="46" y="46" width="13" height="13" rx="3.5" fill="#A855F7" />
        <rect x="62" y="60" width="12" height="12" rx="3.5" fill="#C084FC" />
        <rect x="60" y="40" width="10" height="10" rx="3" fill="#E9D5FF" />
      </g>
    </g>
    <circle cx="53" cy="52" r="2.2" fill="#1E1329" />
    <circle cx="67" cy="52" r="2.2" fill="#1E1329" />
    <path d="M54 63 q6 5 12 0" stroke="#1E1329" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

const IronSvg = () => (
  <svg viewBox="0 0 120 100" className="h-36 w-auto" aria-hidden="true">
    <rect x="12" y="78" width="96" height="6" rx="3" fill="#D8B4FE" />
    <rect x="34" y="70" width="52" height="8" rx="4" fill="#E9D5FF" />
    <path d="M20 84 l-5 10 M100 84 l5 10" stroke="#D8B4FE" strokeWidth="4" strokeLinecap="round" />
    <circle cx="52" cy="30" r="3" fill="#C084FC" className="animate-steam svg-origin" />
    <circle cx="64" cy="26" r="3.6" fill="#D8B4FE" className="animate-steam svg-origin" style={{ animationDelay: "0.7s" }} />
    <circle cx="76" cy="30" r="3" fill="#C084FC" className="animate-steam svg-origin" style={{ animationDelay: "1.3s" }} />
    <g className="animate-iron svg-origin">
      <path d="M44 70 L48 52 Q50 44 60 44 L80 44 Q88 44 88 52 L88 60 Q88 70 78 70 Z" fill="#7E22CE" />
      <rect x="54" y="35" width="26" height="9" rx="4.5" fill="#581C87" />
      <circle cx="82" cy="52" r="2.5" fill="#E9D5FF" />
    </g>
    <path d="M98 40 l1.8 4.5 4.5 1.8 -4.5 1.8 -1.8 4.5 -1.8 -4.5 -4.5 -1.8 4.5 -1.8 z" fill="#F59E0B" className="animate-sparkle svg-origin" />
  </svg>
);

const FoldSvg = () => (
  <svg viewBox="0 0 120 100" className="h-36 w-auto" aria-hidden="true">
    <rect x="34" y="74" width="52" height="11" rx="5.5" fill="#581C87" />
    <rect x="37" y="63" width="46" height="11" rx="5.5" fill="#7E22CE" />
    <rect x="40" y="52" width="40" height="11" rx="5.5" fill="#A855F7" />
    <g className="animate-fold svg-origin">
      <rect x="40" y="36" width="40" height="14" rx="6" fill="#C084FC" />
      <rect x="47" y="41" width="26" height="4" rx="2" fill="#E9D5FF" />
    </g>
    <path d="M24 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#F59E0B" className="animate-sparkle svg-origin" />
    <path d="M96 22 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill="#D8B4FE" className="animate-sparkle svg-origin" style={{ animationDelay: "1.1s" }} />
  </svg>
);

const STEPS = [
  { id: "cuci", title: "Cuci", desc: "Mesin modern & deterjen lembut serat — plus opsi antiseptik Dettol.", Svg: WasherSvg },
  { id: "kering", title: "Keringkan", desc: "Pengering cepat, anti bau apek walau lagi musim hujan.", Svg: DryerSvg },
  { id: "setrika", title: "Setrika", desc: "Setrika uap presisi — licin, tegak, bebas kusut.", Svg: IronSvg },
  { id: "lipat", title: "Lipat Rapi", desc: "Dilipat rapi & dikemas wangi, siap langsung masuk lemari.", Svg: FoldSvg },
];

export default function Proses() {
  return (
    <section id="proses" data-testid="proses-section" className="relative py-24 lg:py-36 bg-[#F3EBF9] overflow-hidden">
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#E9D5FF]/70 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-14"
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Cara Kerja Kami
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Serahkan ke kami, <em className="text-[#7E22CE]">tanpa ribet sama sekali.</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#645B72] leading-relaxed">
            Cukup satu chat WhatsApp — cucianmu kami jemput, cuci, keringkan, setrika, dan lipat
            sampai rapi. Kamu tinggal menikmati harimu.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {STEPS.map((s, i) => (
            <motion.article
              key={s.id}
              data-testid={`proses-card-${s.id}`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8, rotate: i % 2 === 0 ? -1 : 1 }}
              className="bg-white rounded-3xl border border-purple-100 shadow-[0_4px_25px_rgba(126,34,206,0.06)] hover:shadow-[0_16px_40px_rgba(126,34,206,0.14)] hover:border-purple-300 transition-shadow duration-300 p-5 lg:p-6"
              style={{ perspective: 600 }}
            >
              <div className="relative flex items-center justify-center h-40 rounded-2xl bg-gradient-to-b from-[#F3E8FF] to-[#E9D5FF]/60 overflow-hidden">
                <span className="absolute top-3 left-4 font-mono-accent text-xs font-semibold text-[#7E22CE]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <s.Svg />
              </div>
              <h3 className="mt-4 font-display text-xl lg:text-2xl tracking-tight text-[#1E1329]">{s.title}</h3>
              <p className="mt-1.5 text-sm text-[#645B72] leading-relaxed">{s.desc}</p>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 bg-gradient-to-br from-[#7E22CE] to-[#4C1D95] text-white rounded-3xl border border-purple-400/30 shadow-[0_20px_50px_rgba(88,28,135,0.3)] p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-8"
        >
          <span className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 animate-float-soft">
            <Heart className="w-8 h-8 text-[#F3E8FF]" />
          </span>
          <div className="flex-1 text-center lg:text-left">
            <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-snug">
              Sementara kami yang mencuci, <em className="text-[#D8B4FE]">kamu bebas bermain bersama keluarga.</em>
            </h3>
            <p className="mt-3 text-sm sm:text-base text-purple-100 leading-relaxed">
              Weekend bukan untuk antre cucian. Serahkan pada kami — waktu luangmu terlalu berharga
              untuk dihabiskan di depan mesin cuci.
            </p>
          </div>
          <a
            data-testid="proses-cta-wa"
            href={waLink("Halo Jadiwangi Laundry! Saya mau serahkan cucian saya. Mohon info penjemputannya ya kak.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-white text-[#581C87] font-semibold px-7 py-4 rounded-full hover:bg-purple-50 transition-colors duration-300 shrink-0"
          >
            <MessageCircle className="w-5 h-5" />
            Serahkan Cucianmu
          </a>
        </motion.div>
      </div>
    </section>
  );
}
