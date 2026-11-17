"use client";

import type { Cohort, Enrollment } from "@/types/domain";

import { useRemoteData } from "@/lib/use-remote-data";
import { DataSection } from "@/components/dashboard/data-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, CheckCircle2, Library, Clock, ArrowRight, TrendingUp, Flame, Trophy, GraduationCap, MonitorPlay, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/dashboard/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { getCohortImageUrl } from "@/lib/media";
import { moneyToNumber } from "@/lib/money";

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Nivel Inicial",
  INTERMEDIATE: "Nivel Intermedio",
  ADVANCED: "Nivel Avanzado",
};

function parseCohortMeta(cohortName?: string, courseName?: string) {
  if (!cohortName) return { code: null, group: "Edición activa", subtitle: "Edición regular" };
  const parts = cohortName.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const code = parts[0];
    const rest = parts.slice(1).filter((p) => !courseName || p.toLowerCase() !== courseName.toLowerCase());
    const group = rest.join(" · ") || parts[parts.length - 1];
    return { code, group, subtitle: `${code} · ${group}` };
  }
  return { code: null, group: cohortName, subtitle: cohortName };
}

function formatShortDate(value?: string | null) {
  if (!value) return "Por definir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Por definir";
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

interface LearningOverview {
  nextClass: null | { title: string; date: string; meetLink?: string; cohortId: string; courseName: string };
  pendingEvaluations: Array<{ id: string; title: string; dueDate?: string; cohortId: string; courseName: string }>;
  courses: Array<{ cohortId: string; progressPercent: number; completedItems: number; totalItems: number }>;
}

interface Engagement {
  points: number;
  streak: number;
  activeCourses: number;
  badges: Array<{ key: string; label: string; description: string }>;
  nextActivity: { type: string; title: string; cohortId: string } | null;
}

type LearningOverviewWithEngagement = LearningOverview & {
  engagement?: Engagement;
};

export function StudentView() {
  const catalog = useRemoteData<Cohort[]>("/academic/public/cohorts");
  const enrollmentResource = useRemoteData<Enrollment[] | { data: Enrollment[] }>("/academic/enrollments/me");
  const learning = useRemoteData<LearningOverviewWithEngagement>("/academic/student/learning-overview?includeEngagement=true");
  const overview = learning.data;
  const engagement = overview?.engagement;
  const enrollments = Array.isArray(enrollmentResource.data) ? enrollmentResource.data : enrollmentResource.data?.data || [];
  const enrolledCohorts = enrollments.flatMap((enrollment) => {
    const cohort = enrollment.cohort || catalog.data?.find((item) => item.id === enrollment.cohortId);
    return cohort ? [{ ...cohort, enrollment }] : [];
  });
  const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.cohortId));
  const availableCohorts = (catalog.data || []).filter((cohort) => !enrolledIds.has(cohort.id) && cohort.isActive);
  const router = useRouter();

  const nextCourse = enrolledCohorts
    .map((cohort) => ({
      cohort,
      progress: overview?.courses.find((course) => course.cohortId === cohort.id),
    }))
    .filter((item) => item.cohort.enrollment?.status === "ACTIVE" && item.progress && item.progress.progressPercent < 100)
    .sort((a, b) => (b.progress?.progressPercent || 0) - (a.progress?.progressPercent || 0))[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Experiencia de aprendizaje"
        title="Tu campus de aprendizaje"
        description="Revisa tus cursos activos, consulta tu progreso y descubre nuevas oportunidades para seguir avanzando."
      />

      <DataSection {...learning} label="tu progreso y actividades">
      {nextCourse && (
        <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Siguiente paso recomendado</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Continúa con {nextCourse.cohort.course?.name || nextCourse.cohort.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Retoma tu aprendizaje en {nextCourse.cohort.name} y mantén tu avance.</p>
              <div className="mt-5 max-w-xl">
                <div className="mb-1.5 flex justify-between text-xs font-medium"><span>Progreso del curso</span><span>{nextCourse.progress?.progressPercent || 0}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-primary/15"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${nextCourse.progress?.progressPercent || 0}%` }} /></div>
              </div>
            </div>
            <Link href={`/dashboard/my-courses/${nextCourse.cohort.id}?resume=1`}><Button className="w-full gap-2 sm:w-auto">Continuar curso <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </Card>
      )}

      {overview && (overview.nextClass || overview.pendingEvaluations.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {overview.nextClass && (
            <Card className="border-primary/25 bg-gradient-to-br from-primary/10 to-transparent">
              <CardHeader className="pb-3">
                <CardDescription className="font-semibold uppercase tracking-wider">Próxima clase</CardDescription>
                <CardTitle>{overview.nextClass.title}</CardTitle>
                <CardDescription>{overview.nextClass.courseName} · {new Date(overview.nextClass.date).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <Link href={`/dashboard/my-courses/${overview.nextClass.cohortId}`}><Button variant="outline">Ver curso</Button></Link>
                {overview.nextClass.meetLink && <a href={overview.nextClass.meetLink} target="_blank" rel="noreferrer"><Button>Ingresar a clase</Button></a>}
              </CardFooter>
            </Card>
          )}
          {overview.pendingEvaluations.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-lg">Evaluaciones pendientes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {overview.pendingEvaluations.slice(0, 3).map((evaluation) => (
                  <Link key={evaluation.id} href={`/dashboard/aula/${evaluation.cohortId}#activity-${evaluation.id}`} className="flex items-center justify-between rounded-xl border p-3 hover:border-primary/40">
                    <div><p className="text-sm font-medium">{evaluation.title}</p><p className="text-xs text-muted-foreground">{evaluation.courseName}</p></div>
                    <span className="text-xs text-muted-foreground">{evaluation.dueDate ? new Date(evaluation.dueDate).toLocaleDateString("es-PE") : "Sin fecha"}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {engagement && (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]" aria-labelledby="engagement-title">
          <Card className="border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card">
            <CardHeader className="pb-3"><CardDescription className="font-semibold uppercase tracking-wider text-amber-700">Tu ritmo</CardDescription><CardTitle id="engagement-title" className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> {engagement.points} puntos de aprendizaje</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-border/60 bg-background p-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="h-4 w-4 text-orange-500" /> Racha actual</p><p className="mt-1 text-2xl font-bold">{engagement.streak} <span className="text-sm font-medium">días</span></p></div><div className="rounded-xl border border-border/60 bg-background p-3"><p className="text-xs text-muted-foreground">Logros desbloqueados</p><p className="mt-1 text-2xl font-bold">{engagement.badges.length}</p></div></CardContent>
          </Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Siguiente actividad</CardTitle></CardHeader><CardContent>{engagement.nextActivity ? <Link href={engagement.nextActivity.type === "evaluation" && overview?.pendingEvaluations[0] ? `/dashboard/aula/${engagement.nextActivity.cohortId}#activity-${overview.pendingEvaluations[0].id}` : `/dashboard/my-courses/${engagement.nextActivity.cohortId}?resume=1`} className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 p-4 hover:border-primary/60"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{engagement.nextActivity.type === "evaluation" ? "Evaluación" : "Ruta de aprendizaje"}</p><p className="mt-1 font-semibold">{engagement.nextActivity.title}</p></div><ArrowRight className="h-5 w-5 text-primary" /></Link> : <p className="text-sm text-muted-foreground">Vas al día. No tienes actividades pendientes.</p>}</CardContent></Card>
        </section>
      )}

      </DataSection>

      <DataSection {...enrollmentResource} label="tus cursos">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <MetricCard label="Cursos activos" value={enrolledCohorts.length} detail="Matrículas vigentes" icon={Library} />
        <MetricCard label="Completados" value={enrolledCohorts.filter(c => c.enrollment?.status === 'COMPLETED').length} detail="Cursos finalizados" icon={CheckCircle2} tone="success" />
        <MetricCard label="Disponibles" value={catalog.error || catalog.loading ? "—" : availableCohorts.length} detail="Oportunidades de aprendizaje" icon={TrendingUp} tone="warning" />
      </div>

      {/* My Active Courses */}
      {enrolledCohorts.length > 0 && (
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Library className="h-4 w-4" />
              </span>
              Mis Cursos Activos
            </h3>
            <Link href="/dashboard/my-courses" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
              Ver todos mis cursos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enrolledCohorts.map((cohort: Cohort, i: number) => {
              const courseProgress = overview?.courses.find((course) => course.cohortId === cohort.id);
              const status = cohort.enrollment?.status;
              const statusLabel =
                status === 'COMPLETED' ? 'Completado' :
                status === 'DROPPED' ? 'Retirado' : 'En Curso';
              const isPendingPayment = status === 'PENDING_PAYMENT';
              const meta = parseCohortMeta(cohort.name, cohort.course?.name);
              const levelText = (cohort.course?.level && LEVEL_LABELS[cohort.course.level]) || "Programa Oficial";
              const progressPct = courseProgress?.progressPercent ?? 0;

              return (
                <article
                  key={cohort.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_12px_36px_-18px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_48px_-18px_rgba(15,23,42,0.26)] animate-fade-in-up"
                  style={{ animationDelay: `${i * 70 + 250}ms` }}
                >
                  {/* Cinematic Cover Image */}
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-primary">
                    {getCohortImageUrl(cohort) ? (
                      <Image
                        unoptimized
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        src={getCohortImageUrl(cohort)!}
                        alt={`Imagen de ${cohort.course?.name || cohort.name}`}
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-30">
                        <Library className="h-14 w-14 text-white" aria-hidden="true" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/10" />
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />

                    {/* Top Floating Badges */}
                    <div className="absolute left-3.5 right-3.5 top-3.5 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/65 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
                        <GraduationCap className="h-3.5 w-3.5 text-teal-300" />
                        {levelText}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md ${
                          status === "COMPLETED"
                            ? "border border-emerald-300/40 bg-emerald-500/90 text-white"
                            : status === "DROPPED"
                            ? "border border-rose-300/40 bg-rose-500/90 text-white"
                            : isPendingPayment
                            ? "border border-amber-300/40 bg-amber-500/95 text-slate-950"
                            : "border border-white/30 bg-white/95 text-slate-900"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            status === "COMPLETED"
                              ? "bg-white"
                              : status === "DROPPED"
                              ? "bg-white"
                              : isPendingPayment
                              ? "bg-slate-950 animate-pulse"
                              : "bg-emerald-500 animate-pulse"
                          }`}
                        />
                        {isPendingPayment ? "Pago por validar" : statusLabel}
                      </span>
                    </div>

                    {/* Bottom Cover Cohort Pills */}
                    <div className="absolute bottom-3 left-3.5 right-3.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {meta.code && (
                          <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md border border-white/15">
                            {meta.code}
                          </span>
                        )}
                        <span className="truncate rounded-md bg-slate-950/60 px-2 py-0.5 text-[11px] font-medium text-slate-200 backdrop-blur-md">
                          {meta.group}
                        </span>
                      </div>
                      {cohort.modality && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-200">
                          <MonitorPlay className="h-3 w-3" />
                          {cohort.modality === "ONLINE" ? "En vivo" : cohort.modality}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <h4 className="text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-1">
                      {cohort.course?.name || cohort.name}
                    </h4>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {cohort.name}
                    </p>

                    {/* Structured 2-Column Bento Metadata */}
                    <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-border/60 bg-muted/35 p-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inicio</p>
                          <p className="truncate text-xs font-semibold text-foreground">{formatShortDate(cohort.startDate)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Finalización</p>
                          <p className="truncate text-xs font-semibold text-foreground">
                            {cohort.endDate ? formatShortDate(cohort.endDate) : "En curso"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Block */}
                    {courseProgress && (
                      <div className="mt-4 rounded-xl border border-border/50 bg-background/70 p-3">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground">Progreso del programa</span>
                          <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                            {courseProgress.totalItems > 0 && (
                              <span className="text-[11px] font-normal text-muted-foreground">
                                ({courseProgress.completedItems}/{courseProgress.totalItems})
                              </span>
                            )}
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                              {progressPct}%
                            </span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary via-teal-600 to-accent transition-all duration-500"
                            style={{ width: `${Math.max(progressPct, 4)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="mt-auto pt-4 flex items-center gap-2">
                      <Link href={isPendingPayment ? "/dashboard" : `/dashboard/my-courses/${cohort.id}`} className="flex-1">
                        <Button
                          disabled={isPendingPayment}
                          className="w-full cursor-pointer rounded-xl gap-2 font-semibold shadow-sm transition-all group-hover:shadow-md"
                        >
                          {isPendingPayment ? "Esperando validación" : "Ir al Curso"}
                          {!isPendingPayment && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                        </Button>
                      </Link>
                      {!isPendingPayment && (
                        <Link
                          href={`/dashboard/aula/${cohort.id}`}
                          title="Abrir Aula Virtual"
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-border/80 bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                        >
                          Aula
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      </DataSection>

      {/* Available Cohorts */}
      <DataSection {...catalog} label="programas disponibles">
      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <BookOpen className="h-4 w-4" />
            </span>
            Cohortes Disponibles para Matricularte
          </h3>
          <Link href="/dashboard/catalog" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
            Explorar catálogo completo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {availableCohorts.length === 0 ? (
            <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-border/50 bg-card/50">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No hay cohortes nuevas disponibles en este momento.</p>
            </div>
          ) : (
            availableCohorts.map((cohort: Cohort, i: number) => {
              const isFull = cohort.enrolledCount >= cohort.maxCapacity;
              const pctFull = Math.min((cohort.enrolledCount / Math.max(cohort.maxCapacity, 1)) * 100, 100);
              const seatsLeft = Math.max(cohort.maxCapacity - cohort.enrolledCount, 0);
              const meta = parseCohortMeta(cohort.name, cohort.course?.name);
              const levelText = (cohort.course?.level && LEVEL_LABELS[cohort.course.level]) || "Programa Oficial";
              const priceAmount = moneyToNumber(cohort.price);

              return (
                <article
                  key={cohort.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_12px_36px_-18px_rgba(15,23,42,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_48px_-18px_rgba(15,23,42,0.24)] animate-fade-in-up"
                  style={{ animationDelay: `${i * 70 + 400}ms` }}
                >
                  {/* Cover Image */}
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-primary">
                    {getCohortImageUrl(cohort) ? (
                      <Image
                        unoptimized
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        src={getCohortImageUrl(cohort)!}
                        alt={`Imagen de ${cohort.course?.name || cohort.name}`}
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-30">
                        <BookOpen className="h-14 w-14 text-white" aria-hidden="true" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/10" />
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />

                    {/* Top Badges */}
                    <div className="absolute left-3.5 right-3.5 top-3.5 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/65 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                        <MonitorPlay className="h-3 w-3 text-amber-300" />
                        {levelText}
                      </span>
                      <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold text-slate-900 shadow-sm">
                        {priceAmount > 0 ? `S/ ${priceAmount.toFixed(2)}` : "Gratis"}
                      </span>
                    </div>

                    {/* Bottom Cover Pills */}
                    <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {meta.code && (
                          <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md border border-white/15">
                            {meta.code}
                          </span>
                        )}
                        <span className="truncate rounded-md bg-slate-950/60 px-2 py-0.5 text-[11px] font-medium text-slate-200 backdrop-blur-md">
                          {meta.group}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                        <Users className="h-3 w-3" />
                        {isFull ? "Agotado" : `${seatsLeft} libres`}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <h4 className="text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-1">
                      {cohort.course?.name || cohort.name}
                    </h4>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {cohort.name}
                    </p>

                    {/* Structured Info Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-border/60 bg-muted/35 p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inicio</p>
                          <p className="truncate text-xs font-semibold text-foreground">{formatShortDate(cohort.startDate)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                          <MonitorPlay className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modalidad</p>
                          <p className="truncate text-xs font-semibold text-foreground">
                            {cohort.modality === "ONLINE" ? "Clases en vivo" : cohort.modality || "En línea"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Occupancy Bar */}
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">
                          {cohort.enrolledCount} / {cohort.maxCapacity} vacantes ocupadas
                        </span>
                        <span className="font-bold text-foreground">{Math.round(pctFull)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            pctFull >= 90 ? "bg-rose-500" : pctFull >= 60 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.max(pctFull, 6)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-auto pt-4">
                      <Button
                        className="w-full cursor-pointer rounded-xl font-semibold shadow-sm transition-all group-hover:shadow-md gap-2"
                        onClick={() => router.push(`/cohorts/${cohort.id}`)}
                        variant="default"
                        disabled={isFull}
                      >
                        {isFull ? "Sin Cupos" : "Ver Detalles del Curso"}
                        {!isFull && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      </DataSection>
    </div>
  );
}
