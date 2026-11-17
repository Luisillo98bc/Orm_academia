"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Database, Loader2, Mail, MessageCircle, RefreshCw, Server, ShieldCheck, XCircle } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Health = {
  status: string;
  database: string;
  databaseLatencyMs: number;
  timestamp: string;
  version: string;
  environment: string;
  paymentsMode?: string;
  scheduledJobsMode?: string;
  storageBucketQuotaBytes?: number;
  integrations: {
    smtp: boolean;
    whatsapp: boolean;
    storage: string;
    clamav?: { enabled: boolean; required: boolean; status: "up" | "down" | "disabled" };
  };
  schedulers: Record<string, boolean>;
};

type FailedDelivery = {
  id: string;
  channel: string;
  recipient: string;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
};

type Metrics = {
  users: number;
  activeEnrollments: number;
  openTickets: number;
  failedDeliveries: number;
  failedLogins: number;
  pendingPayments?: number;
  expiringReservations?: number;
  recentFailedDeliveries?: FailedDelivery[];
  responseTimeMs: number;
  requests?: {
    windowMinutes: number;
    requests: number;
    errors: number;
    errorRate: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    topRoutes: Array<{ path: string; requests: number; errors: number; averageMs: number }>;
  };
};

function State({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="Operativo" /> : <XCircle className="h-5 w-5 text-amber-500" aria-label="Revisar" />;
}

export default function SystemPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    const [details, operational] = await Promise.all([fetchApi("/health/details"), fetchApi("/health/metrics")]);
    setHealth(details);
    setMetrics(operational);
    setError("");
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No disponible");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([fetchApi("/health/details"), fetchApi("/health/metrics")])
      .then(([details, operational]) => {
        if (!active) return;
        setHealth(details);
        setMetrics(operational);
        setError("");
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "No disponible");
      });
    return () => { active = false; };
  }, []);

  if (!health && !error) return <div className="flex justify-center py-20" role="status" aria-label="Cargando estado del sistema"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (error && !health) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive" role="alert">No se pudo consultar el estado: {error}</div>;

  const requestMetrics = metrics?.requests;
  const operationalMetrics = [
    ["Usuarios", metrics?.users],
    ["Matrículas activas", metrics?.activeEnrollments],
    ["Pagos por validar", metrics?.pendingPayments ?? 0],
    ["Reservas por vencer", metrics?.expiringReservations ?? 0],
    ["Tickets abiertos", metrics?.openTickets],
    ["Entregas fallidas", metrics?.failedDeliveries],
    ["Logins fallidos", metrics?.failedLogins],
  ];
  const requestCards = [
    ["Solicitudes", requestMetrics?.requests ?? 0],
    ["Errores 5xx", requestMetrics?.errors ?? 0],
    ["Tasa de error", `${requestMetrics?.errorRate ?? 0}%`],
    ["P95", `${requestMetrics?.p95Ms ?? 0} ms`],
    ["P99", `${requestMetrics?.p99Ms ?? 0} ms`],
  ];

  const clamav = health?.integrations.clamav;
  const quotaMb = health?.storageBucketQuotaBytes ? `${Math.round(health.storageBucketQuotaBytes / (1024 * 1024))} MB` : "Sin límite";

  return <div className="space-y-6">
    <div className="page-intro flex flex-wrap items-start justify-between gap-4">
      <div><p className="page-eyebrow">Operación</p><h1>Estado del sistema</h1><p className="page-description">Salud de la API, base de datos, integraciones y procesos automáticos.</p></div>
      <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void handleRefresh()}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Actualizar</Button>
    </div>
    {error && <p role="alert" className="workspace-note">La actualización falló: {error}. Se muestra la última lectura disponible.</p>}
    <section aria-label="Resumen del estado" className="dashboard-panel p-5"><h2 className="!text-lg">{health?.status === "ok" ? "Servicios principales operativos" : "El sistema necesita revisión"}</h2><p className="mt-2 text-sm text-muted-foreground">{metrics?.failedDeliveries ? `${metrics.failedDeliveries} notificaciones presentan fallos de entrega.` : "Sin fallos de entrega registrados en las métricas actuales."}</p><div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-primary"><Link href="/dashboard/support" className="hover:underline">Revisar solicitudes ({metrics?.openTickets ?? 0})</Link><Link href="/dashboard/payments" className="hover:underline">Pagos por validar ({metrics?.pendingPayments ?? 0})</Link><Link href="/dashboard/automations" className="hover:underline">Consultar automatizaciones</Link></div></section>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardContent className="flex items-center gap-4 pt-6"><Activity className="h-8 w-8 text-primary" aria-hidden="true" /><div><p className="text-sm text-muted-foreground">API</p><p className="text-xl font-bold">{health?.status === "ok" ? "Operativa" : "Degradada"}</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-4 pt-6"><Database className="h-8 w-8 text-primary" aria-hidden="true" /><div><p className="text-sm text-muted-foreground">PostgreSQL</p><p className="text-xl font-bold">{health?.database} · {health?.databaseLatencyMs} ms</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-4 pt-6"><Server className="h-8 w-8 text-primary" aria-hidden="true" /><div><p className="text-sm text-muted-foreground">Entorno</p><p className="text-xl font-bold">{health?.environment}</p></div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Métricas operativas · 24 horas</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{operationalMetrics.map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value ?? 0}</p></div>)}</CardContent></Card>
    <details className="dashboard-panel p-5"><summary className="cursor-pointer text-sm font-semibold text-primary">Ver diagnóstico técnico e integraciones</summary><div className="mt-5 space-y-5">
    <Card><CardHeader><CardTitle>Rendimiento HTTP reciente</CardTitle><p className="text-sm text-muted-foreground">Ventana móvil de {requestMetrics?.windowMinutes ?? 5} minutos, capturada desde la API.</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{requestCards.map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>{requestMetrics?.topRoutes?.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><caption className="sr-only">Rutas con mayor volumen reciente</caption><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2 font-semibold">Ruta</th><th className="px-3 py-2 font-semibold">Solicitudes</th><th className="px-3 py-2 font-semibold">Errores</th><th className="px-3 py-2 font-semibold">Promedio</th></tr></thead><tbody>{requestMetrics.topRoutes.map((route) => <tr key={route.path} className="border-b border-border/50"><th scope="row" className="max-w-[280px] truncate px-3 py-2 text-left font-medium">{route.path}</th><td className="px-3 py-2">{route.requests}</td><td className="px-3 py-2">{route.errors}</td><td className="px-3 py-2">{route.averageMs} ms</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-muted-foreground">Todavía no hay suficiente tráfico para mostrar rutas.</p>}</CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Integraciones y seguridad</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Mail className="h-4 w-4" aria-hidden="true" />Correo SMTP</span><State ok={Boolean(health?.integrations.smtp)} /></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp</span><State ok={Boolean(health?.integrations.whatsapp)} /></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Antivirus ClamAV {clamav?.required ? "(Obligatorio)" : ""}</span>{clamav?.enabled ? <State ok={clamav.status === "up"} /> : <span className="text-xs text-muted-foreground">Deshabilitado</span>}</div>
        <div className="flex items-center justify-between"><span>Almacenamiento</span><span className="font-medium uppercase">{health?.integrations.storage} · {quotaMb}</span></div>
        <div className="flex items-center justify-between"><span>Modo de pagos</span><span className="font-medium uppercase">{health?.paymentsMode || "cash"}</span></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Procesos automáticos ({health?.scheduledJobsMode || "inline"})</CardTitle></CardHeader><CardContent className="space-y-4">{Object.entries(health?.schedulers || {}).map(([name, ok]) => <div key={name} className="flex items-center justify-between"><span className="capitalize">{name.replace(/([A-Z])/g, " $1")}</span><State ok={ok} /></div>)}</CardContent></Card>
    </div>
    {metrics?.recentFailedDeliveries?.length ? (
      <Card><CardHeader><CardTitle>Últimos envíos de notificación fallidos</CardTitle><p className="text-sm text-muted-foreground">Revisa errores recientes de SMTP o WhatsApp para diagnosticar entregas.</p></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2 font-semibold">Canal</th><th className="px-3 py-2 font-semibold">Destinatario</th><th className="px-3 py-2 font-semibold">Error</th><th className="px-3 py-2 font-semibold">Fecha</th></tr></thead><tbody>{metrics.recentFailedDeliveries.map((item) => <tr key={item.id} className="border-b border-border/50"><td className="px-3 py-2 font-medium">{item.channel}</td><td className="px-3 py-2">{item.recipient}</td><td className="max-w-[320px] truncate px-3 py-2 text-destructive">{item.errorMessage || "Error desconocido"}</td><td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("es-PE")}</td></tr>)}</tbody></table></CardContent></Card>
    ) : null}
    </div></details>
    <p className="text-xs text-muted-foreground">Última lectura: {health ? new Date(health.timestamp).toLocaleString("es-PE") : "-"} · versión {health?.version} · consulta {metrics?.responseTimeMs ?? 0} ms</p>
  </div>;
}
