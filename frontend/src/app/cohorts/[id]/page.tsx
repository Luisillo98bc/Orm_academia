"use client";

import type { Cohort, PlatformSettings, SyllabusModule, User } from "@/types/domain";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import { formatMoney, getCohortPricing } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrochureModal } from "@/components/brochure-modal";
import { RecoveryScreen } from "@/components/system/recovery-screen";
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Heart,
  Laptop,
  QrCode,
  Share2,
  Shield,
  Smartphone,
  Target,
  UserCheck,
  Users,
  Video,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import Image from "next/image";
import { trackConversion } from "@/lib/analytics";
import { getCohortImageUrl, getMediaUrl } from "@/lib/media";
import { toast } from "sonner";

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Nivel Inicial",
  INTERMEDIATE: "Nivel Intermedio",
  ADVANCED: "Nivel Avanzado",
};

const MODALITY_LABELS: Record<string, string> = {
  ONLINE: "En Vivo / Asíncrono",
  IN_PERSON: "Presencial",
  HYBRID: "Híbrido",
};

export default function CohortLandingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [allCohorts, setAllCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof params.id === "string" &&
      window.localStorage.getItem(`academy:saved-cohort:${params.id}`) === "true",
  );
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (typeof params.id === "string") {
      trackConversion("PROGRAM_VIEW", { cohortId: params.id, metadata: { source: "program_page" } });
    }
    fetchCatalogApi<Cohort[]>("/academic/public/cohorts", "cohorts")
      .then((data) => {
        const found = (data || []).find((c: Cohort) => c.id === params.id);
        setCohort(found || null);
        setAllCohorts(data || []);
      })
      .catch(console.error);

    fetchCatalogApi<PlatformSettings>("/settings/public", "settings")
      .then((data) => setSettings(data || null))
      .catch(() => undefined);

    fetchApi(`/academic/cohorts/public/${params.id}/modules`)
      .then((data) => setModules(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!user || typeof params.id !== "string") return;
    fetchApi("/academic/favorites")
      .then((favorites) => {
        const savedIds = new Set((favorites || []).map((favorite: { cohortId: string }) => favorite.cohortId));
        setIsSaved(savedIds.has(params.id as string));
      })
      .catch(() => undefined);
  }, [params.id, user]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl space-y-8 px-6 py-12">
        <div className="shimmer-loading h-80 rounded-3xl border border-border/60" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="shimmer-loading h-96 rounded-3xl border border-border/60 lg:col-span-2" />
          <div className="shimmer-loading h-96 rounded-3xl border border-border/60" />
        </div>
      </div>
    );
  }
  if (!cohort) {
    return <RecoveryScreen kind="not-found" compact reference={typeof params.id === "string" ? params.id : undefined} />;
  }

  const handleBuy = () => {
    if (!user) {
      trackConversion("REGISTRATION_STARTED", { cohortId: cohort.id });
      router.push(`/register?cohortId=${cohort.id}`);
    } else {
      trackConversion("CHECKOUT_STARTED", { cohortId: cohort.id });
      router.push(`/dashboard/checkout?cohortId=${cohort.id}`);
    }
  };

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    if (typeof params.id !== "string") return;
    const nextValue = !isSaved;
    try {
      if (user) {
        await fetchApi(`/academic/cohorts/${params.id}/favorite`, { method: nextValue ? "POST" : "DELETE" });
        setIsSaved(nextValue);
        toast.success(nextValue ? "Edición guardada en tu cuenta" : "Edición quitada de tus favoritos");
      } else {
        setIsSaved(nextValue);
        window.localStorage.setItem(`academy:saved-cohort:${params.id}`, String(nextValue));
        toast.success(nextValue ? "Inicia sesión para sincronizar tus favoritos" : "Edición quitada de guardados");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar favoritos");
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const shareData = {
        title: cohort?.course?.name || "Academia Virtual",
        text: cohort?.name || "Conoce este programa",
        url: window.location.href,
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Enlace copiado al portapapeles");
      } else {
        toast.error("Tu navegador no permite compartir este enlace");
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error("No se pudo compartir el programa");
    } finally {
      setIsSharing(false);
    }
  };

  const whatYouWillLearnList = cohort.course?.whatYouWillLearn
    ? cohort.course.whatYouWillLearn.split("\n").filter((item: string) => item.trim() !== "")
    : [];
  const getEmbedUrl = (url?: string | null) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };
  const videoEmbedUrl = getEmbedUrl(cohort.course?.promotionalVideoUrl);

  const mainTeacher = cohort.teachers?.[0];
  const suggestedCohorts = allCohorts.filter((c) => c.id !== params.id).slice(0, 4);
  const pricing = getCohortPricing(cohort);
  const capacity = cohort.maxCapacity || cohort.maxStudents;
  const enrolled = cohort.enrolledCount ?? cohort.enrollmentCount ?? cohort._count?.enrollments ?? 0;
  const remainingSeats = capacity ? Math.max(capacity - enrolled, 0) : null;

  const courseStructuredData = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: cohort.course?.name || cohort.name,
    description: cohort.course?.description || cohort.name,
    provider: {
      "@type": "EducationalOrganization",
      name: settings?.academyName || "Academia Virtual",
    },
    offers: {
      "@type": "Offer",
      price: pricing.finalPrice.toFixed(2),
      priceCurrency: "PEN",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="course-page flex min-h-screen flex-col bg-background pb-28 font-sans text-foreground selection:bg-primary/20 selection:text-foreground lg:pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseStructuredData) }}
      />

      {/* ── HEADER / HERO ── */}
      <section className="border-b border-border bg-[radial-gradient(circle_at_85%_10%,rgba(37,99,235,.12),transparent_28%),linear-gradient(180deg,hsl(var(--muted)/.55),hsl(var(--background)))] px-6 pb-12 pt-10 lg:px-8">
        <div className="container mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">
              Edición del programa
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                {(cohort.course?.level && LEVEL_LABELS[cohort.course.level]) || cohort.course?.level || "Nivel General"}
              </span>
              {cohort.course?.targetAudience && (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-300">
                  <Target className="h-4 w-4" /> {cohort.course.targetAudience}
                </span>
              )}
              {remainingSeats !== null && remainingSeats > 0 && remainingSeats <= 10 && (
                <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300">
                  ¡Quedan {remainingSeats} vacantes!
                </span>
              )}
            </div>

            <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              {cohort.course?.name}
            </h1>

            <p className="text-xl font-medium leading-relaxed text-muted-foreground">
              {cohort.name} - {cohort.course?.description}
            </p>

            {/* Teacher Snippet */}
            <div className="mt-2 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-blue-500/10 text-xl font-black text-blue-700 shadow-sm dark:text-blue-300">
                {mainTeacher && getMediaUrl(mainTeacher.profilePicture || mainTeacher.profileImage) ? (
                  <Image
                    unoptimized
                    width={56}
                    height={56}
                    src={getMediaUrl(mainTeacher.profilePicture || mainTeacher.profileImage)!}
                    alt={`${mainTeacher.firstName} ${mainTeacher.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : mainTeacher ? (
                  `${mainTeacher.firstName[0]}${mainTeacher.lastName[0]}`
                ) : (
                  <GraduationCap className="h-7 w-7" aria-hidden="true" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Docente de la edición</p>
                <p className="text-lg font-bold text-foreground">
                  {mainTeacher ? `${mainTeacher.firstName} ${mainTeacher.lastName}` : "Equipo Académico"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                aria-pressed={isSaved}
                onClick={() => void handleSave()}
                className={`cursor-pointer h-12 gap-2 rounded-full border-border px-6 font-bold shadow-sm hover:bg-secondary hover:text-foreground ${
                  isSaved ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "text-muted-foreground"
                }`}
              >
                <Heart className={`h-5 w-5 text-rose-500 ${isSaved ? "fill-current" : ""}`} /> {isSaved ? "Guardado" : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleShare()}
                disabled={isSharing}
                className="cursor-pointer h-12 gap-2 rounded-full border-border px-6 font-bold text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground"
              >
                <Share2 className="h-5 w-5" /> {isSharing ? "Compartiendo..." : "Compartir"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBrochureOpen(true)}
                className="cursor-pointer h-12 gap-2 rounded-full border-blue-600/30 bg-blue-500/10 px-6 font-bold text-blue-800 shadow-sm hover:bg-blue-500/20 dark:text-blue-300"
              >
                <FileText className="h-5 w-5" /> Descargar Temario PDF
              </Button>
            </div>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-blue-500/20 bg-muted shadow-2xl shadow-slate-950/15">
            {videoEmbedUrl ? (
              <iframe
                src={videoEmbedUrl}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : getCohortImageUrl(cohort) ? (
              <Image
                unoptimized
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                src={getCohortImageUrl(cohort)!}
                alt={`Imagen de ${cohort.name}`}
                className="absolute inset-0 object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-[#090f1e] to-blue-700/80">
                <BookOpen className="h-20 w-20 text-white/60" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── BANDA DE ATRIBUTOS ── */}
      <section className="border-b border-border bg-muted/20">
        <div className="container mx-auto flex max-w-6xl flex-wrap justify-center gap-4 px-6 py-6 md:justify-start md:gap-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">Duración Total</p>
              <p className="font-black text-foreground">
                {cohort.course?.durationHours ? `${cohort.course.durationHours} horas` : "Por definir"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">Tamaño de Clase</p>
              <p className="font-black text-foreground">Máx {cohort.maxStudents} est.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">Formato</p>
              <p className="font-black text-foreground">
                {cohort.modality ? MODALITY_LABELS[cohort.modality] || cohort.modality : "En Vivo / Asíncrono"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">Certificación</p>
              <p className="font-black text-foreground">Verificable con QR</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="container mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-16 px-6 lg:grid-cols-3">
        {/* ── COLUMNA IZQUIERDA ── */}
        <div className="space-y-14 lg:col-span-2">
          {/* Descripción Ampliada */}
          <section>
            <h2 className="mb-6 text-3xl font-black text-foreground">Sobre esta edición</h2>
            <div className="space-y-5 text-lg leading-relaxed text-muted-foreground">
              <p>{cohort.course?.description}</p>
              <p>
                Esta edición, <strong>{cohort.name}</strong>, está diseñada para proporcionar una experiencia de aprendizaje completa y guiada. Nos enfocamos en brindar todas las herramientas necesarias para que cada estudiante pueda aplicar lo aprendido inmediatamente.
              </p>
            </div>
          </section>

          {/* Lo que aprenderás */}
          {whatYouWillLearnList.length > 0 && (
            <section>
              <h2 className="mb-6 text-3xl font-black text-foreground">Objetivos de Aprendizaje</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {whatYouWillLearnList.map((item: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-4 rounded-2xl border border-blue-500/15 bg-blue-500/10 p-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <span className="font-medium leading-relaxed text-foreground">{item.replace(/^- /, "")}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Temario Acordeón */}
          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-3xl font-black text-foreground">Plan de Estudios</h2>
              <button
                type="button"
                onClick={() => setBrochureOpen(true)}
                className="cursor-pointer inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline dark:text-blue-400"
              >
                <FileText className="h-4 w-4" /> Descargar sílabo en PDF
              </button>
            </div>

            <div className="space-y-4">
              {modules.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-border bg-muted/40 p-10 text-center">
                  <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="font-bold text-muted-foreground">El plan de estudios detallado estará disponible pronto.</p>
                </div>
              ) : (
                modules.map((mod: SyllabusModule, idx: number) => (
                  <div
                    key={mod.id}
                    className={`rounded-3xl border-2 transition-all duration-200 ${
                      expandedModules[mod.id]
                        ? "border-primary/30 bg-card shadow-lg shadow-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className="cursor-pointer flex w-full items-center justify-between rounded-3xl p-6 text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-6">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-black transition-colors ${
                            expandedModules[mod.id]
                              ? "bg-blue-600 text-white"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <h3 className="text-xl font-bold text-foreground">{mod.title}</h3>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        {expandedModules[mod.id] ? "−" : "+"}
                      </div>
                    </button>

                    {expandedModules[mod.id] && (
                      <div className="ml-[4.5rem] px-6 pb-6 pt-2 text-muted-foreground">
                        {mod.description ? (
                          <p className="mb-4 text-lg leading-relaxed">{mod.description}</p>
                        ) : (
                          <p className="mb-4 italic text-muted-foreground">Sin descripción detallada para este módulo.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Requisitos y Herramientas */}
          <section>
            <h2 className="mb-6 text-3xl font-black text-foreground">Requisitos para participar</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5">
                <Laptop className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h3 className="mt-3 font-bold text-foreground">Equipo de cómputo</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  Computadora o laptop (Windows, Mac o Linux) para desarrollar las prácticas durante las sesiones.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <Wifi className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h3 className="mt-3 font-bold text-foreground">Conexión estable</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  Conexión a internet y auriculares/micrófono opcional para interactuar en vivo con el docente.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <Award className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h3 className="mt-3 font-bold text-foreground">Nivel requerido</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {cohort.course?.level === "BEGINNER"
                    ? "No requiere experiencia previa; empezamos paso a paso desde las bases."
                    : "Se recomienda contar con nociones iniciales para aprovechar los retos prácticos."}
                </p>
              </div>
            </div>
          </section>

          {/* Docentes */}
          <section>
            <h2 className="mb-8 text-3xl font-black text-foreground">
              {cohort.teachers && cohort.teachers.length > 1 ? "Conoce a tus docentes" : "Conoce al docente"}
            </h2>
            <div className="space-y-8">
              {cohort.teachers?.map((t: User) => {
                const teacherImageUrl = getMediaUrl(t.profilePicture || t.profileImage);
                const teacherPosition = t.position?.trim();
                const teacherDepartment = t.department?.trim();
                return (
                  <div key={t.id} className="rounded-3xl border border-blue-500/15 bg-blue-500/10 p-8">
                    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
                      <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-border bg-card text-4xl font-black text-blue-700 shadow-xl shadow-slate-950/10 dark:text-blue-300">
                        {teacherImageUrl ? (
                          <Image
                            unoptimized
                            width={128}
                            height={128}
                            src={teacherImageUrl}
                            alt={`${t.firstName} ${t.lastName}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          `${t.firstName[0]}${t.lastName[0]}`
                        )}
                      </div>
                      <div className="text-center sm:text-left">
                        <h3 className="mb-2 text-2xl font-black text-foreground">
                          {t.firstName} {t.lastName}
                        </h3>
                        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-muted-foreground sm:justify-start">
                          <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm">
                            <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Docente asignado
                          </span>
                          {teacherPosition && (
                            <span className="rounded-full border border-border bg-card px-3 py-1.5 shadow-sm">{teacherPosition}</span>
                          )}
                          {teacherDepartment && (
                            <span className="rounded-full border border-border bg-card px-3 py-1.5 shadow-sm">{teacherDepartment}</span>
                          )}
                        </div>
                        {t.bio && <p className="text-lg leading-relaxed text-muted-foreground">{t.bio}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!cohort.teachers || cohort.teachers.length === 0) && (
                <div className="rounded-3xl border-2 border-dashed border-border p-8 text-center font-bold text-muted-foreground">
                  Profesor por asignar
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── COLUMNA DERECHA: TARJETA DE COMPRA ── */}
        <div className="relative">
          <div className="sticky top-24">
            <Card className="relative z-10 overflow-hidden rounded-[2rem] border border-blue-500/15 bg-card p-2 shadow-2xl shadow-slate-950/15">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-blue-500/10 via-card to-amber-500/5 p-8">
                {pricing.discountActive ? (
                  <div className="mb-6">
                    <div className="mb-3 inline-block rounded-full bg-rose-100 px-3 py-1 text-sm font-black text-rose-700">
                      ¡Ahorras {pricing.discountPercentage}%!
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-muted-foreground line-through">S/ {formatMoney(cohort.price)}</span>
                      <span className="text-5xl font-black text-blue-700 dark:text-blue-300">
                        S/ {pricing.finalPrice.toFixed(2)}
                        {(cohort.installments ?? 1) > 1 && (
                          <span className="ml-1.5 text-lg font-bold text-muted-foreground">/ mes</span>
                        )}
                      </span>
                    </div>
                    {(cohort.installments ?? 1) > 1 && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-extrabold text-violet-700 dark:text-violet-300">
                        Facilidad de pago: {cohort.installments} cuotas mensuales
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="text-5xl font-black text-blue-700 dark:text-blue-300">
                      {pricing.basePrice > 0 ? `S/ ${formatMoney(cohort.price)}` : "¡Gratis!"}
                      {pricing.basePrice > 0 && (cohort.installments ?? 1) > 1 && (
                        <span className="ml-1.5 text-lg font-bold text-muted-foreground">/ mes</span>
                      )}
                    </div>
                    {pricing.basePrice > 0 && (cohort.installments ?? 1) > 1 && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-extrabold text-violet-700 dark:text-violet-300">
                        Facilidad de pago: {cohort.installments} cuotas mensuales
                      </div>
                    )}
                  </div>
                )}

                <Button
                  size="lg"
                  className="cursor-pointer h-16 w-full rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/30 transition-transform hover:-translate-y-1 hover:bg-blue-700"
                  onClick={handleBuy}
                >
                  Inscribirse Ahora
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBrochureOpen(true)}
                  className="cursor-pointer mt-3 h-12 w-full gap-2 rounded-xl font-bold"
                >
                  <FileText className="h-4 w-4" /> Descargar Temario en PDF
                </Button>

                <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
                  <Shield className="h-4 w-4 text-emerald-500" /> Matrícula protegida y verificada
                </div>

                {/* Medios de pago aceptados */}
                <div className="mt-6 rounded-2xl border border-border/80 bg-background/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Medios de pago disponibles</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-foreground">
                    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-2.5">
                      <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Yape / Plin</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-2.5">
                      <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Transferencia</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-2.5">
                      <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Efectivo</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <h4 className="text-lg font-bold text-foreground">La inscripción incluye:</h4>
                  <ul className="space-y-4 font-medium text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                        <Video className="h-3.5 w-3.5" />
                      </div>
                      <span>Sesiones de clase en vivo y grabadas</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                        <BookOpen className="h-3.5 w-3.5" />
                      </div>
                      <span>Material de estudio descargable</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <span>Acceso completo al campus virtual</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                        <QrCode className="h-3.5 w-3.5" />
                      </div>
                      <span>Certificado oficial verificable con QR</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN DE SUGERENCIAS ── */}
      {suggestedCohorts.length > 0 && (
        <div className="container mx-auto mt-20 max-w-6xl border-t border-border px-6 pt-16">
          <h2 className="mb-8 text-3xl font-black text-foreground">Otras ediciones que podrían interesarte</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {suggestedCohorts.map((c: Cohort) => {
              const imageUrl = getCohortImageUrl(c);
              const suggestedPricing = getCohortPricing(c);
              return (
                <Link
                  href={`/cohorts/${c.id}`}
                  key={c.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/10"
                >
                  <div className="relative aspect-[16/8] overflow-hidden bg-muted">
                    {imageUrl ? (
                      <>
                        <Image
                          unoptimized
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          src={imageUrl}
                          alt={c.courseName || c.name}
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-950/10 transition-colors group-hover:bg-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-100 to-amber-100 transition-transform group-hover:scale-105">
                        <BookOpen className="h-10 w-10 text-blue-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-grow flex-col p-5">
                    <span className="mb-2 text-xs font-bold text-blue-700 dark:text-blue-400">{c.name}</span>
                    <h3 className="mb-2 line-clamp-2 font-bold leading-snug text-foreground transition-colors group-hover:text-blue-700 dark:group-hover:text-blue-400">
                      {c.courseName}
                    </h3>
                    <div className="mt-auto flex items-center justify-between pt-4">
                      <span className="font-black text-foreground">
                        {suggestedPricing.finalPrice > 0 ? `S/ ${suggestedPricing.finalPrice.toFixed(2)}` : "Gratis"}
                      </span>
                      <span className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
                        <Users className="h-4 w-4" /> {c.enrollmentCount}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BARRA FIJA DE MATRÍCULA EN MÓVILES ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_25px_-10px_rgba(0,0,0,0.2)] backdrop-blur-md lg:hidden print:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inversión</p>
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="whitespace-nowrap text-lg font-black text-blue-700 dark:text-blue-400">
                {pricing.finalPrice > 0 ? `S/ ${pricing.finalPrice.toFixed(2)}` : "¡Gratis!"}
              </span>
              {pricing.finalPrice > 0 && (cohort.installments ?? 1) > 1 && (
                <span className="whitespace-nowrap text-[11px] font-bold text-violet-700 dark:text-violet-300">
                  / mes ({cohort.installments} cuotas)
                </span>
              )}
              {pricing.discountActive && (
                <span className="whitespace-nowrap text-[11px] text-muted-foreground line-through">S/ {formatMoney(cohort.price)}</span>
              )}
            </div>
          </div>
          <Button
            onClick={handleBuy}
            className="cursor-pointer h-11 shrink-0 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-md hover:bg-blue-700"
          >
            Matricularme ahora
          </Button>
        </div>
      </div>

      <BrochureModal
        open={brochureOpen}
        onClose={() => setBrochureOpen(false)}
        cohort={cohort}
        settings={settings}
      />
    </div>
  );
}
