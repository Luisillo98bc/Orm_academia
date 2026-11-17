"use client";

import { useEffect, useState } from "react";
import { downloadApiFile, fetchApi, getErrorMessage } from "@/lib/api";
import {
  Loader2,
  Award,
  Search,
  ExternalLink,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Calendar,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import type { CertificateTemplateSettings } from "@/types/domain";

interface Certificate {
  id: string;
  code: string;
  issueDate: string;
  type?: "COMPLETION" | "GRADES";
  enrollment: {
    user: { id: string; firstName: string; lastName: string; email: string };
    cohort: {
      name: string;
      course: { id: string; name: string; code: string };
    };
  };
  issuer?: { firstName: string; lastName: string } | null;
}

interface PendingEnrollment {
  id: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  cohort: {
    name: string;
    course: { id: string; name: string; code: string };
  };
  completedAt: string;
}

const defaultTemplate: CertificateTemplateSettings = {
  version: "v1",
  primaryColor: "#0ea5e9",
  academyLabel: "ACADEMIA VIRTUAL",
  completionTitle: "CERTIFICADO DE FINALIZACIÓN",
  gradesTitle: "CERTIFICADO DE NOTAS",
  signatureLabel: "Dirección Académica",
};

export default function CertificatesAdminPage() {
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [pending, setPending] = useState<PendingEnrollment[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"issued" | "pending">("issued");
  const [issuing, setIssuing] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [certificateType, setCertificateType] = useState<
    "COMPLETION" | "GRADES"
  >("COMPLETION");
  const [template, setTemplate] = useState<CertificateTemplateSettings>(defaultTemplate);
  const [cohortFilter, setCohortFilter] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [certsRes, pendingRes] = await Promise.all([
        fetchApi("/certificates"),
        fetchApi("/certificates/pending"),
      ]);
      setCertificates(certsRes.data || []);
      setPending(pendingRes.data || []);
      const settings = await fetchApi("/settings");
      setTemplate({ ...defaultTemplate, ...(settings?.certificateTemplate ?? {}) });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar datos"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleIssue = async (enrollmentId: string) => {
    setIssuing(enrollmentId);
    setError("");
    setSuccess("");
    try {
      await fetchApi("/certificates/manual", {
        method: "POST",
        body: JSON.stringify({ enrollmentId, certificateType }),
      });
      setSuccess("Certificado emitido exitosamente");
      await loadData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al emitir certificado"));
    } finally {
      setIssuing(null);
    }
  };

  const filteredCerts = certificates.filter((c) => {
    if (cohortFilter && c.enrollment.cohort.name !== cohortFilter) return false;
    const term = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(term) ||
      c.enrollment.user.firstName.toLowerCase().includes(term) ||
      c.enrollment.user.lastName.toLowerCase().includes(term) ||
      c.enrollment.user.email.toLowerCase().includes(term) ||
      c.enrollment.cohort.course.name.toLowerCase().includes(term)
    );
  });

  const filteredPending = pending.filter((p) => {
    if (cohortFilter && p.cohort.name !== cohortFilter) return false;
    const term = search.toLowerCase();
    return (
      p.user.firstName.toLowerCase().includes(term) ||
      p.user.lastName.toLowerCase().includes(term) ||
      p.user.email.toLowerCase().includes(term) ||
      p.cohort.course.name.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Cargando certificados...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cierre académico"
        title="Gestión de certificados"
        description="Emite y administra los certificados de finalización de curso."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-border/50 bg-card glass flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-500/10">
            <FileText className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{certificates.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Emitidos
            </p>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-border/50 bg-card glass flex items-center gap-4">
          <div className="p-3 rounded-full bg-amber-500/10">
            <Users className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Pendientes
            </p>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-border/50 bg-card glass flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-500/10">
            <Calendar className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {
                certificates.filter((c) => {
                  const d = new Date(c.issueDate);
                  const now = new Date();
                  return (
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear()
                  );
                }).length
              }
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Este Mes
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-2 p-4 text-green-600 bg-green-100 rounded-lg dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <p>{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      <details className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-primary">Consultar vista previa de la plantilla</summary>
        <div className="mt-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Award className="h-4 w-4 text-primary" />
              Vista previa de plantilla
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Así se organizará el documento PDF. Los datos reales se incorporan
              al emitirlo.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Plantilla {template.version}
          </span>
        </div>
        <div className="mx-auto max-w-3xl rounded-lg border-4 bg-background p-5 shadow-inner sm:p-8" style={{ borderColor: `${template.primaryColor}55` }}>
          <div className="border border-border/70 p-5 text-center sm:p-8">
            <p className="text-xs font-bold tracking-[0.28em]" style={{ color: template.primaryColor }}>
              {template.academyLabel}
            </p>
            <div className="mx-auto my-4 h-px w-24 bg-primary/40" />
            <p className="text-lg font-bold uppercase tracking-wide text-foreground sm:text-2xl">
              {certificateType === "GRADES" ? template.gradesTitle : template.completionTitle}
            </p>
            <p className="mt-5 text-xs text-muted-foreground">
              Se otorga el presente documento a:
            </p>
            <p className="mt-2 font-serif text-xl font-semibold text-foreground sm:text-3xl">
              Nombre del estudiante
            </p>
            <p className="mx-auto mt-4 max-w-xl text-xs leading-5 text-muted-foreground">
              {certificateType === "GRADES"
                ? "Se deja constancia de las calificaciones obtenidas en el curso registrado."
                : "Por haber completado satisfactoriamente el curso registrado."}
            </p>
            <p className="mt-4 text-base font-semibold" style={{ color: template.primaryColor }}>
              Nombre del curso
            </p>
            <div className="mt-6 flex items-end justify-between gap-4 text-left text-[10px] text-muted-foreground">
              <span>
                Fecha de emisión
                <br />
                <strong>DD / MM / AAAA</strong>
              </span>
              <span className="flex h-12 w-12 items-center justify-center border-2 border-dashed border-muted-foreground/50 text-center">
                QR
                <br />
                VERIF.
              </span>
              <span className="text-right">
                Código
                <br />
                <strong>CERT-XXXXXXXX</strong>
              </span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{template.signatureLabel}</p>
          </div>
        </div>
        </div>
      </details>

      {/* Tabs + Search */}
      <p className="workspace-note">La lista de pendientes reúne matrículas finalizadas que pueden solicitar emisión. El sistema verifica los requisitos al emitir cada certificado.</p>
      <label className="workspace-toolbar text-sm">Filtrar por cohorte<select aria-label="Filtrar certificados por cohorte" value={cohortFilter} onChange={event => setCohortFilter(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2"><option value="">Todas las cohortes</option>{Array.from(new Set([...certificates.map(c => c.enrollment.cohort.name), ...pending.map(p => p.cohort.name)])).sort().map(name => <option key={name}>{name}</option>)}</select></label>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={tab === "issued" ? "default" : "outline"}
            onClick={() => setTab("issued")}
            className="gap-2"
          >
            <Award className="h-4 w-4" />
            Emitidos ({certificates.length})
          </Button>
          <Button
            variant={tab === "pending" ? "default" : "outline"}
            onClick={() => setTab("pending")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Pendientes ({pending.length})
          </Button>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Plantilla
            <select
              aria-label="Tipo de certificado"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={certificateType}
              onChange={(event) =>
                setCertificateType(
                  event.target.value as "COMPLETION" | "GRADES",
                )
              }
            >
              <option value="COMPLETION">Finalización</option>
              <option value="GRADES">Notas</option>
            </select>
          </label>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table — Issued Certificates */}
      {tab === "issued" && (
        <div className="rounded-xl border border-border/50 bg-card glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-4 font-semibold">Código</th>
                  <th className="text-left p-4 font-semibold">Estudiante</th>
                  <th className="text-left p-4 font-semibold">Curso</th>
                  <th className="text-left p-4 font-semibold">Cohorte</th>
                  <th className="text-left p-4 font-semibold">Emisión</th>
                  <th className="text-left p-4 font-semibold">Emitido por</th>
                  <th className="text-left p-4 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCerts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No se encontraron certificados.
                    </td>
                  </tr>
                ) : (
                  filteredCerts.map((cert) => (
                    <tr
                      key={cert.id}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-4">
                        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">
                          {cert.code}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-medium">
                          {cert.enrollment.user.firstName}{" "}
                          {cert.enrollment.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cert.enrollment.user.email}
                        </p>
                      </td>
                      <td className="p-4 font-medium">
                        {cert.enrollment.cohort.course.name}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {cert.enrollment.cohort.name}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(cert.issueDate).toLocaleDateString("es-ES")}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {cert.issuer
                          ? `${cert.issuer.firstName} ${cert.issuer.lastName}`
                          : "Automático"}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-primary"
                            onClick={() =>
                              window.open(`/verify/${cert.code}`, "_blank")
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-emerald-600"
                            onClick={() =>
                              void downloadApiFile(
                                `/certificates/${cert.code}/pdf`,
                                `certificado-${cert.code}.pdf`,
                              )
                            }
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table — Pending Enrollments */}
      {tab === "pending" && (
        <div className="rounded-xl border border-border/50 bg-card glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-4 font-semibold">Estudiante</th>
                  <th className="text-left p-4 font-semibold">Curso</th>
                  <th className="text-left p-4 font-semibold">Cohorte</th>
                  <th className="text-left p-4 font-semibold">Completado</th>
                  <th className="text-left p-4 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No hay matrículas pendientes de certificado.
                    </td>
                  </tr>
                ) : (
                  filteredPending.map((enr) => (
                    <tr
                      key={enr.id}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-4">
                        <p className="font-medium">
                          {enr.user.firstName} {enr.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {enr.user.email}
                        </p>
                      </td>
                      <td className="p-4 font-medium">
                        {enr.cohort.course.name}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {enr.cohort.name}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {enr.completedAt
                          ? new Date(enr.completedAt).toLocaleDateString(
                              "es-ES",
                            )
                          : "—"}
                      </td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={issuing === enr.id}
                          onClick={() => handleIssue(enr.id)}
                        >
                          {issuing === enr.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Award className="h-3.5 w-3.5" />
                          )}
                          Emitir Certificado
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
