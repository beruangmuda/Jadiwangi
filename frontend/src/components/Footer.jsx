import { motion } from "framer-motion";
import { Clock, Instagram, Lock, MapPin, MessageCircle } from "lucide-react";
import { IG_URL, LOGO_URL, OUTLETS, WA_DISPLAY, trackEvent, waLink } from "@/data/laundry";

export default function Footer() {
  return (
    <footer className="relative bg-[#1E1329] text-white overflow-hidden">
      <div className="absolute -top-32 left-1/3 w-[30rem] h-[30rem] rounded-full bg-[#7E22CE]/25 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 pt-24 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.1]">
            Pakaian bersih, pikiran tenang,
            <em className="text-[#D8B4FE]"> harum sepanjang hari.</em>
          </h2>
          <a
            data-testid="footer-cta-wa"
            onClick={() => trackEvent("wa_click")}
            href={waLink("Halo Jadiwangi Laundry! Saya mau order laundry. Mohon dibantu ya kak.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-9 inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1eb856] text-white font-semibold px-9 py-4 rounded-full transition-colors duration-300 shadow-[0_12px_35px_rgba(37,211,102,0.35)]"
          >
            <MessageCircle className="w-5 h-5" />
            Chat WhatsApp — {WA_DISPLAY}
          </a>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-10 border-t border-white/10 pt-12">
          <div>
            <span className="inline-flex items-center bg-white rounded-2xl px-4 py-2.5 mb-4">
              <img src={LOGO_URL} alt="Jadiwangi Laundry" className="h-12 w-auto" />
            </span>
            <p className="text-sm text-purple-200/80 leading-relaxed">
              Laundry kiloan & premium fabric care dengan garansi cuci ulang gratis.
            </p>
            <a
              data-testid="footer-instagram"
              href={IG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-purple-200 hover:text-white transition-colors"
            >
              <Instagram className="w-4 h-4" />
              @jadiwangilaundry
            </a>
          </div>
          {OUTLETS.map((o) => (
            <div key={o.id}>
              <h3 className="font-display text-xl text-white">{o.name}</h3>
              <p className="text-sm text-purple-200/80 mt-1">{o.region}</p>
              <p className="text-xs text-purple-200/60 mt-1.5 leading-relaxed">{o.address}</p>
              <div className="mt-4 space-y-2.5 text-sm text-purple-200/80">
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  {o.hours}
                </p>
                <a
                  data-testid={`footer-maps-${o.id}`}
                  href={o.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  Lihat di Google Maps
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-7 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-purple-200/60">
          <p>© {new Date().getFullYear()} Jadiwangi Laundry. Garansi Cuci Ulang Gratis.</p>
          <div className="flex items-center gap-5">
            <p className="font-mono-accent tracking-widest uppercase">Jakarta · Bandung · Depok</p>
            <a
              data-testid="footer-admin-login"
              href="/admin"
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Lock className="w-3 h-3" />
              Login Pengelola
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
