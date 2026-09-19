import { motion } from "framer-motion";
import { Bike, ShieldPlus, TrainFront, Wind } from "lucide-react";
import { DETTOL_LOGO, IMG_DETTOL_POUR, rp } from "@/data/laundry";

const IMG_COMMUTE =
  "https://images.pexels.com/photos/36978293/pexels-photo-36978293.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const RISKS = [
  { icon: Wind, text: "Asap kendaraan dan polusi jalanan yang menempel saat naik ojek online" },
  { icon: TrainFront, text: "Pegangan & sandaran gerbong KRL yang tak pernah berhenti disentuh" },
  { icon: Bike, text: "Debu, polusi, dan keringat jalanan saat naik motor" },
];

export default function Antiseptik({ onNavigate }) {
  return (
    <section id="antiseptik" data-testid="antiseptik-section" className="relative py-24 lg:py-36 overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#E9D5FF]/60 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="rounded-[2rem] overflow-hidden border-4 border-white shadow-[0_25px_60px_rgba(88,28,135,0.22)]">
            <img
              data-testid="antiseptik-img"
              src={IMG_COMMUTE}
              alt="Padatnya transportasi umum harian — virus dan bakteri mudah menempel di pakaian"
              loading="lazy"
              className="w-full h-[22rem] lg:h-[26rem] object-cover"
            />
          </div>
          <div className="absolute -bottom-8 -right-2 sm:-right-5 w-32 sm:w-40 rotate-3 rounded-2xl overflow-hidden border-4 border-white shadow-[0_15px_40px_rgba(88,28,135,0.3)] bg-white">
            <img
              data-testid="antiseptik-pour-img"
              src={IMG_DETTOL_POUR}
              alt="Staff menuang antiseptik Dettol asli ke mesin cuci di outlet Jadiwangi"
              loading="lazy"
              className="w-full h-28 sm:h-32 object-cover"
            />
            <p className="bg-white text-[10px] font-mono-accent tracking-wide text-[#581C87] px-2 py-1.5 text-center">
              Dettol asli, dituang di outlet
            </p>
          </div>
          <div className="absolute -bottom-5 left-6 bg-[#581C87] text-white rounded-2xl shadow-[0_15px_40px_rgba(88,28,135,0.35)] px-5 py-4 animate-float-soft">
            <p className="text-xs font-mono-accent tracking-widest uppercase text-purple-200">Risiko tak terlihat</p>
            <p className="font-display text-xl lg:text-2xl">Kuman menempel di serat kain</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Perlindungan Ekstra
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Seharian di jalan, <em className="text-[#7E22CE]">virus & bakteri ikut pulang.</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#645B72] leading-relaxed">
            Naik Gojek, KRL, atau motor — pakaianmu bersentuhan dengan ribuan permukaan dan orang
            sepanjang hari. Kuman yang menempel di kain bisa terbawa ke rumah, ke sofa, sampai ke
            pelukan anak.
          </p>

          <ul className="mt-7 space-y-4">
            {RISKS.map((r) => (
              <li key={r.text} className="flex items-start gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                  <r.icon className="w-5 h-5 text-[#7E22CE]" />
                </span>
                <span className="text-sm sm:text-base text-[#1E1329] leading-relaxed pt-2">{r.text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 bg-white rounded-3xl border border-purple-100 shadow-[0_4px_25px_rgba(126,34,206,0.06)] p-6 lg:p-7">
            <div className="flex items-start gap-4">
              <span className="h-12 rounded-xl bg-white border border-purple-100 shadow-sm flex items-center justify-center shrink-0 px-2">
                <img data-testid="dettol-logo" src={DETTOL_LOGO} alt="Logo Dettol Antiseptik" className="h-9 w-auto" />
              </span>
              <div>
                <h3 className="font-display text-xl lg:text-2xl text-[#1E1329]">
                  Add-on Antiseptik Dettol
                </h3>
                <p className="mt-1.5 text-sm sm:text-base text-[#645B72] leading-relaxed">
                  Setiap cucian direndam antiseptik Dettol untuk membunuh kuman, virus, dan bakteri
                  penyebab bau — pakaian kembali ke rumah dalam keadaan bersih <em>dan</em> terlindungi.
                </p>
                <p className="mt-3 text-xs font-mono-accent tracking-wide text-[#581C87]">
                  +{rp(1000)}/kg (Pulomas & Kalimulya) · +{rp(2000)}/kg (Ujungberung)
                </p>
              </div>
            </div>
            <button
              data-testid="antiseptik-cta-calc"
              onClick={(e) => onNavigate(e, "#kalkulator")}
              className="mt-5 w-full inline-flex items-center justify-center gap-2.5 bg-[#7E22CE] hover:bg-[#581C87] text-white font-semibold px-6 py-3.5 rounded-full transition-colors duration-300"
            >
              <ShieldPlus className="w-5 h-5" />
              Tambahkan Dettol di Kalkulator
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
