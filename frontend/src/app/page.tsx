"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Compass,
  Cpu,
  FileText,
  Flame,
  Headphones,
  Laptop,
  Layers,
  Loader2,
  LockKeyhole,
  MonitorPlay,
  Palette,
  QrCode,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { LandingAnnouncements } from "@/components/landing-announcements";
import { BrochureModal } from "@/components/brochure-modal";
import { WhatsAppLogo } from "@/components/whatsapp-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import { getCohortPricing } from "@/lib/money";
import { trackConversion } from "@/lib/analytics";
import { getMediaUrl } from "@/lib/media";
import type { Cohort, PlatformSettings, User } from "@/types/domain";

interface PublicStats {
  courses: number;
  cohorts: number;
  students: number;
  certificates: number;
}

interface PublicTestimonial {
  score: number;
  comment: string;
  author: string;
  programName?: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function levelLabel(level?: string) {
  return (
    ({
      BEGINNER: "Nivel Inicial",
      INTERMEDIATE: "Nivel Intermedio",
      ADVANCED: "Nivel Avanzado",
    } as Record<string, string>)[level || ""] || "Programa"
  );
}

function modalityLabel(modality?: string | null) {
  return (
    ({
      ONLINE: "En vivo Online",
      PRESENCIAL: "Presencial",
      HIBRIDA: "Modalidad Híbrida",
    } as Record<string, string>)[modality || ""] || "En vivo Online"
  );
}

function getWhatsappHref(settings: PlatformSettings | null, message: string) {
  const number = settings?.whatsappNumber?.replace(/\D/g, "") || "51999999999";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

const HERO_CATEGORIES = [
  { id: "ALL", label: "Todos los programas", query: "", icon: Layers },
  { id: "DEV", label: "Programación y Web", query: "Desarrollo", icon: Code2 },
  { id: "DESIGN", label: "Diseño UX/UI", query: "Diseño", icon: Palette },
  { id: "DATA", label: "Datos y Python", query: "Data", icon: BarChart3 },
  { id: "TECH", label: "Cloud y Proyectos", query: "Cloud", icon: Cpu },
] as const;

export default function LandingPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [prospectForm, setProspectForm] = useState({
    name: "",
    contact: "",
    cohortId: "",
    message: "",
    privacyConsent: false,
  });
  const [prospectSending, setProspectSending] = useState(false);
  const [prospectSent, setProspectSent] = useState(false);
  const [prospectError, setProspectError] = useState("");
  const [cohortLoadError, setCohortLoadError] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [brochureCohort, setBrochureCohort] = useState<Cohort | null>(null);
  const [quizLevel, setQuizLevel] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED">("BEGINNER");
  const [quizInterest, setQuizInterest] = useState<"DEV" | "DESIGN" | "DATA" | "TECH">("DEV");

  const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object" && "data" in value) {
      const data = (value as { data?: unknown }).data;
      return Array.isArray(data) ? (data as T[]) : [];
    }
    return [];
  };

  useEffect(() => {
    trackConversion("LANDING_VIEW");
  }, []);

  useEffect(() => {
    Promise.allSettled([
      fetchCatalogApi<Cohort[]>("/academic/public/cohorts", "cohorts"),
      fetchCatalogApi<PlatformSettings>("/settings/public", "settings"),
      fetchCatalogApi<PublicStats>("/academic/public/stats", "stats"),
    ])
      .then(([cohortResult, settingsResult, statsResult]) => {
        if (cohortResult.status === "fulfilled") {
          setCohorts(toArray<Cohort>(cohortResult.value));
        } else {
          setCohortLoadError(true);
        }

        if (settingsResult.status === "fulfilled") {
          setSettings(settingsResult.value as PlatformSettings | null);
        }
        if (
          statsResult.status === "fulfilled" &&
          statsResult.value &&
          typeof statsResult.value === "object"
        ) {
          setPublicStats(statsResult.value as PublicStats);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCohorts = useMemo(
    () =>
      cohorts
        .filter((cohort) => cohort.isActive && new Date(cohort.endDate) >= new Date())
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [cohorts]
  );

  const filteredCohorts = useMemo(() => {
    if (selectedCategory === "ALL") {
      // Showcase distinct courses first on the landing page rather than repeating groups of the same course
      const seenCourses = new Set<string>();
      const distinct: Cohort[] = [];
      const rest: Cohort[] = [];
      for (const cohort of activeCohorts) {
        const key = cohort.courseId || cohort.course?.name || cohort.id;
        if (!seenCourses.has(key)) {
          seenCourses.add(key);
          distinct.push(cohort);
        } else {
          rest.push(cohort);
        }
      }
      return [...distinct, ...rest];
    }
    const categoryKeywords: Record<string, string[]> = {
      DEV: ["desarrollo", "web", "react", "fullstack", "programación", "codigo", "frontend", "backend"],
      DESIGN: ["diseño", "ux", "ui", "design", "interfaz", "figma"],
      DATA: ["data", "python", "ciencia", "machine", "analítica", "sql"],
      TECH: ["cloud", "proyectos", "agile", "marketing", "robótica", "tecnología"],
    };
    const keywords = categoryKeywords[selectedCategory] || [];
    const matches = activeCohorts.filter((cohort) => {
      const text = `${cohort.course?.name || ""} ${cohort.name || ""} ${cohort.course?.description || ""}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });
    return matches.length > 0 ? matches : activeCohorts;
  }, [activeCohorts, selectedCategory]);

  const recommendedCohort = useMemo(() => {
    if (activeCohorts.length === 0) return null;
    const interestKeywords: Record<string, string[]> = {
      DEV: ["desarrollo", "web", "fullstack", "react"],
      DESIGN: ["diseño", "ux", "ui"],
      DATA: ["data", "python", "analítica"],
      TECH: ["cloud", "proyectos", "agile", "marketing"],
    };
    const keywords = interestKeywords[quizInterest] || [];
    const exactMatch = activeCohorts.find((cohort) => {
      const text = `${cohort.course?.name || ""} ${cohort.course?.description || ""}`.toLowerCase();
      return cohort.course?.level === quizLevel && keywords.some((kw) => text.includes(kw));
    });
    if (exactMatch) return exactMatch;

    const interestMatch = activeCohorts.find((cohort) => {
      const text = `${cohort.course?.name || ""} ${cohort.course?.description || ""}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });
    if (interestMatch) return interestMatch;

    const levelMatch = activeCohorts.find((cohort) => cohort.course?.level === quizLevel);
    return levelMatch || activeCohorts[0];
  }, [activeCohorts, quizInterest, quizLevel]);

  useEffect(() => {
    let mounted = true;
    const courseIds = Array.from(
      new Set(
        activeCohorts
          .map((cohort) => cohort.courseId)
          .filter((courseId): courseId is string => Boolean(courseId))
      )
    ).slice(0, 3);

    if (courseIds.length === 0) {
      Promise.resolve().then(() => {
        if (mounted) setTestimonials([]);
      });
      return () => {
        mounted = false;
      };
    }

    Promise.allSettled(
      courseIds.map((courseId) => fetchApi(`/academic/public/courses/${courseId}/testimonials`))
    )
      .then((results) => {
        if (!mounted) return;
        const published = results.flatMap((result) => {
          if (result.status !== "fulfilled" || !Array.isArray(result.value)) return [];
          return result.value as PublicTestimonial[];
        });
        setTestimonials(published.slice(0, 3));
      })
      .catch(() => {
        if (mounted) setTestimonials([]);
      });

    return () => {
      mounted = false;
    };
  }, [activeCohorts]);

  const teachers = useMemo(() => {
    const unique = new Map<string, User & { subjects: string[] }>();
    cohorts.forEach((cohort) => {
      cohort.teachers?.forEach((teacher) => {
        const current = unique.get(teacher.id);
        const subject = cohort.course?.name;
        if (!current) unique.set(teacher.id, { ...teacher, subjects: subject ? [subject] : [] });
        else if (subject && !current.subjects.includes(subject)) current.subjects.push(subject);
      });
    });
    return Array.from(unique.values());
  }, [cohorts]);

  const advisorHref = getWhatsappHref(
    settings,
    `Hola, quisiera orientación para elegir un programa de ${settings?.academyName || "la academia"}.`
  );

  const faq = useMemo(() => [
    {
      q: "¿Cómo se desarrollan las clases en vivo?",
      a: "Cada programa combina sesiones síncronas en directo con materiales descargables, laboratorios prácticos y grabaciones organizadas por semana dentro de tu campus virtual.",
    },
    {
      q: "¿Para qué perfiles o niveles están pensados los programas?",
      a: "Contamos con rutas desde nivel inicial (sin conocimientos previos) hasta especializaciones intermedias y avanzadas. En cada ficha puedes revisar los requisitos y el temario detallado.",
    },
    {
      q: "¿Cómo se realiza el seguimiento del estudiante?",
      a: "Dentro del aula virtual se registra en tiempo real el porcentaje de avance de materiales, asistencia a clases en vivo, entregas semanales y calificaciones con retroalimentación docente.",
    },
    {
      q: "¿Puedo pagar mi matrícula en cuotas mensuales?",
      a: "Sí. En las ediciones que cuentan con facilidad de pago mensual, puedes abonar mes a mes desde tu panel «Mis Pagos» y descargar tu constancia oficial PDF de cada cuota validada.",
    },
    {
      q: "¿Cómo funciona la certificación digital con código QR?",
      a: "Al culminar y aprobar el programa, el sistema emite tu certificado digital oficial con código único y QR de verificación pública instantánea.",
    },
    {
      q: "¿Qué medios de pago están disponibles?",
      a: "Aceptamos Yape, Plin, transferencia bancaria y pago en efectivo validado por administración. Una vez confirmado tu comprobante, se activa tu acceso inmediato al campus.",
    },
  ], []);

  const structuredData = useMemo(() => {
    const orgName = settings?.academyName || "NTS KIDS";
    const serviceNames = [
      "Cursos de Programación para Niños, Adolescentes y Jóvenes",
      "Talleres de Robótica Educativa y Tecnología",
      "Desarrollo Web Fullstack en Vivo",
      "Python y Ciencia de Datos",
      "Diseño UX/UI y Productos Digitales",
      "Cloud Computing y Gestión Ágil de Proyectos",
      ...Array.from(new Set(activeCohorts.map((c) => c.course?.name).filter(Boolean))),
    ];

    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": ["EducationalOrganization", "LocalBusiness"],
          name: orgName,
          legalName: settings?.legalName || `${orgName} S.A.C.`,
          description:
            settings?.description ||
            `${orgName}: talleres y cursos en vivo de programación, robótica, desarrollo web, Python, diseño UX/UI y tecnología para niños, adolescentes y jóvenes con certificados digitales QR.`,
          ...(settings?.taxId ? { taxID: settings.taxId } : {}),
          ...(settings?.whatsappNumber ? { telephone: settings.whatsappNumber } : {}),
          ...(settings?.supportEmail ? { email: settings.supportEmail } : {}),
          address: {
            "@type": "PostalAddress",
            streetAddress: settings?.address || "Perú",
            addressCountry: "PE",
          },
          areaServed: "PE",
          sameAs: [
            settings?.facebookUrl,
            settings?.instagramUrl,
            settings?.linkedinUrl,
            settings?.youtubeUrl,
            settings?.tiktokUrl,
            settings?.xUrl,
          ].filter(Boolean),
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: `Catálogo de Servicios y Programas de ${orgName}`,
            itemListElement: serviceNames.map((serviceName) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: serviceName,
              },
            })),
          },
        },
        {
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.a,
            },
          })),
        },
        {
          "@type": "ItemList",
          itemListElement: activeCohorts.slice(0, 6).map((cohort, idx) => {
            const { finalPrice } = getCohortPricing(cohort);
            return {
              "@type": "ListItem",
              position: idx + 1,
              item: {
                "@type": "Course",
                name: cohort.course?.name || cohort.name,
                description: cohort.course?.description || cohort.name,
                provider: {
                  "@type": "EducationalOrganization",
                  name: orgName,
                },
                offers: {
                  "@type": "Offer",
                  price: finalPrice.toFixed(2),
                  priceCurrency: "PEN",
                  availability: "https://schema.org/InStock",
                },
              },
            };
          }),
        },
      ],
    };
  }, [activeCohorts, faq, settings]);

  const submitProspect = async (event: React.FormEvent) => {
    event.preventDefault();
    setProspectError("");
    setProspectSending(true);
    try {
      const isEmail = prospectForm.contact.includes("@");
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        prospectForm.cohortId
      );
      await fetchApi("/prospects", {
        method: "POST",
        body: JSON.stringify({
          name: prospectForm.name,
          email: isEmail ? prospectForm.contact : undefined,
          phone: isEmail ? undefined : prospectForm.contact,
          cohortId: isUuid ? prospectForm.cohortId : undefined,
          message: prospectForm.message,
          privacyConsent: prospectForm.privacyConsent,
          source: "LANDING_FORM",
        }),
      });
      setProspectSent(true);
      setProspectForm({ name: "", contact: "", cohortId: "", message: "", privacyConsent: false });
    } catch {
      setProspectError("No pudimos enviar la solicitud. Revisa tus datos e inténtalo nuevamente.");
    } finally {
      setProspectSending(false);
    }
  };

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-slate-50/50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 1: HERO PRINCIPAL LIMPIO Y DESPEJADO (PROTAGONISMO VISUAL)
         ══════════════════════════════════════════════════════════════════════════ */}
      <section className="landing-hero relative overflow-hidden bg-[#070d19] text-white">
        <div className="landing-hero-media pointer-events-none" aria-hidden="true">
          <Image
            src="/hero-young-coder.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="landing-hero-media-overlay pointer-events-none" aria-hidden="true" />

        <div className="landing-hero-shell relative mx-auto grid max-w-7xl items-end px-5 pb-9 pt-24 sm:px-8 lg:grid-cols-[0.94fr_1.06fr] lg:items-center lg:py-24">
          <div className="landing-hero-copy max-w-[85%] lg:max-w-xl">
            <div className="mb-5 hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-100 backdrop-blur-md lg:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{settings?.heroEyebrow || "Academia de cursos virtuales síncronos"}</span>
            </div>

            <h1 className="landing-title text-[1.85rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-white drop-shadow-[0_2px_10px_rgba(2,6,23,0.55)] sm:text-4xl lg:text-[3.35rem] lg:leading-[1.05]">
              {settings?.heroTitle || "Cursos virtuales en vivo de programación, robótica y tecnología"}
            </h1>

            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-slate-200/95 drop-shadow-[0_1px_6px_rgba(2,6,23,0.45)] sm:mt-4 sm:text-base lg:mt-5 lg:max-w-lg lg:text-lg lg:leading-7">
              {settings?.heroSubtitle ||
                "Clases síncronas en tiempo real con docentes especializados, práctica guiada por sesión, aula virtual y certificado digital con QR."}
            </p>

            <div className="landing-hero-actions mt-8 hidden flex-col gap-3 sm:flex-row sm:items-center lg:flex">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-xl bg-amber-400 px-7 font-bold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:-translate-y-0.5 hover:bg-amber-300 sm:h-13 sm:w-auto"
              >
                <Link href="#cohortes">
                  Ver matrículas abiertas <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-xl border-white/25 bg-slate-950/60 px-6 font-semibold text-white backdrop-blur-md hover:bg-slate-900 hover:text-white sm:h-13 sm:w-auto"
              >
                <a
                  data-testid="hero-whatsapp"
                  href={advisorHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackConversion("WHATSAPP_CLICK", { metadata: { placement: "hero" } })}
                >
                  <WhatsAppLogo className="mr-2 h-5 w-5" /> Hablar con un asesor
                </a>
              </Button>
            </div>

            <div className="landing-hero-proof mt-7 hidden flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-5 text-xs font-medium text-slate-200 lg:flex">
              {["Clases síncronas en vivo", "Certificados con QR", "Pago único o en cuotas"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-amber-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 2: CARRUSEL DE ANUNCIOS Y NOVEDADES
         ══════════════════════════════════════════════════════════════════════════ */}
      <LandingAnnouncements />

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 3: PILARES DE ENSEÑANZA
         ══════════════════════════════════════════════════════════════════════════ */}
      <section className="landing-proof-strip border-y border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16">
          <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
                Cómo enseñamos
              </p>
              <h2 className="max-w-xl text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                Formación síncrona organizada de principio a fin
              </h2>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Clases en directo con docente
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                icon: MonitorPlay,
                title: "Clases síncronas por Meet",
                text: "Asiste en tiempo real en horarios fijos, resuelve dudas al instante y repasa con las grabaciones.",
              },
              {
                step: "02",
                icon: BookOpen,
                title: "Aula virtual por semanas",
                text: "Sílabo ordenado, guías descargables, foro de consultas y entregas con calificación docente.",
              },
              {
                step: "03",
                icon: QrCode,
                title: "Certificación con QR",
                text: "Al culminar y aprobar el curso emites tu certificado digital con enlace de validación pública.",
              },
              {
                step: "04",
                icon: ShieldCheck,
                title: "Pago único o en cuotas",
                text: "Matricula en línea mediante Yape, Plin, transferencia o efectivo con constancia PDF inmediata.",
              },
            ].map(({ step, icon: Icon, title, text }) => (
              <article
                key={title}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-600/40 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/15 dark:text-blue-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs font-bold tracking-widest text-slate-300 dark:text-slate-700">
                    {step}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 4: CIFRAS DE LA ACADEMIA
         ══════════════════════════════════════════════════════════════════════════ */}
      {publicStats && (
        <section
          className="landing-stats border-b border-slate-200 px-5 py-12 sm:px-8 lg:py-14 dark:border-slate-800"
          aria-label="Indicadores de la academia"
        >
          <div className="landing-stats-shell relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-slate-800 px-6 py-10 shadow-xl sm:px-10 sm:py-12">
            <div className="relative z-10 mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                  Nuestra academia en cifras
                </p>
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Actividad académica dentro del campus
                </h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Registros vigentes del sistema
              </span>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  icon: Users,
                  value: publicStats.students,
                  label: "Estudiantes activos",
                },
                {
                  icon: BookOpen,
                  value: publicStats.courses,
                  label: "Cursos especializados",
                },
                {
                  icon: CalendarDays,
                  value: publicStats.cohorts,
                  label: "Ediciones abiertas",
                },
                {
                  icon: Award,
                  value: publicStats.certificates,
                  label: "Certificados emitidos",
                },
              ].map(({ icon: StatIcon, value, label }) => (
                <div
                  key={label}
                  className="landing-stat-card flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center"
                >
                  <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
                    <StatIcon className="h-5 w-5" />
                  </span>
                  <p className="text-3xl font-black tracking-tight text-white sm:text-4xl tabular-nums">
                    +{value.toLocaleString("es-PE")}
                  </p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 5: MATRÍCULAS ABIERTAS
         ══════════════════════════════════════════════════════════════════════════ */}
      <section
        id="cohortes"
        className="landing-section landing-cohorts scroll-mt-20 bg-slate-100/80 px-5 py-20 dark:bg-slate-900/50 sm:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                Convocatoria abierta
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Elige tu próximo curso y separa tu vacante
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Consulta fechas de inicio, horarios en vivo, inversión o cuotas mensuales y descarga el sílabo completo en PDF.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="rounded-xl border-slate-300 bg-white font-bold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <Link href="/cursos">
                  Explorar catálogo completo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Barra de filtro rápido por categoría */}
          <div className="mb-8 flex flex-wrap items-center gap-2">
            {HERO_CATEGORIES.map(({ id, label, icon: CatIcon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedCategory(id)}
                className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all duration-150 ${
                  selectedCategory === id
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm dark:border-blue-500 dark:bg-blue-600 dark:text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-600/40 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                }`}
              >
                <CatIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {!loading && !cohortLoadError && filteredCohorts.length > 0 && (
            <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mostrando {Math.min(filteredCohorts.length, 3)} de {activeCohorts.length}{" "}
              {activeCohorts.length === 1 ? "edición disponible" : "ediciones disponibles"} con inscripción inmediata
            </p>
          )}

          {cohortLoadError && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              No pudimos cargar las cohortes disponibles. Revisa la conexión del servidor.
            </div>
          )}

          {loading ? (
            <div
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
              aria-busy="true"
              aria-label="Cargando cohortes disponibles"
            >
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="shimmer-loading aspect-[16/9] w-full rounded-2xl" />
                  <div className="mt-5 space-y-3">
                    <div className="shimmer-loading h-3 w-28 rounded-full" />
                    <div className="shimmer-loading h-6 w-3/4 rounded-lg" />
                    <div className="shimmer-loading h-4 w-full rounded-lg" />
                    <div className="shimmer-loading mt-4 h-16 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCohorts.length > 0 ? (
            <>
              <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
                {filteredCohorts.slice(0, 3).map((cohort) => {
                  const {
                    basePrice: price,
                    finalPrice,
                    discountActive,
                    discountPercentage,
                  } = getCohortPricing(cohort);
                  const capacity = cohort.maxCapacity || cohort.maxStudents;
                  const enrolled =
                    cohort.enrolledCount ?? cohort.enrollmentCount ?? cohort._count?.enrollments ?? 0;
                  const seats = capacity ? Math.max(capacity - enrolled, 0) : null;
                  const imageUrl = getMediaUrl(cohort.imageUrl || cohort.course?.imageUrl);
                  const isLowSeats = seats !== null && seats > 0 && seats <= 8;
                  const installmentsCount = Math.max(1, Number(cohort.installments ?? 1));

                  return (
                    <article
                      key={cohort.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-600/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="relative aspect-[16/9] overflow-hidden bg-slate-950">
                        {imageUrl ? (
                          <Image
                            unoptimized={!imageUrl.startsWith("/course-images/")}
                            loading="lazy"
                            quality={80}
                            fill
                            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                            src={imageUrl}
                            alt={cohort.course?.name || cohort.name}
                            className="object-cover transition duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                            <BookOpen className="h-12 w-12 text-blue-400/70" />
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />

                        <div className="absolute left-3.5 top-3.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                            {levelLabel(cohort.course?.level)}
                          </span>
                          <span className="rounded-md bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                            {modalityLabel(cohort.modality)}
                          </span>
                        </div>

                        {discountActive ? (
                          <span className="absolute right-3.5 top-3.5 inline-flex items-center rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                            -{discountPercentage}%
                          </span>
                        ) : isLowSeats ? (
                          <span className="absolute right-3.5 top-3.5 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow-sm">
                            <Flame className="h-3 w-3" /> {seats} cupos
                          </span>
                        ) : null}

                        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-xs text-slate-200">
                          <span className="font-mono text-[11px] font-semibold text-slate-200 truncate max-w-[70%]">
                            {cohort.name}
                          </span>
                          {installmentsCount > 1 && (
                            <span className="rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                              {installmentsCount} cuotas
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="line-clamp-2 text-xl font-extrabold leading-snug text-slate-950 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                          {cohort.course?.name || cohort.name}
                        </h3>
                        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          {cohort.course?.description ||
                            "Programa práctico con sesiones síncronas en vivo y certificación verificable."}
                        </p>

                        <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                          <span className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span>Inicio: {formatDate(cohort.startDate)}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span>
                              {cohort.course?.durationHours
                                ? `${cohort.course.durationHours} horas`
                                : "En vivo"}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span>{seats === null ? "Cupos activos" : `${seats} vacantes`}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <QrCode className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span>Certificado QR</span>
                          </span>
                        </div>

                        <div className="mt-auto pt-5 space-y-3">
                          <div className="flex items-end justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                {installmentsCount > 1 ? "Cuota mensual" : "Inversión única"}
                              </p>
                              <div className="mt-0.5 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-950 dark:text-white">
                                  S/ {finalPrice.toFixed(2)}
                                </span>
                                {installmentsCount > 1 && (
                                  <span className="text-xs font-bold text-slate-500">/ mes</span>
                                )}
                                {discountActive && (
                                  <span className="text-xs text-slate-400 line-through">
                                    S/ {price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setBrochureCohort(cohort)}
                              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-600/40 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              Sílabo PDF
                            </button>
                          </div>

                          <Button
                            asChild
                            className="h-11 w-full rounded-xl bg-slate-950 px-5 font-bold text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
                          >
                            <Link
                              aria-label={`Ver detalles de ${cohort.course?.name || cohort.name}`}
                              href={`/cohorts/${cohort.id}`}
                              onClick={() =>
                                trackConversion("PROGRAM_VIEW", {
                                  cohortId: cohort.id,
                                  metadata: { source: "landing_card" },
                                })
                              }
                            >
                              Ver detalles y matricularme <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Franja de Garantía y Confianza */}
              <div className="mt-10 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <strong className="block text-slate-950 dark:text-white">Clases en directo</strong>
                    Docentes en vivo durante toda la sesión para resolver tus consultas.
                  </span>
                </div>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300">
                    <Award className="h-5 w-5" />
                  </div>
                  <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <strong className="block text-slate-950 dark:text-white">Certificación con QR</strong>
                    Validación pública instantánea para tu currículum y LinkedIn.
                  </span>
                </div>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <strong className="block text-slate-950 dark:text-white">Facilidades de pago</strong>
                    Pago único o en cuotas mensuales vía Yape, Plin o transferencia.
                  </span>
                </div>
              </div>

              {activeCohorts.length > 3 && (
                <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-6 py-4 text-center dark:border-blue-500/30 dark:bg-blue-500/10 sm:flex-row sm:text-left">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Además de estos destacados, tenemos{" "}
                    <strong>
                      {activeCohorts.length - 3}{" "}
                      {activeCohorts.length - 3 === 1
                        ? "edición adicional abierta"
                        : "ediciones adicionales abiertas"}
                    </strong>{" "}
                    en el catálogo general.
                  </p>
                  <Link
                    href="/cursos"
                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:underline dark:text-blue-300"
                  >
                    Ver todos los programas <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-950">
              <CalendarDays className="mx-auto h-9 w-9 text-blue-600" />
              <h3 className="mt-4 text-lg font-bold">Estamos preparando los próximos inicios</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Contacta con un asesor para recibir información prioritaria cuando se habiliten nuevas fechas.
              </p>
              {advisorHref && (
                <a
                  href={advisorHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center text-sm font-bold text-blue-700"
                >
                  Recibir información <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 6: ORIENTACIÓN EN 2 PASOS
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeCohorts.length > 0 && (
        <section
          id="asesor-virtual"
          className="landing-section border-t border-slate-200 bg-white px-5 py-20 dark:border-slate-800 dark:bg-slate-950 sm:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 rounded-3xl border border-slate-800 bg-[#090f1e] p-6 text-white shadow-xl sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
                  Orientación académica
                </p>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Encuentra tu edición según tu nivel e interés
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Selecciona tu nivel de partida y el área que buscas para ver qué grupo próximo se ajusta mejor.
                </p>

                <div className="mt-7 space-y-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      1. Nivel actual
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {[
                        { id: "BEGINNER", label: "Inicial (Desde cero)" },
                        { id: "INTERMEDIATE", label: "Intermedio (Con bases)" },
                        { id: "ADVANCED", label: "Avanzado (Especialización)" },
                      ].map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() =>
                            setQuizLevel(lvl.id as "BEGINNER" | "INTERMEDIATE" | "ADVANCED")
                          }
                          className={`cursor-pointer rounded-xl border px-3.5 py-3 text-xs font-bold transition-all ${
                            quizLevel === lvl.id
                              ? "border-amber-400 bg-amber-400 text-slate-950 shadow-sm"
                              : "border-white/15 bg-white/[0.05] text-slate-200 hover:border-white/30 hover:bg-white/10"
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      2. Área de formación
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {[
                        { id: "DEV", label: "Apps y Web", icon: Code2 },
                        { id: "DESIGN", label: "Diseño UX/UI", icon: Palette },
                        { id: "DATA", label: "Datos y Python", icon: BarChart3 },
                        { id: "TECH", label: "Cloud y Gestión", icon: Cpu },
                      ].map(({ id, label, icon: InterestIcon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setQuizInterest(id as "DEV" | "DESIGN" | "DATA" | "TECH")}
                          className={`cursor-pointer flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center text-xs font-bold transition-all ${
                            quizInterest === id
                              ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                              : "border-white/15 bg-white/[0.05] text-slate-200 hover:border-white/30 hover:bg-white/10"
                          }`}
                        >
                          <InterestIcon className="h-4 w-4" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {recommendedCohort && (
                <div className="rounded-2xl border border-white/15 bg-white p-6 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Edición sugerida
                  </span>
                  <h3 className="mt-3 text-xl font-extrabold text-slate-950 dark:text-white">
                    {recommendedCohort.course?.name || recommendedCohort.name}
                  </h3>
                  <p className="mt-1 text-xs font-bold text-blue-700 dark:text-blue-400">
                    {recommendedCohort.name} · {levelLabel(recommendedCohort.course?.level)}
                  </p>
                  {recommendedCohort.course?.description && (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {recommendedCohort.course.description}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Inicio:{" "}
                      {formatDate(recommendedCohort.startDate)}
                    </span>
                    <span className="font-mono text-base font-black text-slate-950 dark:text-white">
                      S/ {getCohortPricing(recommendedCohort).finalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                    <Button
                      asChild
                      className="flex-1 rounded-xl bg-slate-950 font-bold text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      <Link href={`/cohorts/${recommendedCohort.id}`}>
                        Ver programa <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setBrochureCohort(recommendedCohort)}
                      className="cursor-pointer flex-1 gap-1.5 rounded-xl font-bold"
                    >
                      <FileText className="h-4 w-4" /> Temario PDF
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 7: METODOLOGÍA APLICADA (#resultados)
         ══════════════════════════════════════════════════════════════════════════ */}
      <section
        id="resultados"
        className="landing-section landing-results scroll-mt-20 bg-slate-100/80 px-5 py-20 sm:px-8 lg:py-24 dark:bg-slate-900/50"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
                Metodología aplicada
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Qué logras en cada curso
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
                Cada semana consolidas lo aprendido con entregas prácticas revisadas y calificadas por tu docente.
              </p>
            </div>
            <Button asChild size="lg" className="rounded-xl bg-slate-950 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white">
              <Link href="/cursos">
                Ver catálogo completo <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Laptop,
                number: "01",
                tag: "Desarrollo Web y Software",
                title: "Proyectos web funcionales",
                text: "Construyes interfaces modernas, APIs y bases de datos aplicando buenas prácticas desde cero.",
                bullets: ["Código ordenado por módulos", "Publicación funcional en la nube"],
              },
              {
                icon: Cpu,
                number: "02",
                tag: "Datos, Robótica y Cloud",
                title: "Prácticas y automatización",
                text: "Trabajas con casos aplicados, lógica de programación y herramientas tecnológicas paso a paso.",
                bullets: ["Ejercicios guiados en directo", "Corrección directa en clase"],
              },
              {
                icon: Award,
                number: "03",
                tag: "Portafolio y Certificación QR",
                title: "Acreditación oficial verificable",
                text: "Respaldas tus entregas aprobadas y notas con un certificado digital verificable mediante QR.",
                bullets: ["Código único de validación pública", "Boleta de notas descargable en PDF"],
              },
            ].map(({ icon: Icon, number, tag, title, text, bullets }) => (
              <article
                key={number}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-600/40 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-lg bg-blue-600/10 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      <Icon className="h-4 w-4" />
                      {tag}
                    </span>
                    <span className="font-mono text-sm font-black tracking-widest text-slate-300 dark:text-slate-700">
                      {number}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold text-slate-950 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {text}
                  </p>
                </div>

                <ul className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 8: RUTA PASO A PASO (#como-funciona)
         ══════════════════════════════════════════════════════════════════════════ */}
      <section
        id="como-funciona"
        className="landing-section landing-method scroll-mt-20 bg-white px-5 py-20 dark:bg-slate-950 sm:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
              Proceso de estudio
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Desde tu matrícula hasta la certificación
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
              Cuatro pasos claros para seguir tu cronograma semanal y completar el programa.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-4">
            {[
              {
                icon: BookOpen,
                number: "PASO 01",
                title: "Elige tu edición",
                text: "Revisa el temario, fechas e inversión, y completa tu matrícula en línea o por WhatsApp.",
              },
              {
                icon: Headphones,
                number: "PASO 02",
                title: "Conéctate en vivo",
                text: "Participa en las clases síncronas semanales, resuelve dudas en directo y accede a las grabaciones.",
              },
              {
                icon: Layers,
                number: "PASO 03",
                title: "Desarrolla proyectos",
                text: "Completa los materiales y entregables prácticos con retroalimentación directa de tu docente.",
              },
              {
                icon: Award,
                number: "PASO 04",
                title: "Obtén tu certificado QR",
                text: "Descarga tu récord académico y tu certificado oficial con código QR de verificación pública.",
              },
            ].map(({ icon: Icon, ...step }) => (
              <div
                key={step.number}
                className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-7 transition-all duration-200 hover:-translate-y-1 hover:border-blue-600/40 hover:bg-white hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm dark:bg-blue-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-blue-600/10 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-extrabold text-slate-950 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 9: TESTIMONIOS VERIFICADOS
         ══════════════════════════════════════════════════════════════════════════ */}
      {testimonials.length > 0 && (
        <section
          className="landing-section landing-testimonials scroll-mt-20 border-t border-slate-200 bg-slate-100/80 px-5 py-20 sm:px-8 lg:py-24 dark:border-slate-800 dark:bg-slate-900/40"
          aria-labelledby="testimonials-title"
        >
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
                  Testimonios reales
                </p>
                <h2
                  id="testimonials-title"
                  className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
                >
                  Lo que valoran nuestros estudiantes
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
                  Opiniones registradas al completar sus cursos dentro del campus virtual.
                </p>
              </div>
              <Link
                href="/cursos"
                className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-600 dark:text-blue-400"
              >
                Conocer programas <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <blockquote
                  key={`${testimonial.author}-${testimonial.programName || "programa"}-${index}`}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <div
                      className="flex items-center gap-1 text-amber-400"
                      aria-label={`${testimonial.score} de 5 estrellas`}
                    >
                      {Array.from({ length: Math.min(testimonial.score, 5) }).map((_, starIndex) => (
                        <Star key={starIndex} className="h-4 w-4 fill-current" aria-hidden="true" />
                      ))}
                    </div>
                    <p className="mt-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
                      “{testimonial.comment}”
                    </p>
                  </div>
                  <footer className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/10 font-bold text-blue-700 dark:text-blue-300">
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <cite className="block font-bold not-italic text-slate-950 dark:text-white">
                        {testimonial.author}
                      </cite>
                      {testimonial.programName && (
                        <span className="text-slate-500 dark:text-slate-400">
                          {testimonial.programName}
                        </span>
                      )}
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 10: BENEFICIOS PARA ESTUDIANTES Y FAMILIAS (#beneficios)
         ══════════════════════════════════════════════════════════════════════════ */}
      <section
        id="beneficios"
        className="landing-section landing-benefits scroll-mt-20 bg-[#090f1e] px-5 py-20 text-white sm:px-8 lg:py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Transparencia académica
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Seguimiento claro para el estudiante y su familia
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Tanto el estudiante como su apoderado conocen en todo momento el cronograma de clases, el porcentaje de avance, la asistencia y el estado de sus pagos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"
              >
                <Link href="#contacto">
                  Solicitar orientación <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: Laptop,
                title: "Todo tu curso en un solo lugar",
                text: "Sílabo semanal, enlaces a Meet, materiales PDF, tareas y foros centralizados en el aula virtual.",
              },
              {
                icon: Headphones,
                title: "Docentes presentes en cada sesión",
                text: "Acompañamiento directo durante la clase y retroalimentación en cada entrega calificada.",
              },
              {
                icon: TrendingUp,
                title: "Constancias y récords en PDF",
                text: "Descarga en cualquier momento tu récord de asistencia, calificaciones y boletas de pago.",
              },
              {
                icon: LockKeyhole,
                title: "Cronograma de cuotas claro",
                text: "Visualización exacta de mensualidades programadas y validación rápida de tus abonos.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="landing-benefit-card rounded-2xl border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 11: EQUIPO DOCENTE
         ══════════════════════════════════════════════════════════════════════════ */}
      {teachers.length > 0 && (
        <section className="landing-section landing-teachers bg-white px-5 py-20 dark:bg-slate-950 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
                Plana docente
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Profesionales asignados a cada edición
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
                Docentes que conducen las clases síncronas en vivo y acompañan tus proyectos semanales.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {teachers.slice(0, 8).map((teacher) => (
                <article
                  key={teacher.id}
                  className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-blue-600/40 hover:bg-white hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 text-lg font-extrabold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300">
                      {teacher.profilePicture ? (
                        <Image
                          unoptimized
                          width={56}
                          height={56}
                          src={getMediaUrl(teacher.profilePicture) || ""}
                          alt={`${teacher.firstName} ${teacher.lastName}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {teacher.firstName?.[0]}
                          {teacher.lastName?.[0]}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-slate-950 dark:text-white">
                        {teacher.firstName} {teacher.lastName}
                      </h3>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Docente asignado
                      </p>
                    </div>
                  </div>
                  {teacher.bio && (
                    <p className="mt-4 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {teacher.bio}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-3 dark:border-slate-800">
                    {teacher.subjects.slice(0, 2).map((subject) => (
                      <span
                        key={subject}
                        className="rounded-md bg-blue-600/10 px-2.5 py-1 text-[11px] font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 12: PREGUNTAS FRECUENTES (#faq)
         ══════════════════════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        className="landing-section landing-faq scroll-mt-20 border-t border-slate-200 bg-slate-100/80 px-5 py-20 dark:border-slate-800 dark:bg-slate-900/40 sm:px-8 lg:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
              Resuelve tus dudas
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Todo lo que necesitas saber sobre las clases síncronas, pagos en cuotas y certificación antes de inscribirte.
            </p>

            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-bold text-slate-950 dark:text-white">
                ¿Tienes una consulta específica?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Nuestro equipo de admisión responde por WhatsApp para ayudarte a elegir horario o confirmar tu matrícula.
              </p>
              {advisorHref && (
                <a
                  href={advisorHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  <WhatsAppLogo className="h-4 w-4" /> Conversar por WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {faq.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={item.q}
                  className={`rounded-2xl border transition-all ${
                    isOpen
                      ? "border-blue-600/50 bg-white shadow-md dark:border-blue-500/50 dark:bg-slate-950"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="cursor-pointer flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="text-sm font-bold text-slate-950 dark:text-white sm:text-base">
                      {item.q}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-5 w-5 shrink-0 text-blue-600 transition-transform duration-200 dark:text-blue-400 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    id={`faq-answer-${index}`}
                    className={`grid transition-all duration-300 ${
                      isOpen ? "grid-rows-[1fr] px-6 pb-5" : "grid-rows-[0fr] px-6"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          MÓDULO 13: CONTACTO Y ORIENTACIÓN PERSONALIZADA (#contacto)
         ══════════════════════════════════════════════════════════════════════════ */}
      <section
        id="contacto"
        className="landing-section landing-contact relative overflow-hidden bg-[#090f1e] px-5 py-20 text-white sm:px-8 lg:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              Admisión y Orientación
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Solicita información de horarios y vacantes
            </h2>
            <p className="text-base leading-7 text-slate-300">
              Déjanos tus datos para enviarte el temario detallado, fechas de inicio y facilidades de pago mensual.
            </p>

            <div className="space-y-3 pt-2 text-sm text-slate-200">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span>Atención directa con asesores académicos</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span>Reserva de vacante en línea en pocos minutos</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span>Opción de pago único o cuotas mensuales</span>
              </div>
            </div>
          </div>

          <div className="landing-contact-form rounded-3xl bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
            {prospectSent ? (
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-72 flex-col items-center justify-center text-center"
              >
                <CheckCircle2 className="h-14 w-14 text-emerald-600" />
                <h3 className="mt-4 text-2xl font-extrabold">¡Recibimos tu solicitud!</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
                  Nuestro equipo de admisión se pondrá en contacto contigo a la brevedad con toda la información del programa.
                </p>
                <button
                  type="button"
                  onClick={() => setProspectSent(false)}
                  className="cursor-pointer mt-6 rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                >
                  Enviar otra consulta
                </button>
              </div>
            ) : (
              <form onSubmit={submitProspect} className="space-y-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-950">Solicita orientación gratuita</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Completa tus datos y te enviaremos el brochure y cronograma de inicio.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label htmlFor="prospect-name" className="text-xs font-bold text-slate-700">
                    Nombre completo
                    <Input
                      id="prospect-name"
                      required
                      value={prospectForm.name}
                      onChange={(e) => setProspectForm((v) => ({ ...v, name: e.target.value }))}
                      className="mt-1.5 h-11 rounded-xl"
                      placeholder="Tu nombre y apellido"
                    />
                  </label>
                  <label htmlFor="prospect-contact" className="text-xs font-bold text-slate-700">
                    Correo o WhatsApp
                    <Input
                      id="prospect-contact"
                      required
                      value={prospectForm.contact}
                      onChange={(e) => setProspectForm((v) => ({ ...v, contact: e.target.value }))}
                      className="mt-1.5 h-11 rounded-xl"
                      placeholder="999 888 777 o correo@ejemplo.com"
                    />
                  </label>
                </div>
                <label htmlFor="prospect-cohort" className="block text-xs font-bold text-slate-700">
                  Programa de interés
                  <select
                    id="prospect-cohort"
                    value={prospectForm.cohortId}
                    onChange={(e) => setProspectForm((v) => ({ ...v, cohortId: e.target.value }))}
                    className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                  >
                    <option value="">Deseo orientación general</option>
                    {activeCohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.course?.name || cohort.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="prospect-message" className="block text-xs font-bold text-slate-700">
                  ¿Qué información necesitas?
                  <textarea
                    id="prospect-message"
                    value={prospectForm.message}
                    onChange={(e) => setProspectForm((v) => ({ ...v, message: e.target.value }))}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal"
                    placeholder="Horarios, cuotas mensuales, contenido del temario..."
                  />
                </label>
                <label className="cursor-pointer flex items-start gap-2.5 text-xs leading-5 text-slate-600">
                  <input
                    required
                    type="checkbox"
                    checked={prospectForm.privacyConsent}
                    onChange={(e) =>
                      setProspectForm((v) => ({ ...v, privacyConsent: e.target.checked }))
                    }
                    className="cursor-pointer mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                  />
                  <span>
                    Acepto el tratamiento de mis datos según la{" "}
                    <Link href="/privacy" className="font-bold text-blue-700 underline">
                      política de privacidad
                    </Link>
                    .
                  </span>
                </label>
                {prospectError && (
                  <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {prospectError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={prospectSending}
                  className="cursor-pointer h-12 w-full rounded-xl bg-slate-950 font-bold text-white shadow-md hover:bg-blue-700"
                >
                  {prospectSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Quiero recibir información
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      <BrochureModal
        open={Boolean(brochureCohort)}
        onClose={() => setBrochureCohort(null)}
        cohort={brochureCohort}
        settings={settings}
      />
    </div>
  );
}
