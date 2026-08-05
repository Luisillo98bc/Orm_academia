"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { API_URL, fetchApi, getErrorMessage } from "@/lib/api";
import { useCulqi } from "@/hooks/use-culqi";
import {
  Loader2,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import type { Cohort } from "@/types/domain";
import { moneyToMinorUnits, moneyToNumber } from "@/lib/money";

type PaymentMethod = "TARJETA" | "YAPE" | "PLIN" | "EFECTIVO";

interface CheckoutState {
  step: "select-method" | "processing" | "upload-voucher" | "success" | "pending" | "error";
  enrollmentId?: string;
  paymentId?: string;
  orderId?: string;
  errorMessage?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ step: "select-method" });
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);

  // ─── Hook de Culqi ────────────────────────────────────────────────────
  const { openCheckout } = useCulqi({
    onToken: async (token) => {
      // Token recibido de Culqi (tarjeta o Yape)
      try {
        setCheckoutState(prev => ({ ...prev, step: "processing" }));
        await fetchApi("/payments/charge", {
          method: "POST",
          body: JSON.stringify({
            paymentId: checkoutState.paymentId,
            tokenId: token.id,
          }),
        });
        setCheckoutState(prev => ({ ...prev, step: "success" }));
      } catch (err: unknown) {
        setCheckoutState(prev => ({
          ...prev,
          step: "error",
          errorMessage: getErrorMessage(err, "Error al procesar el pago"),
        }));
      }
    },
    onError: (error) => {
      setCheckoutState(prev => ({
        ...prev,
        step: "error",
        errorMessage: error?.user_message || error?.message || "Error en Culqi Checkout",
      }));
    },
  });

  const loadCohort = async () => {
    try {
      const allCohorts = await fetchApi("/academic/cohorts");
      const found = allCohorts?.find((candidate: Cohort) => candidate.id === cohortId);
      if (found) {
        setCohort(found);
      } else {
        router.push("/dashboard/catalog");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Cargar datos de la cohorte ───────────────────────────────────────
    const loadCohortEffect = useEffectEvent(loadCohort);

  useEffect(() => {
    if (!cohortId) {
      router.push("/dashboard/catalog");
      return;
    }
    loadCohortEffect();
  }, [cohortId, router]);

  // ─── Paso 1: Crear enrollment + payment en backend ────────────────────
  const handleSelectMethod = async (method: PaymentMethod) => {
    setSelectedMethod(method);
    setIsProcessing(true);

    try {
      const data = await fetchApi("/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ cohortId, method }),
      });

      // Si es gratis, ir directo a éxito
      if (!data.payment) {
        setCheckoutState({ step: "success" });
        setIsProcessing(false);
        return;
      }

      const paymentId = data.payment.id;
      const enrollmentId = data.enrollment.id;

      setCheckoutState(prev => ({ ...prev, paymentId, enrollmentId }));

      if (method === "TARJETA") {
        // Abrir Culqi Checkout directamente con tarjeta
        const amountInCents = moneyToMinorUnits(cohort?.price ?? "0.00");
        openCheckout({
          title: "Academia Virtual",
          currency: "PEN",
          amount: amountInCents,
          description: `Matrícula: ${cohort?.name}`,
        });
        setIsProcessing(false);
      } else if (method === "YAPE") {
        // Para Yape necesitamos crear una orden primero, luego abrir checkout
        try {
          const orderData = await fetchApi("/payments/create-order", {
            method: "POST",
            body: JSON.stringify({ paymentId }),
          });

          setCheckoutState(prev => ({ ...prev, orderId: orderData.orderId }));

          const amountInCents = moneyToMinorUnits(cohort?.price ?? "0.00");
          openCheckout({
            title: "Academia Virtual",
            currency: "PEN",
            amount: amountInCents,
            description: `Matrícula: ${cohort?.name}`,
            orderId: orderData.orderId,
          });
        } catch (err: unknown) {
          setCheckoutState({
            step: "error",
            errorMessage: getErrorMessage(err, "Error al crear orden de Yape"),
          });
        }
        setIsProcessing(false);
      } else if (method === "PLIN" || method === "EFECTIVO") {
        // Para Plin y Efectivo, ir a subir voucher
        setCheckoutState(prev => ({ ...prev, step: "upload-voucher", paymentId, enrollmentId }));
        setIsProcessing(false);
      }
    } catch (err: unknown) {
      setCheckoutState({
        step: "error",
        errorMessage: getErrorMessage(err, "Error al procesar. Es posible que ya estés matriculado."),
      });
      setIsProcessing(false);
    }
  };

  // ─── Subir voucher ────────────────────────────────────────────────────
  const handleUploadVoucher = async () => {
    if (!voucherFile || !checkoutState.paymentId) return;

    setUploadingVoucher(true);
    try {
      const formData = new FormData();
      formData.append("file", voucherFile);

      await fetchApi(`/payments/${checkoutState.paymentId}/voucher`, {
        method: "POST",
        body: formData,
      });

      setCheckoutState(prev => ({ ...prev, step: "pending" }));
    } catch (err: unknown) {
      setCheckoutState(prev => ({
        ...prev,
        step: "error",
        errorMessage: getErrorMessage(err, "Error al subir el comprobante"),
      }));
    } finally {
      setUploadingVoucher(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!cohort) return null;

  const price = moneyToNumber(cohort.price);

  // ─── Vista: Éxito ─────────────────────────────────────────────────────
  if (checkoutState.step === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="bg-card p-12 rounded-3xl shadow-xl border border-border max-w-xl w-full">
          <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-extrabold text-foreground mb-4">¡Pago Exitoso!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Tu pago ha sido procesado correctamente a través de Culqi. Tu matrícula ya está activa y puedes comenzar a estudiar inmediatamente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard/my-courses">
              <Button size="lg" className="w-full sm:w-auto rounded-full h-14 px-8 font-semibold text-lg">
                Ir a mis Cursos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Vista: Pendiente (voucher subido, esperando validación) ──────────
  if (checkoutState.step === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="bg-card p-12 rounded-3xl shadow-xl border border-border max-w-xl w-full">
          <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-8">
            <Loader2 className="w-12 h-12 animate-spin" />
          </div>
          <h1 className="text-4xl font-extrabold text-foreground mb-4">¡Comprobante Enviado!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Tu comprobante de pago ha sido recibido. Un administrador lo validará pronto y tu matrícula será activada. Recibirás un correo de confirmación.
          </p>
          <Link href="/dashboard/catalog">
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 font-semibold text-lg">
              <ArrowLeft className="mr-2 w-5 h-5" /> Volver al Catálogo
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Vista: Error ─────────────────────────────────────────────────────
  if (checkoutState.step === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="bg-card p-12 rounded-3xl shadow-xl border border-border max-w-xl w-full">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-extrabold text-foreground mb-4">Error en el Pago</h1>
          <p className="text-lg text-muted-foreground mb-8">
            {checkoutState.errorMessage || "Ocurrió un error al procesar tu pago. Intenta nuevamente."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="rounded-full h-14 px-8 font-semibold text-lg"
              onClick={() => setCheckoutState({ step: "select-method" })}
            >
              Intentar de nuevo
            </Button>
            <Link href="/dashboard/catalog">
              <Button size="lg" variant="outline" className="rounded-full h-14 px-8 font-semibold text-lg">
                <ArrowLeft className="mr-2 w-5 h-5" /> Volver al Catálogo
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Vista: Processing ────────────────────────────────────────────────
  if (checkoutState.step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="bg-card p-12 rounded-3xl shadow-xl border border-border max-w-xl w-full">
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-8" />
          <h1 className="text-3xl font-extrabold text-foreground mb-4">Procesando pago...</h1>
          <p className="text-muted-foreground">Estamos verificando tu pago con Culqi. No cierres esta ventana.</p>
        </div>
      </div>
    );
  }

  // ─── Vista: Subir Voucher (Plin / Efectivo) ───────────────────────────
  if (checkoutState.step === "upload-voucher") {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
        <button onClick={() => setCheckoutState({ step: "select-method" })} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Cambiar método de pago
        </button>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-lg space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">
              Subir Comprobante de Pago
            </h2>
            <p className="text-muted-foreground">
              Realiza tu pago por <span className="font-bold text-primary">{selectedMethod}</span> y sube una foto o captura del comprobante.
            </p>
          </div>

          {/* Datos de pago */}
          <div className="bg-muted/50 rounded-xl p-6 border border-border/50 space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Datos para el pago</h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Curso</span>
              <span className="font-medium">{cohort.course?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cohorte</span>
              <span className="font-medium">{cohort.name}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="text-muted-foreground">Total a pagar</span>
              <span className="font-bold text-primary">S/ {price.toFixed(2)}</span>
            </div>
          </div>

          {/* Upload */}
          <div className="space-y-4">
            <label
              htmlFor="voucher-upload"
              className="flex flex-col items-center justify-center border-2 border-dashed border-border/70 rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors"
            >
              {voucherFile ? (
                <div className="text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="font-medium">{voucherFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Clic para cambiar</p>
                </div>
              ) : (
                <div className="text-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Arrastra o haz clic para subir</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG o PDF</p>
                </div>
              )}
              <input
                id="voucher-upload"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setVoucherFile(e.target.files?.[0] || null)}
              />
            </label>

            <Button
              className="w-full h-14 text-lg font-semibold rounded-xl"
              disabled={!voucherFile || uploadingVoucher}
              onClick={handleUploadVoucher}
            >
              {uploadingVoucher ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : null}
              Enviar Comprobante
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Vista Principal: Seleccionar Método de Pago ──────────────────────
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/catalog" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Catálogo
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Resumen del curso */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-lg sticky top-24">
            <div className="h-40 bg-muted relative overflow-hidden">
              {cohort.course?.imageUrl ? (
                <Image unoptimized width={640} height={320} src={`${API_URL.replace('/api/v1', '')}${cohort.course.imageUrl}`} alt={cohort.course.name} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                  <ImageIcon className="h-12 w-12 text-primary/30" />
                </div>
              )}
            </div>
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold">{cohort.course?.name}</h2>
              <p className="text-sm text-muted-foreground">{cohort.name}</p>
              <div className="border-t border-border/50 pt-4">
                <div className="flex justify-between items-center text-lg">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-3xl font-extrabold text-primary">
                    S/ {price.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
                Pago seguro procesado por Culqi
              </div>
            </div>
          </div>
        </div>

        {/* Métodos de Pago */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Elige tu método de pago</h1>
            <p className="text-muted-foreground mt-2">Selecciona cómo quieres pagar tu matrícula</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tarjeta */}
            <button
              onClick={() => handleSelectMethod("TARJETA")}
              disabled={isProcessing}
              className="group relative bg-card border-2 border-border/50 rounded-2xl p-6 text-left hover:border-primary/70 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                  <CreditCard className="h-7 w-7 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Tarjeta</h3>
                  <p className="text-sm text-muted-foreground mt-1">Visa, Mastercard, Amex, Diners</p>
                </div>
              </div>
              {isProcessing && selectedMethod === "TARJETA" && (
                <Loader2 className="absolute top-4 right-4 h-5 w-5 animate-spin text-primary" />
              )}
            </button>

            {/* Yape */}
            <button
              onClick={() => handleSelectMethod("YAPE")}
              disabled={isProcessing}
              className="group relative bg-card border-2 border-border/50 rounded-2xl p-6 text-left hover:border-primary/70 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0 group-hover:bg-purple-500/20 transition-colors">
                  <Smartphone className="h-7 w-7 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Yape</h3>
                  <p className="text-sm text-muted-foreground mt-1">Paga desde tu app de Yape</p>
                </div>
              </div>
              {isProcessing && selectedMethod === "YAPE" && (
                <Loader2 className="absolute top-4 right-4 h-5 w-5 animate-spin text-primary" />
              )}
            </button>

            {/* Plin */}
            <button
              onClick={() => handleSelectMethod("PLIN")}
              disabled={isProcessing}
              className="group relative bg-card border-2 border-border/50 rounded-2xl p-6 text-left hover:border-primary/70 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0 group-hover:bg-green-500/20 transition-colors">
                  <Smartphone className="h-7 w-7 text-green-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Plin</h3>
                  <p className="text-sm text-muted-foreground mt-1">Transferencia vía Plin</p>
                </div>
              </div>
              {isProcessing && selectedMethod === "PLIN" && (
                <Loader2 className="absolute top-4 right-4 h-5 w-5 animate-spin text-primary" />
              )}
            </button>

            {/* Efectivo */}
            <button
              onClick={() => handleSelectMethod("EFECTIVO")}
              disabled={isProcessing}
              className="group relative bg-card border-2 border-border/50 rounded-2xl p-6 text-left hover:border-primary/70 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                  <Banknote className="h-7 w-7 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Efectivo</h3>
                  <p className="text-sm text-muted-foreground mt-1">Depositar y subir comprobante</p>
                </div>
              </div>
              {isProcessing && selectedMethod === "EFECTIVO" && (
                <Loader2 className="absolute top-4 right-4 h-5 w-5 animate-spin text-primary" />
              )}
            </button>
          </div>

          {/* Info */}
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Pago 100% seguro</p>
              <p className="mt-1">
                Los pagos con tarjeta y Yape son procesados por <strong>Culqi</strong>, la pasarela de pagos líder en Perú. Tus datos bancarios nunca son almacenados en nuestros servidores.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
