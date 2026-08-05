"use client";

import { useEffect, useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import {
  Loader2,
  Award,
  ExternalLink,
  Printer,
  GraduationCap,
  Calendar,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MyCertificate {
  id: string;
  code: string;
  issueDate: string;
  enrollment: {
    cohort: {
      name: string;
      startDate: string;
      endDate: string;
      course: {
        name: string;
        code: string;
        level: string;
        imageUrl?: string | null;
      };
    };
  };
}

export default function MyCertificatesPage() {
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<MyCertificate[]>([]);
  const [error, setError] = useState("");

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const res = await fetchApi("/certificates/me");
      setCertificates(res.data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar certificados"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCertificates();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      BEGINNER: "bg-green-500/10 text-green-600 dark:text-green-400",
      INTERMEDIATE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      ADVANCED: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    };
    const labels: Record<string, string> = {
      BEGINNER: "Básico",
      INTERMEDIATE: "Intermedio",
      ADVANCED: "Avanzado",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[level] || "bg-muted text-muted-foreground"}`}
      >
        {labels[level] || level}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Cargando tus certificados...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border border-primary/20 rounded-2xl p-6 md:p-8">
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          Mis Certificados
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Aquí encontrarás todos los certificados que has obtenido al completar
          tus cursos. Puedes visualizar, imprimir o compartir cada diploma.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-6 rounded-full bg-muted/50 mb-6">
            <Award className="h-16 w-16 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Aún no tienes certificados
          </h3>
          <p className="text-muted-foreground max-w-md">
            Completa tus cursos para obtener certificados de finalización. Una
            vez completados, aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="group relative rounded-2xl border border-border/50 bg-card glass overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Top decorative gradient */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

              {/* Award Badge */}
              <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Award className="h-20 w-20" />
              </div>

              <div className="p-6 pt-8">
                {/* Course Name */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg leading-tight line-clamp-2">
                      {cert.enrollment.cohort.course.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {cert.enrollment.cohort.name}
                    </p>
                  </div>
                </div>

                {/* Level Badge */}
                <div className="mb-4">
                  {getLevelBadge(cert.enrollment.cohort.course.level)}
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm text-muted-foreground border-t border-border/50 pt-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-500" />
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {cert.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Emitido:{" "}
                      {new Date(cert.issueDate).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-6">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() =>
                      window.open(`/verify/${cert.code}`, "_blank")
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver Diploma
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const w = window.open(`/verify/${cert.code}`, "_blank");
                      setTimeout(() => w?.print(), 1000);
                    }}
                    title="Imprimir"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
