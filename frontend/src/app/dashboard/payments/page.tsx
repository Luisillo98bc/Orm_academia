"use client";

import type { Payment } from "@/types/domain";

import { useEffect, useState } from "react";
import { fetchApi, API_URL } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, FileImage, ExternalLink, X, ZoomIn } from "lucide-react";
import { DataTable, DataTableColumn, DataTableFilter } from "@/components/ui/data-table";
import Image from "next/image";

function getVoucherUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
  // Backend base URL (remover el prefijo /api/v1)
  const backendBase = API_URL.replace(/\/api\/v1\/?$/, "");
  return `${backendBase}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewVoucher, setPreviewVoucher] = useState<{ payment: Payment; url: string } | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await fetchApi("/payments/pending");
      setPayments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadPayments();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleApprove = async (paymentId: string) => {
    setProcessingId(paymentId);
    try {
      await fetchApi(`/payments/${paymentId}/approve`, { method: "PATCH" });
      setPreviewVoucher(null);
      loadPayments();
    } catch  {
      alert("Error al aprobar pago");
    } finally {
      setProcessingId(null);
    }
  };

  const columns: DataTableColumn<Payment>[] = [
    {
      key: "student",
      header: "Estudiante",
      render: (payment) => (
        <div>
          <p className="font-medium text-foreground">
            {payment.enrollment?.user?.firstName} {payment.enrollment?.user?.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{payment.enrollment?.user?.email}</p>
        </div>
      ),
    },
    {
      key: "course",
      header: "Curso / Cohorte",
      render: (payment) => (
        <div>
          <p className="font-medium text-sm text-foreground">
            {payment.enrollment?.cohort?.course?.name}
          </p>
          <p className="text-xs text-muted-foreground">{payment.enrollment?.cohort?.name}</p>
        </div>
      ),
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
            onClick={() => setPreviewVoucher({ payment, url: fullUrl })}
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
      key: "actions",
      header: "",
      render: (payment) => (
        <Button
          size="sm"
          className="h-8 text-xs rounded-lg shadow-sm"
          disabled={processingId === payment.id}
          onClick={() => handleApprove(payment.id)}
        >
          {processingId === payment.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          )}
          Validar Pago
        </Button>
      ),
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
      <div className="flex justify-between items-center border-b border-border/50 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Pagos Pendientes</h2>
          <p className="text-muted-foreground mt-1">
            Valida los comprobantes de transferencias manuales (Yape, Plin, Efectivo) de los alumnos.
          </p>
        </div>
      </div>

      <DataTable
        data={payments}
        columns={columns}
        filters={filters}
        loading={loading}
        searchPlaceholder="Buscar por nombre, curso, método..."
        emptyMessage="No hay pagos pendientes por validar."
        emptyIcon={<CheckCircle2 className="h-12 w-12 text-green-500 opacity-50 mb-2" />}
        pageSize={10}
      />

      {/* Voucher Lightbox / Preview Modal */}
      {previewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
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
              <Image
                unoptimized
                width={800}
                height={600}
                src={previewVoucher.url}
                alt="Comprobante de Pago"
                className="max-h-[480px] w-auto object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  const parent = (e.target as HTMLElement).parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="p-8 text-center text-red-400 font-semibold"><p>No se pudo cargar la imagen del comprobante.</p><p class="text-xs text-muted-foreground mt-2">URL: ${previewVoucher.url}</p></div>`;
                  }
                }}
              />
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
                <Button
                  disabled={processingId === previewVoucher.payment.id}
                  onClick={() => handleApprove(previewVoucher.payment.id)}
                  className="rounded-xl px-6"
                >
                  {processingId === previewVoucher.payment.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Aprobar y Validar Pago
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
