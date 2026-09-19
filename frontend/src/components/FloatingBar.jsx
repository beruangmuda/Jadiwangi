import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GripVertical, MessageCircle } from "lucide-react";
import { PENGADUAN_MESSAGE, getOutlet, trackEvent, waLink } from "@/data/laundry";

export default function FloatingBar({ outletId }) {
  const [show, setShow] = useState(false);
  const constraintsRef = useRef(null);
  const outlet = getOutlet(outletId);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 650);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <div ref={constraintsRef} className="fixed inset-0 z-50 pointer-events-none">
          <motion.div
            data-testid="floating-order-bar"
            drag
            dragConstraints={constraintsRef}
            dragMomentum={false}
            dragElastic={0.08}
            whileDrag={{ scale: 1.05 }}
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto absolute bottom-5 inset-x-4 sm:inset-x-auto sm:right-6 flex items-center gap-2.5 backdrop-blur-2xl bg-white/90 border border-purple-200/80 shadow-[0_10px_35px_rgba(88,28,135,0.18)] rounded-full pl-3 pr-2 py-2 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4 text-purple-300 shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-[#581C87]">
            Outlet: <strong>{outlet.label}</strong>
          </span>
          <a
            data-testid="floating-pengaduan-link"
            href={waLink(PENGADUAN_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("pengaduan_click")}
            className="text-xs text-[#645B72] hover:text-[#7E22CE] underline underline-offset-2 decoration-purple-200 transition-colors whitespace-nowrap"
          >
            Pengaduan
          </a>
          <a
            data-testid="floating-order-wa-btn"
            onClick={() => trackEvent("wa_click", outletId)}
            href={waLink(`Halo Jadiwangi Laundry! Saya mau order untuk outlet ${outlet.label}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#7E22CE] hover:bg-[#581C87] text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors duration-300"
          >
            <MessageCircle className="w-4 h-4" />
            Order Sekarang
          </a>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
