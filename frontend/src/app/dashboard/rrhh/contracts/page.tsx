"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  CheckCircle2,
  Download,
  AlertTriangle,
  FileText,
  Loader2,
  Search,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { downloadApiFile, fetchApi, getErrorMessage } from "@/lib/api";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { DocumentPreview } from "@/components/dashboard/document-preview";

type Contract = {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  agreedSalary: string | number;
  isActive: boolean;
  rejectionReason?: string | null;
  worker: { user: { firstName: string; lastName: string; email: string } };
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Pendiente de firma",
  SIGNED: "Firmado — pendiente de aprobación",
  REJECTED: "Devuelto para corrección",
  APPROVED: "Aprobado",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado",
};

const typeLabels: Record<string, string> = {
  INDEFINITE: "Indefinido",
  FIXED_TERM: "Plazo fijo",
  INTERNSHIP: "Prácticas",
  FREELANCE: "Locación de servicios",
};

function statusClass(status: string) {
  if (status === "APPROVED")
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "SIGNED")
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (status === "SENT")
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "REJECTED")
    return "bg-red-500/10 text-red-700 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const pageSize = 20;

  const loadContracts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (status !== "ALL") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetchApi(`/rrhh/contracts?${params.toString()}`);
      setContracts(response?.data || []);
      setTotal(response?.pagination?.total || 0);
      setError("");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudieron cargar los contratos"));
    } finally {
      setLoading(false);
    }
  };

  const loadContractsEffect = useEffectEvent(loadContracts);

  useEffect(() => {
    const id = window.setTimeout(() => void loadContractsEffect(), 0);
    return () => window.clearTimeout(id);
  }, [page, search, status]);

  const runAction = async (contractId: string, action: "send" | "approve") => {
    setBusy(contractId);
    setError("");
    setSuccess("");
    try {
      await fetchApi(`/rrhh/contracts/${contractId}/${action}`, {
        method: action === "send" ? "POST" : "POST",
      });
      setSuccess(
        action === "send"
          ? "Contrato enviado al trabajador."
          : "Contrato aprobado y activado.",
      );
      await loadContracts();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo actualizar el contrato"));
    } finally {
      setBusy(null);
    }
  };

  const filtered = contracts;

  const today = new Date();
  const alertLimit = new Date(today);
  alertLimit.setDate(alertLimit.getDate() + 30);
  const expiringContracts = contracts.filter((contract) => {
    if (!contract.isActive || !contract.endDate) return false;
    const endDate = new Date(contract.endDate);
    return endDate >= today && endDate <= alertLimit;
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recursos humanos"
        title="Contratos"
        description="Revisa, envía y aprueba contratos con trazabilidad de firma."
      />

      {expiringContracts.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5" role="status">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div className="min-w-0"><h2 className="font-semibold text-amber-800 dark:text-amber-200">Contratos próximos a vencer</h2><p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{expiringContracts.length} contrato(s) requieren revisión dentro de los próximos 30 días.</p><div className="mt-3 flex flex-wrap gap-2">{expiringContracts.slice(0, 4).map((contract) => <button key={contract.id} type="button" onClick={() => setSearch(contract.worker.user.email)} className="rounded-lg border border-amber-500/30 bg-background/60 px-3 py-1.5 text-left text-xs font-semibold text-amber-900 hover:bg-background dark:text-amber-100">{contract.worker.user.firstName} {contract.worker.user.lastName} · {new Date(contract.endDate!).toLocaleDateString("es-PE")}</button>)}</div></div></div>
        </section>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(["ALL", "SENT", "SIGNED", "APPROVED"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => { setStatus(key); setPage(1); }}
            className={`rounded-xl border p-4 text-left transition-colors ${status === key ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"}`}
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {key === "ALL" ? "Todos" : statusLabels[key]}
            </p>
            <p className="mt-1 text-2xl font-bold">
              {key === "ALL"
                ? contracts.length
                : contracts.filter((item) => item.status === key).length}
            </p>
          </button>
        ))}
      </div>
      <div className="workspace-toolbar"><label>Filtrar por estado<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ALL">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="text-xs text-muted-foreground">Los contadores superiores resumen la página actual. Abre el PDF para revisar el documento completo.</p></div>

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar contratos"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Buscar por trabajador o correo"
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {total} contrato(s) encontrados
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando contratos…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>No hay contratos para este filtro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-4">Trabajador</th>
                  <th className="p-4">Contrato</th>
                  <th className="p-4">Vigencia</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contract) => (
                  <tr key={contract.id} className="border-t border-border/70">
                    <td className="p-4">
                      <p className="font-semibold">
                        {contract.worker.user.firstName}{" "}
                        {contract.worker.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contract.worker.user.email}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium">
                        {typeLabels[contract.type] || contract.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        S/ {Number(contract.agreedSalary).toFixed(2)}
                      </p>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(contract.startDate).toLocaleDateString("es-PE")}{" "}
                      —{" "}
                      {contract.endDate
                        ? new Date(contract.endDate).toLocaleDateString("es-PE")
                        : "sin término"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(contract.status)}`}
                      >
                        {statusLabels[contract.status] || contract.status}
                      </span>
                      {contract.rejectionReason && (
                        <p className="mt-1 max-w-48 text-xs text-red-600 dark:text-red-300">
                          {contract.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPreview(contract.id)}>Ver documento</Button>
                        <Button
                          title="Descargar PDF"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            void downloadApiFile(
                              `/rrhh/contracts/${contract.id}/pdf`,
                              `contrato-${contract.id}.pdf`,
                            )
                          }
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {["DRAFT", "REJECTED"].includes(contract.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={busy === contract.id}
                            onClick={() => void runAction(contract.id, "send")}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Enviar
                          </Button>
                        )}
                        {contract.status === "SIGNED" && (
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={busy === contract.id}
                            onClick={() =>
                              void runAction(contract.id, "approve")
                            }
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Aprobar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        )}
      </div>
      {preview && <DocumentPreview key={preview} endpoint={`/rrhh/contracts/${preview}/pdf`} title="Documento del contrato" onClose={() => setPreview(null)} />}
    </div>
  );
}
