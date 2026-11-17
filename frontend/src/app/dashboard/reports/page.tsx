"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { FormEvent } from "react";
import { downloadApiFile, fetchApi } from "@/lib/api";
import { Loader2, TrendingUp, Users, BookOpen, Calendar, DollarSign, Activity, Download, Star, CheckCircle2, Trash2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Cohort } from "@/types/domain";
import type { Money } from "@/lib/money";
import { formatMoney, moneyToNumber } from "@/lib/money";
import { WorkspaceTabs } from "@/components/dashboard/workspace-tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { WhatsAppLogo } from "@/components/whatsapp-logo";

interface SummaryData {
  totalUsers: number;
  totalCourses: number;
  activeCohorts: number;
  totalEnrollments: number;
  totalRevenue: Money;
  pendingPayments: number;
}

interface MonthlyMetric {
  label: string;
  count?: number;
  total?: Money;
}

interface CourseRanking {
  name: string;
  totalEnrollments: number;
}

interface AttendanceSummary {
  id: string;
  name: string;
  attendanceRate: number;
  totalStudents: number;
}

interface PaymentMethodSummary {
  method: string;
  count: number;
}

interface ConversionSummary {
  days: number;
  funnel: Array<{ event: string; count: number }>;
  landingToCheckoutRate: number;
  checkoutConversionRate: number;
  whatsappClicks: number;
  failures: number;
  pendingPayments: number;
  completedRevenue: Money;
}

interface ProgramConversion {
  courseId: string;
  courseName: string;
  programViews: number;
  checkoutStarts: number;
  completedPayments: number;
  conversionRate: number;
}

interface TestimonialModeration {
  id: string;
  score: number;
  comment: string | null;
  isPublished: boolean;
  createdAt: string;
  student: { firstName: string; lastName: string; email: string };
  cohort: { name: string; course: { id: string; name: string } };
}

interface RetentionData {
  days: number;
  summary: { enrolled: number; active: number; completed: number; atRisk: number; retention7d: number; retention30d: number };
  cohorts: Array<{ cohortId: string; cohortName: string; courseName: string; enrolled: number; averageProgress: number; atRisk: number; completed: number }>;
}

interface OperationalOverview {
  notificationDeliveries: Array<{ channel: string; status: string; count: number }>;
}

interface FinancialProfitability {
  revenue: string;
  costs: string;
  profit: string;
  margin: number;
  projectedRevenue: string;
  costsCount: number;
}

interface OperatingCost { id: string; label: string; amount: string | number; periodStart: string; notes?: string | null; course?: { name: string } | null; cohort?: { name: string } | null }

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#64748b'];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [enrollments, setEnrollments] = useState<MonthlyMetric[]>([]);
  const [revenue, setRevenue] = useState<MonthlyMetric[]>([]);
  const [coursesRanking, setCoursesRanking] = useState<CourseRanking[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [conversion, setConversion] = useState<ConversionSummary | null>(null);
  const [programConversion, setProgramConversion] = useState<ProgramConversion[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialModeration[]>([]);
  const [updatingTestimonial, setUpdatingTestimonial] = useState<string | null>(null);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [operations, setOperations] = useState<OperationalOverview | null>(null);
  const [financial, setFinancial] = useState<FinancialProfitability | null>(null);
  const [costs, setCosts] = useState<OperatingCost[]>([]);
  const [costForm, setCostForm] = useState({ label: "", amount: "", periodStart: new Date().toISOString().slice(0, 10), notes: "" });
  const [savingCost, setSavingCost] = useState(false);
  const [deletingCostId, setDeletingCostId] = useState<string | null>(null);

  const loadStaticData = async () => {
    try {
      const [rank, att, pm, cohs, conversionData, programConversionData, testimonialsData, retentionData, operationsData, costsData] = await Promise.all([
        fetchApi("/reports/courses-ranking"),
        fetchApi("/reports/attendance-summary"),
        fetchApi("/reports/payment-methods"),
        fetchApi("/academic/cohorts"),
        fetchApi("/analytics/conversion?days=30"),
        fetchApi("/analytics/conversion-by-program?days=30").catch(() => []),
        fetchApi("/academic/testimonials").catch(() => []),
        fetchApi("/analytics/retention?days=180").catch(() => null),
        fetchApi("/analytics/operational-overview?days=30").catch(() => null),
        fetchApi("/reports/operating-costs").catch(() => []),
      ]);
      setCoursesRanking(rank);
      setAttendance(att);
      setPaymentMethods(pm);
      setCohorts(cohs || []);
      setConversion(conversionData);
      setProgramConversion(programConversionData || []);
      setTestimonials(testimonialsData || []);
      setRetention(retentionData);
      setOperations(operationsData);
      setCosts(costsData || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDateFilteredData = async () => {
    setError("");
    setLoading((prev) => summary === null ? true : prev);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const reportQuery = params.toString() ? `?${params.toString()}` : "";
      const [sum, enr, rev, financialData] = await Promise.all([
        fetchApi(`/reports/summary${reportQuery}`),
        fetchApi(`/reports/enrollments-by-month${reportQuery}`),
        fetchApi(`/reports/revenue-by-month${reportQuery}`),
        fetchApi(`/reports/financial-profitability${reportQuery}`).catch(() => null),
      ]);

      setSummary(sum);
      setEnrollments(enr);
      setRevenue(rev);
      setFinancial(financialData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes");
    } finally {
      setLoading(false);
    }
  };

  const toggleTestimonial = async (testimonial: TestimonialModeration) => {
    setUpdatingTestimonial(testimonial.id);
    try {
      await fetchApi(`/academic/testimonials/${testimonial.id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !testimonial.isPublished }),
      });
      setTestimonials((items) => items.map((item) => item.id === testimonial.id ? { ...item, isPublished: !item.isPublished } : item));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingTestimonial(null);
    }
  };

  const loadStaticDataEffect = useEffectEvent(loadStaticData);
  const loadDateFilteredDataEffect = useEffectEvent(loadDateFilteredData);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStaticDataEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDateFilteredDataEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [startDate, endDate]);

  const handleExport = (type: "students" | "grades" | "attendance" | "payments") => {
    if (type !== "payments" && !selectedCohortId) return;
    const params = new URLSearchParams();
    if (type !== "payments") params.set("cohortId", selectedCohortId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    void downloadApiFile(
      `/reports/export/${type}?${params.toString()}`,
      `reporte-${type}.csv`,
    );
  };

  const saveCost = async (event: FormEvent) => {
    event.preventDefault();
    if (!costForm.label.trim() || Number(costForm.amount) <= 0) return;
    setSavingCost(true);
    try {
      const created = await fetchApi("/reports/operating-costs", { method: "POST", body: JSON.stringify({ label: costForm.label, amount: Number(costForm.amount), periodStart: costForm.periodStart, notes: costForm.notes }) });
      setCosts((current) => [created, ...current]);
      setCostForm((current) => ({ ...current, label: "", amount: "", notes: "" }));
      await loadDateFilteredData();
    } finally { setSavingCost(false); }
  };

  const deleteCost = async (costId: string) => {
    setDeletingCostId(costId);
    try {
      await fetchApi(`/reports/operating-costs/${costId}`, { method: "DELETE" });
      setCosts((current) => current.filter((item) => item.id !== costId));
      await loadDateFilteredData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingCostId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando reportes y analíticas...</p>
      </div>
    );
  }
  if (!summary) return <div className="space-y-6"><PageHeader eyebrow="Inteligencia operativa" title="Reportes y estadísticas" /><div role="alert" className="workspace-note">{error || "No hay datos disponibles para este informe."}<button type="button" onClick={() => void loadDateFilteredData()} className="ml-3 font-semibold text-primary underline">Reintentar</button></div></div>;

  const kpis = [
    { label: "Ingresos Totales", value: `S/ ${formatMoney(summary.totalRevenue)}`, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Matrículas", value: summary.totalEnrollments, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Cursos Activos", value: summary.totalCourses, icon: BookOpen, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Cohortes en Curso", value: summary.activeCohorts, icon: Calendar, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Usuarios Reg.", value: summary.totalUsers, icon: Activity, color: "text-pink-500", bg: "bg-pink-500/10" },
    { label: "Pagos Pendientes", value: summary.pendingPayments, icon: TrendingUp, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ];

  // Custom tooltip formating
  const formatCurrency = (value: number) => `S/ ${value.toFixed(2)}`;
  const revenueChartData = revenue.map((item) => ({
    ...item,
    total: moneyToNumber(item.total),
  }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Inteligencia operativa" title="Reportes y estadísticas" description="Analiza el rendimiento académico, comercial y financiero de la academia." />
      {error && <p role="alert" className="workspace-note">{error}. Se conserva el último informe disponible.</p>}

      <section className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5" aria-labelledby="report-filters-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 id="report-filters-title" className="text-base font-semibold">Filtros del periodo</h2><p className="mt-1 text-sm text-muted-foreground">Aplican a los indicadores, gráficos y exportaciones disponibles.</p></div>
          <div className="flex flex-wrap gap-3"><label className="text-xs font-semibold text-muted-foreground">Desde<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" /></label><label className="text-xs font-semibold text-muted-foreground">Hasta<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" /></label><button type="button" onClick={() => { setStartDate(""); setEndDate(""); }} className="self-end rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted">Limpiar</button></div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="p-4 rounded-xl border border-border/50 bg-card glass flex flex-col items-center justify-center text-center">
            <div className={`p-3 rounded-full ${kpi.bg} mb-3`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold leading-none">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">{kpi.label}</p>
          </div>
        ))}
      </div>

      <WorkspaceTabs label="?reas de reportes" tabs={[
        { id: "overview", label: "Gráficos y exportación", content: <>
<div className="grid lg:grid-cols-2 gap-8">
        {/* Ingresos por Mes */}
        <div className="p-6 rounded-xl border border-border/50 bg-card glass">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" /> Ingresos por Mes
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.7 }} />
                <YAxis tickFormatter={(val) => `S/${val}`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.7 }} />
                <Tooltip 
                  formatter={(value) => [formatCurrency(Number(value || 0)), "Ingresos"]}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Matrículas por Mes */}
        <div className="p-6 rounded-xl border border-border/50 bg-card glass">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" /> Matrículas en el Tiempo
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enrollments}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.7 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.7 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Line type="monotone" dataKey="count" name="Matrículas" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cursos Populares */}
        <div className="p-6 rounded-xl border border-border/50 bg-card glass">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-500" /> Top Cursos Populares
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coursesRanking} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.7 }} />
                <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="totalEnrollments" name="Matrículas" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Métodos de Pago y Asistencia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Métodos de Pago */}
          <div className="p-6 rounded-xl border border-border/50 bg-card glass flex flex-col">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-500" /> Métodos de Pago
            </h3>
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="method"
                  >
                    {paymentMethods.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asistencia Resumen */}
          <div className="p-6 rounded-xl border border-border/50 bg-card glass flex flex-col">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-pink-500" /> Tasa de Asistencia
            </h3>
            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {attendance.map((cohort) => (
                <div key={cohort.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate mr-2" title={cohort.name}>{cohort.name}</span>
                    <span className="font-bold">{cohort.attendanceRate}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${cohort.attendanceRate >= 80 ? 'bg-green-500' : cohort.attendanceRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${cohort.attendanceRate}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right">{cohort.totalStudents} estudiantes</p>
                </div>
              ))}
              {attendance.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No hay datos de asistencia</p>
              )}
            </div>
          </div>
        </div>

        {/* Centro de Exportación */}
        <div className="p-6 rounded-xl border border-border/50 bg-card glass">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Centro de Exportación de Datos
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Exporta información académica por cohorte o el consolidado financiero general en formato CSV (compatible con Excel y Google Sheets).
          </p>
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Seleccionar Cohorte
              </label>
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">-- Elige una Cohorte --</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.course?.name || "Sin curso"})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleExport("payments")}
                className="px-4 py-2.5 rounded-lg border border-primary/40 text-primary font-medium hover:bg-primary/10 text-sm transition-colors"
              >
                Pagos
              </button>
              <button
                disabled={!selectedCohortId}
                onClick={() => handleExport("students")}
                className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/95 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Alumnos
              </button>
              <button
                disabled={!selectedCohortId}
                onClick={() => handleExport("grades")}
                className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/95 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Calificaciones
              </button>
              <button
                disabled={!selectedCohortId}
                onClick={() => handleExport("attendance")}
                className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/95 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Asistencia
              </button>
            </div>
          </div>
        </div>
      </div>
</> },
        { id: "finance", label: "Finanzas y costos", content: <>
{financial && <section className="rounded-xl border border-border/50 bg-card p-6" aria-labelledby="financial-title"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="financial-title" className="text-lg font-bold">Rentabilidad financiera</h2><p className="text-sm text-muted-foreground">Ingresos cobrados menos costos operativos registrados.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{financial.costsCount} costos cargados</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-xl bg-emerald-500/10 p-4"><p className="text-xs text-muted-foreground">Ingresos</p><p className="text-xl font-bold text-emerald-600">S/ {financial.revenue}</p></div><div className="rounded-xl bg-rose-500/10 p-4"><p className="text-xs text-muted-foreground">Costos</p><p className="text-xl font-bold text-rose-600">S/ {financial.costs}</p></div><div className="rounded-xl bg-blue-500/10 p-4"><p className="text-xs text-muted-foreground">Utilidad</p><p className="text-xl font-bold text-blue-600">S/ {financial.profit}</p></div><div className="rounded-xl bg-violet-500/10 p-4"><p className="text-xs text-muted-foreground">Margen</p><p className="text-xl font-bold">{financial.margin}%</p></div><div className="rounded-xl bg-amber-500/10 p-4"><p className="text-xs text-muted-foreground">Proyección activa</p><p className="text-xl font-bold">S/ {financial.projectedRevenue}</p></div></div><div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><form onSubmit={saveCost} className="rounded-xl border border-dashed border-border p-4"><h3 className="font-semibold">Registrar costo</h3><div className="mt-3 grid gap-3"><input aria-label="Concepto del costo" placeholder="Ej. Licencia de plataforma" value={costForm.label} onChange={(event) => setCostForm({ ...costForm, label: event.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" required /><input aria-label="Monto del costo" type="number" min="0.01" step="0.01" placeholder="Monto en soles" value={costForm.amount} onChange={(event) => setCostForm({ ...costForm, amount: event.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" required /><input aria-label="Fecha inicial del costo" type="date" value={costForm.periodStart} onChange={(event) => setCostForm({ ...costForm, periodStart: event.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" required /><input aria-label="Nota del costo" placeholder="Nota opcional" value={costForm.notes} onChange={(event) => setCostForm({ ...costForm, notes: event.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" /><button type="submit" disabled={savingCost} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{savingCost ? "Guardando..." : "Registrar costo"}</button></div></form><div><h3 className="font-semibold">Costos registrados</h3>{costs.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Todavía no hay costos registrados.</p> : <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{costs.slice(0, 10).map((cost) => <div key={cost.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"><span className="min-w-0 truncate"><span className="block font-medium">{cost.label}</span><span className="text-xs text-muted-foreground">{new Date(cost.periodStart).toLocaleDateString("es-PE")}</span></span><div className="ml-3 flex items-center gap-2"><span className="font-semibold">S/ {Number(cost.amount).toFixed(2)}</span><button type="button" onClick={() => void deleteCost(cost.id)} disabled={deletingCostId === cost.id} aria-label={`Eliminar costo ${cost.label}`} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50">{deletingCostId === cost.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button></div></div>)}</div>}</div></div></section>}
</> },
        { id: "academic", label: "Seguimiento académico", content: <>
{retention && (
        <section className="rounded-xl border border-border/50 bg-card p-6" aria-labelledby="retention-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h3 id="retention-title" className="text-lg font-bold">Retención y riesgo académico</h3><p className="text-sm text-muted-foreground">Seguimiento de estudiantes matriculados durante los últimos {retention.days} días.</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700">Retención 7 días: {retention.summary.retention7d}%</span><span className="rounded-full bg-blue-500/10 px-3 py-1 font-semibold text-blue-700">Retención 30 días: {retention.summary.retention30d}%</span></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Matriculados</p><p className="mt-1 text-2xl font-bold">{retention.summary.enrolled}</p></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Activos</p><p className="mt-1 text-2xl font-bold">{retention.summary.active}</p></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Completados</p><p className="mt-1 text-2xl font-bold">{retention.summary.completed}</p></div><div className="rounded-lg bg-amber-500/10 p-3"><p className="text-xs text-amber-800">En riesgo</p><p className="mt-1 text-2xl font-bold text-amber-800">{retention.summary.atRisk}</p></div></div>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-3">Cohorte</th><th className="px-3 py-3">Matriculados</th><th className="px-3 py-3">Avance promedio</th><th className="px-3 py-3">En riesgo</th><th className="px-3 py-3">Completados</th></tr></thead><tbody className="divide-y divide-border">{retention.cohorts.slice(0, 8).map((cohort) => <tr key={cohort.cohortId}><th className="px-3 py-3 font-semibold">{cohort.courseName}<span className="block text-xs font-normal text-muted-foreground">{cohort.cohortName}</span></th><td className="px-3 py-3">{cohort.enrolled}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${cohort.averageProgress}%` }} /></div><span>{cohort.averageProgress}%</span></div></td><td className="px-3 py-3 font-semibold text-amber-700">{cohort.atRisk}</td><td className="px-3 py-3">{cohort.completed}</td></tr>)}</tbody></table>{retention.cohorts.length === 0 && <p className="py-5 text-sm text-muted-foreground">Aún no hay matriculas maduras para analizar.</p>}</div>
        </section>
      )}
</> },
        { id: "sales", label: "Conversión comercial", content: <>
{conversion && (
        <section className="rounded-xl border border-border/50 bg-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-bold">Embudo comercial</h3>
              <p className="text-sm text-muted-foreground">Sesiones únicas durante los últimos {conversion.days} días.</p>
            </div>
            <div className="flex gap-5 text-sm">
              <span><strong>{conversion.landingToCheckoutRate}%</strong> visita → checkout</span>
              <span><strong>{conversion.checkoutConversionRate}%</strong> checkout → pago</span>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {conversion.funnel.map((step, index) => {
              const labels: Record<string, string> = {
                LANDING_VIEW: "Visitas",
                PROGRAM_VIEW: "Vieron programa",
                CHECKOUT_STARTED: "Iniciaron checkout",
                CHECKOUT_CREATED: "Generaron pago",
                PAYMENT_COMPLETED: "Pagaron",
              };
              return (
                <div key={step.event} className="relative rounded-lg border border-border bg-background p-4">
                  <p className="text-2xl font-bold">{step.count}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{labels[step.event] || step.event}</p>
                  {index < conversion.funnel.length - 1 && <span className="absolute -right-2 top-1/2 z-10 hidden text-muted-foreground sm:block">→</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-muted/40 p-3"><span className="inline-flex items-center gap-2 text-muted-foreground"><WhatsAppLogo className="h-5 w-5" />WhatsApp</span><strong className="float-right">{conversion.whatsappClicks}</strong></div>
            <div className="rounded-lg bg-muted/40 p-3"><span className="text-muted-foreground">Fallos</span><strong className="float-right">{conversion.failures}</strong></div>
            <div className="rounded-lg bg-muted/40 p-3"><span className="text-muted-foreground">Pagos pendientes</span><strong className="float-right">{conversion.pendingPayments}</strong></div>
            <div className="rounded-lg bg-muted/40 p-3"><span className="text-muted-foreground">Ingresos del periodo</span><strong className="float-right">S/ {formatMoney(conversion.completedRevenue)}</strong></div>
          </div>
        </section>
      )}
<section className="rounded-xl border border-border/50 bg-card p-6" aria-labelledby="program-conversion-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h3 id="program-conversion-title" className="text-lg font-bold">Conversión por programa</h3><p className="text-sm text-muted-foreground">Identifica qué programas atraen visitas y cuáles convierten en matrículas.</p></div>
          <span className="text-xs text-muted-foreground">Últimos 30 días</span>
        </div>
        {programConversion.length === 0 ? <p className="mt-5 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Todavía no hay eventos suficientes asociados a programas.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-3">Programa</th><th className="px-3 py-3">Vistas</th><th className="px-3 py-3">Checkout</th><th className="px-3 py-3">Pagos</th><th className="px-3 py-3">Conversión</th></tr></thead><tbody className="divide-y divide-border">{programConversion.map((item) => <tr key={item.courseId}><th className="px-3 py-3 font-semibold">{item.courseName}</th><td className="px-3 py-3">{item.programViews}</td><td className="px-3 py-3">{item.checkoutStarts}</td><td className="px-3 py-3">{item.completedPayments}</td><td className="px-3 py-3 font-bold text-primary">{item.conversionRate}%</td></tr>)}</tbody></table></div>}
      </section>
</> },
        { id: "community", label: "Comunicación y testimonios", content: <>
{operations && (
        <section className="rounded-xl border border-border/50 bg-card p-6" aria-labelledby="delivery-title">
          <div><h3 id="delivery-title" className="text-lg font-bold">Salud de notificaciones</h3><p className="text-sm text-muted-foreground">Estado de entregas por canal durante los últimos 30 días.</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{operations.notificationDeliveries.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay envíos externos registrados.</p> : operations.notificationDeliveries.map((item) => <div key={`${item.channel}-${item.status}`} className="rounded-lg border border-border/60 bg-background p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{item.channel}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.status === "SENT" ? "bg-emerald-500/10 text-emerald-700" : item.status === "FAILED" ? "bg-red-500/10 text-red-700" : "bg-amber-500/10 text-amber-700"}`}>{item.status}</span></div><p className="mt-2 text-2xl font-bold">{item.count}</p></div>)}</div>
        </section>
      )}
<section className="rounded-xl border border-border/50 bg-card p-6" aria-labelledby="testimonials-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="testimonials-title" className="text-lg font-bold">Moderación de testimonios</h3>
            <p className="text-sm text-muted-foreground">Publica solo comentarios reales de estudiantes que hayan evaluado a su docente.</p>
          </div>
          <span className="text-xs text-muted-foreground">{testimonials.filter((item) => item.isPublished).length} publicados</span>
        </div>
        {testimonials.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Todavía no hay evaluaciones con comentarios para moderar.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {testimonials.map((testimonial) => (
              <article key={testimonial.id} className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span>{testimonial.cohort.course.name}</span>
                    <span className="text-muted-foreground">· {testimonial.cohort.name}</span>
                    <span className="inline-flex items-center gap-1 text-amber-500"><Star className="h-4 w-4 fill-current" /> {testimonial.score}/5</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{testimonial.comment || "Sin comentario"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{testimonial.student.firstName} {testimonial.student.lastName} · {testimonial.student.email}</p>
                </div>
                <button
                  type="button"
                  disabled={updatingTestimonial === testimonial.id}
                  onClick={() => void toggleTestimonial(testimonial)}
                  className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${testimonial.isPublished ? "border border-border hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {updatingTestimonial === testimonial.id ? "Guardando..." : testimonial.isPublished ? "Ocultar" : "Publicar"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
</> }
      ]} />
    </div>
  );
}
