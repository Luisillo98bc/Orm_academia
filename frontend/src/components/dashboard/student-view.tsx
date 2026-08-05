"use client";

import type { Cohort, Enrollment } from "@/types/domain";

import { useState, useEffect } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Calendar, AlertCircle, CheckCircle2, GraduationCap, Library, Clock, ArrowRight, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function StudentView() {
  const [enrolledCohorts, setEnrolledCohorts] = useState<Cohort[]>([]);
  const [availableCohorts, setAvailableCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [allCohorts, myEnrollments] = await Promise.all([
        fetchApi("/academic/cohorts"),
        fetchApi("/academic/enrollments/me").catch(() => ({ data: [] })),
      ]);

      const enrollments = myEnrollments?.data || myEnrollments || [];
      const enrolledIds = new Set(enrollments.map((e: Enrollment) => e.cohortId));

      // Merge enrollment data with cohort data for the enrolled list
      const enrolled = enrollments.map((enrollment: Enrollment) => {
        const cohort = (allCohorts || []).find((c: Cohort) => c.id === enrollment.cohortId);
        return { ...cohort, enrollment };
      }).filter((c: Cohort) => c.id); // filter out broken references

      const available = (allCohorts || []).filter((c: Cohort) => !enrolledIds.has(c.id) && c.isActive);

      setEnrolledCohorts(enrolled);
      setAvailableCohorts(available);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar datos"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm animate-pulse">Cargando tu portal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent border border-primary/20 p-6 md:p-8 animate-fade-in-up">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <GraduationCap className="h-8 w-8" />
            Portal del Estudiante
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Bienvenido a tu portal. Revisa tus cursos activos, consulta tu progreso y descubre nuevas oportunidades de aprendizaje.
          </p>
        </div>
        {/* Decorative */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400 animate-scale-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent p-5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <Library className="h-5 w-5 text-blue-500 mb-2" />
          <p className="text-3xl font-bold">{enrolledCohorts.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Cursos Activos</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-2" />
          <p className="text-3xl font-bold">{enrolledCohorts.filter(c => c.enrollment?.status === 'COMPLETED').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Completados</p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent p-5 animate-fade-in-up col-span-2 md:col-span-1" style={{ animationDelay: '260ms' }}>
          <TrendingUp className="h-5 w-5 text-violet-500 mb-2" />
          <p className="text-3xl font-bold">{availableCohorts.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Cursos Disponibles</p>
        </div>
      </div>

      {/* My Active Courses */}
      {enrolledCohorts.length > 0 && (
        <section>
          <h3 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            Mis Cursos Activos
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {enrolledCohorts.map((cohort: Cohort, i: number) => {
              const status = cohort.enrollment?.status;
              const statusLabel =
                status === 'COMPLETED' ? 'Completado' :
                status === 'DROPPED' ? 'Retirado' : 'En Curso';
              const statusColor =
                status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                status === 'DROPPED' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                'bg-blue-500/10 text-blue-600 border-blue-500/20';

              return (
                <Card key={cohort.id} className="group relative overflow-hidden border-l-4 border-l-primary hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: `${i * 70 + 400}ms` }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                        {cohort.course?.name || cohort.name}
                      </CardTitle>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <CardDescription className="truncate">{cohort.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="text-sm text-muted-foreground space-y-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary/70" />
                        <span>Inicio: {new Date(cohort.startDate).toLocaleDateString()}</span>
                      </div>
                      {cohort.endDate && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary/70" />
                          <span>Fin: {new Date(cohort.endDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50 mt-auto">
                    <Link href={`/dashboard/my-courses/${cohort.id}`} className="w-full">
                      <Button className="w-full rounded-xl gap-2 group-hover:shadow-md transition-shadow">
                        Ir al Curso <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Available Cohorts */}
      <section>
        <h3 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Cohortes Disponibles para Matricularte
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableCohorts.length === 0 ? (
            <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-border/50 bg-card/50">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No hay cohortes nuevas disponibles en este momento.</p>
            </div>
          ) : (
            availableCohorts.map((cohort: Cohort, i: number) => {
              const isFull = cohort.enrolledCount >= cohort.maxCapacity;
              const pctFull = Math.min((cohort.enrolledCount / cohort.maxCapacity) * 100, 100);

              return (
                <Card key={cohort.id} className="glass flex flex-col relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: `${i * 70 + 600}ms` }}>
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BookOpen className="h-24 w-24" />
                  </div>
                  <CardHeader className="pb-2 z-10">
                    <CardTitle className="text-lg leading-tight mb-2 group-hover:text-primary transition-colors">
                      {cohort.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-1 truncate font-medium text-foreground">
                      {cohort.course?.name || "Desconocido"}
                    </CardDescription>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{cohort.enrolledCount} / {cohort.maxCapacity} cupos</span>
                        <span>{Math.round(pctFull)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            pctFull >= 90 ? 'bg-red-500' : pctFull >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pctFull}%` }}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2 flex-1 z-10">
                    <div className="text-sm text-muted-foreground space-y-2 mt-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary/70" />
                        <span>Inicio: {new Date(cohort.startDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50 mt-auto z-10">
                    <Button 
                      className="w-full shadow-md rounded-xl" 
                      onClick={() => router.push(`/cohorts/${cohort.id}`)}
                      variant="default"
                      disabled={isFull}
                    >
                      {isFull ? "Sin Cupos" : "Ver Detalles del Curso"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
