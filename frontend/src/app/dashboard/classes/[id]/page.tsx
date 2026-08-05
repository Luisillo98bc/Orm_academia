"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { useParams } from "next/navigation";
import { fetchApi, getErrorMessage } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Calendar, FileText, CheckCircle2, MessageSquare, BookOpen, Download, PlayCircle, Plus, Trash2, Users } from "lucide-react";
import { CreateEvaluationModal } from "@/components/teacher/create-evaluation-modal";
import { GradeDeliverableModal } from "@/components/teacher/grade-deliverable-modal";
import { TakeAttendanceModal } from "@/components/teacher/take-attendance-modal";
import { CreateModuleModal } from "@/components/teacher/create-module-modal";
import { AddMaterialModal } from "@/components/teacher/add-material-modal";
import { AddSessionModal } from "@/components/teacher/add-session-modal";
import { GradesSummaryModal } from "@/components/teacher/grades-summary-modal";
import { FileSpreadsheet } from "lucide-react";
import type {
  ClassSession,
  Cohort,
  Deliverable,
  Evaluation,
  Material,
  SyllabusModule,
  User,
} from "@/types/domain";

interface GradingSelection {
  evaluation: Evaluation;
  student: User;
  deliverable: Deliverable;
}

export default function ClassDetailPage() {
  const params = useParams();
  const cohortId = params.id as string;
  
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedModule, setSelectedModule] = useState<SyllabusModule | "students" | null>(null);
  const [isCreateEvalOpen, setIsCreateEvalOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isGradesSummaryOpen, setIsGradesSummaryOpen] = useState(false);
  const [isCreateModuleOpen, setIsCreateModuleOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [gradingDeliverable, setGradingDeliverable] = useState<GradingSelection | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allCohorts, mods, evals, cohortStudents] = await Promise.all([
        fetchApi("/academic/cohorts"),
        fetchApi(`/academic/cohorts/${cohortId}/modules`),
        fetchApi(`/evaluations/cohort/${cohortId}`),
        fetchApi(`/academic/cohorts/${cohortId}/students`)
      ]);
      
      const currentCohort = allCohorts.find((candidate: Cohort) => candidate.id === cohortId);
      if (currentCohort) {
        currentCohort.students = cohortStudents || [];
      }
      setCohort(currentCohort);
      setModules(mods || []);
      
      // EvaluationController returns { data: [...] } unlike other endpoints
      const evalsData = evals?.data || evals || [];
      setEvaluations(Array.isArray(evalsData) ? evalsData : []);
      
      if (mods && mods.length > 0 && !selectedModule) {
        setSelectedModule(mods[0]);
      } else if (mods && mods.length > 0 && selectedModule && selectedModule !== "students") {
        // Refrescar modulo seleccionado
        setSelectedModule(mods.find((module: SyllabusModule) => module.id === selectedModule.id) || mods[0]);
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

  const downloadStudentsCSV = () => {
    if (!cohort || !cohort.students || cohort.students.length === 0) return;
    const headers = ["ID", "Nombre", "Apellido", "Email"];
    const rows = cohort.students.map((student: User) => [
      student.id,
      student.firstName,
      student.lastName,
      student.email
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map((row) => row.map((value) => `"${value}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `estudiantes_${cohort.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este módulo y todo su contenido?")) return;
    try {
      await fetchApi(`/academic/cohorts/modules/${moduleId}`, { method: "DELETE" });
      setSelectedModule(null);
      loadData();
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Error al eliminar módulo"));
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta sesión en vivo?")) return;
    try {
      await fetchApi(`/academic/cohorts/sessions/${sessionId}`, { method: "DELETE" });
      loadData();
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Error al eliminar sesión"));
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este material?")) return;
    try {
      await fetchApi(`/academic/cohorts/materials/${materialId}`, { method: "DELETE" });
      loadData();
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Error al eliminar material"));
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!cohort) {
    return <div className="p-8 text-center text-red-500 font-bold">Cohorte no encontrada</div>;
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[80vh]">
      {/* ── PANEL IZQUIERDO: SYLLABUS ── */}
      <div className="w-full md:w-1/3 lg:w-1/4 space-y-4">
        <div className="glass p-4 rounded-xl border border-border sticky top-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Temario
            </h3>
            <Button size="icon" variant="ghost" onClick={() => setIsCreateModuleOpen(true)} title="Añadir Semana">
              <PlusCircle className="h-5 w-5 text-primary" />
            </Button>
          </div>
          
            {modules.length === 0 ? (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg text-center border border-dashed border-border/60">
                <p className="text-xs text-muted-foreground">Aún no has estructurado este curso en semanas.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const presetWeeks = [
                        { title: "Módulo 1 — Fundamentos y Entorno", description: "Conceptos iniciales, herramientas y configuración de la materia.", order: 1 },
                        { title: "Módulo 2 — Desarrollo y Práctica Core", description: "Profundización teórica y laboratorio práctico de la semana.", order: 2 },
                        { title: "Módulo 3 — Proyectos y Casos Reales", description: "Resolución de casos de estudio y entregables integradores.", order: 3 },
                        { title: "Módulo 4 — Evaluación Final y Cierre", description: "Presentación final del curso y revisión de calificaciones.", order: 4 },
                      ];
                      for (const week of presetWeeks) {
                        await fetchApi(`/academic/cohorts/${cohortId}/modules`, {
                          method: "POST",
                          body: JSON.stringify(week),
                        });
                      }
                      loadData();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full text-xs text-primary border-primary/30 hover:bg-primary/10"
                >
                  ⚡ Generar Estructura (4 Semanas)
                </Button>
              </div>
            ) : (

              modules.map((mod, idx) => (
                <button
                  key={mod.id}
                  onClick={() => setSelectedModule(mod)}
                  className={`w-full text-left p-3 rounded-lg transition-all text-sm font-medium ${
                    selectedModule !== "students" && selectedModule?.id === mod.id 
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
                selectedModule === null 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              Tareas y Evaluaciones
            </button>
            <button
              onClick={() => setSelectedModule("students")}
              className={`w-full text-left p-3 rounded-lg transition-all text-sm font-medium mt-1 ${
                selectedModule === "students" 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              Lista de Estudiantes
            </button>
          </div>
        </div>

      {/* ── PANEL DERECHO: CONTENIDO ── */}
      <div className="w-full md:w-2/3 lg:w-3/4 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-border/50 pb-6 gap-4">
          <div>
            <span className="text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md mb-2 inline-block">
              {cohort.course?.name}
            </span>
            <h2 className="text-3xl font-bold tracking-tight">{cohort.name}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/classes/${cohortId}/forum`}>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Foro
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setIsAttendanceOpen(true)} className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Asistencia
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsGradesSummaryOpen(true)} className="flex items-center gap-2 text-primary border-primary/30">
              <FileSpreadsheet className="h-4 w-4" /> Acta de Notas
            </Button>
            <Button size="sm" onClick={() => setIsCreateEvalOpen(true)} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" /> Crear Tarea
            </Button>
          </div>
        </div>

        {selectedModule === "students" ? (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-4">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" /> Estudiantes Matriculados
                </h3>
                <p className="text-muted-foreground text-sm">Lista oficial de alumnos inscritos en esta clase.</p>
              </div>
              <Button onClick={downloadStudentsCSV} className="gap-2" variant="outline" size="sm">
                <Download className="h-4 w-4" /> Exportar Alumnos (CSV)
              </Button>
            </div>
            
            {!cohort.students || cohort.students.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-xl border border-dashed border-border/50 text-muted-foreground">
                No hay estudiantes matriculados en esta cohorte aún.
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border/50 overflow-hidden glass">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground font-semibold bg-muted/20">
                        <th className="py-3.5 px-6">Estudiante</th>
                        <th className="py-3.5 px-6">Email</th>
                        <th className="py-3.5 px-6 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {cohort.students.map((student: User) => (
                        <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-4 px-6 font-semibold flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                            </div>
                            <span>{student.firstName} {student.lastName}</span>
                          </td>
                          <td className="py-4 px-6 text-muted-foreground">{student.email}</td>
                          <td className="py-4 px-6 text-right">
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                              Activo
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : selectedModule ? (
          <div className="space-y-8 animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-bold">{selectedModule.title}</h3>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteModule(selectedModule.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar Módulo
                </Button>
              </div>
              <p className="text-muted-foreground">{selectedModule.description}</p>
            
            {/* Clases en Vivo */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-primary" /> Clases en Vivo
                </h4>
                <Button variant="outline" size="sm" onClick={() => setIsAddSessionOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Programar
                </Button>
              </div>
              
              {selectedModule.sessions?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-xl border border-border">No has programado clases para esta semana.</p>
              ) : (
                <div className="grid gap-4">
                  {selectedModule.sessions?.map((session: ClassSession) => (
                    <div key={session.id} className="glass p-4 rounded-xl border border-border flex justify-between items-center">
                      <div>
                        <p className="font-bold">{session.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(session.date).toLocaleString()}</p>
                      </div>
                      {session.meetLink && (
                        <a href={session.meetLink} target="_blank" rel="noreferrer">
                          <Button size="sm">Iniciar Meet</Button>
                        </a>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive ml-2" onClick={() => handleDeleteSession(session.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Materiales */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" /> Material de Estudio
                </h4>
                <Button variant="outline" size="sm" onClick={() => setIsAddMaterialOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Añadir Material
                </Button>
              </div>

              {selectedModule.materials?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-xl border border-border">No has subido materiales.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedModule.materials?.map((mat: Material) => (
                    <div key={mat.id} className="glass p-4 rounded-xl border border-border flex justify-between items-center group">
                      <a href={mat.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-primary transition-colors flex-1">
                        <FileText className="h-8 w-8 text-primary opacity-80" />
                        <div>
                          <p className="font-bold text-sm line-clamp-1">{mat.title}</p>
                          <p className="text-xs text-muted-foreground">{mat.type}</p>
                        </div>
                      </a>
                      <Button size="sm" variant="ghost" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteMaterial(mat.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in-up">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <FileText className="h-5 w-5" /> Tareas Publicadas
            </h3>
            
            {evaluations.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-xl border border-dashed border-border/50 text-muted-foreground">
                No has publicado ninguna tarea para esta cohorte.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {evaluations.map((ev) => (
                  <div key={ev.id} className="bg-card p-6 rounded-xl border border-border/50 glass">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-primary">{ev.title}</h4>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Límite: {new Date(ev.dueDate).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Peso: {ev.weight}%</span>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-semibold bg-accent/20 text-accent-foreground">
                        Max: {ev.maxScore} pts
                      </div>
                    </div>
                    
                    <p className="text-sm mb-6 bg-muted/20 p-4 rounded-md">{ev.description}</p>
                    
                    <div className="border-t border-border/50 pt-4">
                      <h5 className="font-semibold text-sm mb-3">Estudiantes ({cohort.students?.length || 0})</h5>
                      
                      {cohort.students?.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No hay estudiantes matriculados.</p>
                      ) : (
                        <div className="space-y-2">
                          {cohort.students?.map((student: User) => {
                            const studentDeliverable = ev.deliverables?.find((deliverable: Deliverable) => deliverable.studentId === student.id);
                            
                            return (
                              <div key={student.id} className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
                                <span className="text-sm">{student.firstName} {student.lastName}</span>
                                {studentDeliverable ? (
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${studentDeliverable.status === 'GRADED' ? 'bg-green-500/20 text-green-600' : 'bg-yellow-500/20 text-yellow-600'}`}>
                                      {studentDeliverable.status === 'GRADED' ? 'Calificado' : 'Por Calificar'}
                                    </span>
                                    <Button size="sm" variant="outline" onClick={() => setGradingDeliverable({ evaluation: ev, student, deliverable: studentDeliverable })}>
                                      Ver Entrega / Calificar
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">No ha entregado</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CreateEvaluationModal 
        isOpen={isCreateEvalOpen} 
        onClose={() => setIsCreateEvalOpen(false)} 
        onSuccess={() => { loadData(); setIsCreateEvalOpen(false); }}
        cohortId={cohortId}
      />

      <CreateModuleModal 
        isOpen={isCreateModuleOpen} 
        onClose={() => setIsCreateModuleOpen(false)} 
        onSuccess={() => { loadData(); setIsCreateModuleOpen(false); }}
        cohortId={cohortId}
      />
      
      {selectedModule && selectedModule !== "students" && (
        <>
          <AddMaterialModal 
            isOpen={isAddMaterialOpen} 
            onClose={() => setIsAddMaterialOpen(false)} 
            onSuccess={() => { loadData(); setIsAddMaterialOpen(false); }}
            moduleId={selectedModule.id}
          />
          <AddSessionModal 
            isOpen={isAddSessionOpen} 
            onClose={() => setIsAddSessionOpen(false)} 
            onSuccess={() => { loadData(); setIsAddSessionOpen(false); }}
            moduleId={selectedModule.id}
          />
        </>
      )}

      {gradingDeliverable && (
        <GradeDeliverableModal
          isOpen={true}
          onClose={() => setGradingDeliverable(null)}
          onSuccess={() => { loadData(); setGradingDeliverable(null); }}
          evaluation={gradingDeliverable.evaluation}
          student={gradingDeliverable.student}
          deliverable={gradingDeliverable.deliverable}
        />
      )}

      <TakeAttendanceModal 
        isOpen={isAttendanceOpen}
        onClose={() => setIsAttendanceOpen(false)}
        cohort={cohort}
      />

      <GradesSummaryModal
        isOpen={isGradesSummaryOpen}
        onClose={() => setIsGradesSummaryOpen(false)}
        cohort={cohort}
      />
    </div>
  );
}
