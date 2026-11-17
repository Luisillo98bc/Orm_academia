"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Eye, GraduationCap, Loader2, RefreshCw, Search, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { downloadApiFile, fetchApi, getErrorMessage, resolveFileUrl } from "@/lib/api";
import { useRemoteData } from "@/lib/use-remote-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataSection } from "@/components/dashboard/data-section";
import { EnrollmentForm, useEnrollmentSearch } from "@/components/enrollments/enrollment-form";
import { availability, dateLabel, paymentLabels, statusLabels, type Candidate, type EnrollmentPage, type EnrollmentRow } from "@/components/enrollments/model";
import type { Cohort } from "@/types/domain";
import { useConfirm } from "@/components/confirm-provider";

function Status({ status }: { status: string }) {
  const color = status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : status === "PENDING_PAYMENT" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{statusLabels[status] || status}</span>;
}

function EnrollmentDetail({ row, close, onUpdated }: { row: EnrollmentRow; close: () => void; onUpdated: () => void }) {
  const [updating, setUpdating] = useState(false);
  const confirm = useConfirm();

  const handleStatusChange = async (nextStatus: string, label: string) => {
    if (!(await confirm({ title: `${label} matrícula`, description: "El estado de la matrícula determina el acceso del estudiante al aula. Confirma el cambio para aplicarlo.", confirmLabel: label, destructive: nextStatus !== "ACTIVE" }))) {
      return;
    }
    setUpdating(true);
    try {
      await fetchApi(`/academic/enrollment-management/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success(`Matrícula actualizada a ${statusLabels[nextStatus] || nextStatus}.`);
      onUpdated();
      close();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar el estado de la matrícula."));
    } finally {
      setUpdating(false);
    }
  };

  return <Modal title="Detalle de matrícula" onClose={close}><div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl">
    <div className="flex items-start justify-between gap-4"><div><p className="page-eyebrow">Ficha de matrícula</p><h2 className="mt-1 text-xl font-bold">{row.user.firstName} {row.user.lastName}</h2><p className="mt-1 break-all text-sm text-muted-foreground">{row.user.email}</p></div><Button variant="ghost" size="icon" aria-label="Cerrar detalle de matrícula" onClick={close}><X className="h-5 w-5" /></Button></div>
    <div className="mt-5 flex flex-wrap items-center gap-2"><Status status={row.status} /><span className="text-xs text-muted-foreground">Inscripción: {dateLabel(row.enrolledAt)}</span></div>
    <div className="mt-4 grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Inscripción</p><p className="mt-1 font-medium">{dateLabel(row.enrolledAt)}</p></div><div><p className="text-xs text-muted-foreground">Pago</p><p className="mt-1 font-medium">{row.payment ? paymentLabels[row.payment.status] || row.payment.status : "Sin registro"}</p></div><div><p className="text-xs text-muted-foreground">Acceso al aula</p><p className="mt-1 font-medium">{row.status === "ACTIVE" ? "Activo" : row.status === "COMPLETED" ? "Curso finalizado" : "Restringido por estado"}</p></div>{row.completedAt && <div><p className="text-xs text-muted-foreground">Finalización</p><p className="mt-1 font-medium">{dateLabel(row.completedAt)}</p></div>}</div>
    <dl className="mt-5 grid grid-cols-1 gap-5 border-t border-border pt-5 text-sm sm:grid-cols-2">{[["DNI", row.user.dni || "Sin registrar"], ["Teléfono", row.user.phone || "Sin registrar"], ["Curso", row.cohort.course.name], ["Cohorte", row.cohort.name], ["Periodo", `${dateLabel(row.cohort.startDate)} – ${dateLabel(row.cohort.endDate)}`], ["Horario", row.cohort.schedule || "Por confirmar"]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl>
    <section className="mt-6 rounded-xl border border-border bg-muted/30 p-4"><h3 className="font-semibold">Pago y comprobante</h3>{row.payment ? <><div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span>S/ {Number(row.payment.amount).toFixed(2)} · {row.payment.method}</span><span>{paymentLabels[row.payment.status] || row.payment.status}</span></div>{row.reservationExpiresAt && row.status === "PENDING_PAYMENT" && <p className="mt-2 text-xs text-muted-foreground">Reserva hasta: {dateLabel(row.reservationExpiresAt)}</p>}<div className="mt-4 flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href={`/dashboard/payments?search=${row.payment.id}`}>Revisar pago<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>{row.payment.voucherUrl ? <Button asChild variant="outline" size="sm"><a href={resolveFileUrl(row.payment.voucherUrl)} target="_blank" rel="noopener noreferrer">Abrir comprobante<ArrowUpRight className="ml-2 h-4 w-4" /></a></Button> : <span className="self-center text-xs text-muted-foreground">Sin comprobante adjunto</span>}</div></> : <p className="mt-2 text-sm text-muted-foreground">Sin pago registrado. Una matrícula administrativa no equivale a un pago aprobado.</p>}</section>

    <section className="mt-6 rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold">Acciones sobre la matrícula</h3>
      {row.status === "ACTIVE" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={updating} onClick={() => handleStatusChange("SUSPENDED", "Suspender")}>
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Suspender acceso
          </Button>
          <Button variant="outline" size="sm" disabled={updating} onClick={() => handleStatusChange("COMPLETED", "Finalizar")}>
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Marcar como finalizada
          </Button>
          <Button variant="destructive" size="sm" disabled={updating} onClick={() => handleStatusChange("DROPPED", "Retirar")}>
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Retirar de cohorte
          </Button>
        </div>
      )}
      {row.status === "SUSPENDED" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={updating} onClick={() => handleStatusChange("ACTIVE", "Reactivar")}>
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reactivar acceso
          </Button>
          <Button variant="destructive" size="sm" disabled={updating} onClick={() => handleStatusChange("DROPPED", "Retirar")}>
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Retirar definitivamente
          </Button>
        </div>
      )}
      {(row.status === "DROPPED" || row.status === "COMPLETED") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={updating} onClick={() => handleStatusChange("ACTIVE", "Reactivar")}>
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reactivar matrícula
          </Button>
          <span className="text-xs text-muted-foreground">Verificará cupo disponible antes de reactivar.</span>
        </div>
      )}
      {row.status === "PENDING_PAYMENT" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Esta matrícula está a la espera de validación de pago. La aprobación o rechazo se realiza en el módulo de Pagos.</p>
          <Button asChild size="sm">
            <Link href={row.payment ? `/dashboard/payments?search=${row.payment.id}` : "/dashboard/payments"}>
              Ir a validar pago<ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </section>

    <div className="mt-6 flex justify-end"><Button variant="outline" onClick={close}>Cerrar ficha</Button></div>
  </div></Modal>;
}

export default function RrhhEnrollmentsPage() {
  const [search, setSearch] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setSearch(new URLSearchParams(window.location.search).get("search") || ""), 0); return () => window.clearTimeout(timer); }, []);
  const [status, setStatus] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<EnrollmentRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const debounced = useEnrollmentSearch(search);
  const filters = new URLSearchParams({ search: debounced, ...(status ? { status } : {}), ...(cohortId ? { cohortId } : {}) });
  const rows = useRemoteData<EnrollmentPage>(`/academic/enrollment-management?${filters}&page=${page}&limit=${limit}`);
  const cohorts = useRemoteData<Cohort[]>("/academic/cohorts");
  const summary = rows.data?.summary;
  const hasFilters = Boolean(search || status || cohortId);
  const onComplete = (student: Candidate) => {
    setCreating(false); setSearch(student.email); setStatus(""); setCohortId(""); setPage(1);
    void rows.reload(); void cohorts.reload();
    toast.success("Matrícula registrada. Mostrando las matrículas del estudiante.");
  };
  return <div className="space-y-6">
    <PageHeader eyebrow="Gestión académica" title="Matrículas" description="Busca estudiantes, revisa sus inscripciones y registra nuevos accesos al aula." actions={<>
      <Button variant="outline" aria-label="Actualizar matrículas" disabled={rows.loading} onClick={() => { void rows.reload(); void cohorts.reload(); }}><RefreshCw className={`mr-2 h-4 w-4 ${rows.loading ? "animate-spin" : ""}`} />Actualizar</Button>
      <Button onClick={() => setCreating(true)} disabled={cohorts.loading || Boolean(cohorts.error)}><UserPlus className="mr-2 h-4 w-4" />Nueva matrícula</Button>
    </>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen de matrículas">{[
      { label: "Matrículas", value: summary?.total, icon: Users, color: "text-primary", next: "" },
      { label: "Activas", value: summary?.active, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", next: "ACTIVE" },
      { label: "Por validar", value: summary?.pending, icon: Clock3, color: "text-amber-600 dark:text-amber-400", next: "PENDING_PAYMENT" },
      { label: "Finalizadas", value: summary?.completed, icon: GraduationCap, color: "text-blue-600 dark:text-blue-400", next: "COMPLETED" },
    ].map(item => <button type="button" key={item.label} onClick={() => { setStatus(item.next); setPage(1); }} aria-pressed={status === item.next} className={`rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40 sm:p-5 ${status === item.next ? "border-primary/40" : "border-border/60"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground sm:text-sm">{item.label}</span><item.icon className={`h-4 w-4 ${item.color}`} /></div><p className="mt-3 text-3xl font-bold tabular-nums">{rows.error || rows.loading ? "—" : item.value ?? 0}</p></button>)}</div>
    <p className="-mt-3 text-xs text-muted-foreground">Indicadores según la búsqueda y la cohorte. Selecciona uno para filtrar el listado.</p>
    {cohorts.error && <DataSection loading={false} error={cohorts.error} reload={cohorts.reload} label="cohortes">{null}</DataSection>}
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card" aria-label="Listado de matrículas">
      <div className="border-b border-border/60 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Registro de matrículas</h2><p className="mt-1 text-xs text-muted-foreground">Consulta el estado académico y abre la ficha para revisar el pago.</p></div><Button variant="outline" size="sm" disabled={exporting || rows.loading || Boolean(rows.error) || !rows.data?.pagination.total} onClick={async () => {
          setExporting(true); try { await downloadApiFile(`/academic/enrollment-management/export?${filters}`, `matriculas_${new Date().toISOString().slice(0, 10)}.csv`); } catch (error) { toast.error(getErrorMessage(error, "No se pudo exportar el listado.")); } finally { setExporting(false); }
        }}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Exportar resultados</Button></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem_12rem]">
          <div className="relative"><label htmlFor="enrollment-search" className="sr-only">Buscar matrículas</label><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="enrollment-search" className="pl-9" placeholder="Nombre, correo, DNI, teléfono, curso o cohorte…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
          <label className="sr-only" htmlFor="enrollment-cohort-filter">Filtrar por cohorte</label><select id="enrollment-cohort-filter" className="min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm" value={cohortId} onChange={event => { setCohortId(event.target.value); setPage(1); }}><option value="">Todas las cohortes</option>{cohorts.data?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <label className="sr-only" htmlFor="enrollment-status-filter">Filtrar por estado</label><select id="enrollment-status-filter" className="rounded-xl border border-input bg-background px-3 py-2 text-sm" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
        </div>
        {hasFilters && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span>La exportación incluye todos los resultados de estos filtros.</span><button className="font-semibold text-primary underline" onClick={() => { setSearch(""); setStatus(""); setCohortId(""); setPage(1); }}>Limpiar filtros</button></div>}
      </div>
      <DataSection loading={rows.loading} error={rows.error} reload={rows.reload} label="matrículas">
        {!rows.data?.data.length ? <div className="px-5 py-16 text-center"><GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-3 font-semibold">{hasFilters ? "No hay matrículas con estos filtros" : "Todavía no hay matrículas"}</h3><p className="mt-1 text-sm text-muted-foreground">{hasFilters ? "Prueba otro dato o limpia los filtros." : "Registra la primera matrícula para habilitar el acceso al aula."}</p></div> : <div className="relative overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Estudiante", "Curso y cohorte", "Inscripción", "Estado", "Pago", ""].map(label => <th key={label} scope="col" className="px-5 py-3 font-semibold">{label || <span className="sr-only">Acciones</span>}</th>)}</tr></thead><tbody className="divide-y divide-border/60">{rows.data.data.map(row => <tr key={row.id} className="transition-colors hover:bg-muted/30"><td className="px-5 py-4"><p className="font-semibold">{row.user.firstName} {row.user.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{row.user.email}</p><p className="mt-1 text-xs text-muted-foreground">{row.user.dni ? `DNI ${row.user.dni}` : "Sin DNI registrado"}</p></td><td className="max-w-xs px-5 py-4"><p className="font-medium">{row.cohort.course.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.cohort.name}</p></td><td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">{dateLabel(row.enrolledAt)}</td><td className="px-5 py-4"><Status status={row.status} /></td><td className="px-5 py-4"><p className="text-xs font-medium">{row.payment ? paymentLabels[row.payment.status] || row.payment.status : "Sin pago registrado"}</p>{row.payment && <p className="mt-1 text-xs text-muted-foreground">S/ {Number(row.payment.amount).toFixed(2)} · {row.payment.method}</p>}</td><td className="px-5 py-4"><Button variant="ghost" size="sm" aria-label={`Ver matrícula de ${row.user.firstName} ${row.user.lastName}`} onClick={() => setDetail(row)}><Eye className="mr-2 h-4 w-4" />Ver ficha</Button></td></tr>)}</tbody></table></div>}
        {rows.data && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-4 text-xs text-muted-foreground"><span>{rows.data.pagination.total} resultados · Página {page} de {rows.data.pagination.totalPages}</span><div className="flex items-center gap-3"><label className="flex items-center gap-2">Por página<select aria-label="Matrículas por página" className="rounded-lg border border-input bg-background px-2 py-1.5" value={limit} onChange={event => { setLimit(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map(value => <option key={value}>{value}</option>)}</select></label><Button variant="outline" size="icon" aria-label="Matrículas anteriores" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Siguientes matrículas" disabled={page >= rows.data.pagination.totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>}
      </DataSection>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground"><span>{cohorts.data ? `${cohorts.data.filter(item => availability(item).eligible).length} cohortes con cupos disponibles` : "Consultando disponibilidad…"} · Los pagos pendientes se validan desde Pagos.</span><Link href="/dashboard/payments" className="inline-flex items-center gap-1 font-semibold text-primary">Ir a Pagos<ArrowUpRight className="h-3 w-3" /></Link></div>
    {creating && <EnrollmentForm cohorts={cohorts.data || []} onClose={() => setCreating(false)} onComplete={onComplete} />}
    {detail && (
      <EnrollmentDetail
        row={detail}
        close={() => setDetail(null)}
        onUpdated={() => {
          void rows.reload();
          void cohorts.reload();
        }}
      />
    )}
  </div>;
}
