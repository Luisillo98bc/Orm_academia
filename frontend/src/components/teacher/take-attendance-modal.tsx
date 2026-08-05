"use client";

import type { AttendanceRecord, Cohort, User } from "@/types/domain";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X, Check, X as XIcon, AlertCircle, Calendar, Printer, Edit3 } from "lucide-react";

export function TakeAttendanceModal({
  isOpen,
  onClose,
  cohort,
}: {
  isOpen: boolean;
  onClose: () => void;
  cohort: Cohort;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Record<string, { isPresent: boolean; isExcused: boolean }>>({});
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Obtener lista de alumnos matriculados
      const studentList = await fetchApi(`/academic/cohorts/${cohort.id}/students`).catch(() => cohort.students || []);
      setStudents(studentList || []);

      // 2. Obtener asistencia registrada para la fecha seleccionada
      const records = await fetchApi(`/academic/cohorts/${cohort.id}/attendance?date=${date}`).catch(() => []);
      
      setHasExistingRecord(records && records.length > 0);

      const newAttendance: Record<string, { isPresent: boolean; isExcused: boolean }> = {};
      (studentList || []).forEach((s: User) => {
        const record = records?.find((r: AttendanceRecord) => r.studentId === s.id);
        newAttendance[s.id] = {
          isPresent: record ? record.isPresent : true,
          isExcused: record ? record.isExcused || false : false,
        };
      });
      setAttendance(newAttendance);
    } catch (err) {
      console.error("Error al cargar asistencia:", err);
    } finally {
      setLoading(false);
    }
  };

    const loadDataEffect = useEffectEvent(loadData);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (isOpen && cohort?.id) {
      loadDataEffect();
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, date, cohort]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = Object.keys(attendance).map((studentId) => ({
        studentId,
        isPresent: attendance[studentId].isPresent,
        isExcused: attendance[studentId].isExcused,
      }));

      await fetchApi(`/academic/cohorts/${cohort.id}/attendance-bulk`, {
        method: "POST",
        body: JSON.stringify({ date, records }),
      });

      setHasExistingRecord(true);
      alert("¡Asistencia guardada/actualizada correctamente!");
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Error al guardar asistencia"));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const presentCount = Object.values(attendance).filter((a) => a.isPresent).length;
  const excusedCount = Object.values(attendance).filter((a) => !a.isPresent && a.isExcused).length;
  const absentCount = Object.values(attendance).filter((a) => !a.isPresent && !a.isExcused).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Estilos CSS Exclusivos para Impresión */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-attendance, #printable-attendance * {
            visibility: visible;
          }
          #printable-attendance {
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

      <Card className="w-full max-w-3xl bg-card border-border shadow-2xl relative rounded-2xl max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted no-print"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="pb-3 border-b border-border/40 shrink-0 no-print">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Calendar className="h-5 w-5 text-primary" />
              Toma y Control de Asistencia
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="mr-8 rounded-xl gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Lista</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {cohort?.course?.name || "Curso"} — {cohort?.name} ({students.length} estudiantes)
          </p>
        </CardHeader>

        <CardContent className="pt-4 flex-1 overflow-y-auto space-y-4" id="printable-attendance">
          {/* Cabecera Oficial Imprimible */}
          <div className="hidden print:block mb-6 text-center border-b pb-4">
            <h1 className="text-2xl font-black uppercase tracking-wider">ACADEMIA VIRTUAL — PLANILLA DE ASISTENCIA</h1>
            <p className="text-sm font-semibold text-gray-700 mt-1">
              Curso: <strong>{cohort?.course?.name}</strong> | Cohorte: <strong>{cohort?.name}</strong>
            </p>
            <p className="text-xs text-gray-600">
              Fecha de Sesión: <strong>{date}</strong> | Total Matriculados: <strong>{students.length}</strong>
            </p>
          </div>

          {/* Selector de Fecha e Indicador de Edición */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border border-border/50 no-print">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                Fecha de Clase:
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/40 outline-none"
              />
            </div>

            {hasExistingRecord ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Edit3 className="h-3.5 w-3.5" /> Modo Edición (Asistencia Ya Registrada)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Check className="h-3.5 w-3.5" /> Nueva Sesión de Clase
              </span>
            )}
          </div>

          {/* Resumen KPI Rápido */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold no-print">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Presentes: {presentCount}
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Justificados: {excusedCount}
            </div>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              Ausentes: {absentCount}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No hay estudiantes matriculados activos en esta cohorte.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {students.map((student: User, idx: number) => {
                const state = attendance[student.id] || { isPresent: true, isExcused: false };

                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border border-border/60 rounded-xl bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-sm text-foreground">
                        {idx + 1}. {student.firstName} {student.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>

                    <div className="flex items-center gap-1.5 no-print">
                      <Button
                        size="sm"
                        variant={state.isPresent ? "default" : "outline"}
                        className={state.isPresent ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" : "text-xs"}
                        onClick={() =>
                          setAttendance((prev) => ({
                            ...prev,
                            [student.id]: { isPresent: true, isExcused: false },
                          }))
                        }
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Presente
                      </Button>

                      <Button
                        size="sm"
                        variant={!state.isPresent && state.isExcused ? "default" : "outline"}
                        className={!state.isPresent && state.isExcused ? "bg-amber-600 hover:bg-amber-700 text-white font-bold" : "text-xs"}
                        onClick={() =>
                          setAttendance((prev) => ({
                            ...prev,
                            [student.id]: { isPresent: false, isExcused: true },
                          }))
                        }
                      >
                        <AlertCircle className="h-3.5 w-3.5 mr-1" /> Justificado
                      </Button>

                      <Button
                        size="sm"
                        variant={!state.isPresent && !state.isExcused ? "destructive" : "outline"}
                        className="text-xs font-bold"
                        onClick={() =>
                          setAttendance((prev) => ({
                            ...prev,
                            [student.id]: { isPresent: false, isExcused: false },
                          }))
                        }
                      >
                        <XIcon className="h-3.5 w-3.5 mr-1" /> Ausente
                      </Button>
                    </div>

                    {/* Estado Imprimible */}
                    <div className="hidden print:block font-bold text-xs">
                      {state.isPresent ? "PRESENTE [ X ]" : state.isExcused ? "JUSTIFICADO [ J ]" : "AUSENTE [ A ]"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Firmas Oficiales para Impresión */}
          <div className="hidden print:flex justify-between pt-16 text-center text-xs font-bold mt-12">
            <div className="border-t border-black w-48 pt-2">
              Firma del Docente
            </div>
            <div className="border-t border-black w-48 pt-2">
              Firma de Dirección Académica
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex justify-end gap-3 no-print">
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              Cerrar
            </Button>
            <Button onClick={handleSave} disabled={saving || loading} className="rounded-xl px-6">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {hasExistingRecord ? "Guardar Cambios de Asistencia" : "Guardar Asistencia"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
