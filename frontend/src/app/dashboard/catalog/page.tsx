"use client";

import type { Cohort, User } from "@/types/domain";
import type { Money } from "@/lib/money";

import { useState, useEffect, useMemo } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Loader2, BookOpen, GraduationCap, CheckCircle2, ImageIcon, Search, SlidersHorizontal, Users, Calendar, MonitorPlay, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { moneyToNumber } from "@/lib/money";
import { getAnalyticsSessionId, trackConversion } from "@/lib/analytics";
import { getCohortImageUrl } from "@/lib/media";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Nivel Inicial",
  INTERMEDIATE: "Nivel Intermedio",
  ADVANCED: "Nivel Avanzado",
};

function parseCohortMeta(cohortName?: string, courseName?: string) {
  if (!cohortName) return { code: null, group: "Edición activa" };
  const parts = cohortName.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const code = parts[0];
    const rest = parts.slice(1).filter((p) => !courseName || p.toLowerCase() !== courseName.toLowerCase());
    const group = rest.join(" · ") || parts[parts.length - 1];
    return { code, group };
  }
  return { code: null, group: cohortName };
}

export default function CatalogPage() {
  const router = useRouter();
  
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("ALL");
  const [price, setPrice] = useState("ALL");

  const loadCatalog = async () => {
    try {
      // Obtenemos todas las cohortes disponibles
      const [allCohorts, myEnrollments] = await Promise.all([
        fetchApi("/academic/public/cohorts"),
        fetchApi("/academic/enrollments/me").catch(() => ({ data: [] })),
      ]);
      const enrollmentItems = myEnrollments?.data || myEnrollments || [];
      setEnrolledIds(
        new Set(enrollmentItems.map((enrollment: { cohortId: string }) => enrollment.cohortId)),
      );
      setCohorts(allCohorts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCatalog();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleEnroll = async (cohortId: string, price: Money) => {
    if (moneyToNumber(price) > 0) {
      // Registrar la solicitud de matrícula y coordinar el pago en efectivo.
      trackConversion("CHECKOUT_STARTED", { cohortId, metadata: { source: "dashboard_catalog" } });
      router.push(`/dashboard/checkout?cohortId=${cohortId}`);
    } else {
      // Matrícula gratuita: procesar directamente
      setEnrolling(cohortId);
      try {
        await fetchApi("/payments/checkout", {
          method: "POST",
          body: JSON.stringify({
            cohortId,
            method: "EFECTIVO",
            analyticsSessionId: getAnalyticsSessionId(),
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        router.push("/dashboard/my-courses");
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Error al matricularse. Es posible que ya estés matriculado o la cohorte esté llena."));
        setEnrolling(null);
      }
    }
  };

  const filteredCohorts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return cohorts.filter((cohort) => {
      const matchesSearch = !normalizedSearch || `${cohort.name} ${cohort.course?.name || ""}`.toLowerCase().includes(normalizedSearch);
      const matchesLevel = level === "ALL" || cohort.course?.level === level;
      const amount = moneyToNumber(cohort.price);
      const matchesPrice = price === "ALL" || (price === "FREE" ? amount === 0 : amount > 0);
      return matchesSearch && matchesLevel && matchesPrice;
    });
  }, [cohorts, level, price, search]);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Oferta académica" title="Catálogo de cohortes" description="Explora las clases disponibles y matricúlate en el programa que mejor se adapte a tus objetivos." />

      {cohorts.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No hay clases abiertas" description="El administrador aún no ha abierto ninguna cohorte para matrícula. Vuelve más tarde." />
      ) : (
        <>
          <div className="rounded-2xl border border-border/50 bg-card p-4 glass">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por curso o cohorte..." className="pl-9" aria-label="Buscar cursos" /></div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filtrar:</span></div>
              <select value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" aria-label="Filtrar por nivel"><option value="ALL">Todos los niveles</option><option value="BEGINNER">Inicial</option><option value="INTERMEDIATE">Intermedio</option><option value="ADVANCED">Avanzado</option></select>
              <select value={price} onChange={(event) => setPrice(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" aria-label="Filtrar por precio"><option value="ALL">Todos los precios</option><option value="FREE">Gratis</option><option value="PAID">De pago</option></select>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Mostrando {filteredCohorts.length} de {cohorts.length} cohortes disponibles.</p>
          </div>

          {filteredCohorts.length === 0 ? <EmptyState icon={<Search className="h-6 w-6" />} title="No encontramos coincidencias" description="Prueba con otro término o limpia los filtros." /> : <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCohorts.map((cls) => {
            const isEnrolled = enrolledIds.has(cls.id);
            const isFull = cls.enrolledCount >= cls.maxCapacity;
            const meta = parseCohortMeta(cls.name, cls.course?.name);
            const levelText = (cls.course?.level && LEVEL_LABELS[cls.course.level]) || cls.course?.level || "Programa Oficial";
            const priceAmount = moneyToNumber(cls.price);
            const seatsLeft = Math.max(cls.maxCapacity - cls.enrolledCount, 0);
            const teacherNames = cls.teachers?.map((t: User) => `${t.firstName || ""} ${t.lastName}`.trim()).join(", ") || "Por asignar";

            return (
              <article
                key={cls.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_12px_36px_-18px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_48px_-18px_rgba(15,23,42,0.26)]"
              >
                {/* Cover Header */}
                <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-primary">
                  {getCohortImageUrl(cls) ? (
                    <Image
                      unoptimized
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      src={getCohortImageUrl(cls)!}
                      alt={`Imagen de ${cls.name}`}
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      <ImageIcon className="h-14 w-14 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/10" />
                  <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />

                  <div className="absolute left-3.5 right-3.5 top-3.5 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/65 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
                      <MonitorPlay className="h-3 w-3 text-amber-300" />
                      {levelText}
                    </span>
                    <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold text-slate-900 shadow-sm">
                      {priceAmount > 0 ? `S/ ${priceAmount.toFixed(2)}` : "Gratis"}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {meta.code && (
                        <span className="shrink-0 rounded-md bg-white/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md border border-white/15">
                          {meta.code}
                        </span>
                      )}
                      <span className="truncate rounded-md bg-slate-950/60 px-2 py-0.5 text-[11px] font-medium text-slate-200 backdrop-blur-md">
                        {meta.group}
                      </span>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                      <Users className="h-3 w-3" />
                      {isFull ? "Agotado" : `${seatsLeft} libres`}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-1">
                    {cls.course?.name || cls.name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">Cohorte: {cls.name}</p>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-border/60 bg-muted/35 p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Docente</p>
                        <p className="truncate text-xs font-semibold text-foreground">{teacherNames}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inicio</p>
                        <p className="truncate text-xs font-semibold text-foreground">
                          {cls.startDate ? new Date(cls.startDate).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "Por definir"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <MonitorPlay className="h-3.5 w-3.5 text-primary" />
                      {cls.modality === "ONLINE" ? "Clases en vivo" : cls.modality || "Modalidad virtual"}
                    </span>
                    <span className="truncate">{cls.schedule || "Horario flexible"}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border/50 bg-muted/20 p-4">
                  {isEnrolled ? (
                    <Button className="w-full rounded-xl" variant="secondary" disabled>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Ya estás matriculado
                    </Button>
                  ) : isFull ? (
                    <Button className="w-full rounded-xl" variant="outline" disabled>
                      Cohorte Llena
                    </Button>
                  ) : (
                    <Button
                      className="w-full cursor-pointer gap-2 rounded-xl font-semibold shadow-sm"
                      onClick={() => handleEnroll(cls.id, cls.price)}
                      disabled={enrolling === cls.id}
                    >
                      {enrolling === cls.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {priceAmount > 0 ? "Pagar Matrícula" : "Matricularme"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>}
        </>
      )}
    </div>
  );
}
