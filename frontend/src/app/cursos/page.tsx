"use client";

import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { CourseComparison } from "@/components/course-comparison";
import { SectionSkeleton } from "@/components/dashboard/data-section";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import { getCohortPricing, moneyToNumber } from "@/lib/money";
import { getMediaUrl } from "@/lib/media";
import type { Cohort, Course } from "@/types/domain";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function levelLabel(level?: string) {
  return ({ BEGINNER: "Inicial", INTERMEDIATE: "Intermedio", ADVANCED: "Avanzado" } as Record<string, string>)[level || ""] || "Programa";
}

function modalityLabel(modality?: string | null) {
  return ({ ONLINE: "En línea", PRESENCIAL: "Presencial", HIBRIDA: "Híbrida" } as Record<string, string>)[modality || ""] || "Modalidad por confirmar";
}

const CATALOG_PARAMS_EVENT = "academy:catalog-params";
function subscribeParams(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CATALOG_PARAMS_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CATALOG_PARAMS_EVENT, onChange);
  };
}
function readParams() {
  return window.location.search.replace(/^\?/, "");
}

function PublicCoursesPage() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const paramSnapshot = useSyncExternalStore(subscribeParams, readParams, () => searchParams.toString());
  const activeParams = useMemo(() => new URLSearchParams(paramSnapshot), [paramSnapshot]);
  const query = activeParams.get("q") || "";
  const valid = (key: string, values: string[], fallback = "ALL") =>
    values.includes(activeParams.get(key) || "") ? activeParams.get(key)! : fallback;
  const level = valid("level", ["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
  const price = valid("price", ["FREE", "PAID"]);
  const modality = valid("modality", ["ONLINE", "PRESENCIAL", "HIBRIDA"]);
  const start = valid("start", ["SOON", "NEXT", "LATER"]);
  const sortBy = valid("sort", ["START_ASC", "PRICE_ASC", "DURATION_DESC"], "START_ASC");
  const selectedIds = [...new Set((activeParams.get("compare") || "").split(",").filter((id) => courses.some((course) => course.id === id)))].slice(0, 3);
  const changeParams = (changes: Record<string, string>) => {
    const currentRaw = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : activeParams.toString();
    const params = new URLSearchParams(currentRaw);
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === "ALL" || (key === "sort" && value === "START_ASC")) params.delete(key);
      else params.set(key, value);
    });
    const nextString = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${nextString ? `?${nextString}` : ""}${window.location.hash}`);
    window.dispatchEvent(new Event(CATALOG_PARAMS_EVENT));
  };
  const [showAllCohorts, setShowAllCohorts] = useState(false);
  const [today] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([fetchCatalogApi<Course[]>("/academic/public/courses", "courses"), fetchCatalogApi<Cohort[]>("/academic/public/cohorts", "cohorts")])
      .then(([courseResult, cohortResult]) => {
        if (!mounted) return;
        const coursesLoaded = courseResult.status === "fulfilled";
        const cohortsLoaded = cohortResult.status === "fulfilled";
        setCourses(coursesLoaded && Array.isArray(courseResult.value) ? courseResult.value : []);
        setCohorts(cohortsLoaded && Array.isArray(cohortResult.value) ? cohortResult.value : []);
        if (!coursesLoaded && !cohortsLoaded) {
          setLoadError("No pudimos conectar con el catálogo. Revisa tu conexión e inténtalo nuevamente.");
        } else if (!coursesLoaded || !cohortsLoaded) {
          setLoadError("El catálogo está parcialmente disponible. Algunas cohortes pueden tardar en aparecer.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openCohorts = useMemo(
    () => cohorts
      .filter((cohort) => cohort.isActive && new Date(cohort.endDate).getTime() >= today)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [cohorts, today],
  );

  const courseItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return courses
      // The public endpoint already excludes unpublished/deleted courses and
      // intentionally omits the administrative flag from its payload.
      .filter((course) => course.isPublished !== false)
      .map((course) => {
        const courseCohorts = openCohorts.filter((cohort) => cohort.courseId === course.id);
        return { course, cohorts: courseCohorts, nextCohort: courseCohorts[0] };
      })
      .filter(({ course, nextCohort }) => {
        const matchesQuery = !normalizedQuery || `${course.name} ${course.description || ""}`.toLowerCase().includes(normalizedQuery);
        const matchesLevel = level === "ALL" || course.level === level;
        const amount = nextCohort ? moneyToNumber(nextCohort.price) : null;
        const matchesPrice = price === "ALL" || (price === "FREE" ? amount === 0 : amount !== null && amount > 0);
        const matchesModality = modality === "ALL" || nextCohort?.modality === modality;
        const daysToStart = nextCohort ? Math.ceil((new Date(nextCohort.startDate).getTime() - today) / 86_400_000) : null;
        const matchesStart = start === "ALL" || (daysToStart !== null && (start === "SOON" ? daysToStart <= 30 : start === "NEXT" ? daysToStart <= 90 : daysToStart > 90));
        return matchesQuery && matchesLevel && matchesPrice && matchesModality && matchesStart;
      })
      .sort((a, b) => {
        if (sortBy === "PRICE_ASC") {
          const priceA = a.nextCohort ? getCohortPricing(a.nextCohort).finalPrice : Number.MAX_SAFE_INTEGER;
          const priceB = b.nextCohort ? getCohortPricing(b.nextCohort).finalPrice : Number.MAX_SAFE_INTEGER;
          return priceA - priceB;
        }
        if (sortBy === "DURATION_DESC") {
          return (b.course.durationHours || 0) - (a.course.durationHours || 0);
        }
        const startA = a.nextCohort ? new Date(a.nextCohort.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        const startB = b.nextCohort ? new Date(b.nextCohort.startDate).getTime() : Number.MAX_SAFE_INTEGER;
        return startA - startB;
      });
  }, [courses, level, modality, openCohorts, price, query, sortBy, start, today]);

  const visibleCohorts = showAllCohorts ? openCohorts : openCohorts.slice(0, 6);

  const hasFilters = Boolean(query || level !== "ALL" || price !== "ALL" || modality !== "ALL" || start !== "ALL");
  const clearFilters = () => changeParams({ q: "", level: "", price: "", modality: "", start: "", sort: "" });
  const comparisonItems = selectedIds.flatMap((id) => {
    const course = courses.find((item) => item.id === id);
    return course ? [{ course, cohort: openCohorts.find((cohort) => cohort.courseId === id) }] : [];
  });

  if (loading) {
    return (
      <div className="programs-page min-h-screen bg-slate-100/70 pb-20 dark:bg-slate-950" aria-busy="true" aria-label="Cargando programas">
        <section className="border-b border-slate-800 bg-[#090f1e] px-5 py-12 text-white sm:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl animate-pulse space-y-4">
            <div className="h-3.5 w-36 rounded-full bg-white/15" />
            <div className="h-11 max-w-2xl rounded-xl bg-white/15" />
            <div className="h-5 max-w-xl rounded-lg bg-white/10" />
            <div className="mt-6 h-16 rounded-2xl bg-white/10" />
          </div>
        </section>
        <section className="px-5 py-12 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-96 animate-pulse rounded-2xl bg-card" />)}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="programs-page min-h-screen bg-slate-100/70 pb-20 dark:bg-slate-950">
      <section className="border-b border-slate-800 bg-[#090f1e] px-5 py-12 text-white sm:px-8 lg:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Catálogo académico</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              Encuentra el programa ideal en clases en vivo
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Cursos virtuales síncronos en programación, robótica, datos y diseño. Filtra por nivel, modalidad o próxima fecha de inicio.
            </p>
          </div>

          <form onSubmit={(event) => event.preventDefault()} role="search" aria-label="Buscar y filtrar programas" className="mt-7 grid gap-2.5 rounded-2xl border border-border/80 bg-card p-3 shadow-xl sm:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1fr_1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => changeParams({ q: event.target.value })}
                placeholder="Buscar por curso o tema..."
                className="h-11 rounded-xl border-input bg-background pl-9 text-foreground"
                aria-label="Buscar programas"
              />
            </div>
            <select value={level} onChange={(event) => changeParams({ level: event.target.value })} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground" aria-label="Filtrar por nivel"><option value="ALL">Todos los niveles</option><option value="BEGINNER">Inicial</option><option value="INTERMEDIATE">Intermedio</option><option value="ADVANCED">Avanzado</option></select>
            <select value={price} onChange={(event) => changeParams({ price: event.target.value })} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground" aria-label="Filtrar por precio"><option value="ALL">Todos los precios</option><option value="FREE">Gratis</option><option value="PAID">De pago</option></select>
            <select value={modality} onChange={(event) => changeParams({ modality: event.target.value })} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground" aria-label="Filtrar por modalidad"><option value="ALL">Todas las modalidades</option><option value="ONLINE">En línea</option><option value="PRESENCIAL">Presencial</option><option value="HIBRIDA">Híbrida</option></select>
            <select value={start} onChange={(event) => changeParams({ start: event.target.value })} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground" aria-label="Filtrar por fecha de inicio"><option value="ALL">Cualquier inicio</option><option value="SOON">Inicia en 30 días</option><option value="NEXT">Inicia en 90 días</option><option value="LATER">Más adelante</option></select>
            {hasFilters && <Button type="button" variant="ghost" onClick={clearFilters} className="justify-center gap-2 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800 sm:col-span-2 lg:col-span-5"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Limpiar filtros <X className="h-4 w-4" aria-hidden="true" /></Button>}
          </form>
        </div>
      </section>

      {loadError && (
        <section className="px-5 pt-8 sm:px-8" aria-label="Estado del catálogo">
          <div role="alert" className="mx-auto flex max-w-7xl flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span>
            <Button type="button" variant="outline" onClick={() => window.location.reload()} className="shrink-0 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100">Reintentar</Button>
          </div>
        </section>
      )}

      <section className="px-5 py-10 sm:px-8 lg:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" aria-live="polite">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                {courseItems.length} {courseItems.length === 1 ? "programa disponible" : "programas disponibles"}
              </span>
            </div>
            <select
              value={sortBy}
              onChange={(event) => changeParams({ sort: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              aria-label="Ordenar programas"
            >
              <option value="START_ASC">Ordenar: Próximo inicio</option>
              <option value="PRICE_ASC">Ordenar: Menor inversión</option>
              <option value="DURATION_DESC">Ordenar: Mayor duración</option>
            </select>
          </div>

          <CourseComparison items={comparisonItems} clear={() => changeParams({ compare: "" })} />

          {courseItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
              <Search className="mx-auto h-8 w-8 text-blue-600" aria-hidden="true" />
              <p className="mt-4 font-semibold text-foreground">{loadError ? "No pudimos consultar los programas disponibles." : "No encontramos programas con esos filtros."}</p>
              <p className="mt-1">{loadError ? "Usa Reintentar para volver a consultar el catálogo." : "Prueba con otra búsqueda o limpia los filtros para ver todo el catálogo."}</p>
              {hasFilters && <Button type="button" variant="outline" onClick={clearFilters} className="mt-5 gap-2"><X className="h-4 w-4" aria-hidden="true" /> Limpiar filtros</Button>}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {courseItems.map(({ course, cohorts: courseCohorts, nextCohort }) => {
                const imageUrl = getMediaUrl(course.imageUrl || nextCohort?.imageUrl);
                const durationLabel = course.durationHours > 0 ? `${course.durationHours} horas` : "En vivo";
                const nextPricing = nextCohort ? getCohortPricing(nextCohort) : null;
                const isSelected = selectedIds.includes(course.id);
                return (
                  <article key={course.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-600/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <div className="relative aspect-[16/9] overflow-hidden bg-slate-950">
                      {imageUrl ? (
                        <Image
                          unoptimized={!imageUrl.startsWith("/course-images/")}
                          fill
                          sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                          src={imageUrl}
                          alt={course.name}
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-slate-900" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-slate-950/20" />
                      <span className="absolute left-3.5 top-3.5 rounded-md bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                        {levelLabel(course.level)}
                      </span>
                      {nextPricing && (
                        <span className="absolute right-3.5 top-3.5 rounded-md bg-white px-2.5 py-1 text-xs font-extrabold text-slate-950 shadow-sm">
                          {nextPricing.finalPrice > 0 ? `S/ ${nextPricing.finalPrice.toFixed(2)}` : "Gratis"}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="text-lg font-extrabold leading-snug tracking-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                        {course.name}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {course.description || "Curso virtual síncrono con docente en directo y certificación verificable."}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                          <span>{durationLabel}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                          <span>{courseCohorts.length > 0 ? `${courseCohorts.length} ${courseCohorts.length === 1 ? "edición" : "ediciones"}` : "Próxima apertura"}</span>
                        </span>
                        <span className="col-span-2 flex items-center gap-1.5 border-t border-slate-200/70 pt-2 text-[11px] dark:border-slate-800">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                          <span>{nextCohort ? `Inicio: ${formatDate(nextCohort.startDate)}` : "Fechas próximas por anunciar"}</span>
                        </span>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                          <input
                            type="checkbox"
                            aria-label={`Comparar ${course.name}`}
                            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                            checked={isSelected}
                            disabled={!isSelected && selectedIds.length >= 3}
                            onChange={(event) => changeParams({ compare: (event.target.checked ? [...selectedIds, course.id] : selectedIds.filter((id) => id !== course.id)).join(",") })}
                          />
                          <span>Comparar</span>
                        </label>
                        <Link
                          href={`/programas/${course.id}`}
                          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          Ver programa <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section id="ediciones" className="relative overflow-hidden border-t border-slate-800 bg-[#090f1e] px-5 py-16 text-white sm:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Próximas ediciones</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Fechas y cupos disponibles</h2>
            <p className="mt-3 text-base leading-7 text-slate-300">Compara cuándo empieza cada grupo en vivo, cuántas vacantes quedan y la inversión o cuotas.</p>
          </div>
          {openCohorts.length === 0 ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-8 text-center text-slate-300">
              <CalendarDays className="mx-auto h-9 w-9 text-amber-400" aria-hidden="true" />
              <p className="mt-4 font-semibold text-white">Pronto anunciaremos nuevas fechas.</p>
              <p className="mt-1 text-sm">Déjanos tus datos en la página principal y te avisaremos cuando se abra una nueva edición.</p>
            </div>
          ) : (
            <>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleCohorts.map((cohort) => {
              const capacity = cohort.maxCapacity || cohort.maxStudents;
              const enrolled = cohort.enrolledCount ?? cohort.enrollmentCount ?? 0;
              const seats = capacity ? Math.max(capacity - enrolled, 0) : null;
              const occupancy = capacity ? Math.min((enrolled / capacity) * 100, 100) : 18;

              return (
                <article key={cohort.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-xl transition hover:-translate-y-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Matrícula abierta</p>
                      <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-600">{cohort.course?.name || "Programa académico"}</p>
                      <h3 className="mt-1 line-clamp-2 text-lg font-extrabold leading-6 text-slate-950">{cohort.name}</h3>
                    </div>
                    {(() => {
                      const pricing = getCohortPricing(cohort);
                      return (
                        <div className="shrink-0 rounded-xl bg-blue-50 px-3 py-2 text-right">
                          <span className="block text-sm font-black text-blue-700">S/ {pricing.finalPrice.toFixed(2)}</span>
                          {pricing.discountActive && (
                            <span className="block text-[11px] text-slate-400 line-through">S/ {pricing.basePrice.toFixed(2)}</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-blue-600" />{formatDate(cohort.startDate)}</span>
                    <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-blue-600" />{cohort.course?.durationHours ? `${cohort.course.durationHours} h` : "En vivo"}</span>
                    <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-600" />{seats === null ? "Cupos limitados" : `${seats} cupos libres`}</span>
                    <span className="font-semibold text-blue-700">{modalityLabel(cohort.modality)}</span>
                  </div>

                  <div className="mt-5">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500"><span>Ocupación</span><span>{enrolled}/{capacity || "—"} cupos</span></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${occupancy}%` }} /></div>
                  </div>

                  <Button asChild className="mt-5 w-full gap-2 rounded-xl bg-slate-950 font-bold text-white hover:bg-blue-700"><Link href={`/cohorts/${cohort.id}`} aria-label={`Ver edición ${cohort.name}`}>Ver edición y matricularme <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
                </article>
              );
            })}
            </div>
            {openCohorts.length > 6 && (
              <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center sm:flex-row sm:text-left">
                <p className="text-sm text-slate-300">{showAllCohorts ? "Estás viendo todas las ediciones disponibles." : `Hay ${openCohorts.length - 6} ediciones más para comparar.`}</p>
                <Button type="button" variant="outline" onClick={() => setShowAllCohorts((value) => !value)} className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                  {showAllCohorts ? "Mostrar menos" : "Ver todas las ediciones"}
                </Button>
              </div>
            )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function CoursesPage() {
  return <Suspense fallback={<SectionSkeleton label="Cargando programas" />}><PublicCoursesPage /></Suspense>;
}
