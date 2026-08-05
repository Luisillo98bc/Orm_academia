"use client";

import type { Certificate, Cohort, Enrollment, User } from "@/types/domain";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { Loader2, CheckCircle, XCircle, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

type VerifiedCertificate = Omit<Certificate, "enrollment"> & {
  enrollment: Enrollment & { user: User; cohort: Cohort };
};

interface CertificateResponse { data: VerifiedCertificate }

export default function VerifyCertificatePage() {
  const params = useParams();
  const code = params.code as string;
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<VerifiedCertificate | null>(null);
  const [error, setError] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card p-8 rounded-2xl shadow-xl text-center border border-destructive/20">
          <XCircle className="h-20 w-20 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Certificado Inválido</h1>
          <p className="text-muted-foreground mb-6">
            No pudimos encontrar un certificado asociado al código brindado ({code}).
            Es posible que el código sea incorrecto o el certificado no exista.
          </p>
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
      </div>

      {/* Botones de acción fuera del diploma */}
      <div className="mt-8 flex gap-4">
        <Button onClick={() => window.open(`/verify/${code}/print`, '_blank')} className="bg-primary hover:bg-primary/90 text-white px-8">
          Imprimir / Guardar en PDF
        </Button>
        <div className="bg-green-500/10 text-green-700 px-4 py-2 rounded-md flex items-center gap-2 border border-green-500/20">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="font-semibold">Certificado Auténtico</span>
        </div>
      </div>
    </div>
  );
}
