"use client";

import type { Certificate, Cohort, Enrollment, User } from "@/types/domain";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { API_URL, fetchApi } from "@/lib/api";
import { Loader2, CheckCircle, Award, Download, Printer, Copy, Check, Share2, ShieldAlert, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type VerifiedCertificate = Omit<Certificate, "enrollment"> & {
  enrollment: Enrollment & { user: User; cohort: Cohort };
};

interface CertificateResponse { data: VerifiedCertificate }

export default function VerifyCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [lookupCode, setLookupCode] = useState(code || "");
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<VerifiedCertificate | null>(null);
  const [error, setError] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchApi(`/certificates/verify/${code}`)
      .then((res: CertificateResponse) => {
        setCert(res.data);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [code]);

  const handleDownloadOfficialPdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await fetch(`${API_URL}/certificates/verify/${encodeURIComponent(code)}/pdf`);
      if (!response.ok) throw new Error("PDF no disponible");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Certificado-${code}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      window.open(`/verify/${code}/print`, "_blank");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Enlace de verificación copiado al portapapeles");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 text-center shadow-sm sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">
            Verificación Oficial de Certificado
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            No encontramos un certificado con ese código
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            El código consultado (<span className="font-mono font-semibold text-foreground">{code}</span>) no figura en nuestro registro vigente o aún no ha sido emitido. Verifica que esté escrito correctamente.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const next = lookupCode.trim();
              if (next) router.push(`/verify/${encodeURIComponent(next)}`);
            }}
            className="mt-6 flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Ingresa otro código (ej. CERT-2026-...)"
                aria-label="Código de certificado a verificar"
                className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>
            <Button type="submit" className="h-11 shrink-0 rounded-xl px-5 font-semibold">
              Verificar código
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-6 text-sm">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al inicio
              </Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-xl">
              <Link href="/cursos">Ver catálogo de programas</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { enrollment } = cert;
  const { user, cohort } = enrollment;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 sm:p-8">
      {/* Visualización del Certificado / Diploma */}
      <div className="w-full max-w-4xl bg-white text-black p-12 sm:p-20 rounded-lg shadow-2xl border-[12px] border-primary/90 relative overflow-hidden text-center">
        {/* Decoraciones bg */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-br-full"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 rounded-tl-full"></div>

        <Award className="h-24 w-24 text-yellow-500 mx-auto mb-6" />
        
        <h1 className="text-5xl md:text-6xl font-serif font-bold text-slate-800 mb-2">
          Certificado de Finalización
        </h1>
        <p className="text-xl text-slate-500 tracking-widest uppercase mb-12">
          Academia Virtual
        </p>

        <p className="text-lg text-slate-600 mb-4">Se otorga el presente a:</p>
        <h2 className="text-4xl font-bold text-primary mb-8 border-b-2 border-primary/20 pb-4 inline-block px-12">
          {user.firstName} {user.lastName}
        </h2>

        <p className="text-lg text-slate-600 mb-4">Por haber completado exitosamente el curso de:</p>
        <h3 className="text-3xl font-bold text-slate-800 mb-2">
          {cohort.course.name}
        </h3>
        <p className="text-slate-500 mb-12">{cohort.name}</p>

        <div className="flex flex-col sm:flex-row justify-between items-center mt-16 pt-8 border-t border-slate-200">
          <div className="text-left mb-6 sm:mb-0">
            <p className="font-bold text-slate-700">Código de Verificación:</p>
            <p className="font-mono text-slate-500">{cert.code}</p>
          </div>
          
          <div className="text-right">
            <p className="font-bold text-slate-700">Fecha de Emisión:</p>
            <p className="text-slate-500">{new Date(cert.issueDate).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-center">
          <Image unoptimized src={`${API_URL}/certificates/verify/${encodeURIComponent(code)}/qr`} alt="Código QR de verificación" width={112} height={112} className="rounded-lg border border-slate-200 p-2" />
          <p className="max-w-xs text-left text-xs leading-5 text-slate-500">Escanea este código para comprobar la autenticidad directamente desde el portal académico.</p>
        </div>
      </div>

      {/* Botones de acción fuera del diploma */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => void handleDownloadOfficialPdf()}
          disabled={downloadingPdf}
          className="bg-primary hover:bg-primary/90 text-white px-6 gap-2"
        >
          {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Descargar PDF Oficial
        </Button>
        <Button
          variant="outline"
          onClick={() => window.open(`/verify/${code}/print`, "_blank")}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Vista de impresión
        </Button>
        <Button
          variant="outline"
          onClick={() => void handleCopyLink()}
          className="gap-2 cursor-pointer"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Enlace copiado" : "Copiar enlace"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const issueDate = new Date(cert.issueDate);
            const linkedInUrl = new URL("https://www.linkedin.com/profile/add");
            linkedInUrl.searchParams.set("startTask", "CERTIFICATION_NAME");
            linkedInUrl.searchParams.set("name", cohort.course.name);
            linkedInUrl.searchParams.set("organizationName", "Academia Virtual");
            linkedInUrl.searchParams.set("issueYear", String(issueDate.getFullYear()));
            linkedInUrl.searchParams.set("issueMonth", String(issueDate.getMonth() + 1));
            linkedInUrl.searchParams.set("certId", cert.code);
            linkedInUrl.searchParams.set("certUrl", window.location.href);
            window.open(linkedInUrl.toString(), "_blank", "noopener,noreferrer");
          }}
          className="gap-2 cursor-pointer border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10"
        >
          <Share2 className="h-4 w-4" />
          Añadir a LinkedIn
        </Button>
        <div className="bg-green-500/10 text-green-700 dark:text-green-300 px-4 py-2 rounded-md flex items-center gap-2 border border-green-500/20">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="font-semibold">Certificado Auténtico</span>
        </div>
      </div>
    </div>
  );
}
