"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileSignature,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { useAuth } from "@/components/auth-provider";
import { downloadApiFile, fetchApi, getErrorMessage } from "@/lib/api";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";
import { DocumentPreview } from "@/components/dashboard/document-preview";

type Contract = {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  agreedSalary: string | number;
  rejectionReason?: string | null;
  signatureName?: string | null;
  signedAt?: string | null;
  approvedAt?: string | null;
};

const labels: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Pendiente de firma",
  SIGNED: "Firmado — en revisión",
  REJECTED: "Devuelto para corrección",
  APPROVED: "Vigente y Aprobado",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado",
};

const contractTypes: Record<string, string> = {
  INDEFINITE: "Contrato indefinido",
  FIXED_TERM: "Contrato a plazo fijo",
  INTERNSHIP: "Convenio de prácticas",
  FREELANCE: "Locación de servicios docentes",
};

function tone(status: string) {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/5";
  if (status === "SENT") return "border-amber-500/30 bg-amber-500/5";
  if (status === "REJECTED") return "border-red-500/30 bg-red-500/5";
  return "border-border bg-card";
}

function getStepIndex(status: string) {
  if (status === "APPROVED") return 3;
  if (status === "SIGNED") return 2;
  if (status === "SENT") return 1;
  return 0;
}

export default function MyContractsPage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [signature, setSignature] = useState("");
  const [rejection, setRejection] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/rrhh/contracts/me");
      setContracts(response?.data || response || []);
      setError("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudieron cargar tus contratos"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(() => void loadContracts(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const sign = async (contractId: string) => {
    const name = signature.trim();
    if (name.length < 3) {
      setError("Escribe tu nombre completo para firmar.");
      return;
    }
    setBusy(contractId);
    setError("");
    setSuccess("");
    try {
      await fetchApi(`/rrhh/contracts/${contractId}/sign`, {
        method: "PATCH",
        body: JSON.stringify({ signatureName: name }),
      });
      setSuccess("Contrato firmado y enviado a revisión administrativa.");
      setSelected(null);
      await loadContracts();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo firmar el contrato"));
    } finally {
      setBusy(null);
    }
  };

  const reject = async (contractId: string) => {
    if (rejection.trim().length < 5) {
      setError("Indica el motivo de la devolución.");
      return;
    }
    setBusy(contractId);
    setError("");
    setSuccess("");
    try {
      await fetchApi(`/rrhh/contracts/${contractId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: rejection.trim() }),
      });
      setSuccess("Contrato devuelto a administración con tus observaciones.");
      setSelected(null);
      await loadContracts();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo devolver el contrato"));
    } finally {
      setBusy(null);
    }
  };

  const activeContract = contracts.find((c) => c.status === "APPROVED") || contracts[0];
  const currentSalary = activeContract ? `S/ ${Number(activeContract.agreedSalary).toFixed(2)}` : "S/ 0.00";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Mi información laboral"
        title="Mis contratos"
        description="Revisa tus acuerdos laborales, firma digitalmente con tu cuenta y consulta el estado de aprobación."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/dashboard/my-payments">
              <CreditCard className="h-4 w-4" /> Ver mis pagos y honorarios
            </Link>
          </Button>
        }
      />
      <SummaryStrip
        items={[
          { label: "Mis contratos", value: contracts.length },
          { label: "Vigentes / Aprobados", value: contracts.filter((c) => c.status === "APPROVED").length },
          { label: "Pendientes de firma", value: contracts.filter((c) => c.status === "SENT").length },
          { label: "Honorario pactado", value: currentSalary },
        ]}
      />
      <p className="workspace-note">
        1. Descarga o previsualiza el documento. 2. Firma digitalmente con tu nombre completo cuando estés de acuerdo. 3. Consulta aquí la validación oficial y el historial de tus contratos.
      </p>
      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-5 w-5" />
          {success}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300"
        >
          <XCircle className="h-5 w-5" />
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando tus contratos…
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>Aún no tienes contratos disponibles.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {contracts
            .slice()
            .sort((a, b) => Number(b.status === "SENT") - Number(a.status === "SENT"))
            .map((contract) => {
              const stepIdx = getStepIndex(contract.status);
              return (
                <section
                  key={contract.id}
                  className={`rounded-2xl border p-6 shadow-sm transition-all ${tone(contract.status)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">
                          {contractTypes[contract.type] || contract.type}
                        </h2>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Desde {new Date(contract.startDate).toLocaleDateString("es-PE")} ·{" "}
                          <strong className="text-foreground">S/ {Number(contract.agreedSalary).toFixed(2)} / mes</strong>
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold">
                      {contract.status === "APPROVED" && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
                      {labels[contract.status] || contract.status}
                    </span>
                  </div>

                  {/* Línea de tiempo del contrato */}
                  <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-background/50 p-3 text-center text-[11px] font-semibold">
                    <div className={stepIdx >= 1 ? "text-primary" : "text-muted-foreground"}>
                      1. Emitido
                    </div>
                    <div className={stepIdx >= 2 ? "text-primary" : "text-muted-foreground"}>
                      2. Firmado
                    </div>
                    <div className={stepIdx >= 3 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                      3. Aprobado
                    </div>
                  </div>

                  {contract.endDate && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Vigencia hasta {new Date(contract.endDate).toLocaleDateString("es-PE")}
                    </p>
                  )}
                  {contract.rejectionReason && (
                    <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                      <strong>Observación:</strong> {contract.rejectionReason}
                    </p>
                  )}
                  {contract.signedAt && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Firmado por {contract.signatureName || user?.firstName} el{" "}
                      {new Date(contract.signedAt).toLocaleString("es-PE")}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreview(contract.id)}>
                      Revisar documento
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() =>
                        void downloadApiFile(
                          `/rrhh/contracts/${contract.id}/pdf`,
                          `contrato-${contract.id}.pdf`,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      Ver / descargar PDF
                    </Button>
                    {contract.status === "SENT" && (
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setSelected(selected === contract.id ? null : contract.id);
                          setSignature(`${user?.firstName || ""} ${user?.lastName || ""}`.trim());
                        }}
                      >
                        <FileSignature className="h-4 w-4" />
                        Revisar y responder
                      </Button>
                    )}
                  </div>
                  {selected === contract.id && contract.status === "SENT" && (
                    <div className="mt-4 space-y-4 rounded-lg border border-border bg-background/60 p-4">
                      <div>
                        <label htmlFor={`signature-${contract.id}`} className="text-sm font-medium">
                          Nombre que aparecerá como firma
                        </label>
                        <Input
                          id={`signature-${contract.id}`}
                          value={signature}
                          onChange={(event) => setSignature(event.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={busy === contract.id}
                          onClick={() => void sign(contract.id)}
                          className="gap-2"
                        >
                          <Send className="h-4 w-4" />
                          Aceptar y firmar
                        </Button>
                        <Button
                          disabled={busy === contract.id}
                          variant="outline"
                          onClick={() => void reject(contract.id)}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Devolver
                        </Button>
                      </div>
                      <div>
                        <label htmlFor={`reason-${contract.id}`} className="text-xs text-muted-foreground">
                          Si devuelves el documento, explica qué debe corregirse
                        </label>
                        <Input
                          id={`reason-${contract.id}`}
                          value={rejection}
                          onChange={(event) => setRejection(event.target.value)}
                          placeholder="Motivo de devolución"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      )}
      {preview && (
        <DocumentPreview
          key={preview}
          endpoint={`/rrhh/contracts/${preview}/pdf`}
          title="Documento del contrato"
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
