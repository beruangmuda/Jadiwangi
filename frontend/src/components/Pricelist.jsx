import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileImage } from "lucide-react";
import { OUTLETS, rp } from "@/data/laundry";

export default function Pricelist() {
  const [tab, setTab] = useState("pulomas");
  const outlet = OUTLETS.find((o) => o.id === tab);

  return (
    <section id="pricelist" className="relative py-24 lg:py-36">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-12"
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Pricelist Transparan
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Harga jujur per outlet, <em className="text-[#7E22CE]">tanpa biaya tersembunyi.</em>
          </h2>
        </motion.div>

        <div className="flex flex-wrap gap-2.5 mb-10" role="tablist" aria-label="Pilih outlet">
          {OUTLETS.map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={tab === o.id}
              data-testid={`pricelist-tab-${o.id}`}
              onClick={() => setTab(o.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                tab === o.id
                  ? "bg-[#7E22CE] text-white shadow-[0_8px_25px_rgba(126,34,206,0.3)]"
                  : "bg-white text-[#581C87] border border-purple-200 hover:border-[#7E22CE]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="grid md:grid-cols-3 gap-5 mb-12">
              {outlet.kiloan.map((k) => (
                <div
                  key={k.name}
                  className="bg-gradient-to-br from-[#7E22CE] to-[#4C1D95] text-white rounded-3xl p-7 border border-purple-400/30 shadow-[0_15px_40px_rgba(88,28,135,0.22)]"
                >
                  <p className="text-xs font-mono-accent uppercase tracking-widest text-purple-200">
                    Kiloan · Min. {k.min} kg
                  </p>
                  <h3 className="font-display text-2xl mt-1.5">{k.name}</h3>
                  <div className="mt-5 space-y-3">
                    <div className="flex justify-between items-baseline border-b border-white/15 pb-3">
                      <span className="text-sm text-purple-200">Reguler · {k.regTime}</span>
                      <span className="font-semibold text-lg">{rp(k.reg)}<span className="text-xs text-purple-200">/kg</span></span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-purple-200">Express · {k.expTime}</span>
                      <span className="font-semibold text-lg">{rp(k.exp)}<span className="text-xs text-purple-200">/kg</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#645B72] -mt-6 mb-12">
              Add on Dettol antiseptik +{rp(outlet.dettolKiloan)}/kg untuk semua layanan kiloan.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {outlet.premium.map((cat) => (
                <div
                  key={cat.title}
                  className="bg-white/95 rounded-3xl border border-purple-100 shadow-[0_4px_25px_rgba(126,34,206,0.06)] hover:border-purple-300 hover:shadow-[0_12px_35px_rgba(126,34,206,0.12)] transition duration-300 p-7"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-4">
                    <h4 className="font-display text-xl text-[#1E1329]">{cat.title}</h4>
                    {cat.mode === "dual" ? (
                      <span className="text-[10px] font-mono-accent uppercase tracking-wider text-[#645B72] text-right">
                        2 hari | 6 jam
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono-accent uppercase tracking-wider text-[#645B72]">
                        {cat.duration || "Satuan"}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2.5">
                    {cat.items.map((it) => (
                      <li key={it.name} className="flex justify-between items-baseline gap-3 text-sm">
                        <span className="text-[#645B72]">{it.name}</span>
                        <span className="font-semibold text-[#1E1329] whitespace-nowrap">
                          {cat.mode === "dual" ? (
                            <>
                              {rp(it.reg)}
                              <span className="text-[#7E22CE]"> / {it.exp ? rp(it.exp) : "—"}</span>
                            </>
                          ) : (
                            <>
                              {rp(it.price)}
                              {cat.unit && <span className="text-xs text-[#645B72]"> {cat.unit}</span>}
                              {it.duration && <span className="text-xs text-[#645B72]"> · {it.duration}</span>}
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {cat.note && <p className="mt-4 text-xs italic text-[#7E22CE]">{cat.note}</p>}
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                data-testid={`pricelist-original-${outlet.id}`}
                href={outlet.pricelistImage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 bg-white hover:bg-purple-50 text-[#581C87] font-semibold px-6 py-3 rounded-full border border-purple-200 transition-colors duration-300 text-sm"
              >
                <FileImage className="w-4.5 h-4.5 w-5 h-5" />
                Lihat Pricelist Asli {outlet.name} (Gambar)
              </a>
              <p className="text-xs text-[#645B72]">
                Pakaian mudah luntur / putih / branded? Kami sarankan cuci satuan agar lebih tahan lama.
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
