import { useRef } from "react";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { MapPin, MessageCircle, Sparkles, Star, Truck, WashingMachine } from "lucide-react";
import { HERO_IMG, LOGO_URL, trackEvent, waLink } from "@/data/laundry";

const LINES = [
  { text: "Laundry Sebersih Sutra,", italic: false },
  { text: "Sewangi Parfum", italic: false, accent: "Prancis." },
];

const CHIPS = [
  { icon: WashingMachine, label: "Cuci Satuan & Kiloan" },
  { icon: Truck, label: "Antar Jemput Radius 5 KM" },
  { icon: Star, label: "Ulasan Bintang 5" },
  { icon: Sparkles, label: "#BESOKSUDAHWANGI" },
];

const reveal = {
  hidden: { y: "115%" },
  show: (i) => ({
    y: "0%",
    transition: { delay: 0.35 + i * 0.16, duration: 1.05, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Hero({ onNavigate }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const mistY = useTransform(scrollYProgress, [0, 1], [0, -70]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 120, damping: 18 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 18 });

  const onMouseMove = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <section
      id="beranda"
      ref={ref}
      onMouseMove={onMouseMove}
      className="hero-grain relative min-h-screen flex items-center overflow-hidden pt-[100px]"
    >
      <div className="absolute -top-32 -right-40 w-[36rem] h-[36rem] rounded-full bg-[#E9D5FF] blur-3xl opacity-70" />
      <div className="absolute top-1/2 -left-48 w-[30rem] h-[30rem] rounded-full bg-[#F3E8FF] blur-3xl opacity-80" />
      <motion.div style={{ y: mistY }} className="absolute bottom-10 right-1/4 w-72 h-72 rounded-full bg-[#D8B4FE]/40 blur-3xl" />
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute -bottom-6 left-0 font-display font-semibold text-[19vw] leading-none text-stroke-lavender opacity-60 whitespace-nowrap z-0"
      >
        JADIWANGI
      </div>

      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 py-20 lg:py-28 grid lg:grid-cols-12 gap-14 lg:gap-8 items-center w-full">
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-purple-200 shadow-sm mb-8"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#7E22CE]" />
            <span className="text-xs font-mono-accent tracking-[0.18em] uppercase text-[#581C87]">
              3 Outlet — Jakarta · Bandung · Depok
            </span>
          </motion.div>

          <img src={LOGO_URL} alt="Jadiwangi Laundry" className="h-24 w-auto mb-7 opacity-95 -ml-2" />

          <h1 className="font-display font-medium text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.08] text-[#1E1329]">
            {LINES.map((line, i) => (
              <span key={i} className="block overflow-hidden pb-1">
                <motion.span
                  className="block"
                  custom={i}
                  variants={reveal}
                  initial="hidden"
                  animate="show"
                >
                  {line.text}
                  {line.accent && (
                    <>
                      {" "}
                      <em className="text-[#7E22CE]">{line.accent}</em>
                    </>
                  )}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#645B72]"
          >
            Masuk sebelum jam 10 pagi, sorenya sudah rapi dan siap diambil — pas banget
            sepulang kantor. Pakaian keluargamu dirawat layaknya gaun adibusana, lengkap
            dengan garansi cuci ulang gratis dan antar jemput sampai depan rumah.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <button
              data-testid="hero-btn-find-outlet"
              onClick={(e) => onNavigate(e, "#outlet")}
              className="group inline-flex items-center gap-2.5 bg-[#7E22CE] hover:bg-[#581C87] text-white font-semibold px-7 py-3.5 rounded-full transition-colors duration-300 shadow-[0_12px_30px_rgba(126,34,206,0.3)]"
            >
              <MapPin className="w-4.5 h-4.5 w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-300" />
              Cari Outlet Terdekat
            </button>
            <a
              data-testid="hero-btn-order-wa"
              onClick={() => trackEvent("wa_click")}
              href={waLink("Halo Jadiwangi Laundry! Saya mau pesan layanan antar jemput laundry.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-white hover:bg-purple-50 text-[#581C87] font-semibold px-7 py-3.5 rounded-full border border-purple-200 transition-colors duration-300"
            >
              <MessageCircle className="w-5 h-5" />
              Pesan Antar Jemput
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.25, duration: 1 }}
            className="mt-10 flex flex-wrap gap-3"
          >
            {CHIPS.map((c, i) => (
              <span
                key={c.label}
                data-testid={`hero-chip-${i}`}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/80 border border-purple-100 text-[#581C87]"
              >
                <c.icon className="w-3.5 h-3.5 text-[#7E22CE]" />
                {c.label}
              </span>
            ))}
          </motion.div>
        </div>

        <div className="lg:col-span-5 relative" style={{ perspective: 1100 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
            className="relative"
          >
            <motion.div style={{ y: imgY }} className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-[0_30px_70px_rgba(88,28,135,0.28)]">
              <img
                src={HERO_IMG}
                alt="Perawatan linen premium Jadiwangi Laundry"
                className="w-full h-[26rem] lg:h-[30rem] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#581C87]/35 via-transparent to-transparent" />
            </motion.div>
            <div
              className="absolute -bottom-6 -left-6 bg-white rounded-2xl border border-purple-100 shadow-[0_15px_40px_rgba(88,28,135,0.18)] px-5 py-4 animate-float-soft"
              style={{ transform: "translateZ(50px)" }}
            >
              <p className="text-xs font-mono-accent tracking-widest uppercase text-[#7E22CE]">Express</p>
              <p className="font-display text-2xl text-[#1E1329]">Masuk Pagi, Ambil Sore</p>
            </div>
            <div
              className="absolute -top-5 -right-4 bg-[#581C87] text-white rounded-2xl shadow-[0_15px_40px_rgba(88,28,135,0.35)] px-5 py-4 animate-float-soft"
              style={{ transform: "translateZ(70px)", animationDelay: "1.4s" }}
            >
              <p className="text-xs font-mono-accent tracking-widest uppercase text-purple-200">Garansi</p>
              <p className="font-display text-2xl">Cuci Ulang Gratis</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
