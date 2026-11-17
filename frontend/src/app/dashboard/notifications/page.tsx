"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";

interface NotificationItem {
  id: string;
  title: string;
  message: string | null;
  type: string | null;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

interface Preferences {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  contractAlerts: boolean;
  academicAlerts: boolean;
  paymentAlerts: boolean;
}

const defaultPreferences: Preferences = {
  emailEnabled: true,
  whatsappEnabled: true,
  pushEnabled: true,
  contractAlerts: true,
  academicAlerts: true,
  paymentAlerts: true,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function resolveNotificationUrl(actionUrl: string | null, role?: string) {
  if (!actionUrl) return null;
  if (role !== "ESTUDIANTE" && actionUrl.startsWith("/dashboard/my-courses")) return "/dashboard";
  if (role !== "ESTUDIANTE" && actionUrl.startsWith("/dashboard/my-payments")) return "/dashboard/payments";
  return actionUrl;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [marking, setMarking] = useState(false);
  const typeLabels: Record<string, string> = { payment: "Pagos", academic: "Académicas", contract: "Contratos", prospect: "Prospectos", support: "Soporte", system: "Sistema" };
  const visibleItems = items.filter(item => !typeFilter || (item.type || "system") === typeFilter).sort((a, b) => Number(a.isRead) - Number(b.isRead) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, prefs] = await Promise.all([
        fetchApi(`/communication/notifications/page?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}`),
        fetchApi("/communication/notifications/preferences"),
      ]);
      setItems((result?.data || []).map((item: NotificationItem) => ({
        ...item,
        actionUrl: resolveNotificationUrl(item.actionUrl, user?.roles?.[0]),
      })));
      setTotal(result?.total || 0);
      setUnread(result?.unread || 0);
      setPreferences({ ...defaultPreferences, ...(prefs || {}) });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "No se pudieron cargar las notificaciones"));
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly, user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const markOneAsRead = async (id: string, navigateTo?: string | null) => {
    const target = items.find((item) => item.id === id);
    if (target && !target.isRead) {
      try { await fetchApi(`/communication/notifications/${id}/read`, { method: "PATCH" }); }
      catch { toast.error("No se pudo marcar la notificación como leída"); return; }
      setUnread((current) => Math.max(0, current - 1));
      setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    }
    if (navigateTo) {
      router.push(navigateTo);
    }
  };

  const markAllAsRead = async () => {
    setMarking(true);
    try {
      await fetchApi("/communication/notifications/read-all", { method: "PATCH" });
      await load();
      toast.success("Notificaciones marcadas como leídas");
    } catch { toast.error("No se pudieron marcar las notificaciones"); }
    finally { setMarking(false); }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await fetchApi("/communication/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(preferences),
      });
      toast.success("Preferencias actualizadas");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "No se pudieron guardar las preferencias"));
    } finally {
      setSaving(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Centro personal" title="Notificaciones" description="Consulta tus avisos y decide qué comunicaciones deseas recibir." />
      <SummaryStrip items={[{ label: "Sin leer", value: unread }, { label: "Resultados", value: total, detail: unreadOnly ? "Solo sin leer" : "Historial completo" }]} />
      <div className="workspace-toolbar"><label>Tipo en esta página<select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{Array.from(new Set(items.map(item => item.type || "system"))).map(type => <option key={type} value={type}>{typeLabels[type] || type}</option>)}</select></label><p className="text-xs text-muted-foreground">Las notificaciones sin leer aparecen primero en cada página.</p></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="notifications-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div><h2 id="notifications-title" className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-5 w-5 text-primary" />Historial</h2><p className="mt-1 text-sm text-muted-foreground">{unread} sin leer</p></div>
            <div className="flex items-center gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }} />Solo sin leer</label><Button variant="outline" size="sm" onClick={() => void markAllAsRead()} disabled={unread === 0 || marking}><CheckCheck className="mr-2 h-4 w-4" />Marcar todas</Button></div>
          </div>
          {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Cargando" /></div> : visibleItems.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center text-center text-muted-foreground"><Bell className="mb-3 h-8 w-8" /><p>No hay notificaciones para mostrar.</p></div> : <div className="divide-y divide-border">{visibleItems.map((item) => <article key={item.id} className={`relative py-5 first:pt-5 ${!item.isRead ? "bg-primary/[.04] -mx-2 px-2 rounded-lg" : ""}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div><h3 className={`text-sm font-semibold ${!item.isRead ? "text-primary" : ""}`}>{item.title}</h3>{item.message && <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>}</div><time className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</time></div><div className="mt-2 flex items-center gap-4">{item.actionUrl && <button type="button" onClick={() => void markOneAsRead(item.id, item.actionUrl)} className="text-sm font-semibold text-primary underline hover:text-primary/80">Ver detalles</button>}{!item.isRead && <button type="button" onClick={() => void markOneAsRead(item.id)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><Check className="h-3.5 w-3.5" />Marcar leída</button>}</div></article>)}</div>}
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-sm text-muted-foreground">Página {page} de {pages}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Página siguiente" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages}><ChevronRight className="h-4 w-4" /></Button></div></div>
        </section>
        <section className="h-fit rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="preferences-title">
          <h2 id="preferences-title" className="text-lg font-semibold">Preferencias</h2><p className="mt-1 text-sm text-muted-foreground">Ajusta avisos operativos de tu cuenta.</p>
          <div className="mt-5 space-y-4">{([['emailEnabled', 'Avisos por correo'], ['whatsappEnabled', 'Avisos por WhatsApp'], ['pushEnabled', 'Avisos dentro del campus'], ['contractAlerts', 'Contratos y vencimientos'], ['academicAlerts', 'Actividad académica'], ['paymentAlerts', 'Pagos y matrículas']]).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 text-sm"><span>{label}</span><input type="checkbox" checked={preferences[key as keyof Preferences]} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} aria-label={label} /></label>)}</div>
          <Button className="mt-6 w-full" onClick={() => void savePreferences()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar preferencias</Button>
        </section>
      </div>
    </div>
  );
}
