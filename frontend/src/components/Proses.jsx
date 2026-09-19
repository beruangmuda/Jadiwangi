import { motion } from "framer-motion";
import { Heart, MessageCircle } from "lucide-react";
import { waLink } from "@/data/laundry";

const STROKE = "#581C87";
const ACCENT = "#7E22CE";
const SOFT = "#D8B4FE";
const GOLD = "#F59E0B";

const SceneCuci = () => (
  <svg viewBox="0 0 160 120" className="h-32 w-auto" aria-hidden="true">
    <rect x="106" y="34" width="44" height="62" rx="8" fill="none" stroke={STROKE} strokeWidth="3" />
    <line x1="106" y1="46" x2="150" y2="46" stroke={STROKE} strokeWidth="3" />
    <circle cx="113" cy="40" r="2" fill={STROKE} />
    <circle cx="128" cy="70" r="14" fill="none" stroke={STROKE} strokeWidth="3" />
    <circle cx="128" cy="70" r="7.5" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeDasharray="4 5" className="animate-drum svg-origin" />
    <g className="animate-walk svg-origin">
      <circle cx="52" cy="38" r="8" fill="none" stroke={STROKE} strokeWidth="3" />
      <line x1="52" y1="46" x2="52" y2="70" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="52" y1="52" x2="68" y2="60" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <path d="M64 58 h18 l-3 14 h-12 z" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="52" y1="70" x2="44" y2="94" stroke={STROKE} strokeWidth="3" strokeLinecap="round" className="animate-leg svg-origin origin-hip" />
      <line x1="52" y1="70" x2="60" y2="94" stroke={STROKE} strokeWidth="3" strokeLinecap="round" className="animate-leg-rev svg-origin origin-hip" />
    </g>
    <circle cx="100" cy="24" r="3" fill="none" stroke={SOFT} strokeWidth="2" className="animate-bubble svg-origin" />
    <circle cx="92" cy="16" r="2.2" fill="none" stroke={SOFT} strokeWidth="2" className="animate-bubble svg-origin" style={{ animationDelay: "1.1s" }} />
    <line x1="8" y1="100" x2="152" y2="100" stroke={SOFT} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const SceneKering = () => (
  <svg viewBox="0 0 160 120" className="h-32 w-auto" aria-hidden="true">
    <path
      d="M36 24 q0 -9 9 -9 q2 -8 11 -8 q9 0 10 8 q9 -1 9 8 q0 7 -9 7 h-21 q-9 0 -9 -6 z"
      fill="#F3E8FF"
      stroke={STROKE}
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <line x1="64" y1="28" x2="60" y2="42" stroke={STROKE} strokeWidth="3" strokeLinecap="round" className="animate-rain svg-origin" />
    <line x1="74" y1="28" x2="70" y2="42" stroke={STROKE} strokeWidth="3" strokeLinecap="round" className="animate-rain svg-origin" style={{ animationDelay: "0.4s" }} />
    <line x1="84" y1="28" x2="80" y2="42" stroke={STROKE} strokeWidth="3" strokeLinecap="round" className="animate-rain svg-origin" style={{ animationDelay: "0.8s" }} />
    <rect x="14" y="40" width="46" height="64" rx="8" fill="none" stroke={STROKE} strokeWidth="3" />
    <line x1="14" y1="52" x2="60" y2="52" stroke={STROKE} strokeWidth="3" />
    <circle cx="21" cy="46" r="2" fill={STROKE} />
    <circle cx="37" cy="76" r="14" fill="none" stroke={STROKE} strokeWidth="3" />
    <g className="animate-drum svg-origin" style={{ animationDuration: "3.4s" }}>
      <path d="M31 74 l6 -6 M39 82 l8 -4 M33 82 l5 4" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
    </g>
    <g className="animate-sparkle svg-origin" style={{ animationDuration: "3s" }}>
      <circle cx="130" cy="18" r="7" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <path d="M130 6 v4 M130 26 v4 M118 18 h4 M138 18 h4 M121 9 l3 3 M139 9 l-3 3 M121 27 l3 -3 M139 27 l-3 -3" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
    </g>
    <g className="animate-bounce svg-origin">
      <circle cx="106" cy="52" r="8" fill="none" stroke={STROKE} strokeWidth="3" />
      <path d="M102 54 q4 3.5 8 0" stroke={STROKE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="106" y1="60" x2="106" y2="84" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="106" y1="66" x2="94" y2="55" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="106" y1="66" x2="118" y2="55" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="106" y1="84" x2="98" y2="104" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="106" y1="84" x2="114" y2="104" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    </g>
    <line x1="8" y1="108" x2="152" y2="108" stroke={SOFT} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const SceneSetrika = () => (
  <svg viewBox="0 0 160 120" className="h-32 w-auto" aria-hidden="true">
    <g className="animate-sparkle svg-origin">
      <circle cx="40" cy="20" r="3" fill={ACCENT} />
      <line x1="43" y1="20" x2="43" y2="10" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
    </g>
    <g className="animate-sparkle svg-origin" style={{ animationDelay: "0.9s" }}>
      <circle cx="56" cy="14" r="2.5" fill={SOFT} />
      <line x1="58.5" y1="14" x2="58.5" y2="6" stroke={SOFT} strokeWidth="2" strokeLinecap="round" />
    </g>
    <circle cx="26" cy="46" r="8" fill="none" stroke={STROKE} strokeWidth="3" />
    <path d="M22 48 q4 3.5 8 0" stroke={STROKE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <line x1="26" y1="54" x2="26" y2="80" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    <line x1="26" y1="80" x2="18" y2="102" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    <line x1="26" y1="80" x2="34" y2="102" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    <line x1="42" y1="80" x2="140" y2="80" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    <line x1="54" y1="80" x2="46" y2="104" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    <line x1="128" y1="80" x2="136" y2="104" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    <rect x="96" y="72" width="34" height="8" rx="4" fill="none" stroke={SOFT} strokeWidth="2.5" />
    <g className="animate-iron svg-origin">
      <line x1="26" y1="62" x2="70" y2="70" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <path d="M64 78 L66 60 Q67 54 74 54 L86 54 Q92 54 92 60 L92 68 Q92 78 82 78 Z" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinejoin="round" />
      <line x1="71" y1="49" x2="85" y2="49" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
    </g>
    <circle cx="118" cy="62" r="2.5" fill="none" stroke={SOFT} strokeWidth="2" className="animate-steam svg-origin" />
    <circle cx="126" cy="58" r="2" fill="none" stroke={SOFT} strokeWidth="2" className="animate-steam svg-origin" style={{ animationDelay: "1s" }} />
  </svg>
);

const SceneLipat = () => (
  <svg viewBox="0 0 160 120" className="h-32 w-auto" aria-hidden="true">
    <g className="animate-stack svg-origin"><rect x="42" y="86" width="58" height="12" rx="6" fill="none" stroke={STROKE} strokeWidth="3" /></g>
    <g className="animate-stack svg-origin" style={{ animationDelay: "0.45s" }}><rect x="46" y="74" width="50" height="12" rx="6" fill="none" stroke={ACCENT} strokeWidth="3" /></g>
    <g className="animate-stack svg-origin" style={{ animationDelay: "0.9s" }}><rect x="50" y="62" width="42" height="12" rx="6" fill="none" stroke={STROKE} strokeWidth="3" /></g>
    <g className="animate-stack svg-origin" style={{ animationDelay: "1.35s" }}><rect x="54" y="50" width="34" height="12" rx="6" fill="none" stroke={ACCENT} strokeWidth="3" /></g>
    <g className="animate-bounce svg-origin" style={{ animationDuration: "2s" }}>
      <circle cx="126" cy="46" r="8" fill="none" stroke={STROKE} strokeWidth="3" />
      <path d="M122 48 q4 3.5 8 0" stroke={STROKE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="126" y1="54" x2="126" y2="78" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="126" y1="60" x2="137" y2="47" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="126" y1="60" x2="117" y2="66" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="126" y1="78" x2="119" y2="100" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
      <line x1="126" y1="78" x2="133" y2="100" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    </g>
    <path d="M28 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill={GOLD} className="animate-sparkle svg-origin" />
    <path d="M104 22 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill={SOFT} className="animate-sparkle svg-origin" style={{ animationDelay: "1.2s" }} />
    <line x1="8" y1="102" x2="152" y2="102" stroke={SOFT} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const STAR = "M0 -12 L3 -4 L12 -4 L5 2 L7.5 11 L0 5.5 L-7.5 11 L-5 2 L-12 -4 L-3 -4 Z";

const SceneBintang = () => (
  <svg viewBox="0 0 160 120" className="h-32 w-auto" aria-hidden="true">
    {[26, 53, 80, 107, 134].map((x, i) => (
      <g key={x} className="animate-star svg-origin" style={{ animationDelay: `${i * 0.35}s` }}>
        <path d={STAR} transform={`translate(${x}, 56)`} fill={GOLD} stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    ))}
    <line x1="30" y1="92" x2="130" y2="92" stroke={SOFT} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 8" />
    <path d="M18 26 l1.8 4.5 4.5 1.8 -4.5 1.8 -1.8 4.5 -1.8 -4.5 -4.5 -1.8 4.5 -1.8 z" fill={SOFT} className="animate-sparkle svg-origin" />
    <path d="M142 24 l1.8 4.5 4.5 1.8 -4.5 1.8 -1.8 4.5 -1.8 -4.5 -4.5 -1.8 4.5 -1.8 z" fill={GOLD} className="animate-sparkle svg-origin" style={{ animationDelay: "0.8s" }} />
  </svg>
);

const STEPS = [
  { id: "cuci", title: "Jalan ke Mesin Cuci", desc: "Cucian kotor dibawa masuk — waktunya mandi busa.", Svg: SceneCuci },
  { id: "kering", title: "Kering Sempurna", desc: "Di luar mendung & hujan pun, cucian tetap kering sempurna — anti apek.", Svg: SceneKering },
  { id: "setrika", title: "Setrika dengan Happy", desc: "Licin dan tegak, disetrika sambil senyum-senyum.", Svg: SceneSetrika },
  { id: "lipat", title: "Lipat Super Rapi", desc: "Hasilnya tumpukan rapi, siap langsung masuk lemari.", Svg: SceneLipat },
  { id: "bintang", title: "Bintang 5 Darimu", desc: "Kering sempurna, rapi, wangi — pantas dapat bintang 5.", Svg: SceneBintang },
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
            Ikuti perjalanan cucianmu — <em className="text-[#7E22CE]">dari keranjang sampai bintang 5.</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#645B72] leading-relaxed">
            Cukup satu chat WhatsApp — cucianmu kami jemput, cuci, keringkan, setrika, dan lipat
            sampai rapi. Kamu tinggal menikmati harimu.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5">
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
