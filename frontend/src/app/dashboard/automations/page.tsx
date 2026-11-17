"use client";

import Link from "next/link";
import { useState } from "react";
import { Play, Loader2, ArrowUpRight, BellRing } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useRemoteData } from "@/lib/use-remote-data";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";
import { DataSection } from "@/components/dashboard/data-section";
import { toast } from "sonner";

type Status = { enabled: boolean; lastRunAt: string | null; nextRunAt?: string | null; lastResult: Record<string, number> | null; history?: { at: string; executed: boolean; result: Record<string, number> }[] };
const processes = [
  { key: "prospects", title: "Seguimiento de prospectos", description: "Avisa al asesor cuando un contacto pendiente supera la fecha de seguimiento.", href: "/dashboard/prospects" },
  { key: "payments", title: "Recordatorios de pago", description: "Recuerda al estudiante los pagos pendientes con más de 24 horas de antigüedad.", href: "/dashboard/payments" },
  { key: "inactiveStudents", title: "Retomar el aprendizaje", description: "Envía recordatorios a estudiantes que necesitan volver a sus cursos.", href: "/dashboard/reports" },
  { key: "notificationRetries", title: "Reintento de notificaciones", description: "Vuelve a intentar entregas fallidas según las reglas de envío.", href: "/dashboard/system" },
];
const date = (value?: string | null) => value ? new Date(value).toLocaleString("es-PE") : "Sin registro";

export default function AutomationsPage() {
  const resource = useRemoteData<Status>("/automation/status");
  const status = resource.data;
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      const result = await fetchApi("/automation/run", { method: "POST" });
      await resource.reload();
      if (result.executed === false) toast.info("Otra instancia está ejecutando estos procesos. No se duplicó la ejecución.");
      else toast.success("Procesos completados. Revisa los resultados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo ejecutar"); }
    finally { setRunning(false); }
  };
  return <div className="space-y-6">
    <PageHeader eyebrow="Operación comercial y académica" title="Automatizaciones" description="Consulta qué procesos están activos y el resultado de sus ejecuciones." actions={<Button onClick={run} disabled={running || resource.loading || !!resource.error}>{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Ejecutar ahora</Button>} />
    <DataSection {...resource} label="automatizaciones">
      <SummaryStrip items={[{ label: "Modo de ejecución", value: status?.enabled ? "Programado" : "Manual / externo" }, { label: "Última ejecución", value: <span className="text-base">{date(status?.lastRunAt)}</span> }, { label: "Próxima ejecución local", value: <span className="text-base">{status?.enabled ? date(status.nextRunAt) : "Gestionada externamente o manual"}</span> }]} />
      <div className="grid gap-4 md:grid-cols-2">{processes.map(process => <article key={process.key} className="dashboard-panel p-5"><div className="flex items-start justify-between gap-3"><BellRing className="h-5 w-5 text-accent" aria-hidden="true" /><span className="text-sm font-semibold tabular-nums">{status?.lastResult?.[process.key] ?? "—"} <span className="font-normal text-muted-foreground">en última ejecución</span></span></div><h2 className="mt-4 !text-base">{process.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{process.description}</p><Link href={process.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Abrir módulo<ArrowUpRight className="h-4 w-4" /></Link></article>)}</div>
      <section className="dashboard-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="!text-lg">Historial de ejecuciones</h2><p className="mt-1 text-xs text-muted-foreground">Hasta 20 registros de esta instancia del servidor. Se reinicia cuando el proceso se reinicia.</p></div>{status?.history?.length ? <ol className="divide-y divide-border">{status.history.map((run, index) => <li key={`${run.at}-${index}`} className="flex flex-wrap justify-between gap-3 px-5 py-4 text-sm"><time>{date(run.at)}</time><span>{run.executed ? `${Object.values(run.result).reduce((sum, count) => sum + count, 0)} avisos o reintentos procesados` : "Omitida: otra instancia tenía el bloqueo"}</span></li>)}</ol> : <p className="p-8 text-center text-sm text-muted-foreground">Todavía no hay ejecuciones registradas.</p>}</section>
    </DataSection>
  </div>;
}
