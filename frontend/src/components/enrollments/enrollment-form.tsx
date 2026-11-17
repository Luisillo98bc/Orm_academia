"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useRemoteData } from "@/lib/use-remote-data";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DataSection } from "@/components/dashboard/data-section";
import type { Cohort } from "@/types/domain";
import { availability, dateLabel, statusLabels, type Candidate, type EnrollmentPage, type Pagination } from "./model";

export function useEnrollmentSearch(value: string) {
  const [search, setSearch] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(value.trim()), 300); return () => window.clearTimeout(timer); }, [value]);
  return search;
}

function ConfirmEnrollment({ student, cohort, onComplete }: { student: Candidate; cohort: Cohort; onComplete: (student: Candidate) => void }) {
  const existing = useRemoteData<EnrollmentPage>(`/academic/enrollment-management?studentId=${student.id}&cohortId=${cohort.id}&limit=1`);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const record = existing.data?.data[0];
  return <div className="mt-5 border-t border-border pt-5">
    <h4 className="text-sm font-semibold">Revisa antes de confirmar</h4>
    <p className="mt-2 text-sm">{student.firstName} {student.lastName}</p><p className="break-all text-xs text-muted-foreground">{student.email}</p>
    <p className="mt-2 text-sm">{cohort.course?.name || cohort.courseName} · {cohort.name}</p>
    <p className="mt-2 text-xs text-muted-foreground">La matrícula administrativa activa el acceso. No registra un cobro; los pagos se gestionan por separado.</p>
    <DataSection loading={existing.loading} error={existing.error} reload={existing.reload} label="validación de matrícula">
      {record ? <p role="status" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">Ya existe una matrícula: <strong>{statusLabels[record.status] || record.status}</strong>. Revisa su estado antes de registrar otra. {record.payment && <Link href={`/dashboard/payments?search=${record.payment.id}`} className="font-semibold underline">Revisar pago</Link>}</p> : <form className="mt-4 space-y-4" onSubmit={async event => {
        event.preventDefault(); if (submitting || !availability(cohort).eligible) return;
        setSubmitting(true); setError("");
        try { await fetchApi("/academic/enrollments/admin", { method: "POST", body: JSON.stringify({ studentId: student.id, cohortId: cohort.id }) }); onComplete(student); }
        catch (failure) { setError(getErrorMessage(failure, "No se pudo registrar la matrícula.")); void existing.reload(); }
        finally { setSubmitting(false); }
      }}>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required disabled={submitting} className="mt-1 h-4 w-4 accent-primary" />Confirmo el estudiante y la cohorte seleccionados.</label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting || !availability(cohort).eligible} className="w-full">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{submitting ? "Registrando matrícula…" : "Confirmar matrícula"}</Button>
        <p className="text-xs text-muted-foreground">El cupo se vuelve a comprobar al registrar.</p>
      </form>}
    </DataSection>
  </div>;
}

export function EnrollmentForm({ cohorts, onClose, onComplete }: { cohorts: Cohort[]; onClose: () => void; onComplete: (student: Candidate) => void }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ESTUDIANTE");
  const [page, setPage] = useState(1);
  const [student, setStudent] = useState<Candidate | null>(null);
  const [cohortId, setCohortId] = useState("");
  const [cohortSearch, setCohortSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const debounced = useEnrollmentSearch(search);
  const candidates = useRemoteData<{ data: Candidate[]; pagination: Pagination }>(`/academic/enrollment-management/candidates?role=${role}&page=${page}&limit=8&search=${encodeURIComponent(debounced)}`);
  const cohort = cohorts.find(item => item.id === cohortId);
  const shownCohorts = cohorts.filter(item => (showClosed || availability(item).eligible) && `${item.name} ${item.course?.name || item.courseName || ""}`.toLowerCase().includes(cohortSearch.toLowerCase()));
  return <Modal title="Nueva matrícula" onClose={onClose}><div className="w-full max-w-5xl rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-7">
    <div className="flex items-start justify-between gap-4"><div><p className="page-eyebrow">Admisión</p><h2 className="mt-1 text-xl font-bold">Nueva matrícula</h2><p className="mt-1 text-sm text-muted-foreground">Encuentra la cuenta, elige una cohorte y confirma el acceso.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Cerrar nueva matrícula" onClick={onClose}><X className="h-5 w-5" /></Button></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section aria-label="Seleccionar estudiante" className="min-w-0 space-y-3">
        <h3 className="font-semibold">1. Estudiante</h3>
        <label htmlFor="candidate-search" className="text-xs text-muted-foreground">Buscar por nombre, correo, DNI o teléfono</label>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="candidate-search" autoFocus className="pl-9" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Escribe un nombre, correo o documento…" /></div>
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">Cuentas<select aria-label="Tipo de cuentas" value={role} onChange={event => { setRole(event.target.value); setPage(1); }} className="rounded-lg border border-input bg-background px-2 py-2"><option value="ESTUDIANTE">Estudiantes</option><option value="ALL">Todas las cuentas</option></select></label>
        {student && <div className="rounded-xl border border-primary/40 bg-primary/5 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{student.firstName} {student.lastName}</p><Button type="button" variant="ghost" size="sm" onClick={() => setStudent(null)}>Cambiar</Button></div><p className="break-all text-xs text-muted-foreground">{student.email}</p><p className="mt-1 text-xs text-muted-foreground">DNI: {student.dni || "Sin registrar"} · {student.phone || "Sin teléfono"}</p></div>}
        <DataSection loading={candidates.loading} error={candidates.error} reload={candidates.reload} label="cuentas">
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {!candidates.data?.data.length && <p className="p-4 text-sm text-muted-foreground">No se encontraron cuentas. Prueba otro dato o selecciona «Todas las cuentas» para comprobar el rol.</p>}
            {candidates.data?.data.map(account => <button type="button" key={account.id} disabled={!account.isActive || !account.roles.includes("ESTUDIANTE")} onClick={() => setStudent(account)} aria-pressed={student?.id === account.id} className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm hover:bg-muted/50 disabled:cursor-not-allowed disabled:bg-muted/20 ${student?.id === account.id ? "bg-primary/5" : ""}`}>
              <span className="min-w-0 flex-1"><span className="block font-medium">{account.firstName} {account.lastName}</span><span className="block break-all text-xs text-muted-foreground">{account.email}</span><span className="mt-1 block text-xs text-muted-foreground">{!account.isActive ? "Cuenta desactivada" : account.roles.includes("ESTUDIANTE") ? `DNI: ${account.dni || "Sin registrar"}` : `Rol: ${account.roles.join(", ") || "Sin rol"}. Requiere rol Estudiante.`}</span></span>{student?.id === account.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>)}
          </div>
          {candidates.data && <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{candidates.data.pagination.total} cuentas · Página {page} de {candidates.data.pagination.totalPages}</span><span className="flex gap-1"><Button type="button" variant="outline" size="icon" aria-label="Cuentas anteriores" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="outline" size="icon" aria-label="Más cuentas" disabled={page >= candidates.data.pagination.totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></span></div>}
        </DataSection>
        {role === "ALL" && <p className="text-xs text-muted-foreground">Las cuentas sin rol Estudiante o desactivadas se muestran para identificarlas. {user?.roles.includes("ADMIN") ? <Link href="/dashboard/users" className="font-semibold underline">Gestionar cuentas en Usuarios</Link> : "Solicita a administración cualquier cambio de rol."}</p>}
      </section>
      <section aria-label="Seleccionar cohorte" className="min-w-0 space-y-3">
        <h3 className="font-semibold">2. Cohorte y confirmación</h3>
        <label htmlFor="cohort-search" className="text-xs text-muted-foreground">Buscar curso o cohorte</label><Input id="cohort-search" value={cohortSearch} onChange={event => setCohortSearch(event.target.value)} placeholder="Ej. Python, turno noche…" />
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showClosed} onChange={event => setShowClosed(event.target.checked)} />Mostrar también cerradas o sin cupos</label>
        <label htmlFor="enroll-cohort" className="sr-only">Cohorte para matricular</label><select id="enroll-cohort" value={cohortId} onChange={event => setCohortId(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"><option value="">Selecciona una cohorte</option>{shownCohorts.map(item => { const seats = availability(item); return <option key={item.id} value={item.id} disabled={!seats.eligible}>{item.course?.name || item.courseName} · {item.name} · {seats.open ? `${seats.available} cupos` : "Cerrada"}</option>; })}</select>
        {!shownCohorts.length && <p className="text-sm text-muted-foreground">No hay cohortes disponibles con estos filtros.</p>}
        {cohort && <div className="rounded-xl bg-muted/40 p-4 text-sm"><p className="font-semibold">{cohort.name}</p><dl className="mt-3 grid grid-cols-2 gap-3"><div><dt className="text-xs text-muted-foreground">Inicio</dt><dd>{dateLabel(cohort.startDate)}</dd></div><div><dt className="text-xs text-muted-foreground">Cupos disponibles</dt><dd>{availability(cohort).available} de {availability(cohort).capacity}</dd></div><div className="col-span-2"><dt className="text-xs text-muted-foreground">Horario</dt><dd>{cohort.schedule || "Por confirmar"}</dd></div></dl></div>}
        {student && cohort ? <ConfirmEnrollment key={`${student.id}:${cohort.id}`} student={student} cohort={cohort} onComplete={onComplete} /> : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Selecciona un estudiante y una cohorte para revisar la matrícula.</p>}
      </section>
    </div>
  </div></Modal>;
}
