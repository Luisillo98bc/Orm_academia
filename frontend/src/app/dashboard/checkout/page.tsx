"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import {
  Loader2,
  Banknote,
  Smartphone,
  Clock3,
  CalendarDays,
  Users,
  UserRound,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  MessageCircle,
  Phone,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import Image from "next/image";
import type { Cohort, PlatformSettings } from "@/types/domain";
import { getCohortPricing } from "@/lib/money";
import { getAnalyticsSessionId, trackConversion } from "@/lib/analytics";
import { getCohortImageUrl } from "@/lib/media";
import { useAuth } from "@/components/auth-provider";

type PaymentMethod = "YAPE" | "PLIN" | "EFECTIVO";

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethod;
  title: string;
  subtitle: string;
  badge: string;
}> = [
  {
    id: "YAPE",
    title: "Yape (con comprobante)",
    subtitle: "Reserva tu vacante y adjunta la captura de tu pago por Yape para activación rápida.",
    badge: "Activación rápida",
  },
  {
    id: "PLIN",
    title: "Plin (con comprobante)",
    subtitle: "Reserva tu vacante y adjunta la captura de tu transferencia por Plin.",
    badge: "Sin comisiones",
  },
  {
    id: "EFECTIVO",
    title: "Efectivo / Coordinación con Admisión",
    subtitle: "Reserva tu cupo por 48 horas y un asesor de Admisión se comunicará contigo para coordinar el pago.",
    badge: "Reserva 48h",
  },
];

interface CheckoutState {
  step: "select-method" | "processing" | "upload-voucher" | "success" | "pending" | "error";
  enrollmentId?: string;
  paymentId?: string;
  orderId?: string;
  operationNumber?: string;
  errorMessage?: string;
}

function CheckoutProgress({ step }: { step: CheckoutState["step"] }) {
  const current = step === "select-method" ? 1 : step === "success" || step === "pending" ? 3 : 2;
  const labels = ["Método", "Pago", "Matrícula"];

  return (
    <nav aria-label="Progreso de inscripción" className="rounded-2xl border border-border/60 bg-card/70 p-4">
      <ol className="flex items-center justify-between gap-2">
        {labels.map((label, index) => {
          const number = index + 1;
          const complete = number < current;
          const active = number === current;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  complete || active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {complete ? "✓" : number}
              </div>
              <span className={`truncate text-xs font-semibold sm:text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {index < labels.length - 1 && <div className={`mx-1 h-px flex-1 ${complete ? "bg-primary" : "bg-border"}`} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function EnrollmentSummary({ cohort, finalPrice, operationNumber, paymentStatus }: { cohort: Cohort; finalPrice: number; operationNumber?: string; paymentStatus?: string }) {
  const teacher = cohort.teachers?.[0];
  const capacity = cohort.maxCapacity || cohort.maxStudents;
  const enrolled = cohort.enrolledCount ?? cohort.enrollmentCount ?? 0;
  const availableSeats = capacity ? Math.max(capacity - enrolled, 0) : null;
  const installments = Math.max(1, Number(cohort.installments || 1));

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Tu selección</p>
        {installments > 1 && (
          <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
            Pago mensual ({installments} cuotas)
          </span>
        )}
      </div>
      <p className="mt-1 font-bold text-foreground">{cohort.course?.name}</p>
      <p className="text-sm text-muted-foreground">Edición: {cohort.name}</p>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Inicio: {formatDate(cohort.startDate)}</span>
        <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />Fin: {formatDate(cohort.endDate)}</span>
        <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" />{teacher ? `${teacher.firstName} ${teacher.lastName}` : "Equipo académico"}</span>
        <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{availableSeats === null ? "Cupos limitados" : `${availableSeats} cupos disponibles`}</span>
        <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />{cohort.modality || "Modalidad por confirmar"} · {cohort.schedule || "Horario por confirmar"}</span>
        {operationNumber && <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Operación: {operationNumber}</span>}
        {paymentStatus && <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />Estado: {paymentStatus === "COMPLETED" ? "Aprobado" : "Pendiente de validación"}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-sm text-muted-foreground">
          {installments > 1 ? `Mensualidad 1 de ${installments}` : "Total"}
        </span>
        <div className="text-right">
          <span className="text-xl font-extrabold text-primary">S/ {finalPrice.toFixed(2)}</span>
          {installments > 1 && (
            <p className="text-[11px] text-muted-foreground">
              Luego {installments - 1} cuota(s) mensual(es) desde «Mis Pagos»
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");
  const { user, refreshUser } = useAuth();

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ step: "select-method" });
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("YAPE");
  const [contactPhone, setContactPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [voucherUploaded, setVoucherUploaded] = useState(false);

  useEffect(() => {
    if (user?.phone && !contactPhone) {
      setContactPhone(user.phone);
    }
  }, [user?.phone, contactPhone]);

  const loadCohort = async () => {
    try {
      const [allCohorts, publicSettings] = await Promise.all([
        fetchCatalogApi<Cohort[]>("/academic/public/cohorts", "cohorts"),
        fetchCatalogApi<PlatformSettings>("/settings/public", "settings").catch(() => null),
      ]);
      if (publicSettings) setSettings(publicSettings);
      const found = allCohorts?.find((candidate: Cohort) => candidate.id === cohortId);
      if (found) {
        setCohort(found);
        trackConversion("CHECKOUT_STARTED", { cohortId: found.id, metadata: { source: "checkout_page" } });
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
  const handleContinue = async () => {
    if (!selectedMethod || !cohort) return;
    const method = selectedMethod;
    setIsProcessing(true);

    try {
      const cleanPhone = contactPhone.trim();
      if (cleanPhone && cleanPhone !== (user?.phone || "")) {
        await fetchApi("/users/me", {
          method: "PATCH",
          body: JSON.stringify({ phone: cleanPhone }),
        }).catch(() => undefined);
        await refreshUser().catch(() => null);
      }

      const data = await fetchApi("/payments/checkout", {
        method: "POST",
        body: JSON.stringify({
          cohortId,
          method,
          analyticsSessionId: getAnalyticsSessionId(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      // Si es gratis, ir directo a éxito
      if (!data.payment) {
        setCheckoutState({ step: "success" });
        setIsProcessing(false);
        return;
      }

      const paymentId = data.payment.id;
      const enrollmentId = data.enrollment.id;
      const operationNum = data.operationNumber || `ORD-${paymentId.slice(0, 8).toUpperCase()}`;

      setCheckoutState(prev => ({
        ...prev,
        step: method === "YAPE" || method === "PLIN" ? "upload-voucher" : "pending",
        paymentId,
        enrollmentId,
        operationNumber: operationNum,
      }));
      setIsProcessing(false);
    } catch (err: unknown) {
      trackConversion("CHECKOUT_FAILED", { cohortId: cohortId || undefined, metadata: { stage: "create_checkout", method } });
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

      setVoucherUploaded(true);
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

  const { finalPrice } = getCohortPricing(cohort);
  const cleanWhatsapp = (settings?.whatsappNumber || "").replace(/\D/g, "");
  const whatsappMessage = encodeURIComponent(
    `Hola, soy ${user?.firstName || ""} ${user?.lastName || ""} (${user?.email || ""}). He registrado mi solicitud de matrícula ${checkoutState.operationNumber || ""} para el curso "${cohort.course?.name}" (${cohort.name}) por S/ ${finalPrice.toFixed(2)} mediante ${selectedMethod}. Quisiera coordinar la validación de mi inscripción.`
  );
  const whatsappHref = cleanWhatsapp ? `https://wa.me/${cleanWhatsapp}?text=${whatsappMessage}` : null;

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
            Tu matrícula fue confirmada correctamente. Ya puedes comenzar a estudiar.
          </p>
          <EnrollmentSummary cohort={cohort} finalPrice={finalPrice} operationNumber={checkoutState.operationNumber} paymentStatus="COMPLETED" />
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
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

  // ─── Vista: Pendiente (voucher subido o reserva en efectivo) ──────────
  if (checkoutState.step === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 py-8">
        <div className="bg-card p-8 sm:p-10 rounded-3xl shadow-xl border border-border max-w-2xl w-full space-y-6">
          <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full flex items-center justify-center mx-auto">
            <Clock3 className="w-10 h-10" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-3">
              Cupo reservado por 48 horas · {checkoutState.operationNumber}
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">
              {voucherUploaded ? "¡Comprobante enviado a Admisión!" : "¡Reserva de matrícula registrada!"}
            </h1>
            <p className="text-base text-muted-foreground mt-2 max-w-lg mx-auto">
              {voucherUploaded
                ? "El área de Admisión ya recibió tu comprobante y notificó al administrador. En breve validarán tu pago y se activará tu acceso al aula virtual."
                : "Tu vacante ya está reservada y el área de Admisión fue notificada. Puedes subir tu comprobante de pago ahora o comunicarte directamente por WhatsApp para coordinar tu ingreso."}
            </p>
          </div>

          <EnrollmentSummary cohort={cohort} finalPrice={finalPrice} operationNumber={checkoutState.operationNumber} paymentStatus="PENDING" />

          {/* Pasos claros para completar la admisión */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-left space-y-2 text-xs sm:text-sm text-muted-foreground">
            <p className="font-bold text-foreground">¿Cómo se activa tu matrícula?</p>
            <p>1. <strong>Notificación enviada:</strong> Tu solicitud aparece de inmediato en el panel de <em>Pagos pendientes</em> de Admisión junto con tu teléfono de contacto.</p>
            <p>2. <strong>Pago o comprobante:</strong> Si pagaste por Yape, Plin o depósito, adjunta la foto de tu voucher. Si elegiste efectivo, coordina con Admisión por WhatsApp.</p>
            <p>3. <strong>Activación inmediata:</strong> Apenas el administrador valide tu pago, recibirás un correo de confirmación y el curso aparecerá activo en <em>Mis Cursos</em>.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                Coordinar por WhatsApp con Admisión
              </a>
            )}
            {checkoutState.paymentId && (
              <Button
                size="lg"
                variant={voucherUploaded ? "outline" : "default"}
                className="h-12 rounded-xl font-semibold gap-2"
                onClick={() => setCheckoutState((prev) => ({ ...prev, step: "upload-voucher" }))}
              >
                <Upload className="h-4 w-4" />
                {voucherUploaded ? "Actualizar comprobante" : "Subir comprobante de pago"}
              </Button>
            )}
          </div>

          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <Link href="/dashboard/my-payments">
              <Button variant="outline" className="w-full sm:w-auto rounded-xl h-11 px-6 font-semibold">
                Ver estado en Mis Pagos
              </Button>
            </Link>
            <Link href="/dashboard/catalog">
              <Button variant="ghost" className="w-full sm:w-auto rounded-xl h-11 px-6 font-semibold">
                <ArrowLeft className="mr-2 w-4 h-4" /> Volver al catálogo
              </Button>
            </Link>
          </div>
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
          <p className="text-muted-foreground">Estamos registrando tu solicitud. No cierres esta ventana.</p>
        </div>
      </div>
    );
  }

  // ─── Vista: Subir Voucher (Plin / Efectivo) ───────────────────────────
  if (checkoutState.step === "upload-voucher") {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
        <CheckoutProgress step={checkoutState.step} />
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
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Operación</span>
              <span className="font-mono font-bold">{checkoutState.operationNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Curso</span>
              <span className="font-medium">{cohort.course?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cohorte</span>
              <span className="font-medium">{cohort.name}</span>
            </div>
            {settings?.whatsappNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Número oficial ({selectedMethod} / WhatsApp)</span>
                <span className="font-mono font-bold text-primary">{settings.whatsappNumber}</span>
              </div>
            )}
            <div className="flex justify-between text-lg pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Total a pagar</span>
              <span className="font-bold text-primary">S/ {finalPrice.toFixed(2)}</span>
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
                  <p className="font-medium">Arrastra o haz clic para subir tu captura o voucher</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP o PDF (máx. 5 MB)</p>
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
              Enviar Comprobante a Admisión
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setCheckoutState((prev) => ({ ...prev, step: "pending" }))}
            >
              Subir comprobante más tarde o coordinar por WhatsApp
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Vista Principal: Seleccionar Método de Pago ──────────────────────
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <CheckoutProgress step={checkoutState.step} />
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
              {getCohortImageUrl(cohort) ? (
                <Image unoptimized fill sizes="(min-width: 1024px) 40vw, 100vw" src={getCohortImageUrl(cohort)!} alt={`Imagen de ${cohort.name}`} className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                  <ImageIcon className="h-12 w-12 text-primary/30" />
                </div>
              )}
            </div>
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold">{cohort.course?.name}</h2>
              <EnrollmentSummary cohort={cohort} finalPrice={finalPrice} />
              <Link href="/dashboard/catalog" className="inline-flex text-sm font-semibold text-primary hover:underline">Cambiar edición antes de registrar la matrícula</Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
                Solicitud registrada de forma segura
              </div>
            </div>
          </div>
        </div>

        {/* Selección de Medio de Pago y Contacto */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Completa tu inscripción</h1>
            <p className="text-muted-foreground mt-2">
              Elige cómo deseas realizar tu pago. Al registrar tu solicitud, tu vacante queda reservada por 48 horas.
            </p>
          </div>

          <div className="space-y-3" role="radiogroup" aria-label="Medios de pago disponibles">
            {PAYMENT_OPTIONS.map((option) => {
              const active = selectedMethod === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedMethod(option.id)}
                  className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        option.id === "EFECTIVO"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {option.id === "EFECTIVO" ? (
                        <Banknote className="h-6 w-6" />
                      ) : (
                        <Smartphone className="h-6 w-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-base font-bold text-foreground">{option.title}</h2>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {option.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{option.subtitle}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Teléfono de contacto para Admisión */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-2">
            <label htmlFor="checkout-phone" className="text-sm font-bold text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Tu celular / WhatsApp de contacto
            </label>
            <Input
              id="checkout-phone"
              type="tel"
              placeholder="Ej. 987 654 321"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              El responsable de Admisión utilizará este número para coordinar tu pago o confirmarte la activación de tu matrícula.
            </p>
          </div>

          <Button
            className="h-14 w-full rounded-xl text-base font-semibold"
            disabled={isProcessing}
            onClick={() => {
              trackConversion("PAYMENT_METHOD_SELECTED", { cohortId: cohort.id, metadata: { method: selectedMethod } });
              void handleContinue();
            }}
          >
            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {isProcessing
              ? "Registrando matrícula..."
              : selectedMethod === "EFECTIVO"
                ? "Reservar cupo y coordinar pago"
                : `Continuar con ${selectedMethod}`}
            {!isProcessing ? <span className="ml-2">· S/ {finalPrice.toFixed(2)}</span> : null}
          </Button>

          {/* Info */}
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">¿Cómo funciona el proceso de admisión?</p>
              <p className="mt-1">
                1. Si eliges <strong>Yape o Plin</strong>, en el siguiente paso podrás adjuntar la foto de tu comprobante.<br />
                2. Si eliges <strong>Efectivo</strong>, recibirás tu código de operación y un botón directo al WhatsApp de Admisión.<br />
                3. El administrador validará tu pago en el panel de <em>Pagos pendientes</em> y tu curso se activará de inmediato en <em>Mis Cursos</em>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
