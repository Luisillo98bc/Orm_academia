"use client";

import type { Cohort, Deliverable, User } from "@/types/domain";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Calendar, AlertCircle, Users, ClipboardList, Clock, ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";

export function TeacherView() {
  const { user } = useAuth();
  const [data, setData] = useState<Cohort[]>([]);
  const [pendingDeliverables, setPendingDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const cohorts = await fetchApi("/academic/cohorts");
      // Filtrar solo las cohortes asignadas a este docente
      const myCohorts = cohorts.filter((c: Cohort) => c.teachers?.some((t: User) => t.id === user?.id));
      setData(myCohorts);

      // Try to load pending deliverables from all my cohorts
      try {
        const allDeliverables: Deliverable[] = [];
        for (const cohort of myCohorts.slice(0, 5)) {
          const evals = await fetchApi(`/evaluations/cohort/${cohort.id}`).catch(() => null);
          const evalsData = evals?.data || evals || [];
          if (Array.isArray(evalsData)) {
            for (const ev of evalsData) {
              if (ev.deliverables) {
                for (const d of ev.deliverables) {
                  if (!d.score && d.score !== 0) {
                    allDeliverables.push({
                      ...d,
                      evaluationTitle: ev.title,
                      cohortName: cohort.name,
                      courseName: cohort.course?.name,
                      cohortId: cohort.id,
                    });
                  }
                }
              }
            }
          }
        }
        setPendingDeliverables(allDeliverables.slice(0, 8));
      } catch  {
        // Non-critical, just skip
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar datos"));
    } finally {
      setLoading(false);
    }
  };

    const loadDataEffect = useEffectEvent(loadData);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDataEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm animate-pulse">Cargando portal docente...</p>
      </div>
    );
  }

  const totalStudents = data.reduce((sum, c) => sum + (c.enrolledCount || 0), 0);
  const activeCohorts = data.filter(c => c.isActive).length;

  const statCards = [
    {
      label: "Clases Asignadas",
      value: data.length,
      icon: BookOpen,
      gradient: "from-blue-500/20 to-cyan-500/10",
      iconColor: "text-blue-500",
      borderColor: "border-blue-500/20",
    },
    {
      label: "Total Estudiantes",
      value: totalStudents,
      icon: Users,
      gradient: "from-violet-500/20 to-purple-500/10",
      iconColor: "text-violet-500",
      borderColor: "border-violet-500/20",
    },
    {
      label: "Cohortes Activas",
      value: activeCohorts,
      icon: Calendar,
      gradient: "from-emerald-500/20 to-teal-500/10",
      iconColor: "text-emerald-500",
      borderColor: "border-emerald-500/20",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-blue-500/5 to-transparent border border-primary/20 p-6 md:p-8 animate-fade-in-up">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <GraduationCap className="h-8 w-8" />
            Portal Docente
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Gestiona tus clases, estudiantes matriculados y califica las evaluaciones entregadas.
          </p>
        </div>
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400 animate-scale-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Stats — Gradient Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-2xl border ${stat.borderColor} bg-gradient-to-br ${stat.gradient} p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg stat-card-glow animate-fade-in-up`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-4xl font-bold mt-2 animate-counter" style={{ animationDelay: `${i * 100 + 200}ms` }}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl bg-background/50 backdrop-blur-sm ${stat.iconColor}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Deliverables */}
      {pendingDeliverables.length > 0 && (
        <section className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-500" />
            Entregas Pendientes por Calificar
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              {pendingDeliverables.length}
            </span>
          </h3>
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="divide-y divide-border/30">
              {pendingDeliverables.map((d, i) => (
                <div key={d.id || i} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.evaluationTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.courseName} — {d.cohortName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {d.submittedAt ? new Date(d.submittedAt).toLocaleDateString() : 'N/A'}
                    </span>
                    {d.cohortId && (
                      <Link href={`/dashboard/classes/${d.cohortId}`}>
                        <Button size="sm" variant="outline" className="rounded-lg text-xs h-7">
                          Calificar
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* My Cohorts */}
      <section>
        <h3 className="text-xl font-semibold tracking-tight mb-4">Mis Clases (Cohortes Asignadas)</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.length === 0 ? (
            <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-border/50 bg-card/50">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No tienes cohortes asignadas actualmente.</p>
            </div>
          ) : (
            data.map((cohort: Cohort, i: number) => (
              <Card key={cohort.id} className="flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-primary animate-fade-in-up" style={{ animationDelay: `${i * 70 + 500}ms` }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg leading-tight mb-1 group-hover:text-primary transition-colors">
                    {cohort.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-1">
                    {cohort.course?.name || "Desconocido"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2 flex-1">
                  <div className="text-sm text-muted-foreground space-y-3 mt-2">
                    <div className="flex items-center gap-2 bg-primary/5 p-2.5 rounded-lg">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{cohort.enrolledCount} Estudiantes inscritos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground/70" />
                      <span>Inicia: {new Date(cohort.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground/70" />
                      <span>Termina: {new Date(cohort.endDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 mt-auto">
                  <Link href={`/dashboard/classes/${cohort.id}`} className="w-full">
                    <Button className="w-full rounded-xl gap-2">
                      Ir al Salón de Clases <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
