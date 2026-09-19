const ITEMS = [
  "WANGI MEWAH TAHAN LAMA",
  "EXPRESS 6 JAM SELESAI",
  "ANTAR JEMPUT RADIUS 5 KM",
  "GARANSI CUCI ULANG JIKA BAU APEK",
  "PANTAU STATUS VIA NOTA ONLINE",
  "PULOMAS · UJUNGBERUNG · KALIMULYA",
];

export default function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative bg-[#581C87] text-white overflow-hidden py-4 border-y border-purple-400/30">
      <div className="animate-marquee flex whitespace-nowrap w-max">
        {row.map((t, i) => (
          <span key={i} className="flex items-center">
            <span className="font-display italic text-lg sm:text-xl px-6">{t}</span>
            <span className="text-[#D8B4FE] text-xs">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
