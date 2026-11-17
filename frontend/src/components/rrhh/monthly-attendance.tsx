"use client";

import { useState } from "react";
import { useRemoteData } from "@/lib/use-remote-data";
import { DataSection } from "@/components/dashboard/data-section";
import { DataTable } from "@/components/ui/data-table";

type Row = { id: string; name: string; department: string; position: string; counts: Record<string, number> };
export function MonthlyAttendance() {
  const [month, setMonth] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const resource = useRemoteData<Row[]>(`/rrhh/attendance/monthly?month=${month}`);
  return <div className="space-y-4"><div className="workspace-toolbar"><label>Mes de consulta<input type="month" value={month} required onChange={event => { if (event.target.value) setMonth(event.target.value); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label><p className="max-w-xl text-xs leading-5 text-muted-foreground">Resume los días registrados. Los días sin marcar no se consideran ausencias automáticamente.</p></div><DataSection {...resource} label="resumen mensual de asistencia"><DataTable<Row> data={resource.data || []} searchPlaceholder="Buscar personal en el resumen mensual" emptyMessage="No hay registros de asistencia para este mes." columns={[
    { key: "name", header: "Trabajador", render: row => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-muted-foreground">{row.department} · {row.position}</p></div> },
    ...Object.entries({ PRESENT: "Presentes", LATE: "Tardanzas", ABSENT: "Ausencias", EXCUSED: "Permisos", VACATION: "Vacaciones" }).map(([key, label]) => ({ key, header: label, render: (row: Row) => <span className="tabular-nums">{row.counts[key] || 0}</span> })),
  ]} /></DataSection></div>;
}
