"use client";

import type { Cohort, User } from "@/types/domain";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  Loader2,
  BookOpen,
  Calendar,
  Users,
  MessageSquare,
  ClipboardCheck,
  Clock,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";
import { getCohortImageUrl } from "@/lib/media";

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Nivel Inicial",
  INTERMEDIATE: "Nivel Intermedio",
  ADVANCED: "Nivel Avanzado",
};

export default function TeacherClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Cohort[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const loading = !user || loadedUserId !== user.id;

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    fetchApi("/academic/cohorts")
      .then((allCohorts) => {
        if (!mounted) return;
        const list = Array.isArray(allCohorts) ? allCohorts : allCohorts?.data || [];
        const isAdmin = user.roles?.includes("ADMIN");
        const myClasses = list.filter((c: Cohort) =>
          c.teachers?.some((t: User) => t.id === user.id),
        );
        setClasses(myClasses.length > 0 ? myClasses : isAdmin ? list : []);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (mounted) setLoadedUserId(user.id);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-6 w-6" />}
        title="Sin clases asignadas"
        description="Aún no se te ha asignado ninguna cohorte para enseñar. Contacta a la administración."
      />
    );
  }

  const totalStudents = classes.reduce(
    (sum, cls) => sum + (cls.enrolledCount ?? cls.enrollmentCount ?? 0),
    0,
  );
  const activeCount = classes.filter(
    (cls) => cls.isActive && new Date(cls.endDate) >= new Date(),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación docente"
        title="Mis clases"
        description="Selecciona una cohorte para gestionar sílabo, asistencia, evaluaciones y acompañar a tus estudiantes."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/dashboard/classes/evaluations">
              <ClipboardCheck className="h-4 w-4" /> Revisar entregas y evaluaciones
            </Link>
          </Button>
        }
      />

      <SummaryStrip
        items={[
          { label: "Cohortes asignadas", value: classes.length },
          { label: "En curso / Activas", value: activeCount },
          { label: "Estudiantes a cargo", value: totalStudents },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((cls) => {
          const enrolled = cls.enrolledCount ?? cls.enrollmentCount ?? 0;
          const capacity = cls.maxStudents || cls.maxCapacity || 30;
          const occupancyPct = Math.min(Math.round((enrolled / capacity) * 100), 100);

          return (
            <article
              key={cls.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="relative h-36 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-primary/80">
                {getCohortImageUrl(cls) ? (
                  <Image
                    unoptimized
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    src={getCohortImageUrl(cls)!}
                    alt={`Imagen de ${cls.name}`}
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <BookOpen className="h-14 w-14 text-white" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 to-transparent" />
                <span className="absolute left-4 top-4 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                  {(cls.course?.level && LEVEL_LABELS[cls.course.level]) || cls.course?.level || "Programa"}
                </span>
                <span className="absolute bottom-3 left-4 right-4 truncate text-sm font-medium text-white">
                  {cls.name}
                </span>
              </div>

              <div className="flex-1 p-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {cls.modality || "ONLINE"}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {enrolled}/{capacity} alumnos
                  </span>
                </div>

                <h3 className="mb-1 text-xl font-bold">{cls.name}</h3>
                <p className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <BookOpen className="h-4 w-4 shrink-0 text-primary" /> {cls.course?.name}
                </p>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Del {new Date(cls.startDate).toLocaleDateString("es-PE")} al{" "}
                      {new Date(cls.endDate).toLocaleDateString("es-PE")}
                    </span>
                  </div>
                  {cls.schedule && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span>{cls.schedule}</span>
                    </div>
                  )}
                </div>

                {/* Barra de ocupación */}
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                    <span>Ocupación del aula</span>
                    <span>{occupancyPct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${occupancyPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-border/50 bg-muted/20 p-4">
                <Link href={`/dashboard/classes/${cls.id}`} className="block w-full">
                  <Button className="w-full text-xs" variant="default" size="sm">
                    Gestionar Salón
                  </Button>
                </Link>
                <Link href={`/dashboard/aula/${cls.id}`} className="block w-full">
                  <Button className="w-full text-xs" variant="outline" size="sm">
                    Aula Virtual
                  </Button>
                </Link>
                <Link href={`/dashboard/classes/${cls.id}/forum`} className="block w-full">
                  <Button className="w-full gap-1 text-xs" variant="outline" size="sm">
                    <MessageSquare className="h-3.5 w-3.5" /> Foro
                  </Button>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
