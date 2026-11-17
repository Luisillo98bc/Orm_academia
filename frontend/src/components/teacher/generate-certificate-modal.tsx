"use client";

import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { User } from "@/types/domain";
import { AlertCircle, Award, CheckCircle2, Loader2, X } from "lucide-react";

type CertificateType = "COMPLETION" | "GRADES";

interface GenerateCertificateModalProps {
  cohortId: string;
  student: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export function GenerateCertificateModal({
  cohortId,
  student,
  isOpen,
  onClose,
  onSuccess,
}: GenerateCertificateModalProps) {
  const [certificateType, setCertificateType] = useState<CertificateType>("COMPLETION");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen || !student) return null;

  const handleClose = () => {
    if (loading) return;
    setError("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await fetchApi(`/certificates/cohort/${cohortId}/student/${student.id}`, {
        method: "POST",
        body: JSON.stringify({ certificateType }),
      });
      setSuccess(true);
      await onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo emitir el certificado."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Generar certificado" onClose={handleClose}>
      <Card className="w-full max-w-md border-border/80 bg-card shadow-2xl">
        <CardHeader className="relative border-b border-border/60 pb-5">
          <div className="flex items-start gap-3 pr-8">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Award className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle id="certificate-modal-title" className="text-xl">Generar certificado</CardTitle>
              <CardDescription className="mt-1">
                Selecciona el documento para {student.firstName} {student.lastName}.
              </CardDescription>
            </div>
          </div>
          <button type="button" onClick={handleClose} disabled={loading} className="absolute right-5 top-5 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Cerrar ventana">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="pt-6">
          {success ? (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Certificado generado</h3>
                <p className="mt-1 text-sm text-muted-foreground">El documento ya está disponible en el módulo de certificados.</p>
              </div>
              <Button type="button" className="w-full" onClick={handleClose}>Cerrar</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Tipo de certificado</legend>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${certificateType === "COMPLETION" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                  <input type="radio" name="certificateType" value="COMPLETION" checked={certificateType === "COMPLETION"} onChange={() => setCertificateType("COMPLETION")} className="mt-1 accent-primary" />
                  <span><span className="block text-sm font-semibold">Certificado de finalización</span><span className="mt-1 block text-xs text-muted-foreground">Acredita que el estudiante completó el curso.</span></span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${certificateType === "GRADES" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                  <input type="radio" name="certificateType" value="GRADES" checked={certificateType === "GRADES"} onChange={() => setCertificateType("GRADES")} className="mt-1 accent-primary" />
                  <span><span className="block text-sm font-semibold">Certificado de notas</span><span className="mt-1 block text-xs text-muted-foreground">Incluye el promedio y el resumen académico.</span></span>
                </label>
              </fieldset>

              <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                El sistema verificará automáticamente que el estudiante cumpla los requisitos de asistencia, progreso y calificaciones.
              </p>

              {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{error}</span></div>}

              <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading} className="min-w-40">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Award className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {loading ? "Generando…" : "Generar certificado"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
