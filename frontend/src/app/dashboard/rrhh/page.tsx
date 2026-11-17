"use client";

import { useState, useEffect } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import {
  Users,
  Briefcase,
  DollarSign,
  AlertCircle,
  FileText,
  Clock,
  Loader2,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { SVGProps } from "react";
import type { Money } from "@/lib/money";
import { moneyToNumber } from "@/lib/money";

interface ExpiringContract {
  id: string;
  workerId?: string;
  workerName: string;
  type: string;
  endDate: string;
}

interface DepartmentSummary {
  name: string;
  count: number;
}

interface RrhhStats {
  totalWorkers: number;
  activeWorkers: number;
  inactiveWorkers?: number;
  onVacation: number;
  activeContracts?: number;
  totalPayrollPaid: Money;
  pendingPayrolls: number;
  expiringContracts: ExpiringContract[];
  departments: DepartmentSummary[];
}

export default function RrhhDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<RrhhStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/rrhh/stats");
      setStats(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar estadísticas"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadStats();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Cargando panel de RRHH...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-red-500">{error}</p>
        <Button onClick={loadStats} variant="outline">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
          <Briefcase className="h-8 w-8" />
          Dashboard RRHH
        </h2>
        <p className="text-muted-foreground mt-1">
          Visión general del estado del personal, nóminas y contratos.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">
              Total Trabajadores
            </h3>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold">{stats?.totalWorkers || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.activeWorkers || 0} activos, {stats?.onVacation || 0} en vacaciones
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">
              Nómina Pagada
            </h3>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold">
            S/ {moneyToNumber(stats?.totalPayrollPaid).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Histórico total pagado
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">
              Nóminas Pendientes
            </h3>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-500">
            {stats?.pendingPayrolls || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pagos pendientes de procesar
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">
              Contratos Activos
            </h3>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">
              {stats?.activeContracts || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Contratos vigentes actualmente
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Expiring Contracts */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="border-b p-6 flex flex-row items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Contratos Próximos a Vencer
              </h3>
              <p className="text-sm text-muted-foreground">
                Expiran en los próximos 30 días
              </p>
            </div>
          </div>
          <div className="p-0 flex-1 overflow-auto max-h-[400px]">
            {stats?.expiringContracts && stats.expiringContracts.length > 0 ? (
              <div className="divide-y">
                {stats.expiringContracts.map((contract: ExpiringContract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {contract.workerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contract.type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {new Date(contract.endDate).toLocaleDateString("es-ES")}
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0 text-xs"
                        onClick={() => router.push(`/dashboard/rrhh/workers/${contract.workerId || ''}`)}
                      >
                        Ver detalle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mb-3" />
                <p className="text-muted-foreground font-medium">Todo en orden</p>
                <p className="text-sm text-muted-foreground">
                  No hay contratos próximos a vencer.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Departments Distribution */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="border-b p-6 bg-muted/20">
            <h3 className="font-semibold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Distribución por Departamento
            </h3>
            <p className="text-sm text-muted-foreground">
              Personal activo por área
            </p>
          </div>
          <div className="p-6 flex-1 flex items-center justify-center">
            {stats?.departments && stats.departments.length > 0 ? (
              <div className="w-full space-y-4">
                {stats.departments.map((dept: DepartmentSummary, idx: number) => {
                  const percentage = Math.round((dept.count / stats.totalWorkers) * 100);
                  const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
                  const color = colors[idx % colors.length];
                  
                  return (
                    <div key={dept.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{dept.name}</span>
                        <span className="text-muted-foreground">{dept.count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${color} rounded-full`} 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center">No hay datos disponibles</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable CheckCircle2 for the empty state
function CheckCircle2(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
