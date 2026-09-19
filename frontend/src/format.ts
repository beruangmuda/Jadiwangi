export function rupiah(n: number | undefined | null): string {
  const v = Math.round(Number(n || 0));
  return "Rp" + v.toLocaleString("id-ID");
}

export function rupiahShort(n: number | undefined | null): string {
  const v = Number(n || 0);
  if (v >= 1_000_000_000) return "Rp" + (v / 1_000_000_000).toFixed(1).replace(".", ",") + "M";
  if (v >= 1_000_000) return "Rp" + (v / 1_000_000).toFixed(1).replace(".", ",") + "jt";
  if (v >= 1_000) return "Rp" + Math.round(v / 1_000) + "rb";
  return "Rp" + Math.round(v);
}

export function kg(n: number | undefined | null): string {
  const v = Number(n || 0);
  return (Number.isInteger(v) ? v.toString() : v.toFixed(1)) + " kg";
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeLeft(iso: string | undefined | null): string {
  if (!iso) return "-";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const label = h >= 24 ? `${Math.floor(h / 24)}h ${h % 24}j` : `${h}j ${m}m`;
  return diff < 0 ? `Telat ${label}` : `${label} lagi`;
}
