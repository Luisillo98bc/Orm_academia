"use client";

import { useEffect, useState } from "react";
import { downloadApiFile, fetchApi, getErrorMessage } from "@/lib/api";
import { Loader2, Award, Download, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface Certificate {
  id: string;
  code: string;
  issueDate: string;
  enrollment: {
    cohort: {
      name: string;
      course: { name: string; imageUrl?: string };
    };
  };
}

export default function MyCertificatesPage() {
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchApi("/certificates/me");
      setCertificates(res.data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar tus certificados"));
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

  const handleDownload = async (code: string) => {
    try {
      await downloadApiFile(`/certificates/${code}/pdf`, `certificado-${code}.pdf`);
    } catch (error) {
      console.error("Error downloading certificate:", error);
      alert("Hubo un problema descargando el certificado.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando tus certificados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
          <Award className="h-8 w-8" />
          Mis Certificados
        </h2>
        <p className="text-muted-foreground mt-1">
          Visualiza y descarga los certificados de los cursos que has completado.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 dark:bg-red-900/20 dark:border-red-900/50">
          {error}
        </div>
      )}

      {certificates.length === 0 && !error ? (
        <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed border-border">
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="h-10 w-10 text-primary opacity-50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Aún no tienes certificados</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Completa tus cursos al 100% para obtener tu certificado de finalización. ¡Sigue aprendiendo!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => (
            <Card key={cert.id} className="overflow-hidden glass transition-all hover:shadow-md hover:scale-[1.02]">
              <div className="h-32 bg-gradient-to-br from-primary/80 to-blue-600 relative p-6 flex flex-col justify-end">
                <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-white">
                  {cert.code}
                </div>
                <h3 className="text-xl font-bold text-white leading-tight drop-shadow-sm line-clamp-2">
                  {cert.enrollment.cohort.course.name}
                </h3>
              </div>
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Emitido el {new Date(cert.issueDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="h-4 w-4" />
                    <span className="truncate">Cohorte: {cert.enrollment.cohort.name}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-5 pt-0 flex gap-2">
                <Button className="w-full gap-2" onClick={() => handleDownload(cert.code)}>
                  <Download className="h-4 w-4" /> Descargar PDF
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.open(`/verify/${cert.code}`, "_blank")} title="Verificar certificado">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
