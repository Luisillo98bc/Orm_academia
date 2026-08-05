"use client";

import { useEffect, useState, useCallback } from "react";
import { API_URL } from "@/lib/api";
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Megaphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface LandingAnnouncement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function LandingAnnouncements() {
  const [announcements, setAnnouncements] = useState<LandingAnnouncement[]>([]);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/communication/announcements/public`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAnnouncements(data || []))
      .catch(() => setAnnouncements([]));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > current ? 1 : -1);
      setCurrent(index);
    },
    [current]
  );

  const next = useCallback(() => {
    if (announcements.length <= 1) return;
    setDirection(1);
    setCurrent((prev) => (prev + 1) % announcements.length);
  }, [announcements.length]);

  const prev = useCallback(() => {
    if (announcements.length <= 1) return;
    setDirection(-1);
    setCurrent(
      (prev) => (prev - 1 + announcements.length) % announcements.length
    );
  }, [announcements.length]);

  // Auto-play
  useEffect(() => {
    if (isPaused || announcements.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [isPaused, next, announcements.length]);

  if (announcements.length === 0) return null;

  function resolveUrl(rawUrl: string = ""): string {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "/";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed === "cursos" || trimmed === "/cursos" || trimmed === "#cursos") return "/#cursos";
    if (trimmed === "beneficios" || trimmed === "/beneficios" || trimmed === "#beneficios") return "/#beneficios";
    if (trimmed === "contacto" || trimmed === "/contacto" || trimmed === "#contacto") return "/#contacto";
    if (trimmed === "faq" || trimmed === "/faq" || trimmed === "#faq") return "/#faq";
    if (trimmed === "catalog" || trimmed === "catalogo") return "/dashboard/catalog";
    if (trimmed.startsWith("/")) return trimmed;
    return `/${trimmed}`;
  }

  const slide = announcements[current];
  const targetUrl = slide ? resolveUrl(slide.ctaUrl) : "/";

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -200 : 200,
      opacity: 0,
    }),
  };

  return (
    <section
      className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative rounded-[2.5rem] bg-slate-950 border border-slate-800/80 shadow-2xl overflow-hidden p-6 sm:p-10 lg:p-12">
        {/* Background ambient lighting */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-primary/20 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative z-10">
          {/* Top Bar with Badge & Controls */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Anuncio Destacado</span>
            </div>

            {/* Slide Navigation Controls */}
            {announcements.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={prev}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center transition-all"
                  aria-label="Anuncio anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs font-medium text-slate-400 px-1">
                  {current + 1} / {announcements.length}
                </span>
                <button
                  onClick={next}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center transition-all"
                  aria-label="Siguiente anuncio"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Slide Content */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
            >
              {/* Text Side */}
              <div className="md:col-span-7 space-y-4">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                  {slide.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl font-normal">
                  {slide.content}
                </p>

                {slide.ctaText && slide.ctaUrl && (
                  <div className="pt-2">
                    <Link href={targetUrl}>
                      <Button className="rounded-full px-7 h-12 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 gap-2 group">
                        <span>{slide.ctaText}</span>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Image Side */}
              <div className="md:col-span-5 flex justify-center items-center">
                {slide.imageUrl ? (
                  <div className="relative w-full max-w-sm rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black/40 group">
                    <Image
                      unoptimized
                      width={800}
                      height={440}
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-full h-auto max-h-[220px] object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-sm h-[180px] rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary/40">
                    <Megaphone className="h-16 w-16" />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots Indicator */}
          {announcements.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-white/10">
              {announcements.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current
                      ? "w-8 bg-emerald-400"
                      : "w-2 bg-white/20 hover:bg-white/40"
                  }`}
                  aria-label={`Ir al slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
