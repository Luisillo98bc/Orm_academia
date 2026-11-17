"use client";

import type { Cohort, Enrollment, User } from "@/types/domain";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Library, Calendar, GraduationCap, AlertCircle, RefreshCw, PlayCircle, MonitorPlay, BookOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SectionSkeleton } from "@/components/dashboard/data-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getCohortImageUrl } from "@/lib/media";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Nivel Inicial",
  INTERMEDIATE: "Nivel Intermedio",
  ADVANCED: "Nivel Avanzado",
};

type EnrolledCourseItem = Cohort & {
  enrollmentStatus?: string;
  progressPercent?: number;
  completedItems?: number;
  totalItems?: number;
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

function formatShortDate(value?: string | null) {
  if (!value) return "Por definir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Por definir";
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function StudentCoursesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<EnrolledCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMyCourses = async (background = false) => {
    if (!background) setLoading(true);
    setError("");
    try {
      const [myEnrollments, overview] = await Promise.all([
        fetchApi("/academic/enrollments/me"),
        fetchApi("/academic/student/learning-overview").catch(() => null),
      ]);
      const progressByCohort = new Map<string, { progressPercent: number; completedItems: number; totalItems: number }>(
        (overview?.courses || []).map((c: { cohortId: string; progressPercent: number; completedItems: number; totalItems: number }) => [
          c.cohortId,
          c,
        ])
      );
      setCourses(
        (myEnrollments?.data || myEnrollments || [])
          .filter((item: Enrollment) => item.status === "ACTIVE" || item.status === "COMPLETED")
          .map((item: Enrollment) => {
            if (!item.cohort) return null;
            const prog = progressByCohort.get(item.cohort.id);
            return {
              ...item.cohort,
              enrollmentStatus: item.status,
              progressPercent: prog?.progressPercent ?? 0,
              completedItems: prog?.completedItems ?? 0,
              totalItems: prog?.totalItems ?? 0,
            };
          })
          .filter(Boolean) as EnrolledCourseItem[]
      );
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos cargar tus cursos."));
    } finally {
      setLoading(false);
    }
  };

  const refreshCourses = useEffectEvent(() => {
    if (user?.roles.includes('ESTUDIANTE')) void loadMyCourses(true);
  });
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') refreshCourses(); };
    window.addEventListener('academy:data-changed', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('academy:data-changed', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    if (!user.roles.includes("ESTUDIANTE")) {
      router.replace("/dashboard");
      return;
    }
    const timeoutId = window.setTimeout(() => {
      loadMyCourses();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [authLoading, router, user]);

  if (authLoading || !user || !user.roles.includes("ESTUDIANTE")) {
    return <SectionSkeleton label="Cargando tus cursos" />;
  }

  if (loading) {
    return <SectionSkeleton label="Cargando tus cursos" />;
  }

  if (error) {
    return <div role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center"><AlertCircle className="h-8 w-8 text-red-500" /><p className="font-semibold">{error}</p><Button type="button" variant="outline" onClick={() => void loadMyCourses()} className="gap-2"><RefreshCw className="h-4 w-4" /> Reintentar</Button></div>;
  }

  if (courses.length === 0) {
    return <EmptyState icon={<Library className="h-6 w-6" />} title="No estás matriculado en ningún curso" description="Dirígete al catálogo para elegir una cohorte disponible." action={<Link href="/dashboard/catalog"><Button>Explorar catálogo</Button></Link>} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Tu aprendizaje" title="Mis cursos" description="Accede a tus clases, revisa tus tareas pendientes y envía tus entregables." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((cls) => {
          const meta = parseCohortMeta(cls.name, cls.course?.name);
          const levelText = (cls.course?.level && LEVEL_LABELS[cls.course.level]) || cls.course?.level || "Programa Oficial";
          const progressPct = cls.progressPercent ?? 0;
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
                    <Library className="h-16 w-16 text-white" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/10" />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />

                {/* Top Floating Pills */}
                <div className="absolute left-3.5 right-3.5 top-3.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/65 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-md">
                    <MonitorPlay className="h-3 w-3 text-teal-300" />
                    {levelText}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md ${
                      cls.enrollmentStatus === "COMPLETED"
                        ? "border border-emerald-300/40 bg-emerald-500/90 text-white"
                        : "border border-white/30 bg-white/95 text-slate-900"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${cls.enrollmentStatus === "COMPLETED" ? "bg-white" : "bg-emerald-500 animate-pulse"}`} />
                    {cls.enrollmentStatus === "COMPLETED" ? "Completado" : "En curso"}
                  </span>
                </div>

                {/* Bottom Cover Pills */}
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
                  <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-teal-200">
                    <MonitorPlay className="h-3 w-3" />
                    {cls.modality === "ONLINE" ? "En vivo" : cls.modality || "Virtual"}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-1">
                  {cls.course?.name || cls.name}
                </h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">Cohorte: {cls.name}</p>

                {/* Bento Metadata */}
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
                      <p className="truncate text-xs font-semibold text-foreground">{formatShortDate(cls.startDate)}</p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 rounded-xl border border-border/50 bg-background/70 p-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Avance de la ruta</span>
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-teal-600 to-accent transition-all duration-500"
                      style={{ width: `${Math.max(progressPct, 4)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="space-y-2 border-t border-border/50 bg-muted/20 p-4">
                <Link href={`/dashboard/my-courses/${cls.id}?resume=1`} className="block w-full">
                  <Button className="w-full cursor-pointer gap-2 rounded-xl font-semibold shadow-sm" variant="default" size="sm">
                    <PlayCircle className="h-4 w-4" />
                    Continuar donde lo dejé
                  </Button>
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/dashboard/my-courses/${cls.id}`} className="block w-full">
                    <Button className="w-full cursor-pointer rounded-xl text-xs" variant="outline" size="sm">
                      <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                      Temario y notas
                    </Button>
                  </Link>
                  <Link href={`/dashboard/aula/${cls.id}`} className="block w-full">
                    <Button className="w-full cursor-pointer rounded-xl text-xs" variant="outline" size="sm">
                      <MonitorPlay className="mr-1.5 h-3.5 w-3.5" />
                      Aula virtual
                    </Button>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
