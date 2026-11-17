"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  FileCheck2,
  Info,
  Loader2,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api";
import { fetchCatalogApi } from "@/lib/catalog-cache";
import type { Cohort, PlatformSettings } from "@/types/domain";

export default function LibroDeReclamacionesPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string>("");

  const [form, setForm] = useState({
    fullName: "",
    documentType: "DNI",
    documentNumber: "",
    email: "",
    phone: "",
    address: "",
    isMinor: false,
    guardianName: "",
    goodType: "SERVICIO",
    cohortId: "",
    claimedAmount: "",
    claimType: "RECLAMO" as "RECLAMO" | "QUEJA",
    description: "",
    consumerRequest: "",
    privacyConsent: false,
  });

  useEffect(() => {
    Promise.allSettled([
      fetchCatalogApi<PlatformSettings>("/settings/public", "settings"),
      fetchCatalogApi<Cohort[]>("/academic/public/cohorts", "cohorts"),
    ]).then(([settingsRes, cohortsRes]) => {
      if (settingsRes.status === "fulfilled" && settingsRes.value) {
        setSettings(settingsRes.value);
      }
      if (cohortsRes.status === "fulfilled" && Array.isArray(cohortsRes.value)) {
        setCohorts(cohortsRes.value);
      }
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSending(true);

    const generatedCode = `LR-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 900000))}`;
    const timestamp = new Intl.DateTimeFormat("es-PE", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date());

    const selectedCohort = cohorts.find((c) => c.id === form.cohortId);
    const programLabel = selectedCohort
      ? `${selectedCohort.course?.name || selectedCohort.name} (${selectedCohort.name})`
      : "General / No especificado";

    const formattedMessage = [
      `[${ generatedCode } - ${form.claimType}]`,
      `Doc: ${form.documentType} ${form.documentNumber}`,
      `Domicilio: ${form.address}`,
      form.isMinor ? `Menor de edad - Apoderado: ${form.guardianName}` : null,
      `Bien contratado: ${form.goodType} - ${programLabel}`,
      form.claimedAmount ? `Monto reclamado: S/ ${form.claimedAmount}` : null,
      `Detalle: ${form.description}`,
      `Pedido del consumidor: ${form.consumerRequest}`,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 2950);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.cohortId);
      await fetchApi("/prospects", {
        method: "POST",
        body: JSON.stringify({
          name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          cohortId: isUuid ? form.cohortId : undefined,
          message: formattedMessage,
          privacyConsent: form.privacyConsent,
          source: "LIBRO_RECLAMACIONES",
        }),
      });
      setSubmittedAt(timestamp);
      setTicketCode(generatedCode);
    } catch {
      setError("No se pudo registrar la hoja de reclamación en este momento. Verifica los campos e inténtalo nuevamente.");
    } finally {
      setSending(false);
    }
  };

  const academyName = settings?.legalName || settings?.academyName || "Academia Virtual";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 dark:text-blue-400"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/50 dark:text-blue-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Ley N.° 29571 — Código de Protección al Consumidor
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-[#090f1e] px-6 py-8 text-white dark:border-slate-800 sm:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300">
                  <BookOpenCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Hoja de Reclamación Virtual</p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Libro de Reclamaciones</h1>
                  <p className="mt-1 text-sm text-slate-300">
                    Proveedor: <strong>{academyName}</strong> {settings?.taxId ? `— RUC: ${settings.taxId}` : ""}
                  </p>
                </div>
              </div>
              {ticketCode && (
                <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-right">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-300">Código de Registro</span>
                  <strong className="text-lg font-extrabold text-amber-300">{ticketCode}</strong>
                </div>
              )}
            </div>
          </div>

          {ticketCode ? (
            <div className=" space-y-6 p-6 sm:p-8" role="status" aria-live="polite">
              <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h2 className="text-lg font-bold">Hoja de reclamación registrada correctamente</h2>
                  <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                    Tu solicitud ha quedado registrada con el código <strong>{ticketCode}</strong> el {submittedAt}. Nuestro equipo de atención al estudiante responderá a tu correo ({form.email}) dentro del plazo legal establecido.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Consumidor</span>
                  <p className="mt-1 font-semibold">{form.fullName}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {form.documentType}: {form.documentNumber}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Contacto</span>
                  <p className="mt-1 font-semibold">{form.email}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Tel: {form.phone}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Tipo registrado</span>
                  <p className="mt-1 font-semibold">{form.claimType}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Fecha de emisión</span>
                  <p className="mt-1 font-semibold">{submittedAt}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">Detalle presentado</span>
                  <p className="mt-1 whitespace-pre-line text-slate-700 dark:text-slate-300">{form.description}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">Pedido del consumidor</span>
                  <p className="mt-1 whitespace-pre-line text-slate-700 dark:text-slate-300">{form.consumerRequest}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                  className="cursor-pointer gap-2"
                >
                  <Printer className="h-4 w-4" /> Imprimir constancia
                </Button>
                <Button asChild className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700">
                  <Link href="/">Volver a la portada</Link>
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8 p-6 sm:p-8">
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-bold">1. Identificación del Consumidor Reclamante</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="claim-name" className="block text-sm font-semibold">
                      Nombres y Apellidos completos *
                    </label>
                    <Input
                      id="claim-name"
                      required
                      minLength={3}
                      value={form.fullName}
                      onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))}
                      placeholder="Ej. Juan Carlos Pérez Gómez"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <label htmlFor="claim-doc-type" className="block text-sm font-semibold">
                      Tipo de Documento *
                    </label>
                    <select
                      id="claim-doc-type"
                      value={form.documentType}
                      onChange={(e) => setForm((v) => ({ ...v, documentType: e.target.value }))}
                      className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="DNI">DNI</option>
                      <option value="CE">Carné de Extranjería (CE)</option>
                      <option value="PASAPORTE">Pasaporte</option>
                      <option value="RUC">RUC</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="claim-doc-number" className="block text-sm font-semibold">
                      Número de Documento *
                    </label>
                    <Input
                      id="claim-doc-number"
                      required
                      minLength={6}
                      maxLength={15}
                      value={form.documentNumber}
                      onChange={(e) => setForm((v) => ({ ...v, documentNumber: e.target.value }))}
                      placeholder="Ej. 74698461"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <label htmlFor="claim-email" className="block text-sm font-semibold">
                      Correo electrónico *
                    </label>
                    <Input
                      id="claim-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                      placeholder="correo@ejemplo.com"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <label htmlFor="claim-phone" className="block text-sm font-semibold">
                      Teléfono / WhatsApp *
                    </label>
                    <Input
                      id="claim-phone"
                      required
                      minLength={6}
                      value={form.phone}
                      onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
                      placeholder="Ej. 999 888 777"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="claim-address" className="block text-sm font-semibold">
                      Domicilio actual (Dirección, Distrito, Ciudad) *
                    </label>
                    <Input
                      id="claim-address"
                      required
                      value={form.address}
                      onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))}
                      placeholder="Ej. Av. Arequipa 1234, Miraflores, Lima"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="cursor-pointer inline-flex items-center gap-2.5 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={form.isMinor}
                        onChange={(e) => setForm((v) => ({ ...v, isMinor: e.target.checked }))}
                        className="cursor-pointer h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>El estudiante es menor de edad (requiere datos del padre, madre o apoderado)</span>
                    </label>
                  </div>

                  {form.isMinor && (
                    <div className="sm:col-span-2">
                      <label htmlFor="claim-guardian" className="block text-sm font-semibold">
                        Nombre completo del Padre, Madre o Apoderado *
                      </label>
                      <Input
                        id="claim-guardian"
                        required={form.isMinor}
                        value={form.guardianName}
                        onChange={(e) => setForm((v) => ({ ...v, guardianName: e.target.value }))}
                        placeholder="Nombre y apellidos del apoderado"
                        className="mt-1.5"
                      />
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <FileCheck2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-bold">2. Identificación del Bien Contratado</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="claim-good-type" className="block text-sm font-semibold">
                      Tipo de bien *
                    </label>
                    <select
                      id="claim-good-type"
                      value={form.goodType}
                      onChange={(e) => setForm((v) => ({ ...v, goodType: e.target.value }))}
                      className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="SERVICIO">Servicio educativo / Matrícula</option>
                      <option value="PRODUCTO">Material / Certificación</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="claim-cohort" className="block text-sm font-semibold">
                      Programa o Edición (opcional)
                    </label>
                    <select
                      id="claim-cohort"
                      value={form.cohortId}
                      onChange={(e) => setForm((v) => ({ ...v, cohortId: e.target.value }))}
                      className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">General / Otro</option>
                      {cohorts.map((cohort) => (
                        <option key={cohort.id} value={cohort.id}>
                          {cohort.course?.name || cohort.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="claim-amount" className="block text-sm font-semibold">
                      Monto reclamado (S/)
                    </label>
                    <Input
                      id="claim-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.claimedAmount}
                      onChange={(e) => setForm((v) => ({ ...v, claimedAmount: e.target.value }))}
                      placeholder="0.00"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-bold">3. Detalle de la Reclamación y Pedido del Consumidor</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`cursor-pointer flex flex-col rounded-xl border p-4 transition-colors ${
                      form.claimType === "RECLAMO"
                        ? "border-blue-600 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/40"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <input
                        type="radio"
                        name="claimType"
                        value="RECLAMO"
                        checked={form.claimType === "RECLAMO"}
                        onChange={() => setForm((v) => ({ ...v, claimType: "RECLAMO" }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-600"
                      />
                      Reclamo
                    </span>
                    <span className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">
                      Disconformidad directamente relacionada con los servicios educativos, acceso al campus o certificaciones.
                    </span>
                  </label>

                  <label
                    className={`cursor-pointer flex flex-col rounded-xl border p-4 transition-colors ${
                      form.claimType === "QUEJA"
                        ? "border-blue-600 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/40"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <input
                        type="radio"
                        name="claimType"
                        value="QUEJA"
                        checked={form.claimType === "QUEJA"}
                        onChange={() => setForm((v) => ({ ...v, claimType: "QUEJA" }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-600"
                      />
                      Queja
                    </span>
                    <span className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">
                      Malestar o descontento respecto a la atención recibida que no guarda relación directa con el servicio contratado.
                    </span>
                  </label>
                </div>

                <div>
                  <label htmlFor="claim-description" className="block text-sm font-semibold">
                    Detalle del Reclamo o Queja *
                  </label>
                  <textarea
                    id="claim-description"
                    required
                    minLength={10}
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
                    placeholder="Explica de forma clara los hechos ocurridos, fechas y detalles relevantes..."
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="claim-request" className="block text-sm font-semibold">
                    Pedido concreto del consumidor *
                  </label>
                  <textarea
                    id="claim-request"
                    required
                    minLength={5}
                    rows={3}
                    value={form.consumerRequest}
                    onChange={(e) => setForm((v) => ({ ...v, consumerRequest: e.target.value }))}
                    placeholder="Indica qué solución o acción solicitas por parte de la academia..."
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </section>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <p>
                  <strong>Nota legal:</strong> La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI. El proveedor deberá dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles, el cual es improrrogable.
                </p>
                <label className="cursor-pointer flex items-start gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                  <input
                    required
                    type="checkbox"
                    checked={form.privacyConsent}
                    onChange={(e) => setForm((v) => ({ ...v, privacyConsent: e.target.checked }))}
                    className="cursor-pointer mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>
                    Declaro que los datos consignados son verdaderos y autorizo el tratamiento de mis datos personales conforme a la{" "}
                    <Link href="/privacy" className="font-semibold text-blue-700 underline dark:text-blue-400">
                      Política de Privacidad
                    </Link>{" "}
                    para la gestión y respuesta de esta hoja de reclamación.
                  </span>
                </label>
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={sending}
                  className="cursor-pointer h-12 rounded-xl bg-blue-600 px-8 font-bold text-white hover:bg-blue-700"
                >
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enviar Hoja de Reclamación
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
