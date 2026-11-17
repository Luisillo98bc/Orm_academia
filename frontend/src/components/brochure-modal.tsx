"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  MonitorPlay,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppLogo } from "@/components/whatsapp-logo";
import { fetchApi } from "@/lib/api";
import { trackConversion } from "@/lib/analytics";
import { getCohortPricing } from "@/lib/money";
import type { Cohort, PlatformSettings } from "@/types/domain";

interface BrochureModalProps {
  open: boolean;
  onClose: () => void;
  cohort: Cohort | null;
  settings?: PlatformSettings | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(value?: string) {
  if (!value) return "Por confirmar";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Por confirmar";
  }
}

function modalityLabel(modality?: string | null) {
  return (
    ({
      ONLINE: "Clases en línea en vivo",
      PRESENCIAL: "Presencial",
      HIBRIDA: "Modalidad híbrida",
    } as Record<string, string>)[modality || ""] || "Clases en línea"
  );
}

export function BrochureModal({ open, onClose, cohort, settings }: BrochureModalProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !cohort) return null;

  const courseName = cohort.course?.name || cohort.courseName || cohort.name;
  const { finalPrice, basePrice, discountActive } = getCohortPricing(cohort);
  const objectives = cohort.course?.whatYouWillLearn
    ? cohort.course.whatYouWillLearn
        .split("\n")
        .map((line) => line.replace(/^- /, "").trim())
        .filter(Boolean)
    : [
        "Clases guiadas en vivo con acompañamiento docente permanente",
        "Proyectos prácticos evaluados paso a paso en el campus virtual",
        "Materiales descargables, ejercicios y seguimiento de avance",
        "Certificado digital con código único de verificación QR",
      ];

  const whatsappNumber = settings?.whatsappNumber?.replace(/\D/g, "") || "51999999999";
  const whatsappBrochureHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Hola, acabo de solicitar el temario del programa "${courseName}" (${cohort.name}) y me gustaría recibir el brochure detallado.`,
  )}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      const isEmail = contact.includes("@");
      const validUuid = UUID_REGEX.test(cohort.id) ? cohort.id : undefined;
      await fetchApi("/prospects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: isEmail ? contact.trim() : undefined,
          phone: isEmail ? undefined : contact.trim(),
          cohortId: validUuid,
          message: `Solicitud de descarga de Temario / Brochure para: ${courseName} (${cohort.name})`,
          privacyConsent,
          source: "BROCHURE_MODAL",
        }),
      });
      trackConversion("PROGRAM_VIEW", {
        cohortId: cohort.id,
        metadata: { action: "brochure_requested", courseName },
      });
      setUnlocked(true);
    } catch {
      setError("No pudimos procesar la solicitud. Verifica tus datos e inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brochure-modal-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana de temario"
          className="cursor-pointer absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {!unlocked ? (
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
              <FileText className="h-3.5 w-3.5" />
              Brochure y Plan de Estudios
            </div>

            <h2 id="brochure-modal-title" className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Descargar temario: {courseName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Ingresa tus datos para ver y descargar la ficha académica completa con fechas, inversión, requisitos y módulos del programa.
            </p>

            <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CalendarDays className="h-4 w-4 text-teal-600" /> Inicio: {formatDate(cohort.startDate)}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Clock3 className="h-4 w-4 text-teal-600" /> {cohort.course?.durationHours ? `${cohort.course.durationHours} horas` : "Programa intensivo"}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <MonitorPlay className="h-4 w-4 text-teal-600" /> {modalityLabel(cohort.modality)}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="brochure-name" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Nombre completo
                </label>
                <Input
                  id="brochure-name"
                  ref={nameInputRef}
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. María Fernández"
                  className="mt-1.5"
                />
              </div>

              <div>
                <label htmlFor="brochure-contact" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  WhatsApp o Correo electrónico
                </label>
                <Input
                  id="brochure-contact"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Ej. 999 888 777 o correo@ejemplo.com"
                  className="mt-1.5"
                />
              </div>

              <label className="cursor-pointer flex items-start gap-2.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                <input
                  required
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="cursor-pointer mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                <span>
                  Acepto recibir la información del programa conforme a la{" "}
                  <Link href="/privacy" className="font-semibold text-teal-700 underline dark:text-teal-300">
                    política de privacidad
                  </Link>
                  .
                </span>
              </label>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={sending}
                className="cursor-pointer h-12 w-full rounded-xl bg-teal-700 font-semibold text-white hover:bg-teal-800"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Ver y descargar ficha del programa
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Ficha desbloqueada
                </p>
                <h2 id="brochure-modal-title" className="text-xl font-bold text-slate-950 dark:text-white">
                  {courseName}
                </h2>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">Edición</span>
                  <strong className="mt-0.5 block text-slate-900 dark:text-white">{cohort.name}</strong>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">Inicio</span>
                  <strong className="mt-0.5 block text-slate-900 dark:text-white">{formatDate(cohort.startDate)}</strong>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">Modalidad</span>
                  <strong className="mt-0.5 block text-slate-900 dark:text-white">{modalityLabel(cohort.modality)}</strong>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">Inversión</span>
                  <strong className="mt-0.5 block text-teal-700 dark:text-teal-300">
                    S/ {finalPrice.toFixed(2)}{" "}
                    {discountActive && <span className="text-[11px] text-slate-400 line-through">S/ {basePrice.toFixed(2)}</span>}
                  </strong>
                </div>
              </div>

              {cohort.schedule && (
                <p className="mt-3 border-t border-slate-200/80 pt-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  <strong>Horario referencial:</strong> {cohort.schedule}
                </p>
              )}
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <BookOpen className="h-4 w-4 text-teal-600" />
                Lo que lograrás en este programa
              </h3>
              <ul className="mt-2.5 space-y-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
                {objectives.slice(0, 6).map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2.5 text-xs text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
              Incluye acceso al campus virtual, grabaciones de soporte y certificado digital verificable con código QR.
            </div>

            <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                className="cursor-pointer h-11 flex-1 gap-2 rounded-xl"
              >
                <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
              </Button>
              <Button
                asChild
                className="cursor-pointer h-11 flex-1 gap-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800"
              >
                <a href={whatsappBrochureHref} target="_blank" rel="noreferrer">
                  <WhatsAppLogo className="h-4 w-4" /> Recibir en mi WhatsApp
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
