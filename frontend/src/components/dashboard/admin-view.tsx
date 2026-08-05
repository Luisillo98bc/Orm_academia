"use client";

import { useState, useEffect } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Calendar, AlertCircle, CheckCircle2, PlusCircle, Users, BarChart3, TrendingUp, Activity, Download } from "lucide-react";
import { CreateUserModal } from "@/components/admin/create-user-modal";
import { CreateCourseModal } from "@/components/admin/create-course-modal";
import { CreateCohortModal } from "@/components/admin/create-cohort-modal";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { saveAs } from 'file-saver';
import type { Money } from "@/lib/money";
import { formatMoney, moneyToNumber } from "@/lib/money";

interface DashboardMetrics {
  totalRevenue: Money;
  totalStudents: number;
  activeCohorts: number;
  revenueByMonth: Array<{ month: string; revenue: Money }>;
}

export function AdminView() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isCohortModalOpen, setIsCohortModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const dashboardMetrics = await fetchApi("/academic/metrics");
      setMetrics(dashboardMetrics);
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

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const studentsData = await fetchApi("/academic/export-students");
      if (!studentsData || studentsData.length === 0) {
        setError("No hay datos para exportar");
        setIsExporting(false);
        return;
      }

      // Convert JSON to CSV
      const headers = Object.keys(studentsData[0]).join(',');
      const rows = studentsData.map((row: Record<string, unknown>) => Object.values(row).map(val => `"${val}"`).join(','));
      const csvContent = [headers, ...rows].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm animate-pulse">Cargando panel administrativo...</p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Ingresos Totales",
      value: `S/ ${formatMoney(metrics?.totalRevenue)}`,
      icon: TrendingUp,
      gradient: "from-green-500/20 to-emerald-500/10",
      iconColor: "text-emerald-500",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Alumnos Matriculados",
      value: metrics?.totalStudents || 0,
      icon: Users,
      gradient: "from-violet-500/20 to-purple-500/10",
      iconColor: "text-violet-500",
      borderColor: "border-violet-500/20",
    },
    {
      label: "Cohortes Activos",
      value: metrics?.activeCohorts || 0,
      icon: Calendar,
      gradient: "from-blue-500/20 to-cyan-500/10",
      iconColor: "text-blue-500",
      borderColor: "border-blue-500/20",
    },
  ];

  const quickActions = [
    {
      label: "Crear Curso",
      description: "Añadir nuevo curso al catálogo",
      icon: BookOpen,
      color: "text-blue-500",
      bg: "bg-blue-500/10 hover:bg-blue-500/20",
      onClick: () => setIsCourseModalOpen(true),
    },
    {
      label: "Registrar Usuario",
      description: "Añadir nuevo usuario al sistema",
      icon: Users,
      color: "text-violet-500",
      bg: "bg-violet-500/10 hover:bg-violet-500/20",
      onClick: () => setIsUserModalOpen(true),
    },
    {
      label: "Abrir Cohorte",
      description: "Programar nueva clase de un curso",
      icon: Calendar,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
      onClick: () => setIsCohortModalOpen(true),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Panel de Administración
          </h2>
          <p className="text-muted-foreground mt-1">
            Revisa métricas clave, gestiona cohortes y exporta datos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExportCSV} disabled={isExporting} variant="outline" className="flex items-center gap-2 rounded-xl">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar Estudiantes
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400 animate-scale-in">
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

      {/* Stats Overview — Gradient Cards */}
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
              {/* Decorative glow */}
              <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full ${stat.gradient} blur-2xl opacity-50`} />
            </div>
          );
        })}
      </div>

      {/* Gráfico de Ingresos */}
      <Card className="glass overflow-hidden shadow-sm animate-fade-in-up" style={{ animationDelay: `300ms` }}>
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
                <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2, fill: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No hay datos de ingresos suficientes
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h3 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Acciones Rápidas
        </h3>
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
