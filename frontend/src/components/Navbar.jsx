import { MessageCircle, Tag } from "lucide-react";
import { LOGO_URL, PROMO, getOutlet, trackEvent, waLink } from "@/data/laundry";

const LINKS = [
  { href: "#keunggulan", label: "Keunggulan" },
  { href: "#proses", label: "Cara Kerja" },
  { href: "#layanan", label: "Layanan" },
  { href: "#outlet", label: "Outlet & Jarak" },
  { href: "#kalkulator", label: "Kalkulator" },
  { href: "#pricelist", label: "Pricelist" },
  { href: "#ulasan", label: "Ulasan" },
  { href: "#kemitraan", label: "Kemitraan", highlight: true },
];

export default function Navbar({ outletId, onNavigate }) {
  const outlet = getOutlet(outletId);
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      {PROMO.active && (
        <a
          data-testid="promo-strip"
          href={waLink(PROMO.waMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-[#7E22CE] to-[#581C87] text-white px-4 py-2 text-xs sm:text-sm hover:from-[#6B21A8] hover:to-[#4C1D95] transition-colors duration-300"
        >
          <Tag className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono-accent uppercase tracking-widest text-[10px] sm:text-xs text-purple-200">{PROMO.badge}</span>
          <span className="hidden md:inline font-medium">{PROMO.text}</span>
          <span className="font-semibold underline underline-offset-2 whitespace-nowrap">{PROMO.cta}</span>
        </a>
      )}
      <div className="backdrop-blur-xl bg-white/85 border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between gap-4">
        <a
          href="#beranda"
          data-testid="navbar-brand-logo"
          onClick={(e) => onNavigate(e, "#beranda")}
          className="flex items-center gap-2.5 shrink-0"
        >
          <img src={LOGO_URL} alt="Jadiwangi Laundry" className="h-11 w-auto" />
        </a>
        <nav className="hidden lg:flex items-center gap-7">
          {LINKS.map((l) =>
            l.highlight ? (
              <a
                key={l.href}
                href={l.href}
                data-testid="navbar-kemitraan-highlight"
                onClick={(e) => onNavigate(e, l.href)}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E1329] bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 px-4 py-2 rounded-full shadow-[0_6px_20px_rgba(245,158,11,0.35)] transition-all duration-300 hover:-translate-y-0.5"
              >
                {l.label}
              </a>
            ) : (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => onNavigate(e, l.href)}
                className="text-sm font-medium text-[#645B72] hover:text-[#7E22CE] transition-colors duration-200"
              >
                {l.label}
              </a>
            )
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span
            data-testid="navbar-outlet-select"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono-accent bg-purple-50 text-[#581C87] border border-purple-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {outlet.label}
          </span>
          <a
            data-testid="navbar-whatsapp-cta"
            onClick={() => trackEvent("wa_click", outletId)}
            href={waLink(`Halo Jadiwangi Laundry! Saya mau tanya-tanya dulu untuk outlet ${outlet.label}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#7E22CE] hover:bg-[#6B21A8] text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-colors duration-200 animate-pulse-glow"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Order via WA</span>
            <span className="sm:hidden">WA</span>
          </a>
        </div>
        </div>
      </div>
    </header>
  );
}
