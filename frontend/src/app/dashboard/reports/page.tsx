"use client";

import { useEffect, useState } from "react";
import { downloadApiFile, fetchApi } from "@/lib/api";
import { Loader2, TrendingUp, Users, BookOpen, Calendar, DollarSign, Activity, Download } from "lucide-react";
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

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#64748b'];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [enrollments, setEnrollments] = useState<MonthlyMetric[]>([]);
  const [revenue, setRevenue] = useState<MonthlyMetric[]>([]);
  const [coursesRanking, setCoursesRanking] = useState<CourseRanking[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, enr, rev, rank, att, pm, cohs] = await Promise.all([
        fetchApi("/reports/summary"),
        fetchApi("/reports/enrollments-by-month"),
        fetchApi("/reports/revenue-by-month"),
        fetchApi("/reports/courses-ranking"),
        fetchApi("/reports/attendance-summary"),
        fetchApi("/reports/payment-methods"),
        fetchApi("/academic/cohorts"),
      ]);

      setSummary(sum);
      setEnrollments(enr);
      setRevenue(rev);
      setCoursesRanking(rank);
      setAttendance(att);
      setPaymentMethods(pm);
      setCohorts(cohs || []);
    } catch (err) {
      console.error(err);
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

  const handleExport = (type: "students" | "grades" | "attendance") => {
    if (!selectedCohortId) return;
    void downloadApiFile(
      `/reports/export/${type}?cohortId=${selectedCohortId}`,
      `reporte-${type}.csv`,
    );
  };

  if (loading || !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando reportes y analíticas...</p>
      </div>
    );
  }

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
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Reportes y Estadísticas</h2>
        <p className="text-muted-foreground mt-1">Analíticas de rendimiento y estado general de la academia.</p>
      </div>

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
            Selecciona una cohorte para exportar la lista de alumnos, calificaciones y asistencia consolidada en formato CSV (compatible con Excel y Google Sheets).
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
    </div>
  );
}
