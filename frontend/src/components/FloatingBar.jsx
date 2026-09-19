import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { getOutlet, waLink } from "@/data/laundry";

export default function FloatingBar({ outletId }) {
  const [show, setShow] = useState(false);
  const outlet = getOutlet(outletId);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 650);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          data-testid="floating-order-bar"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-5 inset-x-4 sm:inset-x-auto sm:right-6 z-50 flex items-center gap-3 backdrop-blur-2xl bg-white/90 border border-purple-200/80 shadow-[0_10px_35px_rgba(88,28,135,0.18)] rounded-full pl-5 pr-2 py-2"
        >
          <span className="text-xs sm:text-sm font-medium text-[#581C87]">
            Outlet: <strong>{outlet.label}</strong>
          </span>
          <a
            data-testid="floating-order-wa-btn"
            href={waLink(`Halo Jadiwangi Laundry! Saya mau order untuk outlet ${outlet.label}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#7E22CE] hover:bg-[#581C87] text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors duration-300"
          >
            <MessageCircle className="w-4 h-4" />
            Order Sekarang
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
