import { useCallback, useEffect, useState } from "react";
import Lenis from "lenis";
import "@/App.css";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import Manifesto from "@/components/Manifesto";
import Services from "@/components/Services";
import OutletFinder from "@/components/OutletFinder";
import Calculator from "@/components/Calculator";
import Pricelist from "@/components/Pricelist";
import Testimonials from "@/components/Testimonials";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import FloatingBar from "@/components/FloatingBar";

export default function App() {
  const [outletId, setOutletId] = useState("pulomas");

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    window.__lenis = lenis;
    let raf;
    const loop = (t) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      window.__lenis = null;
    };
  }, []);

  const onNavigate = useCallback((e, hash) => {
    e.preventDefault();
    if (window.__lenis) window.__lenis.scrollTo(hash, { offset: -104 });
    else document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="bg-[#FAF7FD] text-[#1E1329] font-body antialiased overflow-x-clip">
      <Navbar outletId={outletId} onNavigate={onNavigate} />
      <main>
        <Hero onNavigate={onNavigate} />
        <Marquee />
        <Manifesto />
        <Services onNavigate={onNavigate} />
        <OutletFinder outletId={outletId} onSelect={setOutletId} />
        <Calculator outletId={outletId} />
        <Pricelist />
        <Testimonials />
        <Faq />
      </main>
      <Footer />
      <FloatingBar outletId={outletId} />
    </div>
  );
}
