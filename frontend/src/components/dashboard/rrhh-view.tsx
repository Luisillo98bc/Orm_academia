"use client";

import { useEffect, useState } from "react";
import { downloadApiFile, fetchApi } from "@/lib/api";
import {
  Users, DollarSign, AlertTriangle, Building2,
  TrendingUp, Clock, UserCheck, Palmtree, Download, RefreshCw
} from "lucide-react";
import type { Money } from "@/lib/money";
import { moneyToNumber } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";

interface RrhhStats {
  totalWorkers: number;
  activeWorkers: number;
  inactiveWorkers: number;
  onVacation: number;
  pendingPayrolls: number;
  paidPayrolls: number;
  totalPayrollPaid: Money;
  expiringContracts: { id: string; workerName: string; type: string; endDate: string }[];
  departments: { name: string; count: number }[];
}

export function RrhhView() {
  const [stats, setStats] = useState<RrhhStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renderedAt, setRenderedAt] = useState(() => Date.now());

  const loadStats = async () => {
    setLoading(true);
    setError("");
    try {
      setStats(await fetchApi("/rrhh/stats"));
      setRenderedAt(Date.now());
    } catch {
      setError("No se pudieron cargar las métricas de RRHH.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadStats(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="mx-auto max-w-lg rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-red-500" /><p className="mt-3 font-semibold">{error || "Error cargando datos de RRHH"}</p><Button onClick={() => void loadStats()} className="mt-5 gap-2"><RefreshCw className="h-4 w-4" /> Reintentar</Button></div>;
  }

  const kpis = [
    { label: "Trabajadores", value: stats.totalWorkers, icon: Users, tone: "info" as const, detail: "Total registrado" },
    { label: "Activos", value: stats.activeWorkers, icon: UserCheck, tone: "success" as const, detail: "Personal operativo" },
    { label: "Vacaciones", value: stats.onVacation, icon: Palmtree, tone: "warning" as const, detail: "Ausencias actuales" },
    { label: "Nóminas pendientes", value: stats.pendingPayrolls, icon: Clock, tone: "warning" as const, detail: "Requieren revisión" },
    { label: "Nóminas pagadas", value: stats.paidPayrolls, icon: DollarSign, tone: "success" as const, detail: "Procesadas" },
    { label: "Total pagado", value: `S/ ${moneyToNumber(stats.totalPayrollPaid).toLocaleString()}`, icon: TrendingUp, tone: "primary" as const, detail: "Acumulado" },
  ];

  const deptColors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];
  const totalDept = stats.departments.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Gestión de personas" title="Panel de recursos humanos" description="Supervisa el personal, las ausencias y el estado de las nóminas." actions={<Button
          onClick={() => void downloadApiFile("/rrhh/export/payroll", "nominas.csv")}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar Nóminas CSV
        </Button>} />

      {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadStats()} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Reintentar</Button></div>}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => <MetricCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Departamento */}
        <div className="dashboard-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Distribución por Departamento</h3>
          </div>
          <div className="space-y-3">
            {stats.departments.map((dept, i) => {
              const pct = totalDept > 0 ? Math.round((dept.count / totalDept) * 100) : 0;
              return (
                <div key={dept.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{dept.name}</span>
                    <span className="text-muted-foreground">{dept.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${deptColors[i % deptColors.length]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.departments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay datos de departamentos</p>
            )}
          </div>
        </div>

        {/* Contratos por Vencer */}
        <div className="dashboard-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold">Contratos Próximos a Vencer</h3>
            <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
              {stats.expiringContracts.length}
            </span>
          </div>
          <div className="space-y-2">
            {stats.expiringContracts.map((c) => {
              const daysLeft = Math.ceil(
                (new Date(c.endDate).getTime() - renderedAt) / (1000 * 60 * 60 * 24)
              );
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/30"
                >
                  <div>
                    <p className="text-sm font-medium">{c.workerName}</p>
                    <p className="text-xs text-muted-foreground">{c.type}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    daysLeft <= 7
                      ? "bg-red-500/10 text-red-600"
                      : daysLeft <= 14
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-blue-500/10 text-blue-600"
                  }`}>
                    {daysLeft} días
                  </span>
                </div>
              );
            })}
            {stats.expiringContracts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                ✅ No hay contratos próximos a vencer
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
