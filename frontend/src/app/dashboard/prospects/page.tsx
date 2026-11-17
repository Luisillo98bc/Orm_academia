"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Download,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  Phone,
  Plus,
  Search,
  UserCheck,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Cohort, User } from "@/types/domain";
import { PageHeader } from "@/components/dashboard/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TablePagination } from "@/components/dashboard/table-pagination";

type Status = "NEW" | "CONTACTED" | "INTERESTED" | "ENROLLED" | "LOST";

interface Note {
  id: string;
  content: string;
  createdAt: string;
  author: { firstName: string; lastName: string };
}

interface Prospect {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  source: string;
  status: Status;
  nextFollowUpAt?: string | null;
  createdAt: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  cohort?: { id: string; course: { name: string }; name: string } | null;
  notes: Note[];
}

const labels: Record<Status, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  INTERESTED: "Interesado",
  ENROLLED: "Matriculado",
  LOST: "Descartado",
};

const colors: Record<Status, string> = {
  NEW: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  CONTACTED: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  INTERESTED: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  ENROLLED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  LOST: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

function formatSource(source: string): { label: string; badgeClass: string } {
  if (source.includes("LIBRO_RECLAMACIONES")) {
    return { label: "Libro Reclamaciones", badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" };
  }
  if (source.includes("BROCHURE")) {
    return { label: "Temario PDF", badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20" };
  }
  if (source.includes("EFECTIVO")) {
    return { label: "Reserva Efectivo", badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/20" };
  }
  if (source.includes("CHECKOUT")) {
    return { label: "Checkout Web", badgeClass: "bg-purple-500/10 text-purple-700 border-purple-500/20" };
  }
  if (source.includes("MANUAL") || source.includes("DIRECT")) {
    return { label: "Ingreso Manual", badgeClass: "bg-slate-500/10 text-slate-700 border-slate-500/20" };
  }
  return { label: "Web Landing", badgeClass: "bg-teal-500/10 text-teal-700 border-teal-500/20" };
}

function cleanPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 9) return `51${digits}`;
  return digits;
}

export default function ProspectsPage() {
  const [items, setItems] = useState<Prospect[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [stats, setStats] = useState<{ byStatus: Partial<Record<Status, number>>; overdue: number }>({
    byStatus: {},
    overdue: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<"list" | "board">("list");
  const [onlyDue, setOnlyDue] = useState(false);
  const isDue = (item: Prospect) => !!item.nextFollowUpAt && new Date(item.nextFollowUpAt) <= new Date() && !["ENROLLED", "LOST"].includes(item.status);
  const visibleItems = items.filter(item => !onlyDue || isDue(item)).toSorted((a, b) => Number(isDue(b)) - Number(isDue(a)));

  // Modal para nuevo prospecto manual
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    email: "",
    phone: "",
    cohortId: "",
    assignedToId: "",
    source: "MANUAL",
    status: "NEW" as Status,
    message: "",
    nextFollowUpAt: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filter) query.set("status", filter);
      if (cohortFilter) query.set("cohortId", cohortFilter);
      if (assignedFilter) query.set("assignedToId", assignedFilter);
      if (search.trim()) query.set("search", search.trim());
      query.set("page", String(page));
      query.set("limit", String(pageSize));

      const [prospects, summary, staffResponse, cohortsResponse] = await Promise.all([
        fetchApi(`/prospects?${query}`),
        fetchApi("/prospects/stats"),
        fetchApi("/users?limit=100"),
        fetchApi("/academic/public/cohorts").catch(() => []),
      ]);

      const staff = staffResponse?.data || staffResponse || [];
      const prospectRows = prospects?.data || prospects || [];
      setItems(prospectRows);
      setTotal(prospects?.pagination?.total || prospectRows.length);
      setStats(summary || { byStatus: {}, overdue: 0 });
      setUsers(staff.filter((user: User) => user.isActive !== false));
      setCohorts(cohortsResponse || []);
      setSelectedId((current) =>
        current && prospectRows.some((item: Prospect) => item.id === current)
          ? current
          : prospectRows[0]?.id || null,
      );
    } catch {
      toast.error("No se pudieron cargar los prospectos");
    } finally {
      setLoading(false);
    }
  }, [filter, cohortFilter, assignedFilter, search, page]);

  useEffect(() => {
    const id = window.setTimeout(load, 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const update = async (data: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetchApi(`/prospects/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast.success("Prospecto actualizado");
      await load();
    } catch {
      toast.error("No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!selected || !note.trim()) return;
    setSaving(true);
    try {
      await fetchApi(`/prospects/${selected.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: note }),
      });
      setNote("");
      toast.success("Nota registrada");
      await load();
    } catch {
      toast.error("No se pudo guardar la nota");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name.trim()) {
      toast.error("Ingresa el nombre del prospecto");
      return;
    }
    if (!newForm.email.trim() && !newForm.phone.trim()) {
      toast.error("Ingresa al menos un teléfono o correo de contacto");
      return;
    }

    setCreating(true);
    try {
      await fetchApi("/prospects/admin", {
        method: "POST",
        body: JSON.stringify({
          name: newForm.name.trim(),
          email: newForm.email.trim() || undefined,
          phone: newForm.phone.trim() || undefined,
          cohortId: newForm.cohortId || undefined,
          assignedToId: newForm.assignedToId || undefined,
          source: newForm.source,
          status: newForm.status,
          message: newForm.message.trim() || undefined,
          nextFollowUpAt: newForm.nextFollowUpAt ? new Date(newForm.nextFollowUpAt).toISOString() : undefined,
        }),
      });

      toast.success("Prospecto registrado exitosamente");
      setShowCreateModal(false);
      setNewForm({
        name: "",
        email: "",
        phone: "",
        cohortId: "",
        assignedToId: "",
        source: "MANUAL",
        status: "NEW",
        message: "",
        nextFollowUpAt: "",
      });
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo registrar el prospecto"));
    } finally {
      setCreating(false);
    }
  };

  const active =
    (stats.byStatus.NEW || 0) +
    (stats.byStatus.CONTACTED || 0) +
    (stats.byStatus.INTERESTED || 0);

  const statCards = [
    { icon: Users, value: active, label: "Prospectos activos", tone: "info" as const },
    { icon: UserRoundCheck, value: stats.byStatus.INTERESTED || 0, label: "Interesados", tone: "primary" as const },
    { icon: CalendarClock, value: stats.overdue, label: "Seguimientos vencidos", tone: "warning" as const },
    { icon: UserCheck, value: stats.byStatus.ENROLLED || 0, label: "Matriculados", tone: "success" as const },
  ];

  const funnelSteps: Status[] = ["NEW", "CONTACTED", "INTERESTED", "ENROLLED"];
  const funnelTotal = Math.max(
    funnelSteps.reduce((sum, step) => sum + (stats.byStatus[step] || 0), 0),
    1,
  );

  const handleExportCsv = () => {
    if (!visibleItems.length) {
      toast.error("No hay prospectos visibles para exportar");
      return;
    }
    const headers = ["Nombre", "Correo", "Telefono", "Programa", "Origen", "Estado", "Asesor", "Fecha Registro"];
    const rows = visibleItems.map((p) => [
      p.name,
      p.email || "",
      p.phone || "",
      p.cohort?.course?.name || p.cohort?.name || "Consulta general",
      formatSource(p.source).label,
      labels[p.status],
      p.assignedTo ? `${p.assignedTo.firstName} ${p.assignedTo.lastName}` : "Sin asignar",
      new Date(p.createdAt).toLocaleDateString("es-PE"),
    ]);
    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prospectos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Reporte CSV de prospectos descargado");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Admisiones y Ventas"
          title="Gestión de Prospectos"
          description="Monitorea las oportunidades de matrícula, canal de contacto y próximos seguimientos."
        />
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            className="gap-2 rounded-xl shadow-sm cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="gap-2 rounded-xl shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nuevo prospecto
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        {statCards.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Funnel Section */}
      <section
        className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
        aria-labelledby="prospect-funnel-title"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="prospect-funnel-title" className="font-semibold text-foreground">
              Embudo comercial de admisiones
            </h2>
            <p className="text-sm text-muted-foreground">
              Haz clic en cada etapa para filtrar rápidamente a los candidatos.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pipeline de conversión
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          {funnelSteps.map((step, index) => {
            const count = stats.byStatus[step] || 0;
            const previous =
              index === 0 ? funnelTotal : stats.byStatus[funnelSteps[index - 1]] || 0;
            const conversion = previous > 0 ? Math.round((count / previous) * 100) : 0;
            const isSelected = filter === step;

            return (
              <button
                key={step}
                type="button"
                onClick={() => {
                  setFilter(isSelected ? "" : step);
                  setPage(1);
                }}
                className={`group rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                    : "border-border/70 bg-background hover:-translate-y-px hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      step === "NEW"
                        ? "bg-blue-500"
                        : step === "CONTACTED"
                        ? "bg-amber-500"
                        : step === "INTERESTED"
                        ? "bg-purple-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {index === 0 ? "Total base" : `${conversion}% desde anterior`}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {labels[step]}
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">{count}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(4, (count / funnelTotal) * 100))}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Unified Filter Bar */}
      <div className="grid gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:grid-cols-12 sm:items-center">
        <div className="relative sm:col-span-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, correo o teléfono..."
            className="pl-9 text-sm"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos los estados</option>
            {(Object.keys(labels) as Status[]).map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={cohortFilter}
            onChange={(e) => {
              setCohortFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todas las cohortes / cursos</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course?.name || c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            value={assignedFilter}
            onChange={(e) => {
              setAssignedFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos los asesores</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Split Layout: List & Detail */}
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-xl border border-border bg-card p-1" role="group" aria-label="Presentación de prospectos"><Button size="sm" variant={view === "list" ? "default" : "ghost"} aria-pressed={view === "list"} onClick={() => setView("list")}>Lista y ficha</Button><Button size="sm" variant={view === "board" ? "default" : "ghost"} aria-pressed={view === "board"} onClick={() => setView("board")}>Tablero por etapas</Button></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyDue} onChange={event => setOnlyDue(event.target.checked)} />Seguimientos vencidos en esta página</label></div>
      {view === "board" && !loading && <section aria-label="Tablero comercial" className="space-y-3"><p className="text-xs text-muted-foreground">Mostrando {visibleItems.length} de los {total} resultados. Los filtros y la paginación también se aplican al tablero.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(labels) as Status[]).map(status => <div key={status} className="min-w-0 rounded-xl border border-border bg-muted/40 p-3"><h2 className="mb-3 flex items-center justify-between !text-sm">{labels[status]}<span className="text-xs text-muted-foreground">{visibleItems.filter(item => item.status === status).length}</span></h2><div className="space-y-2">{visibleItems.filter(item => item.status === status).map(item => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id} className={`w-full rounded-xl border bg-card p-3 text-left shadow-sm ${selectedId === item.id ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/40"}`}><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.cohort?.course.name || "Consulta general"}</p><p className={`mt-3 text-xs ${isDue(item) ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{item.nextFollowUpAt ? `${isDue(item) ? "Vencido · " : "Contacto · "}${new Date(item.nextFollowUpAt).toLocaleDateString("es-PE")}` : "Sin seguimiento programado"}</p></button>)}{!visibleItems.some(item => item.status === status) && <p className="py-5 text-center text-xs text-muted-foreground">Sin registros en esta página</p>}</div></div>)}</div></section>}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className={`grid min-h-[400px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ${view === "list" ? "lg:grid-cols-[0.85fr_1.15fr]" : ""}`}>
          {/* Left Column: Prospect List */}
          <div hidden={view === "board"} className="max-h-[720px] divide-y divide-border/60 overflow-y-auto border-b lg:border-b-0 lg:border-r border-border/70">
            {visibleItems.map((p) => {
              const sourceInfo = formatSource(p.source);
              const isOverdue =
                p.nextFollowUpAt &&
                new Date(p.nextFollowUpAt) < new Date() &&
                p.status !== "ENROLLED" &&
                p.status !== "LOST";

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full p-4 text-left transition hover:bg-muted/50 ${
                    selectedId === p.id ? "bg-primary/5 ring-1 ring-primary/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-foreground">{p.name}</p>
                        {isOverdue && (
                          <span
                            title="Seguimiento vencido"
                            className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse"
                          />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.cohort?.course.name || "Consulta general"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        colors[p.status]
                      }`}
                    >
                      {labels[p.status]}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${sourceInfo.badgeClass}`}
                    >
                      {sourceInfo.label}
                    </span>
                    {p.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.email}</span>
                      </span>
                    )}
                    {p.phone && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Phone className="h-3 w-3 shrink-0" />
                        {p.phone}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {!visibleItems.length && (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Users className="h-10 w-10 stroke-[1.5] text-muted-foreground/60" />
                <p className="mt-3 text-sm font-medium">No se encontraron prospectos</p>
                <p className="mt-1 text-xs">Prueba ajustando los filtros de búsqueda.</p>
              </div>
            )}
          </div>

          {/* Right Column: Selected Prospect Detail */}
          {selected ? (
            <div className="p-6 lg:p-7 space-y-6 overflow-y-auto max-h-[720px]">
              {/* Header Profile & Status Selector */}
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start border-b pb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">{selected.name}</h2>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        colors[selected.status]
                      }`}
                    >
                      {labels[selected.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Registrado el {new Date(selected.createdAt).toLocaleString("es-PE")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Estado:</label>
                  <select
                    value={selected.status}
                    disabled={saving}
                    onChange={(e) =>
                      void update({
                        status: e.target.value,
                        markContacted: e.target.value === "CONTACTED",
                      })
                    }
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {(Object.keys(labels) as Status[]).map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Direct Actions: WhatsApp & Email */}
              <div className="flex flex-wrap items-center gap-2.5">
                {selected.phone && (
                  <a
                    href={`https://wa.me/${cleanPhoneForWhatsApp(selected.phone)}?text=${encodeURIComponent(
                      `¡Hola ${selected.name.split(" ")[0]}! Te saluda el equipo de Admisiones de la academia. Vimos tu interés en ${
                        selected.cohort?.course?.name || "nuestros programas"
                      }. ¿En qué podemos ayudarte para tu inscripción?`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Abrir WhatsApp directo
                  </a>
                )}
                {selected.email && (
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(
                      `Información sobre ${selected.cohort?.course?.name || "nuestra oferta académica"}`,
                    )}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted transition"
                  >
                    <Mail className="h-4 w-4" />
                    Enviar correo
                  </a>
                )}
              </div>

              {/* Contact and Academic Interest Cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Datos de Contacto
                  </p>
                  <div>
                    <span className="text-xs text-muted-foreground">Correo:</span>
                    <p className="text-sm font-medium text-foreground">
                      {selected.email || "No registrado"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Teléfono:</span>
                    <p className="text-sm font-medium text-foreground">
                      {selected.phone || "No registrado"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Interés Académico y Origen
                  </p>
                  <div>
                    <span className="text-xs text-muted-foreground">Programa:</span>
                    <p className="text-sm font-medium text-foreground">
                      {selected.cohort?.course.name || selected.cohort?.name || "Consulta general"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Canal de origen:</span>
                    <p className="text-xs font-medium text-muted-foreground">
                      {formatSource(selected.source).label} ({selected.source})
                    </p>
                  </div>
                </div>
              </div>

              {/* Message */}
              {selected.message && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Mensaje o consulta inicial
                  </p>
                  <p className="rounded-xl border border-border/60 bg-muted/10 p-3.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {selected.message}
                  </p>
                </div>
              )}

              {/* Responsable & Próximo Seguimiento */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border/60 bg-card p-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Asesor Responsable
                  </label>
                  <select
                    value={selected.assignedTo?.id || ""}
                    disabled={saving}
                    onChange={(e) => void update({ assignedToId: e.target.value })}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Sin asignar</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Próximo Seguimiento
                  </label>
                  <Input
                    type="datetime-local"
                    value={
                      selected.nextFollowUpAt
                        ? new Date(
                            new Date(selected.nextFollowUpAt).getTime() -
                              new Date(selected.nextFollowUpAt).getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      void update({
                        nextFollowUpAt: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Follow-up Notes Timeline */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Bitácora de seguimiento ({selected.notes.length})
                </h3>

                <div className="flex gap-2">
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void addNote();
                    }}
                    placeholder="Escribe una nota de la llamada o acuerdo..."
                    className="text-sm"
                  />
                  <Button onClick={addNote} disabled={saving || !note.trim()} className="gap-1.5">
                    <MessageSquarePlus className="h-4 w-4" />
                    Añadir
                  </Button>
                </div>

                <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
                  {selected.notes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1"
                    >
                      <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Por {n.author.firstName} {n.author.lastName} ·{" "}
                        {new Date(n.createdAt).toLocaleString("es-PE")}
                      </p>
                    </div>
                  ))}
                  {!selected.notes.length && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Aún no hay notas registradas para este candidato.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 stroke-[1.5] text-muted-foreground/40" />
              <p className="mt-3 text-base font-medium">Selecciona un prospecto</p>
              <p className="mt-1 text-xs">
                Elige un candidato de la lista izquierda para ver sus detalles y notas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />

      {/* Modal: Nuevo Prospecto Manual */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Nuevo Prospecto Manual</h3>
                <p className="text-xs text-muted-foreground">
                  Registra un interesado captado por teléfono, WhatsApp o presencial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProspect} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Nombre completo *
                </label>
                <Input
                  required
                  value={newForm.name}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej. Roberto Sánchez"
                  className="mt-1"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Teléfono / WhatsApp
                  </label>
                  <Input
                    value={newForm.phone}
                    onChange={(e) => setNewForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+51 987 654 321"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Correo electrónico
                  </label>
                  <Input
                    type="email"
                    value={newForm.email}
                    onChange={(e) => setNewForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="candidato@correo.com"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Programa de interés
                  </label>
                  <select
                    value={newForm.cohortId}
                    onChange={(e) => setNewForm((prev) => ({ ...prev, cohortId: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Consulta general / Aún no decide</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.course?.name || c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Asesor responsable
                  </label>
                  <select
                    value={newForm.assignedToId}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, assignedToId: e.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Sin asignar</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Canal de origen
                  </label>
                  <select
                    value={newForm.source}
                    onChange={(e) => setNewForm((prev) => ({ ...prev, source: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="MANUAL">Ingreso Manual (Venta directa)</option>
                    <option value="WHATSAPP">WhatsApp directo</option>
                    <option value="LLAMADA">Llamada telefónica</option>
                    <option value="FACEBOOK">Facebook / Instagram</option>
                    <option value="REFERIDO">Referido por alumno</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Estado inicial
                  </label>
                  <select
                    value={newForm.status}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, status: e.target.value as Status }))
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="NEW">Nuevo</option>
                    <option value="CONTACTED">Contactado</option>
                    <option value="INTERESTED">Interesado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Próximo seguimiento (opcional)
                </label>
                <Input
                  type="datetime-local"
                  value={newForm.nextFollowUpAt}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, nextFollowUpAt: e.target.value }))
                  }
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Notas o consulta inicial
                </label>
                <textarea
                  value={newForm.message}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, message: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Detalles sobre lo que busca o acordó..."
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating} className="gap-1.5">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar prospecto
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
