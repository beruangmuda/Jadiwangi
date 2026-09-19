import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";
import { OUTLETS, TESTIMONIALS, getOutlet } from "@/data/laundry";

const FILTERS = [{ id: "all", label: "Semua" }, ...OUTLETS.map((o) => ({ id: o.id, label: o.name }))];

export default function Testimonials() {
  const [filter, setFilter] = useState("all");
  const list = TESTIMONIALS.filter((t) => filter === "all" || t.outlet === filter);

  return (
    <section id="ulasan" className="relative py-24 lg:py-36 bg-[#F3EBF9] overflow-hidden">
      <div className="absolute -top-24 right-0 w-96 h-96 rounded-full bg-[#E9D5FF]/70 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-10"
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Ulasan Google Maps
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Kata mereka yang sudah <em className="text-[#7E22CE]">wangi duluan.</em>
          </h2>
          <div className="mt-5 inline-flex items-center gap-2 bg-white rounded-full border border-purple-200 px-4 py-2">
            <span className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
              ))}
            </span>
            <span className="text-sm font-semibold text-[#1E1329]">Ulasan asli bintang 5 · tertaut ke Google Maps</span>
          </div>
        </motion.div>

        <div className="flex flex-wrap gap-2.5 mb-10">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              data-testid={f.id === "all" ? "reviews-filter-all" : `reviews-filter-${f.id}`}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                filter === f.id
                  ? "bg-[#7E22CE] text-white shadow-[0_8px_25px_rgba(126,34,206,0.3)]"
                  : "bg-white text-[#581C87] border border-purple-200 hover:border-[#7E22CE]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {list.map((t) => (
              <motion.figure
                layout
                key={t.name}
                data-testid={`review-card-${t.name.toLowerCase().replace(/\s+/g, "-")}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white rounded-3xl border border-purple-100 p-7 shadow-[0_4px_25px_rgba(126,34,206,0.06)]"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                    ))}
                  </span>
                  <a
                    href={t.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`review-link-${t.name.toLowerCase().replace(/\s+/g, "-")}`}
                    className="text-[10px] font-mono-accent uppercase tracking-wider text-[#645B72] hover:text-[#7E22CE] transition-colors"
                  >
                    Google Maps · {t.time} ↗
                  </a>
                </div>
                <blockquote className="text-sm sm:text-base text-[#1E1329] leading-relaxed">
                  “{t.text}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7E22CE] to-[#4C1D95] text-white flex items-center justify-center font-display text-lg">
                    {t.name[0]}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1E1329]">{t.name}</p>
                    <p className="text-xs text-[#645B72]">Outlet {getOutlet(t.outlet).label}</p>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </AnimatePresence>
          {list.length === 0 && (
            <div data-testid="reviews-empty-state" className="col-span-full bg-white rounded-3xl border border-dashed border-purple-300 p-10 text-center">
              <p className="text-sm sm:text-base text-[#645B72]">
                Ulasan outlet ini belum ditampilkan di sini.
              </p>
              <a
                data-testid="reviews-empty-maps-link"
                href={getOutlet(filter).mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#7E22CE] hover:text-[#581C87] transition-colors"
              >
                Lihat ulasan {getOutlet(filter).label} di Google Maps ↗
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
