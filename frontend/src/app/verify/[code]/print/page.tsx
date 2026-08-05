"use client";

import type { Certificate, Cohort, Enrollment, User } from "@/types/domain";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

type VerifiedCertificate = Omit<Certificate, "enrollment"> & {
  enrollment: Enrollment & { user: User; cohort: Cohort };
};

interface CertificateResponse { data: VerifiedCertificate }

export default function PrintCertificatePage() {
  const params = useParams();
  const code = params.code as string;
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<VerifiedCertificate | null>(null);

  useEffect(() => {
    fetchApi(`/certificates/verify/${code}`)
      .then((res: CertificateResponse) => {
        setCert(res.data);
        // Auto print after loading
        setTimeout(() => window.print(), 500);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl font-bold text-red-500">Certificado no encontrado</p>
      </div>
    );
  }

  const { enrollment } = cert;
  const { user, cohort } = enrollment;

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        {/* Print button (hidden on print) */}
        <div className="no-print mb-4 flex gap-3">
          <button
            onClick={() => window.print()}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            🖨️ Imprimir / Guardar PDF
          </button>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
          >
            Cerrar
          </button>
        </div>

        {/* Diploma - landscape oriented */}
        <div
          className="w-full bg-white text-black relative overflow-hidden"
          style={{
            maxWidth: "1100px",
            aspectRatio: "1.414 / 1",
            border: "8px solid",
            borderImage: "linear-gradient(135deg, #0ea5e9, #8b5cf6, #f59e0b) 1",
            padding: "60px 80px",
          }}
        >
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-40 h-40 opacity-10" style={{
            background: "radial-gradient(circle at 0% 0%, #0ea5e9 0%, transparent 70%)"
          }} />
          <div className="absolute top-0 right-0 w-40 h-40 opacity-10" style={{
            background: "radial-gradient(circle at 100% 0%, #8b5cf6 0%, transparent 70%)"
          }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 opacity-10" style={{
            background: "radial-gradient(circle at 0% 100%, #f59e0b 0%, transparent 70%)"
          }} />
          <div className="absolute bottom-0 right-0 w-40 h-40 opacity-10" style={{
            background: "radial-gradient(circle at 100% 100%, #0ea5e9 0%, transparent 70%)"
          }} />

          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
            {/* Logo */}
            <div className="mb-4">
              <span className="text-5xl">🎓</span>
            </div>

            <h1 className="text-4xl font-serif font-bold text-slate-800 tracking-wide mb-1">
              CERTIFICADO DE FINALIZACIÓN
            </h1>
            <p className="text-lg text-slate-400 tracking-[0.3em] uppercase mb-10">
              Academia Virtual
            </p>

            <p className="text-base text-slate-500 mb-3">Se otorga el presente certificado a:</p>
            <h2 className="text-3xl font-bold mb-8" style={{
              borderBottom: "3px solid #0ea5e9",
              paddingBottom: "8px",
              display: "inline-block",
              color: "#0ea5e9",
              paddingLeft: "32px",
              paddingRight: "32px",
            }}>
              {user.firstName} {user.lastName}
            </h2>

            <p className="text-base text-slate-500 mb-2">
              Por haber completado satisfactoriamente el curso de:
            </p>
            <h3 className="text-2xl font-bold text-slate-800 mb-1">
              {cohort.course.name}
            </h3>
            <p className="text-sm text-slate-400 mb-10">{cohort.name}</p>

            {/* Footer */}
            <div className="w-full flex justify-between items-end mt-auto pt-6" style={{ borderTop: "1px solid #e2e8f0" }}>
              <div className="text-left">
                <p className="text-xs text-slate-400">Código de Verificación</p>
                <p className="font-mono text-sm text-slate-600 font-bold">{cert.code}</p>
              </div>
              <div className="text-center">
                <div className="w-40 border-b border-slate-300 mb-1" />
                <p className="text-xs text-slate-400">Firma Autorizada</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Fecha de Emisión</p>
                <p className="text-sm text-slate-600 font-bold">
                  {new Date(cert.issueDate).toLocaleDateString("es-PE", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
