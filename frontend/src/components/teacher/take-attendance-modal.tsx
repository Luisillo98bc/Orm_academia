"use client";

import { Modal } from "@/components/ui/modal";
import type { AttendanceRecord, ClassSession, Cohort, User } from "@/types/domain";

import { useState, useEffect, useEffectEvent } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X, Check, X as XIcon, AlertCircle, Calendar, Printer, Edit3 } from "lucide-react";
import { toast } from "sonner";

export function TakeAttendanceModal({
  isOpen,
  onClose,
  cohort,
  sessions,
}: {
  isOpen: boolean;
  onClose: () => void;
  cohort: Cohort;
  sessions: ClassSession[];
}) {
  type AttendanceState = {
    isPresent: boolean;
    isExcused: boolean;
    isMarked: boolean;
    observation: string;
  };

  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [students, setStudents] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>({});
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const activeSessionId = sessions.some((session) => session.id === selectedSessionId)
    ? selectedSessionId
    : sessions[0]?.id || "";
  const selectedSession = sessions.find((session) => session.id === activeSessionId);
  const sessionDate = selectedSession ? new Intl.DateTimeFormat('en-CA', { timeZone: selectedSession.timeZone || 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(selectedSession.date)) : "";

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      // La lista se consulta aunque todavía no exista una sesión para
      // distinguir "sin clase programada" de "sin matrícula".
      const [studentList, records] = await Promise.all([
        fetchApi(`/academic/cohorts/${cohort.id}/students`),
        selectedSession
          ? fetchApi(
              `/academic/cohorts/${cohort.id}/attendance?date=${sessionDate}&sessionId=${encodeURIComponent(selectedSession.id)}`,
            )
          : Promise.resolve([]),
      ]);
      const safeStudents: User[] = Array.isArray(studentList) ? studentList : [];
      const safeRecords: AttendanceRecord[] = Array.isArray(records) ? records : [];
      setStudents(safeStudents);

      setHasExistingRecord(safeRecords.length > 0);

      const newAttendance: Record<string, AttendanceState> = {};
      safeStudents.forEach((s: User) => {
        const record = safeRecords.find((r: AttendanceRecord) => r.studentId === s.id);
        newAttendance[s.id] = {
          isPresent: record?.isPresent ?? false,
          isExcused: record ? record.isExcused || false : false,
          isMarked: Boolean(record),
          observation: record?.observation || "",
        };
      });
      setAttendance(newAttendance);
    } catch (err) {
      console.error("Error al cargar asistencia:", err);
      setStudents([]);
      setAttendance({});
      setHasExistingRecord(false);
      setLoadError(getErrorMessage(err, "No se pudo cargar la lista de asistencia"));
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
  }, [isOpen, selectedSessionId, cohort]);

  const handleSave = async () => {
    if (!selectedSession) {
      toast.error("Selecciona una sesión de clase antes de guardar la asistencia");
      return;
    }

    const markedRecords = Object.entries(attendance).filter(([, state]) => state.isMarked);
    if (markedRecords.length === 0) {
      toast.error("Marca al menos un estudiante antes de guardar la asistencia");
      return;
    }

    setSaving(true);
    try {
      const records = markedRecords.map(([studentId, state]) => ({
        studentId,
        isPresent: state.isPresent,
        isExcused: state.isExcused,
        observation: state.observation.trim() || undefined,
      }));

      await fetchApi(`/academic/cohorts/${cohort.id}/attendance-bulk`, {
        method: "POST",
        body: JSON.stringify({ date: sessionDate, sessionId: selectedSession.id, records }),
      });

      setHasExistingRecord(true);
      toast.success("Asistencia guardada correctamente");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al guardar asistencia"));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const presentCount = Object.values(attendance).filter((a) => a.isMarked && a.isPresent).length;
  const excusedCount = Object.values(attendance).filter((a) => a.isMarked && !a.isPresent && a.isExcused).length;
  const absentCount = Object.values(attendance).filter((a) => a.isMarked && !a.isPresent && !a.isExcused).length;
  const unmarkedCount = Object.values(attendance).filter((a) => !a.isMarked).length;

  return (
    <Modal title="Registrar asistencia" onClose={() => { if (!saving) onClose(); }}>

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
        <button aria-label="Cerrar ventana"
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
            <p className="mt-1 text-sm font-semibold text-foreground">
              Curso: <strong>{cohort?.course?.name}</strong> | Cohorte: <strong>{cohort?.name}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Sesión: <strong>{selectedSession?.title}</strong> | Fecha: <strong>{sessionDate}</strong> | Total Matriculados: <strong>{students.length}</strong>
            </p>
          </div>

          {/* Selector de Sesión e Indicador de Edición */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border border-border/50 no-print">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label htmlFor="teacher-take-attendance-modal-0" className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                Sesión de Clase:
              </label>
              <select
 id="teacher-take-attendance-modal-0"                value={activeSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                disabled={sessions.length === 0}
                aria-label="Seleccionar sesión de clase"
                className="flex h-10 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/40 outline-none"
              >
                {sessions.length === 0 ? (
                  <option value="">No hay sesiones programadas</option>
                ) : (
                  sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title} — {new Date(session.date).toLocaleDateString()}
                    </option>
                  ))
                )}
              </select>
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
          <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold no-print sm:grid-cols-4">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Presentes: {presentCount}
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Justificados: {excusedCount}
            </div>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              Ausentes: {absentCount}
            </div>
            <div className="rounded-xl border border-border bg-muted/50 p-2 text-muted-foreground">
              Sin marcar: {unmarkedCount}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center" role="alert">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
              <p className="text-sm font-medium text-destructive">{loadError}</p>
              <Button variant="outline" size="sm" onClick={loadData} className="mt-4">
                Reintentar
              </Button>
            </div>
          ) : sessions.length === 0 && students.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">
                No hay sesiones programadas para esta cohorte.
              </p>
              <p className="mt-2">
                {students.length > 0
                  ? `${students.length} estudiante(s) matriculado(s) activo(s). Programa primero una clase para poder tomar asistencia.`
                  : "Programa primero una clase y verifica que existan matrículas activas para esta cohorte."}
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm">
              <AlertCircle className="mx-auto mb-3 h-6 w-6 text-amber-500" />
              <p className="font-semibold text-foreground">
                No hay estudiantes con matrícula activa en esta cohorte.
              </p>
              <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
                Crear la cuenta del estudiante no lo matricula automáticamente. Administración o RRHH debe matricularlo en esta cohorte exacta y aprobar el pago si corresponde.
              </p>
              <Button variant="outline" size="sm" onClick={loadData} className="mt-4">
                Actualizar lista
              </Button>
            </div>
          ) : (
            <>
              {sessions.length === 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm" role="status">
                  <p className="font-semibold text-foreground">Hay {students.length} estudiantes matriculados.</p>
                  <p className="mt-1 text-muted-foreground">Programa una sesión de clase para habilitar los botones y guardar la asistencia.</p>
                </div>
              )}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {students.map((student: User, idx: number) => {
                const state = attendance[student.id] || { isPresent: false, isExcused: false, isMarked: false, observation: "" };

                return (
                  <div
                    key={student.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground">
                        {idx + 1}. {student.firstName} {student.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                      {!state.isMarked && <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">Pendiente de marcar</p>}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 no-print">
                      <Button
                        size="sm"
                        disabled={!selectedSession}
                        variant={state.isMarked && state.isPresent ? "default" : "outline"}
                        className={state.isMarked && state.isPresent ? "bg-emerald-600 font-bold text-white hover:bg-emerald-700" : "text-xs"}
                        onClick={() =>
                          setAttendance((prev) => ({
                            ...prev,
                            [student.id]: { ...prev[student.id], isPresent: true, isExcused: false, isMarked: true },
                          }))
                        }
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Presente
                      </Button>

                      <Button
                        size="sm"
                        disabled={!selectedSession}
                        variant={state.isMarked && !state.isPresent && state.isExcused ? "default" : "outline"}
                        className={!state.isPresent && state.isExcused ? "bg-amber-600 hover:bg-amber-700 text-white font-bold" : "text-xs"}
                        onClick={() =>
                          setAttendance((prev) => ({
                            ...prev,
                            [student.id]: { ...prev[student.id], isPresent: false, isExcused: true, isMarked: true },
                          }))
                        }
                      >
                        <AlertCircle className="h-3.5 w-3.5 mr-1" /> Justificado
                      </Button>

                      <Button
                        size="sm"
                        disabled={!selectedSession}
                        variant={state.isMarked && !state.isPresent && !state.isExcused ? "destructive" : "outline"}
                        className="text-xs font-bold"
                        onClick={() =>
                          setAttendance((prev) => ({
                            ...prev,
                            [student.id]: { ...prev[student.id], isPresent: false, isExcused: false, isMarked: true },
                          }))
                        }
                      >
                        <XIcon className="h-3.5 w-3.5 mr-1" /> Ausente
                      </Button>
                    </div>

                    <Input
                      value={state.observation}
                      disabled={!selectedSession}
                      onChange={(event) =>
                        setAttendance((prev) => ({
                          ...prev,
                          [student.id]: { ...state, observation: event.target.value },
                        }))
                      }
                      placeholder="Observación opcional"
                      aria-label={`Observación de ${student.firstName} ${student.lastName}`}
                      className="basis-full sm:basis-auto sm:flex-1"
                    />

                    {/* Estado Imprimible */}
                    <div className="hidden print:block font-bold text-xs">
                      {!state.isMarked
                        ? "SIN MARCAR [ — ]"
                        : state.isPresent
                          ? "PRESENTE [ X ]"
                          : state.isExcused
                            ? "JUSTIFICADO [ J ]"
                            : "AUSENTE [ A ]"}
                    </div>
                  </div>
                );
              })}
              </div>
            </>
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
            <Button onClick={handleSave} disabled={saving || loading || !selectedSession} className="rounded-xl px-6">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {hasExistingRecord ? "Guardar Cambios de Asistencia" : "Guardar Asistencia"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
