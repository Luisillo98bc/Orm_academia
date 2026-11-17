"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Calendar, AlertCircle, CheckCircle2, PlusCircle, Users, BarChart3, TrendingUp, Download, ContactRound, CreditCard, ArrowRight } from "lucide-react";
import { CreateUserModal } from "@/components/admin/create-user-modal";
import { CreateCourseModal } from "@/components/admin/create-course-modal";
import { CreateCohortModal } from "@/components/admin/create-cohort-modal";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { saveAs } from 'file-saver';
import type { Money } from "@/lib/money";
import { buildCsvBlob, formatMoney, moneyToNumber } from "@/lib/money";
import { useRemoteData } from "@/lib/use-remote-data";
import { DataSection } from "@/components/dashboard/data-section";
import type { Cohort } from "@/types/domain";
import { PageHeader } from "@/components/dashboard/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import Link from "next/link";
import { WorkspaceTabs } from "@/components/dashboard/workspace-tabs";

interface DashboardMetrics {
  totalRevenue: Money;
  totalStudents: number;
  activeCohorts: number;
  revenueByMonth: Array<{ month: string; revenue: Money }>;
}

interface OperationalData {
  pendingProspects: number;
  overdueProspects: number;
  pendingPayments: number;
  upcomingCohorts: Array<{ id: string; name: string; startDate: string; course?: { name?: string } }>;
  lowOccupancy: Array<{ id: string; name: string; occupancy: number; course?: { name?: string } }>;
  fullCohorts: Array<{ id: string; name: string; course?: { name?: string } }>;
}

interface DataQualityData { score: number; counts: { courses: number; cohorts: number; users: number; payments: number } }

export function AdminView() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isCohortModalOpen, setIsCohortModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const metricsResource = useRemoteData<DashboardMetrics>("/academic/metrics");
  const prospectsResource = useRemoteData<{ byStatus: Record<string, number>; overdue: number }>("/prospects/stats");
  const paymentsResource = useRemoteData<{ data: unknown[]; pagination: { total: number } }>("/payments/pending?page=1&limit=1");
  const cohortsResource = useRemoteData<Cohort[]>("/academic/cohorts");
  const qualityResource = useRemoteData<DataQualityData>("/academic/data-quality");
  const metrics = metricsResource.data;
  const quality = qualityResource.data;
  const byStatus = prospectsResource.data?.byStatus || {};
  const operationalCohorts = (cohortsResource.data || []).filter((cohort) => cohort.isActive && new Date(cohort.endDate) >= new Date());
  const operations: OperationalData = {
    pendingProspects: (byStatus.NEW || 0) + (byStatus.CONTACTED || 0) + (byStatus.INTERESTED || 0),
    overdueProspects: prospectsResource.data?.overdue || 0,
    pendingPayments: paymentsResource.data?.pagination?.total || 0,
    upcomingCohorts: operationalCohorts.filter((cohort) => new Date(cohort.startDate) >= new Date()).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).slice(0, 4),
    lowOccupancy: operationalCohorts.map((cohort) => ({ ...cohort, occupancy: cohort.maxStudents ? Math.round(((cohort.enrollmentCount || 0) / cohort.maxStudents) * 100) : 0 })).filter((cohort) => cohort.occupancy < 35).sort((a, b) => a.occupancy - b.occupancy),
    fullCohorts: operationalCohorts.filter((cohort) => (cohort.enrollmentCount || 0) >= cohort.maxStudents),
  };
  const loadData = () => { void metricsResource.reload(); void prospectsResource.reload(); void paymentsResource.reload(); void cohortsResource.reload(); void qualityResource.reload(); };
  const operationsState = {
    loading: prospectsResource.loading || paymentsResource.loading || cohortsResource.loading,
    error: [prospectsResource.error, paymentsResource.error, cohortsResource.error].filter(Boolean).join(" "),
    reload: () => { void prospectsResource.reload(); void paymentsResource.reload(); void cohortsResource.reload(); },
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const studentsData = await fetchApi("/academic/export-students");
      if (!studentsData || studentsData.length === 0) {
        setError("No hay datos para exportar");
        setIsExporting(false);
        return;
      }

      // Convert JSON to CSV with UTF-8 BOM and formula/quote escaping
      const headers = Object.keys(studentsData[0]);
      const rows = studentsData.map((row: Record<string, unknown>) => Object.values(row));
      const blob = buildCsvBlob(headers, rows);
      saveAs(blob, `estudiantes_export_${new Date().toISOString().split('T')[0]}.csv`);
      setSuccess("Reporte descargado correctamente");
    } catch  {
      setError("Error al exportar datos");
    } finally {
      setIsExporting(false);
    }
  };

  // Auto-dismiss success messages
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const statCards = [
    { label: "Ingresos totales", value: `S/ ${formatMoney(metrics?.totalRevenue)}`, icon: TrendingUp, tone: "success" as const, detail: "Matrículas completadas" },
    { label: "Alumnos matriculados", value: metrics?.totalStudents || 0, icon: Users, tone: "info" as const, detail: "Estudiantes activos" },
    { label: "Cohortes activas", value: metrics?.activeCohorts || 0, icon: Calendar, tone: "primary" as const, detail: "Clases en operación" },
  ];
  const recentRevenue = metrics?.revenueByMonth || [];
  const lastRevenue = recentRevenue.at(-1);
  const previousRevenue = recentRevenue.at(-2);
  const monthlyChange = lastRevenue && previousRevenue && moneyToNumber(previousRevenue.revenue) > 0 ? Math.round((moneyToNumber(lastRevenue.revenue) / moneyToNumber(previousRevenue.revenue) - 1) * 100) : null;

  const quickActions = [
    {
      label: "Crear Curso",
      description: "Añadir nuevo curso al catálogo",
      icon: BookOpen,
      color: "text-primary",
      bg: "bg-primary/10 hover:bg-primary/20",
      onClick: () => setIsCourseModalOpen(true),
    },
    {
      label: "Registrar Usuario",
      description: "Añadir nuevo usuario al sistema",
      icon: Users,
      color: "text-accent",
      bg: "bg-accent/10 hover:bg-accent/20",
      onClick: () => setIsUserModalOpen(true),
    },
    {
      label: "Abrir Cohorte",
      description: "Programar nueva clase de un curso",
      icon: Calendar,
      color: "text-accent",
      bg: "bg-accent/10 hover:bg-accent/20",
      onClick: () => setIsCohortModalOpen(true),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administración"
        title="Panel de administración"
        description="Tu operación de un vistazo: prioridades, próximos inicios y resultados de la academia."
        actions={<Button onClick={handleExportCSV} disabled={isExporting} variant="outline" className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar Estudiantes
          </Button>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted-foreground">{new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p><Button variant="outline" size="sm" onClick={loadData}>Actualizar indicadores</Button></div>

      {error && (
        <div role="alert" className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400 animate-scale-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 text-green-600 bg-green-100 rounded-xl dark:bg-green-900/30 dark:text-green-400 animate-scale-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <DataSection {...metricsResource} label="indicadores administrativos">
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => <MetricCard key={stat.label} {...stat} />)}
      </div>

      </DataSection>
      <WorkspaceTabs label="Áreas del resumen administrativo" tabs={[{ id: "operations", label: "Prioridades de hoy", content: <DataSection {...operationsState} label="prioridades operativas">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_1.1fr_1.8fr]" aria-label="Prioridades operativas">
        <Card className="border-amber-500/20 bg-amber-500/[0.04]">
          <CardHeader className="pb-3"><CardDescription className="flex items-center gap-2 font-semibold uppercase tracking-wider"><ContactRound className="h-4 w-4 text-amber-600" /> Seguimiento comercial</CardDescription><CardTitle className="text-3xl">{operations.pendingProspects}</CardTitle><CardDescription>{operations.overdueProspects ? `${operations.overdueProspects} requieren atención hoy` : "Prospectos en proceso"}</CardDescription></CardHeader>
          <CardContent><Link href="/dashboard/prospects" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Revisar prospectos <ArrowRight className="h-4 w-4" /></Link></CardContent>
        </Card>
        <Card className="border-rose-500/20 bg-rose-500/[0.04]">
          <CardHeader className="pb-3"><CardDescription className="flex items-center gap-2 font-semibold uppercase tracking-wider"><CreditCard className="h-4 w-4 text-rose-600" /> Pagos por validar</CardDescription><CardTitle className="text-3xl">{operations.pendingPayments}</CardTitle><CardDescription>Solicitudes pendientes de confirmación</CardDescription></CardHeader>
          <CardContent><Link href="/dashboard/payments" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Gestionar pagos <ArrowRight className="h-4 w-4" /></Link></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardDescription className="flex items-center gap-2 font-semibold uppercase tracking-wider"><Calendar className="h-4 w-4 text-primary" /> Próximas cohortes</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {operations.upcomingCohorts.length ? operations.upcomingCohorts.map((cohort) => <Link key={cohort.id} href={`/dashboard/cohorts`} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm hover:border-primary/40"><span className="min-w-0 truncate"><span className="block font-medium truncate">{cohort.course?.name || cohort.name}</span><span className="text-xs text-muted-foreground">{cohort.name}</span></span><span className="ml-3 shrink-0 text-xs font-semibold text-primary">{new Date(cohort.startDate).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</span></Link>) : <p className="text-sm text-muted-foreground">No hay cohortes próximas registradas.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Salud de cohortes">
        <Card className="border-amber-500/20 bg-amber-500/[0.04]">
          <CardHeader className="pb-3"><CardDescription className="flex items-center gap-2 font-semibold uppercase tracking-wider"><Users className="h-4 w-4 text-amber-600" /> Baja ocupación</CardDescription><CardTitle className="text-2xl">{operations.lowOccupancy.length} cohortes</CardTitle><CardDescription>Menos de 35% de cupos ocupados</CardDescription></CardHeader>
          <CardContent className="space-y-2">{operations.lowOccupancy.length ? operations.lowOccupancy.slice(0, 4).map((cohort) => <Link key={cohort.id} href="/dashboard/cohorts" className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"><span className="truncate">{cohort.course?.name || cohort.name}</span><span className="ml-3 font-semibold text-amber-700 dark:text-amber-300">{cohort.occupancy}%</span></Link>) : <p className="text-sm text-muted-foreground">No hay alertas de baja ocupación.</p>}</CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
          <CardHeader className="pb-3"><CardDescription className="flex items-center gap-2 font-semibold uppercase tracking-wider"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Cohortes llenas</CardDescription><CardTitle className="text-2xl">{operations.fullCohorts.length}</CardTitle><CardDescription>Requieren cerrar inscripciones o abrir otra edición</CardDescription></CardHeader>
          <CardContent className="space-y-2">{operations.fullCohorts.length ? operations.fullCohorts.slice(0, 4).map((cohort) => <Link key={cohort.id} href="/dashboard/cohorts" className="block truncate rounded-lg border border-border/50 px-3 py-2 text-sm">{cohort.course?.name || cohort.name}</Link>) : <p className="text-sm text-muted-foreground">No hay cohortes llenas.</p>}</CardContent>
        </Card>
      </section>

      </DataSection> }, { id: "quality", label: "Calidad de datos", content: <DataSection {...qualityResource} label="calidad de datos">
      {quality && <section aria-label="Calidad de datos" className="rounded-xl border border-border/50 bg-card p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold">Calidad de datos</h2><p className="text-sm text-muted-foreground">Detecta cursos, cohortes, usuarios y pagos incompletos antes de publicar o cobrar.</p></div><div className={`rounded-full px-4 py-2 text-lg font-bold ${quality.score >= 90 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : quality.score >= 70 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>{quality.score}/100</div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(quality.counts).map(([key, value]) => <div key={key} className="rounded-lg bg-muted/40 p-3"><p className="text-xs capitalize text-muted-foreground">{({ courses: "Cursos", cohorts: "Cohortes", users: "Usuarios", payments: "Pagos" } as Record<string, string>)[key] || key} con alertas</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div></section>}

      </DataSection> }, { id: "revenue", label: "Evolución de ingresos", content: <>
      {monthlyChange !== null && <p className="workspace-note"><strong className="text-foreground">{monthlyChange > 0 ? "+" : ""}{monthlyChange}%</strong> en {lastRevenue?.month} frente a {previousRevenue?.month}. La comparación utiliza los meses disponibles y puede incluir el mes en curso.</p>}
      {/* Gráfico de Ingresos */}
      {!metricsResource.loading && !metricsResource.error && <Card className="dashboard-panel overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Ingresos de los últimos 6 meses</CardTitle>
          <CardDescription>Rendimiento de ventas por matrículas completadas</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
          {metrics?.revenueByMonth && metrics.revenueByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.revenueByMonth.map((item) => ({ ...item, revenue: moneyToNumber(item.revenue) }))} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `S/ ${value}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value) => [`S/ ${Number(value || 0).toFixed(2)}`, 'Ingresos']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#168f80" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#168f80', strokeWidth: 2, fill: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No hay datos de ingresos suficientes
            </div>
          )}
        </CardContent>
      </Card>

      }
      </> }]} />
      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Acciones Rápidas
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`text-left rounded-2xl border border-border/50 p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-md group animate-fade-in-up`}
                style={{ animationDelay: `${i * 80 + 400}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${action.bg} transition-colors`}>
                    <Icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <div>
                    <p className="font-semibold group-hover:text-primary transition-colors">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                </div>
                <div className="mt-4 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <PlusCircle className="h-3.5 w-3.5" /> Crear ahora
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <CreateUserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSuccess={() => { setSuccess("Usuario creado exitosamente"); loadData(); }}
      />
      <CreateCourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onSuccess={() => { setSuccess("Curso creado exitosamente"); loadData(); }}
      />
      <CreateCohortModal
        isOpen={isCohortModalOpen}
        onClose={() => setIsCohortModalOpen(false)}
        onSuccess={() => { setSuccess("Cohorte creada exitosamente"); loadData(); }}
      />
    </div>
  );
}
