"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  FileImage,
  Loader2,
  MessageCircle,
  PlusCircle,
  Printer,
  RotateCcw,
  Upload,
  UserCheck,
  X,
  XCircle,
  ZoomIn,
} from "lucide-react";
import { fetchApi, getErrorMessage, resolveFileUrl } from "@/lib/api";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import { formatMoney } from "@/lib/money";
import type { Payment, PlatformSettings } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { MetricCard } from "@/components/dashboard/metric-card";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

const statusMeta: Record<string, { label: string; className: string; icon: typeof Clock3 }> = {
  COMPLETED: { label: "Aprobado", className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  PENDING: { label: "Pendiente de validación", className: "text-amber-600 bg-amber-500/10 border-amber-500/20", icon: Clock3 },
  REJECTED: { label: "Rechazado", className: "text-red-600 bg-red-500/10 border-red-500/20", icon: XCircle },
};

const METHOD_LABELS: Record<string, string> = {
  YAPE: "Yape",
  PLIN: "Plin",
  EFECTIVO: "Efectivo / Admisión",
  TARJETA: "Tarjeta en línea",
  TRANSFER: "Transferencia bancaria",
  CARD: "Tarjeta",
  CASH: "Efectivo",
};

interface TeacherPayroll {
  id: string;
  period: string;
  baseSalary: string | number;
  bonuses: string | number;
  deductions: string | number;
  totalAmount: string | number;
  status: "PENDING" | "PAID";
  paymentDate?: string | null;
  createdAt: string;
}

interface TeacherPayrollResponse {
  data: TeacherPayroll[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: {
    totalPaid: string;
    totalPending: string;
    baseSalary: string;
    position?: string;
    department?: string;
  };
}

function formatPeriod(period: string) {
  const [year, month] = period.split("-");
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const mIndex = parseInt(month, 10) - 1;
  return `${monthNames[mIndex] || month} ${year}`;
}

function voucherUrl(rawUrl?: string | null) {
  return resolveFileUrl(rawUrl);
}

function ReservationCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  if (remaining <= 0) return <p className="mt-2 text-xs font-semibold text-destructive">Reserva vencida; vuelve a intentar el pago.</p>;
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Reserva activa por {hours}h {minutes}m {seconds}s más.</p>;
}

export default function MyPaymentsPage() {
  const { user } = useAuth();
  const isDocente = Boolean(
    user?.roles?.some((r) =>
      typeof r === "string"
        ? r.toUpperCase() === "DOCENTE"
        : (r as { role?: { name?: string }; name?: string })?.role?.name?.toUpperCase() === "DOCENTE" ||
          (r as { role?: { name?: string }; name?: string })?.name?.toUpperCase() === "DOCENTE"
    )
  );

  const canViewTeachingServices =
    isDocente ||
    Boolean(
      user?.roles?.some((r) =>
        typeof r === "string" ? r === "ADMIN" : (r as { name?: string })?.name === "ADMIN"
      )
    );

  // Tab activo: por defecto honorarios si es docente o tiene servicios
  const [selectedTab, setActiveTab] = useState<"services" | "purchases" | null>(null);
  const activeTab = selectedTab ?? (isDocente ? "services" : "purchases");

  // Estados para Pagos de Alumno (Compras de cursos)
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [studentError, setStudentError] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previewVoucher, setPreviewVoucher] = useState<{ payment: Payment; url: string; label?: string } | null>(null);
  const [voucherImageError, setVoucherImageError] = useState(false);

  // Modal para pagar siguiente mensualidad
  const [installmentModal, setInstallmentModal] = useState<{
    payment: Payment;
    nextNumber: number;
    total: number;
  } | null>(null);
  const [installmentMethod, setInstallmentMethod] = useState<"YAPE" | "PLIN" | "EFECTIVO">("YAPE");
  const [installmentFile, setInstallmentFile] = useState<File | null>(null);
  const [submittingInstallment, setSubmittingInstallment] = useState(false);

  // Estados para Pagos de Docente (Honorarios / Nómina)
  const [teacherPayrolls, setTeacherPayrolls] = useState<TeacherPayroll[]>([]);
  const [teacherSummary, setTeacherSummary] = useState<TeacherPayrollResponse["summary"]>({
    totalPaid: "0",
    totalPending: "0",
    baseSalary: "0",
  });
  const [loadingTeacher, setLoadingTeacher] = useState(true);
  const [teacherError, setTeacherError] = useState("");
  const [teacherPage, setTeacherPage] = useState(1);
  const [teacherTotal, setTeacherTotal] = useState(0);

  const pageSize = 20;

  // Cargar pagos de compras (alumno)
  const loadStudentPayments = useCallback((targetPage = studentPage) => {
    return fetchApi(`/payments/my-payments?page=${targetPage}&limit=${pageSize}`).then((response) => {
      setPayments(response?.data || []);
      setStudentTotal(response?.pagination?.total || 0);
    });
  }, [studentPage]);

  // Cargar nóminas / honorarios del docente
  const loadTeacherPayrolls = useCallback((targetPage = teacherPage) => {
    return fetchApi(`/rrhh/my-payroll?page=${targetPage}&limit=${pageSize}`).then(
      (response: TeacherPayrollResponse) => {
        setTeacherPayrolls(response?.data || []);
        setTeacherTotal(response?.pagination?.total || 0);
        if (response?.summary) {
          setTeacherSummary(response.summary);
        }
      }
    );
  }, [teacherPage]);

  const refreshAll = useEffectEvent(() => {
    if (activeTab === "services" || isDocente) {
      void loadTeacherPayrolls(teacherPage).catch(() => undefined);
    }
    void loadStudentPayments(studentPage).catch(() => undefined);
  });

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") refreshAll();
    };
    window.addEventListener("academy:data-changed", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("academy:data-changed", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    fetchCatalogApi<PlatformSettings>("/settings/public", "settings")
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (canViewTeachingServices) {
      loadTeacherPayrolls(teacherPage)
        .catch((err) => setTeacherError(getErrorMessage(err, "No se pudieron cargar tus honorarios")))
        .finally(() => setLoadingTeacher(false));
    }
  }, [canViewTeachingServices, teacherPage, loadTeacherPayrolls]);

  useEffect(() => {
    loadStudentPayments(studentPage)
      .catch((err) => setStudentError(getErrorMessage(err, "No se pudo cargar tu historial de pagos")))
      .finally(() => setLoadingStudent(false));
  }, [studentPage, loadStudentPayments]);

  // Subir voucher de estudiante
  const handleVoucherFileChange = async (paymentId: string, file?: File | null) => {
    if (!file) return;
    setUploadingId(paymentId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetchApi(`/payments/${paymentId}/voucher`, {
        method: "POST",
        body: formData,
      });
      toast.success(res?.message || "Comprobante adjuntado con éxito");
      await loadStudentPayments(studentPage);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo subir el comprobante"));
    } finally {
      setUploadingId(null);
    }
  };

  const handleOpenInstallmentModal = (payment: Payment, nextNumber: number, total: number) => {
    const defaultMethod =
      payment.method === "PLIN" || payment.method === "EFECTIVO" ? payment.method : "YAPE";
    setInstallmentMethod(defaultMethod);
    setInstallmentFile(null);
    setInstallmentModal({ payment, nextNumber, total: Math.max(total, nextNumber) });
  };

  const handleDownloadReceipt = (
    payment: Payment,
    installmentNum?: number,
    customAmount?: string | number,
    customValidatedAt?: string | null
  ) => {
    const cohort = payment.enrollment?.cohort;
    const courseName = cohort?.course?.name || cohort?.name || "Programa Académico";
    const cohortName = cohort?.name || "Edición General";
    const totalInst = Math.max(
      1,
      Number(payment.totalInstallments ?? 1),
    );
    const targetInst = installmentNum ?? Math.max(1, Number(payment.installmentNumber ?? 1));
    const conceptLabel =
      totalInst > 1
        ? `Cuota / Mensualidad ${targetInst} de ${totalInst}`
        : "Matrícula / Pago Único de Programa";
    const opCode = payment.operationNumber || `ORD-${payment.id.slice(0, 8).toUpperCase()}`;
    const amountFormatted = formatMoney(customAmount ?? payment.amount);
    const methodLabel = METHOD_LABELS[payment.method] || payment.method;
    const dateRaw = customValidatedAt || payment.validatedAt || payment.createdAt;
    const dateFormatted = dateRaw
      ? new Date(dateRaw).toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : new Date().toLocaleDateString("es-PE");
    const studentName =
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Estudiante";
    const academyName = settings?.academyName || "Academia Virtual";

    const receiptWindow = window.open("", "_blank", "width=840,height=720");
    if (!receiptWindow) {
      toast.error("Permite las ventanas emergentes para descargar tu constancia en PDF.");
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Constancia de Pago - ${opCode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; background: #f8fafc; padding: 32px 16px; }
    .sheet { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(15,23,42,0.06); }
    .top-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 20px; margin-bottom: 24px; gap: 16px; }
    .brand h1 { font-size: 22px; font-weight: 800; color: #0f766e; letter-spacing: -0.02em; }
    .brand p { font-size: 12px; color: #64748b; margin-top: 4px; }
    .doc-box { border: 2px solid #0f766e; border-radius: 12px; padding: 10px 16px; text-align: center; background: #f0fdfa; }
    .doc-box .doc-type { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f766e; letter-spacing: 0.08em; }
    .doc-box .doc-num { font-size: 15px; font-weight: 800; font-family: monospace; color: #0f172a; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
    .field { font-size: 12px; }
    .field span { display: block; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; margin-bottom: 2px; }
    .field strong { color: #0f172a; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #0f172a; color: #ffffff; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 14px; }
    th:last-child, td:last-child { text-align: right; }
    td { padding: 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b; }
    .total-row { display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
    .total-row .seal { display: inline-flex; align-items: center; gap: 6px; background: #059669; color: #fff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 999px; letter-spacing: 0.06em; text-transform: uppercase; }
    .total-row .amount { font-size: 22px; font-weight: 900; color: #0f766e; font-family: monospace; }
    .footer { font-size: 11px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 16px; line-height: 1.5; }
    .actions { max-width: 720px; margin: 0 auto 16px; display: flex; justify-content: flex-end; gap: 8px; }
    .btn { background: #0f766e; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border: 1px solid #cbd5e1; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="sheet">
    <div class="top-bar">
      <div class="brand">
        <h1>${academyName}</h1>
        <p>${settings?.supportEmail ? `Contacto: ${settings.supportEmail}` : "Plataforma de Educación Continua"}</p>
        ${settings?.whatsappNumber ? `<p>Atención y Admisión: ${settings.whatsappNumber}</p>` : ""}
      </div>
      <div class="doc-box">
        <div class="doc-type">Constancia de Pago</div>
        <div class="doc-num">${opCode}-M${targetInst}</div>
      </div>
    </div>

    <div class="grid">
      <div class="field"><span>Estudiante</span><strong>${studentName}</strong></div>
      <div class="field"><span>Correo Electrónico</span><strong>${user?.email || "-"}</strong></div>
      <div class="field"><span>Fecha de Validación / Registro</span><strong>${dateFormatted}</strong></div>
      <div class="field"><span>Método de Pago</span><strong>${methodLabel}</strong></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Programa / Edición</th>
          <th>Concepto</th>
          <th>Importe</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${courseName}</strong><br/>
            <span style="font-size:11px;color:#64748b;">Edición: ${cohortName}</span>
          </td>
          <td>${conceptLabel}</td>
          <td><strong>S/ ${amountFormatted}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="total-row">
      <div>
        <span class="seal">✓ Pago Validado</span>
      </div>
      <div>
        <span style="font-size:12px;color:#475569;font-weight:700;margin-right:8px;">TOTAL ABONADO:</span>
        <span class="amount">S/ ${amountFormatted}</span>
      </div>
    </div>

    <div class="footer">
      Constancia digital emitida por el sistema financiero de <strong>${academyName}</strong>.<br/>
      Conserva este documento como respaldo de tu abono y matrícula académica.
    </div>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>
</body>
</html>`;

    receiptWindow.document.open();
    receiptWindow.document.write(html);
    receiptWindow.document.close();
  };

  const handleSubmitNextInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installmentModal) return;
    setSubmittingInstallment(true);
    try {
      const { payment, nextNumber } = installmentModal;
      await fetchApi(`/payments/${payment.id}/next-installment`, {
        method: "POST",
        body: JSON.stringify({ method: installmentMethod }),
      });

      if (installmentFile) {
        const formData = new FormData();
        formData.append("file", installmentFile);
        await fetchApi(`/payments/${payment.id}/voucher`, {
          method: "POST",
          body: formData,
        });
        toast.success(
          `Mensualidad ${nextNumber} registrada y comprobante enviado a validación.`
        );
      } else {
        toast.success(
          `Mensualidad ${nextNumber} habilitada (${METHOD_LABELS[installmentMethod] || installmentMethod}). Ahora puedes adjuntar tu comprobante.`
        );
      }

      setInstallmentModal(null);
      setInstallmentFile(null);
      await loadStudentPayments(studentPage);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo habilitar la mensualidad"));
    } finally {
      setSubmittingInstallment(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finanzas Personales"
        title={isDocente ? "Mis Pagos y Honorarios" : "Mis Pagos"}
        description={
          isDocente
            ? "Revisa los pagos y liquidaciones correspondientes a tus servicios docentes y honorarios."
            : "Revisa el estado de tus inscripciones, cronograma de mensualidades y comprobantes."
        }
      />

      {/* Tabs si el usuario es docente (o tiene ambos roles) */}
      {canViewTeachingServices && (
        <div className="flex border-b border-border/70">
          <button
            type="button"
            onClick={() => setActiveTab("services")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "services"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Banknote className="h-4 w-4" />
            Pagos por Mis Servicios Docentes
            {teacherTotal > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {teacherTotal}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("purchases")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "purchases"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Mis Compras de Cursos
            {studentTotal > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {studentTotal}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ─────────────────── VISTA DOCENTE: HONORARIOS / SERVICIOS ─────────────────── */}
      {canViewTeachingServices && activeTab === "services" && (
        <div className="space-y-6">
          {/* KPI Cards de Honorarios */}
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard
              icon={Banknote}
              value={`S/ ${formatMoney(teacherSummary.baseSalary || 0)}`}
              label="Honorario mensual pactado"
              tone="primary"
            />
            <MetricCard
              icon={CheckCircle2}
              value={`S/ ${formatMoney(teacherSummary.totalPaid || 0)}`}
              label="Total cobrado / abonado"
              tone="success"
            />
            <MetricCard
              icon={Clock3}
              value={`S/ ${formatMoney(teacherSummary.totalPending || 0)}`}
              label="Pendiente de abono"
              tone="warning"
            />
            <MetricCard
              icon={UserCheck}
              value={teacherSummary.position || "Docente"}
              label="Cargo / Especialidad"
              tone="info"
            />
          </div>

          {loadingTeacher ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : teacherError ? (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {teacherError}
            </div>
          ) : !teacherPayrolls.length ? (
            <div className="rounded-2xl border border-border/70 bg-card p-12 text-center shadow-sm">
              <Banknote className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-bold text-foreground">No hay pagos registrados para este periodo</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Cuando Administración o Recursos Humanos genere la nómina de tus clases u honorarios del mes,
                aparecerá detallada aquí con su estado y fecha de depósito.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" asChild>
                  <Link href="/dashboard/my-contracts">Revisar mis contratos vigentes</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/classes">Ver mis clases activas</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                <div className="border-b border-border/60 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground">Historial de liquidaciones y pagos de servicios</h3>
                  <p className="text-xs text-muted-foreground">
                    Detalle de honorarios mensuales, bonificaciones por horas dictadas y retenciones.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border/60 bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3.5">Período</th>
                        <th className="px-4 py-3.5">Honorario base</th>
                        <th className="px-4 py-3.5">Bonos / Adicionales</th>
                        <th className="px-4 py-3.5">Deducciones</th>
                        <th className="px-4 py-3.5">Monto Neto Total</th>
                        <th className="px-4 py-3.5">Estado</th>
                        <th className="px-5 py-3.5">Fecha de abono</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {teacherPayrolls.map((payroll) => {
                        const isPaid = payroll.status === "PAID";
                        return (
                          <tr key={payroll.id} className="transition hover:bg-muted/30">
                            <td className="px-5 py-4 font-semibold text-foreground">
                              {formatPeriod(payroll.period)}
                              <span className="block text-[11px] font-normal text-muted-foreground">
                                Ref: {payroll.period}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-muted-foreground">
                              S/ {formatMoney(payroll.baseSalary)}
                            </td>
                            <td className="px-4 py-4 text-emerald-600 dark:text-emerald-400">
                              +S/ {formatMoney(payroll.bonuses)}
                            </td>
                            <td className="px-4 py-4 text-rose-600 dark:text-rose-400">
                              -S/ {formatMoney(payroll.deductions)}
                            </td>
                            <td className="px-4 py-4 font-bold text-foreground">
                              S/ {formatMoney(payroll.totalAmount)}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                  isPaid
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                                {isPaid ? "Abonado / Pagado" : "Pendiente de abono"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs text-muted-foreground">
                              {payroll.paymentDate ? (
                                <span className="font-medium text-foreground">
                                  {new Date(payroll.paymentDate).toLocaleDateString("es-PE", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              ) : (
                                "Por coordinar con Administración"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <TablePagination
                page={teacherPage}
                pageSize={pageSize}
                total={teacherTotal}
                onPageChange={setTeacherPage}
              />
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── VISTA ESTUDIANTE: COMPRAS DE CURSOS ─────────────────── */}
      {(!canViewTeachingServices || activeTab === "purchases") && (
        <div className="space-y-4">
          {studentError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {studentError}
            </div>
          )}

          {loadingStudent ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : !payments.length ? (
            <EmptyState
              icon={<CreditCard className="h-6 w-6" />}
              title="No tienes pagos de cursos registrados"
              description="Cuando te matricules en un programa o curso, podrás revisar aquí los vouchers, estados de pago y mensualidades."
              action={
                <Link href="/dashboard/catalog">
                  <Button>Ver cursos disponibles</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => {
                const meta = statusMeta[payment.status] || statusMeta.PENDING;
                const StatusIcon = meta.icon;
                const cohort = payment.enrollment?.cohort;
                const courseName = cohort?.course?.name || cohort?.name || "Programa";
                const cleanWhatsapp = (settings?.whatsappNumber || "").replace(/[^0-9]/g, "");

                const totalInstallments = Math.max(
                  1,
                  Number(payment.totalInstallments ?? 1),
                );
                const currentInstallment = Math.max(1, Number(payment.installmentNumber ?? 1));
                const paidInstallments =
                  payment.status === "COMPLETED"
                    ? Math.max(1, Number(payment.paidInstallments ?? 1), currentInstallment)
                    : Number(payment.paidInstallments ?? 0);
                const historyItems = Array.isArray(payment.installmentHistory)
                  ? payment.installmentHistory
                  : [];

                const hasPendingNextMonth =
                  payment.status === "COMPLETED" && paidInstallments < totalInstallments;

                const waText = encodeURIComponent(
                  `Hola, adjunto comprobante del pago ${payment.operationNumber || payment.id}${
                    totalInstallments > 1 ? ` (Mensualidad ${currentInstallment} de ${totalInstallments})` : ""
                  } para el curso ${courseName}.`
                );

                return (
                  <Card key={payment.id} className="overflow-hidden border border-border/70 shadow-sm">
                    <CardContent className="flex flex-col gap-4 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
                              <StatusIcon className="h-3 w-3" />
                              {meta.label}
                            </span>
                            {totalInstallments > 1 ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                                <CalendarDays className="h-3 w-3" />
                                Mensualidad {currentInstallment} de {totalInstallments}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                Pago único
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Método: <strong>{METHOD_LABELS[payment.method] || payment.method}</strong>
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-foreground truncate">{courseName}</h3>
                          {cohort?.name && cohort.name !== courseName && (
                            <p className="text-xs text-muted-foreground truncate">Edición: {cohort.name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Operación:{" "}
                            <strong className="font-mono text-foreground">
                              {payment.operationNumber || `ORD-${payment.id.slice(0, 8).toUpperCase()}`}
                            </strong>{" "}
                            · {totalInstallments > 1 ? `Monto por mensualidad:` : `Monto:`}{" "}
                            <strong className="text-foreground">S/ {formatMoney(payment.amount)}</strong>
                          </p>
                          {payment.status === "PENDING" && payment.enrollment?.reservationExpiresAt && (
                            <ReservationCountdown expiresAt={payment.enrollment.reservationExpiresAt} />
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {payment.voucherUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => {
                                setVoucherImageError(false);
                                setPreviewVoucher({
                                  payment,
                                  url: voucherUrl(payment.voucherUrl),
                                  label:
                                    totalInstallments > 1
                                      ? `Mensualidad ${currentInstallment} de ${totalInstallments}`
                                      : undefined,
                                });
                              }}
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                              Ver comprobante
                            </Button>
                          )}
                          {(payment.status === "COMPLETED" || paidInstallments > 0) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 cursor-pointer"
                              onClick={() =>
                                handleDownloadReceipt(
                                  payment,
                                  payment.status === "COMPLETED" ? currentInstallment : paidInstallments
                                )
                              }
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Constancia PDF
                            </Button>
                          )}
                          {payment.status === "PENDING" && (
                            <label className="inline-flex cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                disabled={uploadingId === payment.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  void handleVoucherFileChange(payment.id, file);
                                  e.currentTarget.value = "";
                                }}
                              />
                              <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90">
                                {uploadingId === payment.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="h-3.5 w-3.5" />
                                )}
                                {payment.voucherUrl
                                  ? "Cambiar voucher"
                                  : totalInstallments > 1
                                  ? `Subir voucher (Mes ${currentInstallment})`
                                  : "Subir comprobante"}
                              </span>
                            </label>
                          )}
                          {payment.status === "PENDING" && cleanWhatsapp && (
                            <a
                              href={`https://wa.me/${cleanWhatsapp}?text=${waText}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-500/20"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp Admisión
                            </a>
                          )}
                          {hasPendingNextMonth && (
                            <Button
                              size="sm"
                              className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700 shadow-sm cursor-pointer"
                              onClick={() =>
                                handleOpenInstallmentModal(
                                  payment,
                                  paidInstallments + 1,
                                  totalInstallments
                                )
                              }
                            >
                              <PlusCircle className="h-4 w-4" />
                              Pagar Mensualidad {paidInstallments + 1} (S/ {formatMoney(payment.amount)})
                            </Button>
                          )}
                          {payment.status === "COMPLETED" && totalInstallments === 1 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs border-violet-500/30 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300 cursor-pointer"
                              onClick={() => handleOpenInstallmentModal(payment, 2, 2)}
                            >
                              <CalendarDays className="h-3.5 w-3.5" />
                              Pagar siguiente mensualidad
                            </Button>
                          )}
                          {payment.status === "REJECTED" && paidInstallments > 0 && (
                            <Button
                              size="sm"
                              className="gap-1.5 cursor-pointer"
                              onClick={() =>
                                handleOpenInstallmentModal(
                                  payment,
                                  currentInstallment,
                                  totalInstallments
                                )
                              }
                            >
                              <RotateCcw className="h-4 w-4" />
                              Reintentar Mensualidad {currentInstallment}
                            </Button>
                          )}
                          {payment.status === "REJECTED" && paidInstallments === 0 && cohort && (
                            <Link href={`/dashboard/checkout?cohortId=${cohort.id}`}>
                              <Button size="sm" className="gap-1.5">
                                <RotateCcw className="h-4 w-4" />
                                Reintentar pago
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Cronograma visual de Mensualidades */}
                      {totalInstallments > 1 && (
                        <div className="rounded-xl border border-border/60 bg-muted/25 p-3.5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5 text-primary" />
                              Cronograma de Mensualidades ({paidInstallments} de {totalInstallments} pagadas)
                            </p>
                            {payment.nextDueDate && paidInstallments < totalInstallments && (
                              <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                                Próximo vencimiento sugerido:{" "}
                                {new Date(payment.nextDueDate).toLocaleDateString("es-PE", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {Array.from({ length: totalInstallments }, (_, idx) => {
                              const monthNum = idx + 1;
                              const historyRecord = historyItems.find(
                                (item) => Number(item?.installmentNumber) === monthNum
                              );
                              const isPaid = monthNum <= paidInstallments;
                              const isCurrentPending =
                                monthNum === currentInstallment && payment.status === "PENDING";
                              const isCurrentRejected =
                                monthNum === currentInstallment && payment.status === "REJECTED";
                              const isNextToPay =
                                monthNum === paidInstallments + 1 && payment.status === "COMPLETED";

                              const historicalVoucher =
                                historyRecord?.voucherUrl ||
                                (monthNum === currentInstallment ? payment.voucherUrl : null);

                              return (
                                <div
                                  key={monthNum}
                                  className={`flex flex-col justify-between rounded-lg border p-2.5 text-xs transition ${
                                    isPaid
                                      ? "border-emerald-500/30 bg-emerald-500/10"
                                      : isCurrentPending
                                      ? "border-amber-500/40 bg-amber-500/10"
                                      : isCurrentRejected
                                      ? "border-rose-500/40 bg-rose-500/10"
                                      : isNextToPay
                                      ? "border-violet-500/40 bg-violet-500/10"
                                      : "border-border/60 bg-background/60 opacity-75"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-foreground">
                                      Mensualidad {monthNum}
                                    </span>
                                    <span className="font-mono font-bold text-foreground">
                                      S/ {formatMoney(historyRecord?.amount || payment.amount)}
                                    </span>
                                  </div>

                                  <div className="mt-1.5 flex items-center justify-between gap-1">
                                    {isPaid ? (
                                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                                        <CheckCircle2 className="h-3 w-3" /> Pagada
                                      </span>
                                    ) : isCurrentPending ? (
                                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                                        <Clock3 className="h-3 w-3" />
                                        {payment.voucherUrl ? "En validación" : "Subir voucher"}
                                      </span>
                                    ) : isCurrentRejected ? (
                                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-300">
                                        <XCircle className="h-3 w-3" /> Observada
                                      </span>
                                    ) : isNextToPay ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenInstallmentModal(
                                            payment,
                                            monthNum,
                                            totalInstallments
                                          )
                                        }
                                        className="inline-flex items-center gap-1 font-bold text-violet-700 underline hover:text-violet-800 dark:text-violet-300 cursor-pointer"
                                      >
                                        <PlusCircle className="h-3 w-3" /> Pagar ahora
                                      </button>
                                    ) : (
                                      <span className="text-muted-foreground">Programada</span>
                                    )}

                                    <div className="flex items-center gap-2">
                                      {isPaid && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDownloadReceipt(
                                              payment,
                                              monthNum,
                                              historyRecord?.amount || payment.amount,
                                              historyRecord?.validatedAt || payment.validatedAt
                                            )
                                          }
                                          className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300 cursor-pointer"
                                          title="Descargar constancia PDF de esta mensualidad"
                                        >
                                          Boleta PDF
                                        </button>
                                      )}
                                      {historicalVoucher && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setVoucherImageError(false);
                                            setPreviewVoucher({
                                              payment,
                                              url: voucherUrl(historicalVoucher),
                                              label: `Mensualidad ${monthNum} de ${totalInstallments}`,
                                            });
                                          }}
                                          className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                                        >
                                          Voucher
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    {payment.status === "REJECTED" && payment.rejectionReason && (
                      <div className="border-t border-red-500/10 bg-red-500/5 px-5 py-3 text-sm text-red-700 dark:text-red-300">
                        <strong>Motivo:</strong> {payment.rejectionReason}
                      </div>
                    )}
                  </Card>
                );
              })}
              <TablePagination page={studentPage} pageSize={pageSize} total={studentTotal} onPageChange={setStudentPage} />
            </div>
          )}
        </div>
      )}

      {/* Modal para habilitar y pagar la siguiente mensualidad */}
      {installmentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="installment-modal-title"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => {
                if (!submittingInstallment) setInstallmentModal(null);
              }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                <CalendarDays className="h-3.5 w-3.5" />
                Mensualidad {installmentModal.nextNumber} de {installmentModal.total}
              </span>
              <h2 id="installment-modal-title" className="mt-2 text-xl font-bold text-foreground">
                Registrar pago de mensualidad
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Curso:{" "}
                <strong className="text-foreground">
                  {installmentModal.payment.enrollment?.cohort?.course?.name ||
                    installmentModal.payment.enrollment?.cohort?.name ||
                    "Programa"}
                </strong>{" "}
                · Monto de la cuota:{" "}
                <strong className="text-primary font-mono">
                  S/ {formatMoney(installmentModal.payment.amount)}
                </strong>
              </p>
            </div>

            <form onSubmit={handleSubmitNextInstallment} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Elige tu método de pago
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(["YAPE", "PLIN", "EFECTIVO"] as const).map((methodKey) => {
                    const active = installmentMethod === methodKey;
                    return (
                      <button
                        key={methodKey}
                        type="button"
                        onClick={() => setInstallmentMethod(methodKey)}
                        className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition cursor-pointer ${
                          active
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <span>{METHOD_LABELS[methodKey]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(settings?.whatsappNumber || settings?.supportEmail) && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs space-y-1">
                  <p className="font-bold text-foreground">Canales oficiales para abono y coordinación:</p>
                  {settings?.whatsappNumber && (
                    <p className="text-muted-foreground">
                      Yape / Plin / WhatsApp Oficial:{" "}
                      <strong className="text-foreground font-mono">{settings.whatsappNumber}</strong>
                    </p>
                  )}
                  {settings?.supportEmail && (
                    <p className="text-muted-foreground">
                      Correo de Admisión:{" "}
                      <strong className="text-foreground">{settings.supportEmail}</strong>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  2. Adjunta tu comprobante / voucher (opcional ahora, o súbelo luego)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setInstallmentFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                />
                {installmentFile && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Archivo listo: {installmentFile.name}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submittingInstallment}
                  onClick={() => setInstallmentModal(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submittingInstallment} className="gap-1.5">
                  {submittingInstallment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {installmentFile
                    ? `Registrar y enviar voucher (Mes ${installmentModal.nextNumber})`
                    : `Habilitar Mensualidad ${installmentModal.nextNumber}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de previsualización de comprobante */}
      {previewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
          <div className="relative bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setPreviewVoucher(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="border-b border-border/60 pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                Mi Comprobante — {METHOD_LABELS[previewVoucher.payment.method] || previewVoucher.payment.method}
                {previewVoucher.label && (
                  <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                    {previewVoucher.label}
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Operación: <strong className="font-mono text-foreground">{previewVoucher.payment.operationNumber || `ORD-${previewVoucher.payment.id.slice(0, 8).toUpperCase()}`}</strong> · Monto: <strong className="text-primary">S/ {formatMoney(previewVoucher.payment.amount)}</strong>
              </p>
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-xl overflow-hidden flex items-center justify-center min-h-[260px] max-h-[60vh]">
              {previewVoucher.url.toLowerCase().endsWith(".pdf") ? (
                <iframe src={previewVoucher.url} className="w-full h-[420px]" title="Comprobante PDF" />
              ) : voucherImageError ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm font-medium mb-1">No se pudo previsualizar la imagen</p>
                  <p className="text-xs">Usa el enlace inferior para abrir el archivo original.</p>
                </div>
              ) : (
                <Image
                  unoptimized
                  width={900}
                  height={900}
                  src={previewVoucher.url}
                  alt="Comprobante de pago"
                  className="max-h-[55vh] w-auto object-contain rounded-lg"
                  onError={() => setVoucherImageError(true)}
                />
              )}
            </div>
            <div className="flex justify-between items-center pt-2">
              <a
                href={previewVoucher.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir en nueva pestaña
              </a>
              <Button variant="outline" size="sm" onClick={() => setPreviewVoucher(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
