"use client";

import type { Cohort, Deliverable, Evaluation, User } from "@/types/domain";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Loader2, ClipboardList, BookOpen, Calendar, CheckCircle2, Clock, AlertCircle, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeacherEvaluationsPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Cohort[]>([]);
  const [evaluationsByClass, setEvaluationsByClass] = useState<Record<string, Evaluation[]>>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const allCohorts = await fetchApi("/academic/cohorts");
      const myClasses = allCohorts.filter((c: Cohort) => c.teachers?.some((t: User) => t.id === user?.id));
      setClasses(myClasses);

      // Load evaluations for each class
      const evalMap: Record<string, Evaluation[]> = {};
      await Promise.all(
        myClasses.map(async (cls: Cohort) => {
          try {
            const evals = await fetchApi(`/evaluations/cohort/${cls.id}`);
            const evalsData = evals?.data || evals || [];
            evalMap[cls.id] = Array.isArray(evalsData) ? evalsData : [];
          } catch {
            evalMap[cls.id] = [];
          }
        })
      );
      setEvaluationsByClass(evalMap);
    } catch (err) {
      console.error(err);
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
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card/50 glass">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-bold">Sin evaluaciones</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          No tienes clases asignadas. Las evaluaciones aparecerán aquí cuando tengas cohortes activas.
        </p>
      </div>
    );
  }

  const totalEvaluations = Object.values(evaluationsByClass).reduce((sum, evals) => sum + evals.length, 0);
  const pendingGrading = Object.values(evaluationsByClass).reduce((sum, evals) => {
    return sum + evals.filter((e: Evaluation) => {
      const deliverables = e.deliverables || [];
      return deliverables.some((d: Deliverable) => d.status === "SUBMITTED" && !d.grade);
    }).length;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Evaluaciones</h2>
        <p className="text-muted-foreground mt-1">Gestiona las evaluaciones y calificaciones de tus clases.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border/50 p-5 glass">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Evaluaciones</span>
          </div>
          <p className="text-3xl font-bold">{totalEvaluations}</p>
        </div>

        <div className="bg-card rounded-xl border border-border/50 p-5 glass">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Por Calificar</span>
          </div>
          <p className="text-3xl font-bold text-amber-500">{pendingGrading}</p>
        </div>

        <div className="bg-card rounded-xl border border-border/50 p-5 glass">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <BookOpen className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Clases Activas</span>
          </div>
          <p className="text-3xl font-bold text-emerald-500">{classes.length}</p>
        </div>
      </div>

      {/* Evaluations by Class */}
      <div className="space-y-6">
        {classes.map((cls) => {
          const evals = evaluationsByClass[cls.id] || [];

          return (
            <div key={cls.id} className="bg-card rounded-xl border border-border/50 overflow-hidden glass">
              <div className="p-5 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{cls.name}</h3>
                    <p className="text-sm text-muted-foreground">{cls.course?.name}</p>
                  </div>
                </div>
                <Link href={`/dashboard/classes/${cls.id}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Entrar al Salón <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>

              {evals.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay evaluaciones creadas para esta clase.</p>
                  <Link href={`/dashboard/classes/${cls.id}`}>
                    <Button variant="link" size="sm" className="mt-1">Crear desde el Salón →</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {evals.map((ev: Evaluation) => {
                    const deliverables = ev.deliverables || [];
                    const submitted = deliverables.filter((d: Deliverable) => d.status === "SUBMITTED").length;
                    const graded = deliverables.filter((d: Deliverable) => d.grade !== null && d.grade !== undefined).length;
                    const total = deliverables.length;

                    return (
                      <div key={ev.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{ev.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Vence: {new Date(ev.dueDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {total} entregas
                            </span>
                            {submitted > 0 && (
                              <span className="flex items-center gap-1 text-amber-500">
                                <AlertCircle className="h-3 w-3" />
                                {submitted} por calificar
                              </span>
                            )}
                            {graded > 0 && (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <CheckCircle2 className="h-3 w-3" />
                                {graded} calificadas
                              </span>
                            )}
                          </div>
                        </div>
                        <Link href={`/dashboard/classes/${cls.id}`}>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
