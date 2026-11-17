"use client";

import type { Cohort, Deliverable, User } from "@/types/domain";

import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, AlertCircle, Users, ClipboardList, Clock, ArrowRight, MessageCircle, TrendingDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRemoteData } from "@/lib/use-remote-data";
import { DataSection } from "@/components/dashboard/data-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { getCohortImageUrl } from "@/lib/media";

export function TeacherView() {
  const { user } = useAuth();
  const [now] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [remindingStudent, setRemindingStudent] = useState<string | null>(null);
  const cohortsResource = useRemoteData<Cohort[]>("/academic/cohorts");
  const calendarResource = useRemoteData<Array<{ id: string; title: string; date: string; cohortId?: string; meetLink?: string }>>("/academic/calendar-events");
  const attentionResource = useRemoteData<{
    lowProgressStudents: Array<{ studentId: string; studentName: string; email: string; cohortId: string; cohortName: string; courseName: string; progressPercent: number }>;
    pendingForums: Array<{ id: string; title: string; cohortId: string; cohortName: string; lastMessage: string; lastActivityAt: string | null }>;
    pendingDeliverables: Deliverable[];
    totals: { lowProgress: number; pendingForums: number };
  }>("/academic/teacher/attention");
  const data = (cohortsResource.data || []).filter((cohort) => !cohort.teachers?.length || cohort.teachers.some((teacher: User) => teacher.id === user?.id));
  const attention = attentionResource.data || { lowProgressStudents: [], pendingForums: [], totals: { lowProgress: 0, pendingForums: 0 } };
  const pendingDeliverables = (attentionResource.data?.pendingDeliverables || []).slice(0, 8);
  const upcomingEvents = (calendarResource.data || []).filter((event) => new Date(event.date).getTime() >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);

  const remindStudent = async (studentId: string, cohortId: string) => {
    const key = `${studentId}-${cohortId}`;
    setRemindingStudent(key);
    try {
      await fetchApi("/academic/teacher/attention/remind", {
        method: "POST",
        body: JSON.stringify({ studentId, cohortId }),
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo enviar el recordatorio"));
    } finally {
      setRemindingStudent(null);
    }
  };

  const totalStudents = data.reduce((sum, c) => sum + (c.enrollmentCount ?? c.enrolledCount ?? c._count?.enrollments ?? 0), 0);
  const activeCohorts = data.filter(c => c.isActive).length;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Operación académica" title="Portal docente" description="Gestiona tus clases, estudiantes matriculados y evaluaciones pendientes desde un solo lugar." />

      {error && (
        <div role="alert" className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400 animate-scale-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <DataSection {...cohortsResource} label="resumen docente">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Clases asignadas" value={data.length} detail="Cohortes a tu cargo" icon={BookOpen} />
        <MetricCard label="Estudiantes" value={totalStudents} detail="Matrículas en tus clases" icon={Users} tone="info" />
        <MetricCard label="Cohortes activas" value={activeCohorts} detail="Clases en operación" icon={Calendar} tone="success" />
      </div>

      </DataSection>
      <DataSection {...attentionResource} label="acompañamiento de alumnos">
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-5" aria-labelledby="low-progress-title">
          <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Acompañamiento</p><h3 id="low-progress-title" className="mt-1 text-lg font-semibold">Estudiantes con bajo progreso</h3></div><span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700">{attention.totals.lowProgress}</span></div>
          {attention.lowProgressStudents.length === 0 ? <p className="text-sm text-muted-foreground">No hay alertas de progreso por atender.</p> : <div className="space-y-2">{attention.lowProgressStudents.slice(0, 6).map((student) => <div key={`${student.studentId}-${student.cohortId}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{student.studentName}</p><p className="truncate text-xs text-muted-foreground">{student.cohortName} · {student.courseName}</p></div><span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-amber-700"><TrendingDown className="h-3.5 w-3.5" />{student.progressPercent}%</span></div>)}</div>}
        </section>
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5" aria-labelledby="pending-forums-title">
          <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Comunidad</p><h3 id="pending-forums-title" className="mt-1 text-lg font-semibold">Foros pendientes de respuesta</h3></div><span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">{attention.totals.pendingForums}</span></div>
          {attention.pendingForums.length === 0 ? <p className="text-sm text-muted-foreground">No hay conversaciones pendientes.</p> : <div className="space-y-2">{attention.pendingForums.slice(0, 6).map((forum) => <Link key={forum.id} href={`/dashboard/classes/${forum.cohortId}`} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 transition hover:border-primary/40"><MessageCircle className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{forum.title}</p><p className="truncate text-xs text-muted-foreground">{forum.cohortName} · {forum.lastMessage}</p></div></Link>)}</div>}
        </section>
      </div>

      {attention.lowProgressStudents.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card p-5" aria-labelledby="teacher-actions-title">
          <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Acciones rápidas</p><h3 id="teacher-actions-title" className="mt-1 text-lg font-semibold">Acompaña a tus estudiantes</h3><p className="mt-1 text-sm text-muted-foreground">Envía un recordatorio al campus del estudiante sin salir del dashboard.</p></div>
          <div className="grid gap-2 md:grid-cols-2">
            {attention.lowProgressStudents.slice(0, 6).map((student) => {
              const key = `${student.studentId}-${student.cohortId}`;
              return <div key={key} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold">{student.studentName}</p><p className="truncate text-xs text-muted-foreground">{student.cohortName} · {student.progressPercent}% de avance</p></div><Button type="button" size="sm" variant="outline" onClick={() => void remindStudent(student.studentId, student.cohortId)} disabled={remindingStudent === key} className="shrink-0 text-xs">{remindingStudent === key ? "Enviando…" : "Enviar recordatorio"}</Button></div>;
            })}
          </div>
        </section>
      )}

      {attention.pendingForums.length > 0 && (
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5" aria-labelledby="forum-actions-title">
          <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Respuesta prioritaria</p><h3 id="forum-actions-title" className="mt-1 text-lg font-semibold">Responde desde el dashboard</h3></div>
          <div className="grid gap-2 md:grid-cols-2">{attention.pendingForums.slice(0, 6).map((forum) => <Link key={`quick-${forum.id}`} href={`/dashboard/forums/${forum.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-3 transition hover:border-primary/40"><span className="min-w-0 truncate text-sm font-semibold">{forum.title}</span><span className="shrink-0 text-xs font-semibold text-primary">Abrir foro →</span></Link>)}</div>
        </section>
      )}

      </DataSection>
      <DataSection {...calendarResource} label="próximas clases">
      {upcomingEvents.length > 0 && (
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Agenda docente</p><h3 className="mt-1 text-lg font-semibold">Próximas clases</h3></div><Link href="/dashboard/calendar" className="text-sm font-semibold text-primary hover:underline">Ver calendario</Link></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{upcomingEvents.map((event) => <div key={event.id} className="rounded-xl border border-border/50 bg-card p-3"><p className="truncate text-sm font-semibold">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(event.date).toLocaleString("es-PE", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>{event.meetLink && <a href={event.meetLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-primary">Abrir Meet</a>}</div>)}</div>
        </section>
      )}

      {/* Pending Deliverables */}
      </DataSection>
      <DataSection {...attentionResource} label="entregas pendientes">
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

      </DataSection>
      {/* My Cohorts */}
      <DataSection {...cohortsResource} label="clases asignadas">
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
              <Card key={cohort.id} className="group flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-primary animate-fade-in-up" style={{ animationDelay: `${i * 70 + 500}ms` }}>
                <div className="relative h-32 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-primary/80">
                  {getCohortImageUrl(cohort) ? (
                    <Image unoptimized fill sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" src={getCohortImageUrl(cohort)!} alt={`Imagen de ${cohort.name}`} className="object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-30"><BookOpen className="h-14 w-14 text-white" aria-hidden="true" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                </div>
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
                      <span className="font-medium text-foreground">{cohort.enrollmentCount ?? cohort.enrolledCount ?? cohort._count?.enrollments ?? 0} Estudiantes inscritos</span>
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
      </DataSection>
    </div>
  );
}
