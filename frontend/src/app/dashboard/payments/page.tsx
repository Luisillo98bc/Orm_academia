"use client";

import type { Payment } from "@/types/domain";

import { useEffect, useEffectEvent, useState } from "react";
import { fetchApi, resolveFileUrl } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, FileImage, ExternalLink, X, ZoomIn, XCircle, MessageCircle, Phone, Download, CalendarDays } from "lucide-react";
import { DataTable, DataTableColumn, DataTableFilter } from "@/components/ui/data-table";
import Image from "next/image";
import { PageHeader } from "@/components/dashboard/page-header";
import { toast } from "sonner";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";
import { Modal } from "@/components/ui/modal";

function getVoucherUrl(rawUrl?: string | null): string {
  return resolveFileUrl(rawUrl);
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewVoucher, setPreviewVoucher] = useState<{ payment: Payment; url: string } | null>(null);
  const [voucherImageError, setVoucherImageError] = useState(false);
  const [rejectionPaymentId, setRejectionPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"pending" | "due" | "history">("pending");
  const history = viewMode !== "pending";
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(new URLSearchParams(window.location.search).get("search") || ""), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const pageSize = 20;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (rejectionPaymentId) {
          setRejectionPaymentId(null);
        } else if (previewVoucher) {
          setPreviewVoucher(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewVoucher, rejectionPaymentId]);

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    setNow(Date.now());
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(viewMode === "due" ? 100 : pageSize),
        ...(search ? { search } : {}),
        ...(method && method !== "__all__" ? { method } : {}),
      });
      const response = await fetchApi(`/payments/${viewMode === "pending" ? "pending" : "history"}?${query}`);
      const rawItems: Payment[] = response?.data || [];
      if (viewMode === "due") {
        const dueItems = rawItems.filter((p) => {
          const totalInst = Math.max(
            1,
            Number(p.totalInstallments ?? 1),
            Number(p.enrollment?.cohort?.installments ?? 1)
          );
          const currInst = Math.max(1, Number(p.installmentNumber ?? 1));
          const paidCount =
            p.status === "COMPLETED"
              ? Math.max(1, Number(p.paidInstallments ?? 1), currInst)
              : Number(p.paidInstallments ?? 0);
          return p.status === "COMPLETED" && totalInst > 1 && paidCount < totalInst;
        });
        setPayments(dueItems);
        setTotal(dueItems.length);
      } else {
        setPayments(rawItems);
        setTotal(response?.pagination?.total || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los pagos");
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentsEffect = useEffectEvent(loadPayments);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void loadPaymentsEffect(); };
    window.addEventListener('academy:data-changed', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('academy:data-changed', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadPaymentsEffect();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [page, viewMode, search, method]);

  const handleApprove = async (paymentId: string) => {
    setProcessingId(paymentId);
    try {
      await fetchApi(`/payments/${paymentId}/approve`, { method: "PATCH" });
      setPreviewVoucher(null);
      await loadPayments();
      toast.success("Pago aprobado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al aprobar pago");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (paymentId: string) => {
    setRejectionPaymentId(paymentId);
    setRejectionReason("");
  };

  const submitRejection = async () => {
    if (!rejectionPaymentId || rejectionReason.trim().length < 5) return;
    const paymentId = rejectionPaymentId;
    setProcessingId(paymentId);
    try {
      await fetchApi(`/payments/${paymentId}/reject`, { method: "PATCH", body: JSON.stringify({ reason: rejectionReason.trim() }) });
      setPreviewVoucher(null);
      setRejectionPaymentId(null);
      setRejectionReason("");
      await loadPayments();
      toast.success("Pago rechazado y motivo registrado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo rechazar el pago");
    } finally {
      setProcessingId(null);
    }
  };

  const columns: DataTableColumn<Payment>[] = [
    { key: "createdAt", header: "Registro", render: payment => <div className="whitespace-nowrap text-xs"><p>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("es-PE") : "Sin fecha"}</p>{payment.status === "PENDING" && payment.createdAt && <p className="mt-1 text-muted-foreground">Hace {Math.max(0, Math.floor((Date.now() - new Date(payment.createdAt).getTime()) / 86400000))} días</p>}</div> },
    {
      key: "student",
      header: "Estudiante / Contacto",
      render: (payment) => {
        const student = payment.enrollment?.user;
        const cleanPhone = (student?.phone || "").replace(/\D/g, "");
        const whatsappPhone = cleanPhone
          ? cleanPhone.startsWith("51") && cleanPhone.length >= 11
            ? cleanPhone
            : `51${cleanPhone}`
          : "";
        const opCode = payment.operationNumber || `ORD-${payment.id.slice(0, 8).toUpperCase()}`;
        const courseTitle = payment.enrollment?.cohort?.course?.name || payment.enrollment?.cohort?.name || "el programa";
        const msg = encodeURIComponent(
          `Hola ${student?.firstName || ""}, te escribimos del área de Admisión de Academia Virtual respecto a tu solicitud de matrícula (${opCode}) para "${courseTitle}" por S/ ${formatMoney(payment.amount)}. ¿Cómo podemos ayudarte a completar tu inscripción?`
        );

        return (
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {student?.firstName} {student?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{student?.email}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {student?.phone ? (
                <a
                  href={`https://wa.me/${whatsappPhone}?text=${msg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  title="Escribir por WhatsApp al alumno"
                >
                  <MessageCircle className="h-3 w-3" />
                  {student.phone}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Phone className="h-3 w-3" /> Sin teléfono
                </span>
              )}
              {student?.dni && (
                <span className="text-[11px] text-muted-foreground font-mono">DNI: {student.dni}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "course",
      header: "Curso / Operación",
      render: (payment) => {
        const totalInstallments = Math.max(
          1,
          Number(payment.totalInstallments ?? 1),
          Number(payment.enrollment?.cohort?.installments ?? 1)
        );
        const installmentNumber = Math.max(1, Number(payment.installmentNumber ?? 1));
        const paidCount =
          payment.status === "COMPLETED"
            ? Math.max(1, Number(payment.paidInstallments ?? 1), installmentNumber)
            : Number(payment.paidInstallments ?? 0);

        return (
          <div className="space-y-1">
            <p className="font-medium text-sm text-foreground">
              {payment.enrollment?.cohort?.course?.name || "Programa académico"}
            </p>
            <p className="text-xs text-muted-foreground">{payment.enrollment?.cohort?.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-mono text-primary">
                {payment.operationNumber || `ORD-${payment.id.slice(0, 8).toUpperCase()}`}
              </span>
              {totalInstallments > 1 ? (
                <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  Mensualidad {installmentNumber} de {totalInstallments}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Pago único
                </span>
              )}
              {totalInstallments > 1 && paidCount > 0 && (
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  ({paidCount}/{totalInstallments} pagadas)
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Monto",
      render: (payment) => (
        <span className="font-mono font-bold text-primary text-sm">
          S/ {formatMoney(payment.amount)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "method",
      header: "Método",
      render: (payment) => (
        <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          {payment.method}
        </span>
      ),
    },
    {
      key: "voucher",
      header: "Comprobante",
      render: (payment) => {
        const fullUrl = getVoucherUrl(payment.voucherUrl);

        return payment.voucherUrl ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setVoucherImageError(false);
              setPreviewVoucher({ payment, url: fullUrl });
            }}
            className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-lg"
          >
            <ZoomIn className="h-3.5 w-3.5" />
            <span>Ver Comprobante</span>
          </Button>
        ) : (
          <span className="text-xs text-amber-500 font-semibold italic">Sin voucher</span>
        );
      },
    },
    {
      key: "issue",
      header: "Situación",
      render: (payment) => {
        if (payment.status === 'COMPLETED') {
          const totalInst = Math.max(
            1,
            Number(payment.totalInstallments ?? 1),
            Number(payment.enrollment?.cohort?.installments ?? 1)
          );
          const currInst = Math.max(1, Number(payment.installmentNumber ?? 1));
          const paidCount = Math.max(1, Number(payment.paidInstallments ?? 1), currInst);
          const owesNext = totalInst > 1 && paidCount < totalInst;

          return (
            <div className="space-y-1">
              <span className="text-xs font-semibold text-emerald-700 block">
                Aprobado {payment.validatedAt ? new Date(payment.validatedAt).toLocaleDateString('es-PE') : ''}
              </span>
              {owesNext && (
                <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                  <CalendarDays className="h-3 w-3" />
                  Por cobrar: Mes {paidCount + 1}/{totalInst}
                  {payment.nextDueDate
                    ? ` (Vence ${new Date(payment.nextDueDate).toLocaleDateString("es-PE")})`
                    : ""}
                </span>
              )}
            </div>
          );
        }
        if (payment.status === 'REJECTED') return <span className="text-xs text-red-600">Rechazado{payment.rejectionReason ? `: ${payment.rejectionReason}` : ''}</span>;
        const expired = payment.enrollment?.reservationExpiresAt && new Date(payment.enrollment.reservationExpiresAt).getTime() <= Date.now();
        if (payment.chargeAttemptKey) return <span className="text-xs font-semibold text-amber-700">Cobro por conciliar. Comprueba Culqi antes de modificar.</span>;
        if (expired) return <span className="text-xs font-semibold text-red-600">Reserva vencida. Revisar disponibilidad antes de aprobar.</span>;
        return <span className="text-xs text-muted-foreground">Pendiente de revisión</span>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (payment) => {
        if (payment.status === "COMPLETED") {
          const totalInst = Math.max(
            1,
            Number(payment.totalInstallments ?? 1),
            Number(payment.enrollment?.cohort?.installments ?? 1)
          );
          const currInst = Math.max(1, Number(payment.installmentNumber ?? 1));
          const paidCount = Math.max(1, Number(payment.paidInstallments ?? 1), currInst);
          if (totalInst > 1 && paidCount < totalInst) {
            const student = payment.enrollment?.user;
            const cleanPhone = (student?.phone || "").replace(/\D/g, "");
            const whatsappPhone = cleanPhone
              ? cleanPhone.startsWith("51") && cleanPhone.length >= 11
                ? cleanPhone
                : `51${cleanPhone}`
              : "";
            const courseTitle =
              payment.enrollment?.cohort?.course?.name ||
              payment.enrollment?.cohort?.name ||
              "tu programa";
            const dueText = payment.nextDueDate
              ? ` con vencimiento el ${new Date(payment.nextDueDate).toLocaleDateString("es-PE")}`
              : "";
            const reminderMsg = encodeURIComponent(
              `Hola ${student?.firstName || ""}, te saludamos de Academia Virtual para recordarte que tu Mensualidad ${paidCount + 1} de ${totalInst} del programa "${courseTitle}" (S/ ${formatMoney(payment.amount)})${dueText} ya se encuentra habilitada en tu sección "Mis Pagos".`
            );
            return whatsappPhone ? (
              <div className="flex justify-end">
                <a
                  href={`https://wa.me/${whatsappPhone}?text=${reminderMsg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 text-xs font-bold text-violet-700 hover:bg-violet-500/20 dark:text-violet-300 transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Recordar cuota {paidCount + 1}
                </a>
              </div>
            ) : null;
          }
          return null;
        }
        if (payment.status !== 'PENDING') return null;
        return (
          <div className="flex justify-end gap-2"><Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-red-600"
            disabled={processingId === payment.id || !!payment.chargeAttemptKey}
            onClick={() => handleReject(payment.id)}
          ><XCircle className="mr-1 h-3.5 w-3.5" />Rechazar</Button><Button
            size="sm"
            className="h-8 text-xs rounded-lg shadow-sm"
            disabled={processingId === payment.id || !!payment.chargeAttemptKey || !!(payment.enrollment?.reservationExpiresAt && new Date(payment.enrollment.reservationExpiresAt).getTime() <= Date.now())}
            onClick={() => handleApprove(payment.id)}
          >
            {processingId === payment.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            )}
            Validar Pago
          </Button></div>
        );
      },
      className: "text-right",
    },
  ];

  const filters: DataTableFilter[] = [
    {
      key: "method",
      label: "Método de pago",
      options: [
        { value: "TARJETA", label: "Tarjeta" },
        { value: "YAPE", label: "Yape" },
        { value: "PLIN", label: "Plin" },
        { value: "EFECTIVO", label: "Efectivo" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Control financiero" title="Control de pagos" description="Revisa comprobantes, valida solicitudes y consulta el historial de pagos." />
      <SummaryStrip items={[{ label: history ? "Pagos en el historial" : "Pagos por revisar", value: total, detail: "Según los filtros actuales" }, { label: "Volumen en esta página", value: `S/ ${formatMoney(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0))}` }, { label: "Comprobantes en esta página", value: payments.filter(p => p.voucherUrl).length }, { label: "Por conciliar en esta página", value: payments.filter(p => p.chargeAttemptKey).length }]} />
      {error && <div role="alert" className="workspace-note">{error}<Button variant="outline" size="sm" className="ml-3" onClick={loadPayments}>Reintentar</Button></div>}

      <div className="flex flex-wrap gap-2" aria-label="Vista de pagos">
        <Button variant={viewMode === "pending" ? "default" : "outline"} onClick={() => { setPage(1); setViewMode("pending"); }}>Pendientes</Button>
        <Button variant={viewMode === "due" ? "default" : "outline"} onClick={() => { setPage(1); setViewMode("due"); }} className="gap-1.5">
          <CalendarDays className="h-4 w-4" />
          Mensualidades por cobrar
        </Button>
        <Button variant={viewMode === "history" ? "default" : "outline"} onClick={() => { setPage(1); setViewMode("history"); }}>Historial</Button>
        <Button
          type="button"
          variant="outline"
          className="ml-auto gap-2 cursor-pointer"
          onClick={() => {
            if (!payments.length) {
              toast.error("No hay pagos visibles para exportar");
              return;
            }
            const headers = ["Fecha", "Operacion", "Estudiante", "Correo", "Telefono", "Curso", "Cohorte", "Cuota", "Metodo", "Monto", "Estado"];
            const rows = payments.map((p) => {
              const totalInst = Math.max(1, Number(p.totalInstallments ?? 1), Number(p.enrollment?.cohort?.installments ?? 1));
              const currInst = Math.max(1, Number(p.installmentNumber ?? 1));
              return [
                p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-PE") : "",
                p.operationNumber || `ORD-${p.id.slice(0, 8).toUpperCase()}`,
                `${p.enrollment?.user?.firstName || ""} ${p.enrollment?.user?.lastName || ""}`.trim(),
                p.enrollment?.user?.email || "",
                p.enrollment?.user?.phone || "",
                p.enrollment?.cohort?.course?.name || "",
                p.enrollment?.cohort?.name || "",
                totalInst > 1 ? `Mensualidad ${currInst}/${totalInst}` : "Pago único",
                p.method,
                formatMoney(p.amount),
                p.status,
              ];
            });
            const csvContent =
              "\uFEFF" +
              [headers, ...rows]
                .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
                .join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `pagos-${history ? "historial" : "pendientes"}-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success("Reporte CSV de pagos descargado");
          }}
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <DataTable
        data={payments}
        columns={columns}
        filters={filters}
        loading={loading}
        searchPlaceholder="Buscar por nombre, curso, método..."
        emptyMessage={history ? "No hay pagos aprobados o rechazados." : "No hay pagos pendientes por validar."}
        emptyIcon={<CheckCircle2 className="h-12 w-12 text-green-500 opacity-50 mb-2" />}
        pageSize={Math.max(payments.length, 1)}
        serverPagination={{ page, pageSize, total, search, filters: { method }, onPageChange: setPage, onSearchChange: value => { setSearch(value); setPage(1); }, onFilterChange: (_, value) => { setMethod(value); setPage(1); } }}
      />

      {/* Voucher Lightbox / Preview Modal */}
      {previewVoucher && (
        <Modal title="Revisión del comprobante de pago" onClose={() => setPreviewVoucher(null)}>
          <div className="relative bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setPreviewVoucher(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-border/60 pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                Comprobante de Pago — {previewVoucher.payment.method}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Estudiante: <strong className="text-foreground">{previewVoucher.payment.enrollment?.user?.firstName} {previewVoucher.payment.enrollment?.user?.lastName}</strong> ({previewVoucher.payment.enrollment?.user?.email})
              </p>
              <p className="text-xs text-muted-foreground">
                Curso: <strong className="text-foreground">{previewVoucher.payment.enrollment?.cohort?.course?.name}</strong> — Monto: <strong className="text-primary font-mono text-sm">S/ {formatMoney(previewVoucher.payment.amount)}</strong>
              </p>
            </div>

            {/* Voucher Image Display */}
            <div className="bg-black/60 rounded-xl overflow-hidden border border-border/50 flex justify-center items-center min-h-[300px] max-h-[500px]">
              {voucherImageError ? (
                <div className="p-8 text-center text-red-400 font-semibold">
                  <p>No se pudo cargar la imagen del comprobante.</p>
                  <p className="text-xs text-muted-foreground mt-2">Puedes abrir el comprobante en otra pestaña para revisarlo.</p>
                </div>
              ) : (
                <Image
                  unoptimized
                  width={800}
                  height={600}
                  src={previewVoucher.url}
                  alt="Comprobante de Pago"
                  className="max-h-[480px] w-auto object-contain rounded-lg shadow-lg"
                  onError={() => setVoucherImageError(true)}
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={previewVoucher.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir imagen en pestaña nueva
              </a>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreviewVoucher(null)} className="rounded-xl">
                  Cerrar
                </Button>
                {previewVoucher.payment.status === "PENDING" && <Button
                  disabled={processingId === previewVoucher.payment.id || !!previewVoucher.payment.chargeAttemptKey || !!(previewVoucher.payment.enrollment?.reservationExpiresAt && new Date(previewVoucher.payment.enrollment.reservationExpiresAt).getTime() <= now)}
                  onClick={() => handleApprove(previewVoucher.payment.id)}
                  className="rounded-xl px-6"
                >
                  {processingId === previewVoucher.payment.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Aprobar y Validar Pago
                </Button>}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {rejectionPaymentId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rejection-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Seguimiento del pago</p>
                <h2 id="rejection-title" className="mt-1 text-xl font-bold text-foreground">Rechazar comprobante</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setRejectionPaymentId(null)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Escribe un motivo claro. El estudiante podrá verlo y corregir su registro.</p>
            <label htmlFor="rejection-reason" className="mt-5 block text-sm font-semibold text-foreground">Motivo del rechazo</label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Ej.: El comprobante no permite verificar el monto o la fecha."
              rows={4}
              maxLength={500}
              className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
              autoFocus
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{rejectionReason.length}/500</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectionPaymentId(null)}>Cancelar</Button>
              <Button variant="destructive" disabled={rejectionReason.trim().length < 5 || processingId === rejectionPaymentId} onClick={() => void submitRejection()}>
                {processingId === rejectionPaymentId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar rechazo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
