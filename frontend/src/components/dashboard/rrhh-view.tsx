"use client";

import { useEffect, useState } from "react";
import { downloadApiFile, fetchApi } from "@/lib/api";
import {
  Users, DollarSign, AlertTriangle, Building2,
  TrendingUp, Clock, UserCheck, Palmtree, Download
} from "lucide-react";
import type { Money } from "@/lib/money";
import { moneyToNumber } from "@/lib/money";

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
  const [renderedAt] = useState(() => Date.now());

  useEffect(() => {
    fetchApi("/rrhh/stats")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-muted-foreground p-8">Error cargando datos de RRHH</div>;
  }

  const kpis = [
    { label: "Total Trabajadores", value: stats.totalWorkers, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Activos", value: stats.activeWorkers, icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "De Vacaciones", value: stats.onVacation, icon: Palmtree, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Nóminas Pendientes", value: stats.pendingPayrolls, icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Nóminas Pagadas", value: stats.paidPayrolls, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Total Pagado", value: `S/ ${moneyToNumber(stats.totalPayrollPaid).toLocaleString()}`, icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  const deptColors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];
  const totalDept = stats.departments.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard de RRHH</h2>
          <p className="text-muted-foreground">Vista general del personal y nóminas</p>
        </div>
        <button
          onClick={() => void downloadApiFile("/rrhh/export/payroll", "nominas.csv")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          Exportar Nóminas CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-border/50 bg-card p-4 hover:shadow-md transition-shadow">
              <div className={`inline-flex p-2 rounded-lg ${kpi.bg} mb-3`}>
                <Icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Departamento */}
        <div className="rounded-xl border border-border/50 bg-card p-6">
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
        <div className="rounded-xl border border-border/50 bg-card p-6">
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
