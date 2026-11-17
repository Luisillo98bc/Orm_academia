"use client";

import { useEffect, useState, useCallback } from "react";
import { API_URL } from "@/lib/api";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Pause,
  Play,
} from "lucide-react";
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
  const [isInteracting, setIsInteracting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/communication/announcements/public`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAnnouncements(data || []))
      .catch(() => setAnnouncements([]))
      .finally(() => setIsLoading(false));
  }, []);

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
    if (isPaused || isInteracting || announcements.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [isInteracting, isPaused, next, announcements.length]);

  if (isLoading) {
    return (
      <section className="landing-announcements-section mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16" aria-label="Cargando anuncios" aria-busy="true">
        <div className="mb-7 h-14 max-w-xl animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
        <div className="min-h-[360px] animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/60" />
      </section>
    );
  }

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
      aria-label="Anuncios destacados"
      aria-roledescription="carrusel"
      className="landing-announcements-section mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocus={() => setIsInteracting(true)}
      onBlur={() => setIsInteracting(false)}
    >
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            Novedades y ofertas
          </p>
          <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-3xl">
            Promociones y próximas convocatorias
          </h2>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {announcements.length} {announcements.length === 1 ? "oferta vigente" : "ofertas vigentes"}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-emerald-200 bg-gradient-to-br from-[#ecfdf5] via-[#f0fdfa] to-[#ccfbf1] p-5 shadow-[0_28px_64px_-24px_rgba(4,120,87,0.18)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-300 via-teal-400 to-emerald-600" />

        <div className="relative z-10 pt-1">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white shadow-sm">
              <Megaphone className="h-3.5 w-3.5" />
              <span>Oferta destacada</span>
            </div>

            {announcements.length > 1 && (
              <div className="flex items-center gap-2" aria-label="Controles de anuncios">
                <button
                  onClick={() => setIsPaused((paused) => !paused)}
                  className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-emerald-900/20 bg-white/60 text-stone-900 transition hover:border-emerald-700/40 hover:bg-white"
                  aria-label={isPaused ? "Reanudar anuncios" : "Pausar anuncios"}
                  aria-pressed={isPaused}
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button
                  onClick={prev}
                  className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-emerald-900/20 bg-white/60 text-stone-900 transition hover:border-emerald-700/40 hover:bg-white"
                  aria-label="Anuncio anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="min-w-12 text-center text-xs font-bold tabular-nums text-stone-900" aria-live="polite">
                  {String(current + 1).padStart(2, "0")} / {String(announcements.length).padStart(2, "0")}
                </span>
                <button
                  onClick={next}
                  className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-emerald-900/20 bg-white/60 text-stone-900 transition hover:border-emerald-700/40 hover:bg-white"
                  aria-label="Siguiente anuncio"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeInOut" }}
              role="group"
              aria-roledescription="anuncio"
              aria-label={`${current + 1} de ${announcements.length}`}
              className="grid items-center gap-8 md:grid-cols-12 lg:gap-12"
            >
              <div className="space-y-5 md:col-span-7">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-800">Beneficio por tiempo limitado</p>
                <h3 className="max-w-2xl text-3xl font-extrabold leading-[1.08] tracking-[-0.04em] text-stone-900 sm:text-4xl lg:text-[2.75rem]">
                  {slide.title}
                </h3>
                <p className="max-w-xl text-sm leading-7 text-stone-700 sm:text-base">
                  {slide.content}
                </p>

                {slide.ctaText && slide.ctaUrl && (
                  <div className="pt-2">
                    <Button asChild className="h-12 rounded-full bg-emerald-700 px-6 text-sm font-extrabold text-white shadow-lg transition hover:bg-emerald-800">
                      <Link href={targetUrl}>
                        <span>{slide.ctaText}</span>
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center md:col-span-5">
                {slide.imageUrl ? (
                  <div className="group relative aspect-[16/10] w-full max-w-md overflow-hidden rounded-[1.35rem] border-2 border-emerald-300/60 bg-slate-950/20 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.55)]">
                    <Image
                      unoptimized
                      fill
                      sizes="(min-width: 1024px) 36vw, (min-width: 768px) 42vw, 100vw"
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-slate-950/25 via-transparent to-white/10" />
                    <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      NTS KIDS
                    </div>
                  </div>
                  ) : (
                  <div className="flex aspect-[16/10] w-full max-w-md items-center justify-center rounded-[1.35rem] border border-emerald-300 bg-white/40 text-emerald-800">
                    <Megaphone className="h-16 w-16" />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

        </div>
      </div>
    </section>
  );
}
