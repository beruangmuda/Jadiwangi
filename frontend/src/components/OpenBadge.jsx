import { useEffect, useState } from "react";
import { isOpenNow } from "@/data/laundry";

export default function OpenBadge({ hours, testId }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const open = isOpenNow();
  return (
    <p
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        open
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
      {open ? `Buka Sekarang · ${hours}` : "Tutup · Buka lagi pukul 07.00 WIB"}
    </p>
  );
}
