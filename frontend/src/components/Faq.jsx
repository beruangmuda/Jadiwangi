import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Berapa minimal order laundry kiloan?",
    a: "Tergantung outlet & layanan: mulai 3 kg (Ujungberung), 4 kg (Kalimulya Depok), dan 5 kg (Pulomas) untuk Cuci Kering Setrika. Detail minimal tiap layanan bisa dilihat di bagian pricelist.",
  },
  {
    q: "Bagaimana layanan antar jemputnya?",
    a: "Kurir kami menjemput dan mengantar cucianmu sampai depan rumah dalam radius maksimal 5 km dari outlet. Ongkirnya flat dan jujur: Rp 10.000 untuk jarak 0–2 km dan Rp 15.000 untuk 3–5 km. Order langsung lewat WhatsApp dan kurir kami meluncur.",
  },
  {
    q: "Kalau pakaian masih bau apek, bagaimana?",
    a: "Kami beri garansi cuci ulang gratis. Cukup laporkan maksimal 1 hari dari tanggal nota pengambilan, dan cucianmu kami proses ulang tanpa biaya.",
  },
  {
    q: "Bisa pantau status cucian saya?",
    a: "Bisa. Setiap order mendapat nota (via WhatsApp/kertas) berisi link untuk memantau status pakaianmu. Kalau kamu tidak menerima nota dari staff kami, kamu berhak mendapat cuci gratis.",
  },
  {
    q: "Pakaian putih atau branded aman dicuci di sini?",
    a: "Aman. Kami sangat menyarankan layanan cuci satuan untuk pakaian mudah luntur, putih, branded, atau mahal agar terawat dan lebih tahan lama. Kamu juga bisa minta staff menghitung pakaian di awal.",
  },
  {
    q: "Ada layanan express?",
    a: "Ada. Hampir semua layanan tersedia versi Express 6 Jam — dari kiloan, kemeja, dress, sampai bed cover. Tipsnya: order express yang masuk sebelum jam 10 pagi bisa diambil sore hari, pas banget dijemput sepulang kantor.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="relative py-24 lg:py-32">
      <div className="max-w-3xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12"
        >
          <p className="text-xs font-mono-accent uppercase tracking-[0.25em] text-[#7E22CE] font-semibold mb-4">
            FAQ
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#1E1329]">
            Masih <em className="text-[#7E22CE]">penasaran?</em>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                data-testid={`faq-item-${i}`}
                className="bg-white rounded-2xl border border-purple-100 px-6 shadow-[0_4px_20px_rgba(126,34,206,0.05)] data-[state=open]:border-[#7E22CE]/40"
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-semibold text-[#1E1329] hover:text-[#7E22CE] hover:no-underline py-5">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-[#645B72] leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
