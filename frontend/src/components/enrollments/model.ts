import type { Cohort } from "@/types/domain";
export interface Pagination { page: number; limit: number; total: number; totalPages: number }
export interface Candidate { id: string; firstName: string; lastName: string; email: string; dni: string | null; phone: string | null; isActive: boolean; roles: string[] }
export interface EnrollmentRow {
  id: string; status: string; enrolledAt: string; completedAt: string | null; reservationExpiresAt: string | null;
  user: Omit<Candidate, "roles">;
  cohort: { id: string; name: string; schedule: string | null; startDate: string; endDate: string; course: { id: string; name: string } };
  payment: { id: string; amount: string; status: string; method: string; voucherUrl: string | null } | null;
}
export interface EnrollmentPage { data: EnrollmentRow[]; pagination: Pagination; summary: { total: number; active: number; pending: number; completed: number } }
export const statusLabels: Record<string, string> = { ACTIVE: "Activa", PENDING_PAYMENT: "Por validar", COMPLETED: "Finalizada", SUSPENDED: "Suspendida", DROPPED: "Retirada" };
export const paymentLabels: Record<string, string> = { PENDING: "Pendiente", COMPLETED: "Aprobado", REJECTED: "Rechazado" };
export const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" }).format(new Date(value)) : "—";
export function availability(cohort: Cohort) {
  const capacity = cohort.maxStudents ?? cohort.maxCapacity ?? 0;
  const occupied = cohort.enrollmentCount ?? cohort.enrolledCount ?? 0;
  const available = Math.max(0, capacity - occupied);
  const open = cohort.isActive && !cohort.deletedAt && new Date(cohort.endDate).getTime() >= Date.now();
  return { available, capacity, occupied, open, eligible: open && available > 0 };
}
