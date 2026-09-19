import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, Send } from "lucide-react";
import { OUTLETS, deliveryFee, getOutlet, rp, waLink } from "@/data/laundry";

export default function Calculator({ outletId }) {
  const [calcOutlet, setCalcOutlet] = useState(outletId);
  const [serviceKey, setServiceKey] = useState("kiloan-0-reg");
  const [qty, setQty] = useState(5);
  const [dettol, setDettol] = useState(false);
  const [km, setKm] = useState(1.5);

  const outlet = getOutlet(calcOutlet);

  const options = useMemo(() => {
    const opts = [];
    outlet.kiloan.forEach((k, i) => {
      opts.push({ key: `kiloan-${i}-reg`, group: "Kiloan", label: `${k.name} — Reguler ${k.regTime} (min. ${k.min} kg)`, unit: "kg", price: k.reg, min: k.min });
      opts.push({ key: `kiloan-${i}-exp`, group: "Kiloan", label: `${k.name} — Express ${k.expTime} (min. ${k.min} kg)`, unit: "kg", price: k.exp, min: k.min });
    });
    outlet.premium.forEach((cat) => {
      cat.items.forEach((it) => {
        const price = it.price ?? it.reg;
        if (price == null) return;
        opts.push({
          key: `prem-${cat.title}-${it.name}`,
          group: cat.title,
          label: `${it.name}${it.duration || cat.duration ? ` (${it.duration || cat.duration})` : ""}`,
          unit: cat.unit === "/ m" ? "meter" : "pcs",
          price,
          min: 1,
        });
      });
    });
    return opts;
  }, [outlet]);

  const opt = options.find((o) => o.key === serviceKey) || options[0];
  const effQty = Math.max(qty, opt.min);
  const subtotal = opt.price * effQty + (dettol && opt.unit === "kg" ? outlet.dettolKiloan * effQty : 0);
  const fee = deliveryFee(km);
  const ongkir = fee === -1 ? 0 : fee;
  const total = subtotal + ongkir;

  const message = [
    "Halo Jadiwangi Laundry! Saya mau order:",
    `• Outlet: ${outlet.label}`,
    `• Layanan: ${opt.label}`,
    `• Jumlah: ${effQty} ${opt.unit}${dettol && opt.unit === "kg" ? " + Dettol" : ""}`,
    `• Estimasi jarak antar jemput: ${km} km`,
    `• Estimasi total: ${rp(total)}${fee === -1 ? " (di luar radius 5 km, mohon info ongkir)" : ""}`,
    "Mohon info penjemputan ke alamat saya ya kak. Terima kasih!",
  ].join("\n");

  const selectCls =
    "w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm text-[#1E1329] focus:outline-none focus:ring-2 focus:ring-[#7E22CE]/40 focus:border-[#7E22CE] transition";

  return (
    <section id="kalkulator" className="relative py-24 lg:py-36 bg-[#F3EBF9] overflow-hidden">
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#E9D5FF]/70 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Kalkulator Estimasi
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Hitung dulu, <em className="text-[#7E22CE]">order kemudian.</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#645B72] leading-relaxed">
            Pilih outlet, layanan, dan jumlahnya — estimasi biaya & ongkir langsung muncul.
            Tinggal kirim format ordernya ke WhatsApp kami dalam satu klik.
          </p>

          <div className="mt-10 space-y-5">
            <div>
              <label htmlFor="calc-outlet" className="block text-xs font-mono-accent uppercase tracking-widest text-[#581C87] mb-2">Outlet</label>
              <select
                id="calc-outlet"
                data-testid="calc-outlet-select"
                value={calcOutlet}
                onChange={(e) => { setCalcOutlet(e.target.value); setServiceKey("kiloan-0-reg"); }}
                className={selectCls}
              >
                {OUTLETS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="calc-service" className="block text-xs font-mono-accent uppercase tracking-widest text-[#581C87] mb-2">Layanan</label>
              <select
                id="calc-service"
                data-testid="calc-service-select"
                value={opt.key}
                onChange={(e) => { setServiceKey(e.target.value); const o = options.find((x) => x.key === e.target.value); if (o) setQty(o.min); }}
                className={selectCls}
              >
                {[...new Set(options.map((o) => o.group))].map((g) => (
                  <optgroup key={g} label={g}>
                    {options.filter((o) => o.group === g).map((o) => (
                      <option key={o.key} value={o.key}>{o.label} — {rp(o.price)}/{o.unit === "kg" ? "kg" : o.unit === "meter" ? "m" : "pcs"}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-mono-accent uppercase tracking-widest text-[#581C87] mb-2">
                  Jumlah ({opt.unit})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    data-testid="calc-qty-minus"
                    onClick={() => setQty((q) => Math.max(opt.min, q - 1))}
                    className="w-10 h-10 rounded-full border border-purple-200 bg-white text-[#7E22CE] hover:bg-purple-50 flex items-center justify-center transition-colors"
                    aria-label="Kurangi jumlah"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    data-testid="calc-weight-input"
                    type="number"
                    min={opt.min}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value) || opt.min)}
                    className="w-full text-center bg-white border border-purple-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7E22CE]/40"
                  />
                  <button
                    data-testid="calc-qty-plus"
                    onClick={() => setQty((q) => q + 1)}
                    className="w-10 h-10 rounded-full border border-purple-200 bg-white text-[#7E22CE] hover:bg-purple-50 flex items-center justify-center transition-colors"
                    aria-label="Tambah jumlah"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="calc-distance" className="block text-xs font-mono-accent uppercase tracking-widest text-[#581C87] mb-2">
                  Jarak antar jemput: {km} km
                </label>
                <input
                  id="calc-distance"
                  data-testid="calc-distance-slider"
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={km}
                  onChange={(e) => setKm(Number(e.target.value))}
                  className="w-full accent-[#7E22CE] mt-3"
                />
                <p className="text-xs text-[#645B72] mt-1.5">&lt; 2 km gratis · maks. radius 5 km</p>
              </div>
            </div>

            {opt.unit === "kg" && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  data-testid="calc-dettol-toggle"
                  type="checkbox"
                  checked={dettol}
                  onChange={(e) => setDettol(e.target.checked)}
                  className="w-4.5 h-4.5 w-5 h-5 accent-[#7E22CE]"
                />
                <span className="text-sm text-[#1E1329]">
                  Tambah Dettol antiseptik <span className="text-[#645B72]">(+{rp(outlet.dettolKiloan)}/kg)</span>
                </span>
              </label>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="lg:sticky lg:top-24 bg-gradient-to-br from-[#7E22CE] to-[#4C1D95] text-white rounded-3xl border border-purple-400/30 shadow-[0_20px_50px_rgba(88,28,135,0.3)] p-8 lg:p-10"
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-purple-200">Estimasi Biaya</p>
          <h3 className="font-display text-2xl lg:text-3xl mt-2">{outlet.label}</h3>

          <dl className="mt-7 space-y-3.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-purple-200">Layanan</dt>
              <dd className="text-right font-medium max-w-[60%]">{opt.label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-purple-200">Subtotal {effQty} {opt.unit}</dt>
              <dd className="font-medium">{rp(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-purple-200">Ongkir antar jemput ({km} km)</dt>
              <dd className="font-medium" data-testid="calc-ongkir-display">
                {fee === -1 ? "Hubungi admin" : fee === 0 ? "GRATIS" : rp(fee)}
              </dd>
            </div>
            <div className="border-t border-white/20 pt-4 flex justify-between items-baseline gap-4">
              <dt className="text-purple-200">Total estimasi</dt>
              <dd data-testid="calc-total-display" className="font-display text-4xl">{rp(total)}</dd>
            </div>
          </dl>

          <a
            data-testid="calc-submit-wa-btn"
            href={waLink(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 w-full inline-flex items-center justify-center gap-2.5 bg-white text-[#581C87] font-semibold px-6 py-4 rounded-full hover:bg-purple-50 transition-colors duration-300"
          >
            <Send className="w-5 h-5" />
            Kirim Order via WhatsApp
          </a>
          <p className="mt-4 text-xs text-purple-200 leading-relaxed">
            Estimasi mengikuti pricelist resmi outlet. Berat akhir ditimbang bersama staff saat penjemputan.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
