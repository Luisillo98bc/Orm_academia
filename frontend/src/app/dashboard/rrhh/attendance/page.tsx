"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import {
  Loader2,
  CalendarDays,
  UserCheck,
  UserX,
  Clock,
  Briefcase,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { SummaryStrip, WorkspaceTabs } from "@/components/dashboard/workspace-tabs";
import { MonthlyAttendance } from "@/components/rrhh/monthly-attendance";

interface WorkerAttendance {
  worker: {
    id: string;
    name: string;
    department: string;
    position: string;
  };
  attendance: {
    id: string;
    status: string;
    checkInTime?: string;
    observation?: string;
  } | null;
}

export default function AttendancePage() {
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<WorkerAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const visibleData = data.filter(item => `${item.worker.name} ${item.worker.department} ${item.worker.position}`.toLowerCase().includes(search.toLowerCase()) && (!statusFilter || (item.attendance?.status || "UNMARKED") === statusFilter));

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetchApi(`/rrhh/attendance?date=${date}`);
      setData(res || []);
      setError("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo cargar la asistencia."));
    } finally {
      setLoading(false);
    }
  };

    const loadAttendanceEffect = useEffectEvent(loadAttendance);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAttendanceEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [date]);

  const handleMarkAttendance = async (workerId: string, status: string) => {
    setMarkingId(workerId);
    setError("");
    setNotice("");
    try {
      await fetchApi(`/rrhh/attendance`, {
        method: "POST",
        body: JSON.stringify({
          workerId,
          date,
          status,
        }),
      });
      // update local state instantly for UI responsiveness
      setData(prev =>
        prev.map(item => {
          if (item.worker.id === workerId) {
            return {
              ...item,
              attendance: {
                id: item.attendance?.id || "temp",
                status,
                checkInTime: (status === "PRESENT" || status === "LATE")
                  ? item.attendance?.checkInTime || new Date().toISOString()
                  : undefined,
                observation: item.attendance?.observation,
              }
            };
          }
          return item;
        })
      );
      setNotice("Asistencia actualizada correctamente.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo guardar la asistencia."));
    } finally {
      setMarkingId(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return <span className="text-muted-foreground text-sm">Sin marcar</span>;
    switch (status) {
      case "PRESENT":
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-500 flex items-center gap-1 w-fit"><UserCheck className="h-3 w-3"/> Presente</span>;
      case "LATE":
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 flex items-center gap-1 w-fit"><Clock className="h-3 w-3"/> Tarde</span>;
      case "ABSENT":
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 flex items-center gap-1 w-fit"><UserX className="h-3 w-3"/> Ausente</span>;
      case "EXCUSED":
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 flex items-center gap-1 w-fit"><Briefcase className="h-3 w-3"/> Permiso</span>;
      case "VACATION":
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-500 flex items-center gap-1 w-fit"><Plane className="h-3 w-3"/> Vacaciones</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Recursos humanos" title="Control de asistencia" description="Registra la asistencia diaria del personal activo." actions={<div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2 shadow-sm">
          <CalendarDays className="h-5 w-5 text-muted-foreground ml-2" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-0 focus-visible:ring-0 shadow-none"
          />
        </div>} />

      {error && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <WorkspaceTabs label="Vistas de asistencia" tabs={[{ id: "daily", label: "Registro diario", content: <>
      <SummaryStrip items={[{ label: "Personal activo", value: data.length }, { label: "Presentes", value: data.filter(item => item.attendance?.status === "PRESENT").length }, { label: "Tardanzas", value: data.filter(item => item.attendance?.status === "LATE").length }, { label: "Sin marcar", value: data.filter(item => !item.attendance).length }]} />
      <div className="workspace-toolbar"><label className="min-w-40 flex-1">Buscar personal<Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, cargo o departamento" /></label><label>Estado<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">Todos</option><option value="PRESENT">Presentes</option><option value="LATE">Tardanzas</option><option value="ABSENT">Ausentes</option><option value="EXCUSED">Permisos</option><option value="UNMARKED">Sin marcar</option></select></label></div>
      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border/50">
              <tr className="text-left">
                <th className="px-6 py-4 font-medium">Trabajador</th>
                <th className="px-6 py-4 font-medium">Cargo y Depto</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Hora Check-In</th>
                <th className="px-6 py-4 font-medium text-right">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Cargando trabajadores...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No hay trabajadores activos.
                  </td>
                </tr>
              ) : (
                visibleData.map((item) => (
                  <tr key={item.worker.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-semibold">{item.worker.name}</p>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-muted-foreground">{item.worker.position}</p>
                      <p className="text-xs text-muted-foreground opacity-70">{item.worker.department}</p>
                    </td>
                    <td className="px-6 py-3">
                      {getStatusBadge(item.attendance?.status)}
                    </td>
                    <td className="px-6 py-3 font-mono text-muted-foreground">
                      {item.attendance?.checkInTime 
                        ? new Date(item.attendance.checkInTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) 
                        : "-"}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                          title="Marcar Presente"
                          aria-label={`Marcar presente a ${item.worker.name}`}
                          onClick={() => handleMarkAttendance(item.worker.id, "PRESENT")}
                          disabled={markingId === item.worker.id || item.attendance?.status === "PRESENT"}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                          title="Marcar Tarde"
                          aria-label={`Marcar tarde a ${item.worker.name}`}
                          onClick={() => handleMarkAttendance(item.worker.id, "LATE")}
                          disabled={markingId === item.worker.id || item.attendance?.status === "LATE"}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          title="Marcar Ausente"
                          aria-label={`Marcar ausente a ${item.worker.name}`}
                          onClick={() => handleMarkAttendance(item.worker.id, "ABSENT")}
                          disabled={markingId === item.worker.id || item.attendance?.status === "ABSENT"}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                          title="Permiso / Justificado"
                          aria-label={`Marcar permiso a ${item.worker.name}`}
                          onClick={() => handleMarkAttendance(item.worker.id, "EXCUSED")}
                          disabled={markingId === item.worker.id || item.attendance?.status === "EXCUSED"}
                        >
                          <Briefcase className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div></> }, { id: "monthly", label: "Resumen mensual", content: <MonthlyAttendance /> }]} />
    </div>
  );
}
