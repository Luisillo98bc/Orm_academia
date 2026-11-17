"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { Modal } from "@/components/ui/modal";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string };
  oldValue?: unknown;
  newValue?: unknown;
}

interface SecuritySummary {
  failedLogins: number;
  successfulLogins: number;
  activeSessions: number;
  adminsWithoutTwoFactor: number;
  riskLevel: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [security, setSecurity] = useState<SecuritySummary | null>(null);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const actionLabel = (value: string) => {
    const labels: Record<string, string> = { LOGIN: "Inicio de sesión", LOGIN_FAILED: "Acceso fallido", LOGOUT: "Cierre de sesión", CREATE: "Creación", UPDATE: "Actualización", DELETE: "Eliminación", RESTORE: "Restauración", APPROVE: "Aprobación", REJECT: "Rechazo", POST: "Registro", PATCH: "Actualización", PUT: "Actualización" };
    return labels[value] || value.split(/[_ :]/).map(word => labels[word] || word.toLowerCase()).join(" ");
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "25", page: String(page) });
      if (action.trim()) query.set("action", action.trim().toUpperCase());
      if (entity.trim()) query.set("entity", entity.trim());
      if (search.trim()) query.set("search", search.trim());
      if (fromDate) query.set("fromDate", fromDate);
      if (toDate) query.set("toDate", toDate);
      const response = await fetchApi(`/audit-logs?${query}`);
      setLogs(response.data || []);
      setTotal(response.total || 0);
      fetchApi("/audit-logs/security-summary?days=30").then(setSecurity).catch(() => setSecurity(null));
    } catch (requestError: unknown) {
      setLogs([]);
      setError(getErrorMessage(requestError, "No se pudo cargar la auditoría"));
    } finally {
      setLoading(false);
    }
  }, [action, entity, search, fromDate, toDate, page]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Control institucional" title="Auditoría" description="Trazabilidad de operaciones administrativas críticas." />
      {security && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de seguridad"><div className="rounded-xl border border-border/60 bg-card p-4"><p className="text-xs text-muted-foreground">Fallos de acceso · 30 días</p><p className="mt-1 text-2xl font-bold text-amber-700">{security.failedLogins}</p></div><div className="rounded-xl border border-border/60 bg-card p-4"><p className="text-xs text-muted-foreground">Accesos correctos</p><p className="mt-1 text-2xl font-bold">{security.successfulLogins}</p></div><div className="rounded-xl border border-border/60 bg-card p-4"><p className="text-xs text-muted-foreground">Sesiones activas</p><p className="mt-1 text-2xl font-bold">{security.activeSessions}</p></div><div className={`rounded-xl border p-4 ${security.riskLevel === "REVIEW" ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}><p className="text-xs text-muted-foreground">Estado de seguridad</p><p className="mt-1 text-lg font-bold">{security.riskLevel === "REVIEW" ? "Revisar alertas" : "Normal"}</p></div></section>}
      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between"><CardTitle>Actividad reciente</CardTitle><div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto"><Input value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="Filtrar por acción" aria-label="Filtrar auditoría por acción" className="sm:max-w-xs" /><Input value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }} placeholder="Filtrar por entidad" aria-label="Filtrar auditoría por entidad" className="sm:max-w-xs" /></div></CardHeader>
        <div className="grid gap-2 border-t border-border/50 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar usuario o evento" aria-label="Buscar auditoría" />
          <label className="text-xs font-semibold text-muted-foreground">Desde<Input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} aria-label="Fecha inicial de auditoría" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Hasta<Input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} aria-label="Fecha final de auditoría" /></label>
          <Button type="button" variant="outline" className="self-end" onClick={() => { setSearch(""); setAction(""); setEntity(""); setFromDate(""); setToDate(""); setPage(1); }}>Limpiar filtros</Button>
        </div>
        <CardContent>
          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">{error}</div>}
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : (
            <>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Fecha</th><th className="p-3">Usuario</th><th className="p-3">Acción</th><th className="p-3">Entidad</th><th className="p-3">IP</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-b last:border-0"><td className="p-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("es-PE")}</td><td className="p-3"><p className="font-medium">{log.user ? `${log.user.firstName} ${log.user.lastName}` : "Sistema"}</p><p className="text-xs text-muted-foreground">{log.user?.email}</p></td><td className="p-3 text-xs"><button type="button" onClick={() => setSelected(log)} className="text-left font-semibold text-primary hover:underline">{actionLabel(log.action)}<span className="mt-1 block font-mono text-[10px] font-normal text-muted-foreground">{log.action}</span></button></td><td className="p-3">{log.entity}</td><td className="p-3 text-muted-foreground">{log.ipAddress || "—"}</td></tr>)}</tbody></table>{logs.length === 0 && <p className="py-12 text-center text-muted-foreground">No hay registros para este filtro.</p>}</div>
              {total > 0 && <div className="flex flex-col gap-3 border-t border-border/50 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} de {total}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" />Anterior</Button><Button variant="outline" size="sm" onClick={() => setPage((current) => current + 1)} disabled={page * 25 >= total}>Siguiente<ChevronRight className="h-4 w-4" /></Button></div></div>}
            </>
          )}
        </CardContent>
      </Card>
      {selected && <Modal title="Detalle del evento" onClose={() => setSelected(null)}><div className="w-full max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"><div><p className="page-eyebrow">Registro de actividad</p><h2>{actionLabel(selected.action)}</h2><p className="mt-2 text-sm text-muted-foreground">{new Date(selected.createdAt).toLocaleString("es-PE")}</p></div><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Usuario</dt><dd>{selected.user ? `${selected.user.firstName} ${selected.user.lastName}` : "Sistema"}</dd></div><div><dt className="text-xs text-muted-foreground">Entidad</dt><dd>{selected.entity}</dd></div><div><dt className="text-xs text-muted-foreground">Identificador</dt><dd className="break-all font-mono text-xs">{selected.entityId || "Sin identificador"}</dd></div><div><dt className="text-xs text-muted-foreground">Origen</dt><dd>{selected.ipAddress || "Sin registro"}</dd></div></dl>{[["Datos anteriores", selected.oldValue], ["Datos registrados", selected.newValue]].map(([label, value]) => <details key={String(label)} className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-semibold">{String(label)}</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">{value == null ? "Sin detalle registrado" : JSON.stringify(value, null, 2)}</pre></details>)}<div className="flex justify-end"><Button variant="outline" onClick={() => setSelected(null)}>Cerrar detalle</Button></div></div></Modal>}
    </div>
  );
}
