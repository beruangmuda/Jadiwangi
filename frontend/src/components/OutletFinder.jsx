import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, MapPin, Navigation, Truck } from "lucide-react";
import { OUTLETS, deliveryFee, haversineKm, rp, waLink } from "@/data/laundry";
import OpenBadge from "@/components/OpenBadge";

export default function OutletFinder({ outletId, onSelect }) {
  const [status, setStatus] = useState("idle"); // idle | locating | done | denied
  const [dists, setDists] = useState({});

  const detect = () => {
    if (!navigator.geolocation) {
      setStatus("denied");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = {};
        OUTLETS.forEach((o) => {
          d[o.id] = haversineKm(pos.coords.latitude, pos.coords.longitude, o.lat, o.lng);
        });
        setDists(d);
        const nearest = OUTLETS.reduce((a, b) => (d[a.id] <= d[b.id] ? a : b));
        onSelect(nearest.id);
        setStatus("done");
      },
      () => setStatus("denied"),
      { timeout: 12000, maximumAge: 300000 }
    );
  };

  const nearestId = Object.keys(dists).length
    ? OUTLETS.reduce((a, b) => (dists[a.id] <= dists[b.id] ? a : b)).id
    : null;

  return (
    <section id="outlet" className="relative py-24 lg:py-36 overflow-hidden">
      <div className="absolute top-0 right-0 w-[28rem] h-[28rem] rounded-full bg-[#E9D5FF]/60 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mb-12"
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            Outlet & Jarak
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329] leading-[1.12]">
            Deteksi lokasimu, kami hitung <em className="text-[#7E22CE]">jarak & ongkirnya.</em>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#645B72] leading-relaxed">
            Antar jemput radius 5 KM dari outlet. Ongkir Rp 10.000 (0–2 km) · Rp 15.000 (3–5 km).
          </p>
        </motion.div>

        <div className="flex flex-wrap items-center gap-4 mb-10">
          <button
            data-testid="btn-detect-user-location"
            onClick={detect}
            disabled={status === "locating"}
            className="inline-flex items-center gap-2.5 bg-[#7E22CE] hover:bg-[#581C87] disabled:opacity-70 text-white font-semibold px-7 py-3.5 rounded-full transition-colors duration-300 shadow-[0_12px_30px_rgba(126,34,206,0.3)]"
          >
            {status === "locating" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Navigation className="w-5 h-5" />
            )}
            {status === "locating" ? "Mendeteksi Lokasi..." : "Deteksi Lokasi Saya"}
          </button>
          {status === "denied" && (
            <p data-testid="location-denied-msg" className="text-sm text-[#645B72]">
              Lokasi tidak terdeteksi — pilih outletmu manual di bawah ini.
            </p>
          )}
          {status === "done" && nearestId && (
            <p data-testid="location-success-msg" className="text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2">
              Outlet terdekatmu: {OUTLETS.find((o) => o.id === nearestId).label}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {OUTLETS.map((o, i) => {
            const dist = dists[o.id];
            const fee = deliveryFee(dist);
            const selected = outletId === o.id;
            const isNearest = nearestId === o.id;
            return (
              <motion.article
                key={o.id}
                data-testid={`outlet-card-${o.id}`}
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={`relative rounded-3xl p-7 border bg-white/95 transition-all duration-300 ${
                  selected
                    ? "border-[#7E22CE] ring-2 ring-[#7E22CE]/30 shadow-[0_16px_45px_rgba(126,34,206,0.18)]"
                    : "border-purple-100 shadow-[0_4px_25px_rgba(126,34,206,0.06)] hover:border-purple-300"
                }`}
              >
                {isNearest && (
                  <span className="absolute -top-3 left-6 inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-[#7E22CE] text-white">
                    Terdekat darimu
                  </span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl tracking-tight text-[#1E1329]">{o.name}</h3>
                    <p className="text-sm text-[#645B72] mt-0.5">{o.region}</p>
                    <p className="text-xs text-[#645B72] mt-1.5 leading-relaxed">{o.address}</p>
                  </div>
                  <MapPin className={`w-6 h-6 shrink-0 ${selected ? "text-[#7E22CE]" : "text-purple-300"}`} />
                </div>

                <div className="mt-5 space-y-2.5 text-sm">
                  <OpenBadge hours={o.hours} testId={`outlet-hours-${o.id}`} />
                  {dist != null && (
                    <p data-testid={`outlet-distance-${o.id}`} className="font-semibold text-[#1E1329]">
                      Jarak dari lokasimu: ± {dist.toFixed(1)} km
                    </p>
                  )}
                  {fee != null && (
                    <p
                      data-testid={`outlet-ongkir-${o.id}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        fee === -1
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-purple-50 text-[#581C87] border border-purple-200"
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      {fee === -1
                        ? "Di luar radius antar jemput (5 km)"
                        : `Ongkir antar jemput ${rp(fee)}`}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-2.5">
                  <button
                    data-testid={`outlet-select-${o.id}`}
                    onClick={() => onSelect(o.id)}
                    className={`flex-1 min-w-[8rem] px-4 py-2.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                      selected
                        ? "bg-[#7E22CE] text-white"
                        : "bg-purple-50 text-[#581C87] hover:bg-purple-100 border border-purple-200"
                    }`}
                  >
                    {selected ? "Outlet Terpilih" : "Pilih Outlet Ini"}
                  </button>
                  <a
                    data-testid={`outlet-maps-${o.id}`}
                    href={o.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Buka ${o.label} di Google Maps`}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-purple-200 text-[#7E22CE] hover:bg-purple-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </motion.article>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-8 text-center"
        >
          <a
            data-testid="outlet-wa-order-btn"
            href={waLink(`Halo Jadiwangi Laundry! Saya mau order antar jemput untuk outlet ${OUTLETS.find((o) => o.id === outletId).label}. Mohon info penjemputannya ya kak.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1eb856] text-white font-semibold px-8 py-4 rounded-full transition-colors duration-300 shadow-[0_12px_30px_rgba(37,211,102,0.3)]"
          >
            <Navigation className="w-5 h-5" />
            Jemput Laundry Saya Sekarang
          </a>
        </motion.div>
      </div>
    </section>
  );
}
