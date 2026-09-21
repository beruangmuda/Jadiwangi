type ReceiptData = {
  phone?: string;
  code: string;
  customerName: string;
  date?: string;
  itemLines: string[];
  total: string;
  payment: string;
  status: string;
};

export function normalizeWhatsAppPhone(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function buildReceiptWhatsAppUrl(data: ReceiptData) {
  const phone = normalizeWhatsAppPhone(data.phone);
  if (!phone) return null;
  const lines = [
    "*Jadiwangi Laundry*",
    `Struk ${data.code}`,
    "",
    `Pelanggan: ${data.customerName}`,
    ...(data.date ? [`Tanggal: ${data.date}`] : []),
    "",
    "*Rincian Laundry*",
    ...(data.itemLines.length ? data.itemLines : ["Rincian sedang diproses"]),
    "",
    `Total: *${data.total}*`,
    `Pembayaran: ${data.payment}`,
    `Status: ${data.status}`,
    "",
    "Terima kasih telah mempercayakan laundry Anda kepada Jadiwangi Laundry.",
  ];
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}