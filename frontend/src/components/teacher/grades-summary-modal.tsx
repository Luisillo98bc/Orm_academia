"use client";

import { Modal } from "@/components/ui/modal";
import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Printer,
  Award,
} from "lucide-react";
import type { Cohort, Deliverable, Evaluation, User } from "@/types/domain";
import { toast } from "sonner";

interface GradeSummaryCell {
  score: number | null;
  feedback: string | null;
  status: string;
}

interface StudentGradeSummary {
  student: User;
  gradesMap: Record<string, GradeSummaryCell>;
  finalGrade: number;
  isPassed: boolean;
  attendanceRate: number;
  totalClasses: number;
  presentCount: number;
}

interface GradesSummaryData {
  evaluations: Evaluation[];
  studentsSummary: StudentGradeSummary[];
  totalWeight: number;
}

export function GradesSummaryModal({
  isOpen,
  onClose,
  cohort,
}: {
  isOpen: boolean;
  onClose: () => void;
  cohort: Cohort;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GradesSummaryData | null>(null);
  const [issuingCertificate, setIssuingCertificate] = useState<string | null>(
    null,
  );

  const loadGradesSummary = async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await fetchApi(`/academic/cohorts/${cohort.id}/grades-summary`);
      } catch {
        try {
          res = await fetchApi(
            `/evaluations/cohort/${cohort.id}/grades-summary`,
          );
        } catch {
          // Fallback resiliente en frontend si el proceso backend está desactualizado
          const [studentsList, evaluationsRaw] = await Promise.all([
            fetchApi(`/academic/cohorts/${cohort.id}/students`).catch(
              () => cohort.students || [],
            ),
            fetchApi(`/evaluations/cohort/${cohort.id}`).catch(() => []),
          ]);

          const evaluations = Array.isArray(evaluationsRaw)
            ? evaluationsRaw
            : evaluationsRaw?.data || [];
          const students = Array.isArray(studentsList) ? studentsList : [];
          const totalWeight = evaluations.reduce(
            (acc: number, evaluation: Evaluation) =>
              acc + (evaluation.weight || 0),
            0,
          );

          const studentsSummary = students.map((student: User) => {
            let weightedScore = 0;
            const gradesMap: Record<string, GradeSummaryCell> = {};

            evaluations.forEach((ev: Evaluation) => {
              const deliverables = ev.deliverables || [];
              const deliverable = deliverables.find(
                (item: Deliverable) => item.studentId === student.id,
              );
              const grade = deliverable?.grade;

              if (grade && grade.score !== undefined && grade.score !== null) {
                const normScore =
                  (grade.score / (ev.maxScore || 20)) * (ev.weight || 0);
                weightedScore += normScore;
                gradesMap[ev.id] = {
                  score: grade.score,
                  feedback: grade.feedback ?? null,
                  status: grade.status || "GRADED",
                };
              } else if (deliverable) {
                gradesMap[ev.id] = {
                  score: null,
                  feedback: null,
                  status: "PENDING_GRADE",
                };
              } else {
                gradesMap[ev.id] = {
                  score: null,
                  feedback: null,
                  status: "NOT_SUBMITTED",
                };
              }
            });

            const finalGrade =
              totalWeight > 0
                ? Math.round((weightedScore / totalWeight) * 20 * 100) / 100
                : 0;

            return {
              student,
              gradesMap,
              finalGrade,
              isPassed: finalGrade >= 13,
              attendanceRate: 100,
              totalClasses: 0,
              presentCount: 0,
            };
          });

          res = {
            evaluations,
            studentsSummary,
            totalWeight,
          };
        }
      }
      setData(res);
    } catch (err) {
      console.error("Error al cargar acta de notas:", err);
    } finally {
      setLoading(false);
    }
  };

  const issueCertificate = async (
    studentId: string,
    certificateType: "GRADES" | "COMPLETION",
  ) => {
    setIssuingCertificate(`${studentId}:${certificateType}`);
    try {
      await fetchApi(`/certificates/cohort/${cohort.id}/student/${studentId}`, {
        method: "POST",
        body: JSON.stringify({ certificateType }),
      });
      toast.success(
        certificateType === "GRADES"
          ? "Certificado de notas emitido correctamente."
          : "Certificado de finalización emitido correctamente.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo emitir el certificado.",
      );
    } finally {
      setIssuingCertificate(null);
    }
  };

  const loadGradesSummaryEffect = useEffectEvent(loadGradesSummary);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (isOpen && cohort?.id) {
        loadGradesSummaryEffect();
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, cohort]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <Modal title="Resumen de notas" onClose={() => { if (!loading) onClose(); }}>

      {/* Estilos CSS Exclusivos para Impresión de Acta de Notas */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-grades-summary,
          #printable-grades-summary * {
            visibility: visible;
          }
          #printable-grades-summary {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <Card className="w-full max-w-5xl bg-card border-border shadow-2xl relative rounded-2xl max-h-[90vh] flex flex-col">
        <button aria-label="Cerrar ventana"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted no-print"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="pb-3 border-b border-border/40 shrink-0 no-print">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Acta Oficial de Notas y Promedios Finales
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="mr-8 rounded-xl gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Acta de Notas</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {cohort?.course?.name} — {cohort?.name}
          </p>
        </CardHeader>

        <CardContent
          className="pt-4 flex-1 overflow-y-auto space-y-4"
          id="printable-grades-summary"
        >
          {/* Cabecera Oficial de Impresión */}
          <div className="hidden print:block mb-6 text-center border-b pb-4">
            <h1 className="text-2xl font-black uppercase tracking-wider">
              ACADEMIA VIRTUAL — ACTA CONSOLIDADA DE NOTAS
            </h1>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Curso: <strong>{cohort?.course?.name}</strong> | Cohorte:{" "}
              <strong>{cohort?.name}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Fecha de Emisión:{" "}
              <strong>{new Date().toLocaleDateString("es-ES")}</strong> | Escala
              Evaluativa: <strong>Vigesimal (0 - 20)</strong>
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 no-print">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">
                Calculando promedios y consolidado de evaluaciones...
              </p>
            </div>
          ) : !data || data.studentsSummary?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No hay estudiantes matriculados o evaluaciones registradas en esta
              cohorte.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
                  <p className="text-xs text-muted-foreground font-semibold">
                    Total Alumnos
                  </p>
                  <p className="text-2xl font-black text-foreground">
                    {data.studentsSummary.length}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    Aprobados (≥13)
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {
                      data.studentsSummary.filter((student) => student.isPassed)
                        .length
                    }
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5">
                  <p className="text-xs text-red-600 dark:text-red-400 font-semibold">
                    Desaprobados (&lt;13)
                  </p>
                  <p className="text-2xl font-black text-red-600 dark:text-red-400">
                    {
                      data.studentsSummary.filter(
                        (student) => !student.isPassed,
                      ).length
                    }
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
                  <p className="text-xs text-muted-foreground font-semibold">
                    Tareas Publicadas
                  </p>
                  <p className="text-2xl font-black text-foreground">
                    {data.evaluations.length}
                  </p>
                </div>
              </div>

              {/* Grades Table */}
              <div className="border border-border/60 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/70 text-foreground font-bold uppercase border-b border-border/60">
                      <tr>
                        <th className="p-3 min-w-[180px]">Estudiante</th>
                        <th className="p-3 text-center">Asistencia</th>
                        {data.evaluations.map((ev: Evaluation) => (
                          <th
                            key={ev.id}
                            className="p-3 text-center min-w-[100px]"
                            title={ev.title}
                          >
                            <div>{ev.title}</div>
                            <span className="text-[10px] text-muted-foreground normal-case font-normal">
                              ({ev.weight}%)
                            </span>
                          </th>
                        ))}
                        <th className="p-3 text-center bg-primary/10 text-primary font-black min-w-[100px]">
                          Promedio Final
                        </th>
                        <th className="p-3 text-center">Estado</th>
                        <th className="p-3 text-center no-print">
                          Certificados
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {data.studentsSummary.map((item: StudentGradeSummary) => (
                        <tr
                          key={item.student.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3 font-semibold text-foreground">
                            <div>
                              {item.student.firstName} {item.student.lastName}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-normal">
                              {item.student.email}
                            </span>
                          </td>
                          <td className="p-3 text-center font-semibold">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] ${
                                item.attendanceRate >= 80
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {item.attendanceRate}%
                            </span>
                          </td>

                          {data.evaluations.map((ev: Evaluation) => {
                            const gradeInfo = item.gradesMap[ev.id];
                            const score = gradeInfo?.score;

                            return (
                              <td
                                key={ev.id}
                                className="p-3 text-center font-medium"
                              >
                                {score !== null && score !== undefined ? (
                                  <span className="font-bold text-foreground">
                                    {score} / {ev.maxScore || 20}
                                  </span>
                                ) : gradeInfo?.status === "PENDING_GRADE" ? (
                                  <span className="text-amber-500 italic text-[11px]">
                                    Por calificar
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[11px] italic">
                                    Sin entrega
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          <td className="p-3 text-center bg-primary/5 font-black text-sm text-primary">
                            {item.finalGrade} / 20
                          </td>

                          <td className="p-3 text-center">
                            {item.isPassed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> Aprobado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400">
                                <XCircle className="h-3 w-3" /> Desaprobado
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center no-print">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={
                                !item.isPassed || issuingCertificate !== null
                              }
                              onClick={() =>
                                void issueCertificate(item.student.id, "GRADES")
                              }
                              title={
                                !item.isPassed
                                  ? "Disponible para estudiantes aprobados"
                                  : "Emitir certificado de notas"
                              }
                            >
                              {issuingCertificate ===
                              `${item.student.id}:GRADES` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Award className="h-3 w-3" />
                              )}
                              Notas
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={
                                !item.isPassed || issuingCertificate !== null
                              }
                              onClick={() =>
                                void issueCertificate(
                                  item.student.id,
                                  "COMPLETION",
                                )
                              }
                              title={
                                !item.isPassed
                                  ? "Disponible para estudiantes aprobados"
                                  : "Emitir certificado de finalización"
                              }
                            >
                              {issuingCertificate ===
                              `${item.student.id}:COMPLETION` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              Curso
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Firmas Oficiales para Impresión de Acta */}
          <div className="hidden print:flex justify-between pt-16 text-center text-xs font-bold mt-12">
            <div className="border-t border-black w-48 pt-2">
              Firma del Docente Titular
            </div>
            <div className="border-t border-black w-48 pt-2">
              Firma de Dirección Académica
            </div>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
