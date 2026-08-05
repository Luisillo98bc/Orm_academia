"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, MessageSquare, PlayCircle, BookOpen, Download, BarChart3, TrendingUp, Video } from "lucide-react";
import { EvaluateTeacherModal } from "@/components/student/evaluate-teacher-modal";
import { SubmitDeliverableModal } from "@/components/student/submit-deliverable-modal";
import { WeeklyTaskTracker } from "@/components/student/weekly-task-tracker";
import type {
  AttendanceRecord,
  Certificate,
  ClassSession,
  Cohort,
  Enrollment,
  Evaluation,
  Material,
  ProgressGrade,
  StudentProgress,
  SyllabusModule,
} from "@/types/domain";


export default function StudentCourseDetailPage() {
  const params = useParams();
  const cohortId = params.id as string;
  
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]); // Para evaluaciones sueltas
  const [loading, setLoading] = useState(true);
  
  const [selectedModule, setSelectedModule] = useState<SyllabusModule | null>(null);
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);
  const [isEvaluateOpen, setIsEvaluateOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [isEmitting, setIsEmitting] = useState(false);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allCohorts, mods, evals, myEnrollments, myCertificates] = await Promise.all([
        fetchApi("/academic/cohorts"),
        fetchApi(`/academic/cohorts/${cohortId}/modules`),
        fetchApi(`/evaluations/cohort/${cohortId}`),
        fetchApi("/academic/enrollments/me"),
        fetchApi("/certificates/me").catch(() => null) // Prevent crash if endpoint is not ready
      ]);
      
      const currentCohort = allCohorts.find((candidate: Cohort) => candidate.id === cohortId);
      setCohort(currentCohort);
      setModules(mods || []);

      const myEnrollment = myEnrollments?.data?.find((item: Enrollment) => item.cohortId === cohortId);
      setEnrollment(myEnrollment || null);

      if (myCertificates?.data && myEnrollment) {
        const cert = myCertificates.data.find((item: Certificate) => item.enrollmentId === myEnrollment.id);
        setCertificate(cert || null);
      }
      
      // EvaluationController returns { data: [...] } unlike other endpoints
      const evalsData = evals?.data || evals || [];
      setEvaluations(Array.isArray(evalsData) ? evalsData : []);
      
      if (mods && mods.length > 0) {
        setSelectedModule(mods[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

    const loadDataEffect = useEffectEvent(loadData);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDataEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cohortId]);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!cohort) {
    return <div className="p-8 text-center text-red-500 font-bold">Clase no encontrada</div>;
  }

  const handleEmitCertificate = async () => {
    if (!enrollment) return;
    setIsEmitting(true);
    try {
      await fetchApi("/certificates/auto", {
        method: "POST",
        body: JSON.stringify({ enrollmentId: enrollment.id }),
      });
      loadData();
    } catch (err: unknown) {
      alert("Error al emitir certificado: " + getErrorMessage(err));
    } finally {
      setIsEmitting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[80vh]">
      {/* ── PANEL IZQUIERDO: SYLLABUS ── */}
      <div className="w-full md:w-1/3 lg:w-1/4 space-y-4">
        <div className="glass p-4 rounded-xl border border-border sticky top-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Temario
          </h3>
          <div className="space-y-2">
            {modules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay módulos publicados.</p>
            ) : (
              modules.map((mod, idx) => (
                <button
                  key={mod.id}
                  onClick={() => setSelectedModule(mod)}
                  className={`w-full text-left p-3 rounded-lg transition-all text-sm font-medium ${
                    selectedModule?.id === mod.id 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Semana {idx + 1}: {mod.title}
                </button>
              ))
            )}
            
            <hr className="my-4 border-border/50" />
            <button
              onClick={() => setSelectedModule(null)}
              className={`w-full text-left p-3 rounded-lg transition-all text-sm font-medium ${
                selectedModule === null && !showProgress
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              Ver Tareas y Evaluaciones
            </button>
            <button
              onClick={async () => {
                setShowProgress(true);
                setSelectedModule(null);
                if (!progress) {
                  setProgressLoading(true);
                  try {
                    const data = await fetchApi(`/academic/cohorts/${cohortId}/my-progress`);
                    setProgress(data);
                  } catch (err) { console.error(err); }
                  finally { setProgressLoading(false); }
                }
              }}
              className={`w-full text-left p-3 rounded-lg transition-all text-sm font-medium flex items-center gap-2 ${
                showProgress
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="h-4 w-4" /> Mi Progreso
            </button>
          </div>
        </div>
      </div>

      {/* ── PANEL DERECHO: CONTENIDO ── */}
      <div className="w-full md:w-2/3 lg:w-3/4 space-y-6">
        <div className="border-b border-border/50 pb-6 flex justify-between items-start">
          <div>
            <span className="text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md mb-2 inline-block">
              {cohort.name}
            </span>
            <h2 className="text-3xl font-bold tracking-tight">{cohort.course?.name}</h2>
            {enrollment?.status === "COMPLETED" && !certificate && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="font-bold text-yellow-600 mb-2">¡Felicidades, has completado este curso!</p>
                <Button onClick={handleEmitCertificate} disabled={isEmitting} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  {isEmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Emitir Certificado Automático
                </Button>
              </div>
            )}
            {certificate && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-green-600">Certificado Emitido</p>
                  <p className="text-sm text-green-700/80">Código: {certificate.code}</p>
                </div>
                <Link href={`/verify/${certificate.code}`} target="_blank">
                  <Button className="bg-green-600 hover:bg-green-700 text-white">Ver Certificado</Button>
                </Link>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/dashboard/classes/${cohortId}/forum`}>
              <Button variant="outline" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Foro
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setIsEvaluateOpen(true)}>
              Evaluar Docente
            </Button>
          </div>
        </div>

        {/* BANNER CLASE EN VIVO (GOOGLE MEET) */}
        {cohort.googleMeetLink && (
          <div className="bg-gradient-to-r from-blue-600/15 via-indigo-600/15 to-purple-600/15 border border-blue-500/30 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm mb-6">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
                <Video className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                  Clase en Vivo de la Semana
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                    EN DIRECTO / GOOGLE MEET
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conéctate al aula virtual interactiva para hacer preguntas en directo a tu docente.
                </p>
              </div>
            </div>
            <a href={cohort.googleMeetLink} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-md">
                <Video className="h-4 w-4" />
                Unirse a la Clase en Vivo
              </Button>
            </a>
          </div>
        )}

        {showProgress ? (
          <div className="space-y-6 animate-fade-in-up">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Mi Progreso
            </h3>
            {progressLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : progress ? (
              <>
                {/* Progress KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-border/50 bg-card text-center">
                    <p className="text-3xl font-bold text-primary">{progress.progressPercent}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Completado</p>
                    <div className="h-2 bg-muted rounded-full mt-2"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress.progressPercent}%` }} /></div>
                  </div>
                  <div className="p-4 rounded-xl border border-border/50 bg-card text-center">
                    <p className="text-3xl font-bold text-emerald-500">{progress.averageScore}</p>
                    <p className="text-xs text-muted-foreground mt-1">Nota Promedio</p>
                  </div>
                  <div className="p-4 rounded-xl border border-border/50 bg-card text-center">
                    <p className="text-3xl font-bold text-blue-500">{progress.attendance.rate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Asistencia</p>
                  </div>
                  <div className="p-4 rounded-xl border border-border/50 bg-card text-center">
                    <p className="text-3xl font-bold">{progress.completedModules}/{progress.modules}</p>
                    <p className="text-xs text-muted-foreground mt-1">Módulos</p>
                  </div>
                </div>

                {/* Grades Table */}
                <div className="rounded-xl border border-border/50 bg-card">
                  <div className="p-4 border-b border-border/30">
                    <h4 className="font-semibold">Calificaciones</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Evaluación</th>
                          <th className="text-center px-4 py-2 font-medium">Peso</th>
                          <th className="text-center px-4 py-2 font-medium">Nota</th>
                          <th className="text-center px-4 py-2 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.grades.map((g: ProgressGrade) => (
                          <tr key={g.evaluationId} className="border-t border-border/20">
                            <td className="px-4 py-3">{g.title}</td>
                            <td className="px-4 py-3 text-center">{g.weight}%</td>
                            <td className="px-4 py-3 text-center font-bold">
                              {g.score !== null ? `${g.score}/${g.maxScore}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                g.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-600' :
                                g.status === 'PENDING' ? 'bg-amber-500/10 text-amber-600' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {g.status === 'PUBLISHED' ? 'Publicada' : g.status === 'PENDING' ? 'Pendiente' : 'Sin Entregar'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Attendance */}
                <div className="rounded-xl border border-border/50 bg-card p-4">
                  <h4 className="font-semibold mb-3">Historial de Asistencia</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {progress.attendance.records.map((r: AttendanceRecord, i: number) => (
                      <div
                        key={i}
                        title={`${new Date(r.date).toLocaleDateString()} - ${r.isPresent ? 'Presente' : r.isExcused ? 'Justificado' : 'Ausente'}`}
                        className={`w-6 h-6 rounded text-[9px] flex items-center justify-center font-bold ${
                          r.isPresent ? 'bg-emerald-500/20 text-emerald-600' :
                          r.isExcused ? 'bg-amber-500/20 text-amber-600' :
                          'bg-red-500/20 text-red-600'
                        }`}
                      >
                        {r.isPresent ? '✓' : r.isExcused ? 'J' : '✗'}
                      </div>
                    ))}
                    {progress.attendance.records.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sin registros de asistencia</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/20" /> Presente</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/20" /> Justificado</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/20" /> Ausente</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No se pudo cargar el progreso</p>
            )}
          </div>
        ) : selectedModule ? (
          <div className="space-y-8 animate-fade-in-up">
            <div>
              <h3 className="text-2xl font-bold mb-2">{selectedModule.title}</h3>
              <p className="text-muted-foreground">{selectedModule.description}</p>
            </div>
            
            {/* Clases en Vivo / Grabaciones */}
            <section>
              <h4 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <PlayCircle className="h-5 w-5 text-primary" /> Clases en Vivo & Grabaciones
              </h4>
              {selectedModule.sessions?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No hay clases registradas aún.</p>
              ) : (
                <div className="grid gap-4">
                  {selectedModule.sessions?.map((session: ClassSession) => (
                    <div key={session.id} className="glass p-4 rounded-xl border border-border flex justify-between items-center">
                      <div>
                        <p className="font-bold">{session.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(session.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        {session.meetLink && (
                          <a href={session.meetLink} target="_blank" rel="noreferrer">
                            <Button size="sm">Unirse a Meet</Button>
                          </a>
                        )}
                        {session.recordingUrl && (
                          <a href={session.recordingUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">Ver Grabación</Button>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Materiales */}
            <section>
              <h4 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Download className="h-5 w-5 text-primary" /> Material de Estudio
              </h4>
              {selectedModule.materials?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No hay materiales de estudio.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedModule.materials?.map((mat: Material) => (
                    <a key={mat.id} href={mat.fileUrl} target="_blank" rel="noreferrer" className="glass p-4 rounded-xl border border-border hover:border-primary/50 transition-colors flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary opacity-80" />
                      <div>
                        <p className="font-bold text-sm">{mat.title}</p>
                        <p className="text-xs text-muted-foreground">{mat.type}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in-up">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Mis Tareas y Entregables Semanales
            </h3>
            
            <WeeklyTaskTracker evaluations={evaluations} onRefresh={loadData} />
          </div>
        )}

      </div>

      {selectedEval && (
        <SubmitDeliverableModal
          isOpen={true}
          onClose={() => setSelectedEval(null)}
          onSuccess={() => { loadData(); setSelectedEval(null); }}
          evaluation={selectedEval}
        />
      )}

      <EvaluateTeacherModal 
        isOpen={isEvaluateOpen}
        onClose={() => setIsEvaluateOpen(false)}
        cohort={cohort}
      />
    </div>
  );
}
