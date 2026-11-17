"use client";

import { useState, useEffect, useEffectEvent, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi, getErrorMessage, resolveFileUrl } from "@/lib/api";
import { buildCsvBlob } from "@/lib/money";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Award,
  Loader2,
  PlusCircle,
  Calendar,
  FileText,
  MessageSquare,
  BookOpen,
  Download,
  PlayCircle,
  Plus,
  Pencil,
  Trash2,
  Users,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Video,
  ExternalLink,
  Clock,
  Layers,
  ClipboardCheck,
  Search,
  FileSpreadsheet,
  Copy,
  Mail,
} from "lucide-react";
import { CreateEvaluationModal } from "@/components/teacher/create-evaluation-modal";
import { GradeDeliverableModal } from "@/components/teacher/grade-deliverable-modal";
import { TakeAttendanceModal } from "@/components/teacher/take-attendance-modal";
import { CreateModuleModal } from "@/components/teacher/create-module-modal";
import { AddMaterialModal } from "@/components/teacher/add-material-modal";
import { AddSessionModal } from "@/components/teacher/add-session-modal";
import { GradesSummaryModal } from "@/components/teacher/grades-summary-modal";
import { EditContentModal, type EditableContent } from "@/components/teacher/edit-content-modal";
import { GenerateCertificateModal } from "@/components/teacher/generate-certificate-modal";
import { ImportGradesModal } from "@/components/teacher/import-grades-modal";
import type {
  ClassSession,
  Cohort,
  Deliverable,
  Evaluation,
  Material,
  SyllabusModule,
  User,
} from "@/types/domain";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";

interface GradingSelection {
  evaluation: Evaluation;
  student: User;
  deliverable: Deliverable;
}

/**
 * Limpia prefijos redundantes como "DEMO100 | DEMO100 | Desarrollo Web Fullstack | Grupo 2 | Semana 1"
 * para mostrar títulos limpios y legibles en el temario y encabezados.
 */
function cleanAcademicTitle(
  rawTitle: string | undefined | null,
  cohort?: Cohort | null,
  fallback = "Contenido"
): string {
  if (!rawTitle) return fallback;
  const parts = rawTitle
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) return rawTitle.trim();

  const cohortParts = new Set(
    [
      cohort?.name,
      cohort?.course?.name,
      cohort?.course?.code,
      ...(cohort?.name ? cohort.name.split("|").map((s) => s.trim()) : []),
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase())
  );

  const filtered = parts.filter((part, idx) => {
    const lower = part.toLowerCase();
    // Eliminar duplicados consecutivos (ej. DEMO100 | DEMO100)
    if (idx > 0 && lower === parts[idx - 1].toLowerCase()) return false;
    // Eliminar partes que ya están en el nombre del curso/cohorte, salvo que sea el último segmento útil
    if (idx < parts.length - 1 && cohortParts.has(lower)) return false;
    if (idx < parts.length - 1 && /^demo\d+$/i.test(part)) return false;
    return true;
  });

  return (filtered.length > 0 ? filtered.join(" · ") : parts[parts.length - 1]).trim();
}

export default function ClassDetailPage() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const params = useParams();
  const router = useRouter();
  const cohortId = params.id as string;
  const { user } = useAuth();
  const confirmAction = useConfirm();
  const role = user?.roles?.[0];
  const canManageContent = role === "ADMIN" || role === "DOCENTE";

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoadError, setStudentsLoadError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [selectedModule, setSelectedModule] = useState<SyllabusModule | "students" | null>(null);
  const [isCreateEvalOpen, setIsCreateEvalOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isGradesSummaryOpen, setIsGradesSummaryOpen] = useState(false);
  const [isCreateModuleOpen, setIsCreateModuleOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [gradingDeliverable, setGradingDeliverable] = useState<GradingSelection | null>(null);
  const [editingContent, setEditingContent] = useState<EditableContent | null>(null);
  const [certificateStudent, setCertificateStudent] = useState<User | null>(null);
  const [isImportGradesOpen, setIsImportGradesOpen] = useState(false);

  const attendanceSessions =
    selectedModule && selectedModule !== "students"
      ? selectedModule.sessions || []
      : modules.flatMap((m) => m.sessions || []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentCohort = await fetchApi(`/academic/cohorts/${cohortId}`);

      const [modsResult, evalsResult, studentsResult] = await Promise.allSettled([
        fetchApi(`/academic/cohorts/${cohortId}/modules`),
        fetchApi(`/evaluations/cohort/${cohortId}`),
        fetchApi(`/academic/cohorts/${cohortId}/students`),
      ]);
      const mods = modsResult.status === "fulfilled" ? modsResult.value : [];
      const evals = evalsResult.status === "fulfilled" ? evalsResult.value : [];
      const studentsPayload = studentsResult.status === "fulfilled" ? studentsResult.value : [];
      const cohortStudents = Array.isArray(studentsPayload)
        ? studentsPayload
        : Array.isArray(studentsPayload?.data)
          ? studentsPayload.data
          : [];

      if (studentsResult.status === "rejected") {
        console.error("Error al cargar estudiantes de la cohorte:", studentsResult.reason);
        setStudentsLoadError(getErrorMessage(studentsResult.reason, "No se pudo cargar la lista de estudiantes"));
      } else {
        setStudentsLoadError("");
      }

      setCohort({ ...currentCohort, students: cohortStudents });
      setModules(mods || []);

      const evalsData = evals?.data || evals || [];
      setEvaluations(Array.isArray(evalsData) ? evalsData : []);

      if (mods && mods.length > 0 && !selectedModule) {
        setSelectedModule(mods[0]);
      } else if (mods && mods.length > 0 && selectedModule && selectedModule !== "students") {
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

  const totalSessionsCount = useMemo(
    () => modules.reduce((acc, m) => acc + (m.sessions?.length || 0), 0),
    [modules]
  );
  const totalMaterialsCount = useMemo(
    () => modules.reduce((acc, m) => acc + (m.materials?.length || 0), 0),
    [modules]
  );
  const pendingDeliverablesCount = useMemo(
    () =>
      evaluations.reduce(
        (acc, ev) =>
          acc + (ev.deliverables?.filter((d) => d.status !== "GRADED").length || 0),
        0
      ),
    [evaluations]
  );

  const selectedModuleIndex = useMemo(() => {
    if (!selectedModule || selectedModule === "students") return -1;
    return modules.findIndex((m) => m.id === selectedModule.id);
  }, [modules, selectedModule]);

  const filteredStudents = useMemo(() => {
    const list = cohort?.students || [];
    const q = studentSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q)
    );
  }, [cohort?.students, studentSearch]);

  const downloadStudentsCSV = () => {
    if (!cohort || !cohort.students || cohort.students.length === 0) return;
    const headers = ["ID", "Nombre", "Apellido", "Email"];
    const rows = cohort.students.map((student: User) => [
      student.id,
      student.firstName,
      student.lastName,
      student.email,
    ]);
    const blob = buildCsvBlob(headers, rows);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", objectUrl);
    link.setAttribute("download", `estudiantes_${cohort.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (
      !(await confirmAction({
        title: "Eliminar módulo",
        description:
          "Se eliminará el módulo junto con sus materiales, sesiones y evaluaciones relacionadas.",
        confirmLabel: "Eliminar módulo",
      }))
    )
      return;
    try {
      await fetchApi(`/academic/cohorts/modules/${moduleId}`, { method: "DELETE" });
      setSelectedModule(null);
      loadData();
      toast.success("Módulo eliminado correctamente");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al eliminar módulo"));
    }
  };

  const handleEditModule = (module: SyllabusModule) => {
    setEditingContent({
      kind: "module",
      id: module.id,
      title: module.title,
      description: module.description,
    });
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (
      !(await confirmAction({
        title: "Eliminar sesión",
        description: "La sesión dejará de aparecer en el calendario y en el salón de clases.",
        confirmLabel: "Eliminar sesión",
      }))
    )
      return;
    try {
      await fetchApi(`/academic/cohorts/sessions/${sessionId}`, { method: "DELETE" });
      loadData();
      toast.success("Sesión eliminada");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al eliminar sesión"));
    }
  };

  const handleEditSession = (session: ClassSession) => {
    setEditingContent({
      kind: "session",
      id: session.id,
      title: session.title,
      date: session.date,
      meetLink: session.meetLink,
      recordingUrl: session.recordingUrl,
      durationMinutes: session.durationMinutes,
      timeZone: session.timeZone,
    });
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (
      !(await confirmAction({
        title: "Eliminar material",
        description: "El material dejará de estar disponible para los estudiantes de esta cohorte.",
        confirmLabel: "Eliminar material",
      }))
    )
      return;
    try {
      await fetchApi(`/academic/cohorts/materials/${materialId}`, { method: "DELETE" });
      loadData();
      toast.success("Material eliminado");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al eliminar material"));
    }
  };

  const handleEditMaterial = (material: Material) => {
    setEditingContent({
      kind: "material",
      id: material.id,
      title: material.title,
      fileUrl: material.fileUrl,
    });
  };

  const handleEditEvaluation = (evaluation: Evaluation) => {
    setEditingContent({
      kind: "evaluation",
      id: evaluation.id,
      title: evaluation.title,
      description: evaluation.description,
      weight: evaluation.weight,
      maxScore: evaluation.maxScore,
      dueDate: evaluation.dueDate,
    });
  };

  const handleDeleteEvaluation = async (evaluationId: string) => {
    if (
      !(await confirmAction({
        title: "Retirar tarea",
        description:
          "La tarea dejará de estar disponible, pero se conservarán las entregas y notas existentes.",
        confirmLabel: "Retirar tarea",
      }))
    )
      return;
    try {
      await fetchApi(`/evaluations/${evaluationId}`, { method: "DELETE" });
      await loadData();
      toast.success("Tarea retirada");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al retirar tarea"));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cohort) {
    return <div className="p-8 text-center text-red-500 font-bold">Cohorte no encontrada</div>;
  }

  const courseName = cohort.course?.name || "Programa Académico";
  const cleanCohortHeading = cleanAcademicTitle(cohort.name, null, cohort.name);

  return (
    <div className="space-y-6 pb-10">
      {/* ── CABECERA EJECUTIVA DEL AULA / COHORTE ── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#090f1e] p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/classes"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/20"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Mis Clases
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-200">
                <BookOpen className="h-3.5 w-3.5" />
                {courseName}
              </span>
              {cohort.course?.code && (
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-xs font-semibold text-slate-300">
                  {cohort.course.code}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-white">
              {cleanCohortHeading}
            </h2>

            {/* Mini KPIs del Salón */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-200">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium">
                <Layers className="h-3.5 w-3.5 text-blue-300" />
                <strong>{modules.length}</strong> {modules.length === 1 ? "semana" : "semanas"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium">
                <Video className="h-3.5 w-3.5 text-sky-300" />
                <strong>{totalSessionsCount}</strong> {totalSessionsCount === 1 ? "sesión en vivo" : "sesiones en vivo"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium">
                <FileText className="h-3.5 w-3.5 text-amber-300" />
                <strong>{totalMaterialsCount}</strong> {totalMaterialsCount === 1 ? "material" : "materiales"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium">
                <ClipboardCheck className="h-3.5 w-3.5 text-violet-300" />
                <strong>{evaluations.length}</strong> {evaluations.length === 1 ? "evaluación" : "evaluaciones"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium">
                <Users className="h-3.5 w-3.5 text-emerald-300" />
                <strong>{cohort.students?.length || 0}</strong> {cohort.students?.length === 1 ? "estudiante" : "estudiantes"}
              </span>
            </div>
          </div>

          {/* Barra de Herramientas Docente */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              asChild
              size="sm"
              className="bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold shadow-sm gap-1.5"
            >
              <Link href={`/dashboard/aula/${cohortId}`}>
                <BookOpen className="h-4 w-4" />
                Trabajo del curso
              </Link>
            </Button>

            {canManageContent && (
              <Button
                size="sm"
                onClick={() => setIsCreateEvalOpen(true)}
                className="bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-sm gap-1.5 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4 text-blue-700" />
                Crear Tarea
              </Button>
            )}

            <Link href={`/dashboard/classes/${cohortId}/forum`}>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white gap-1.5 cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                Foro
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAttendanceOpen(true)}
              disabled={attendanceSessions.length === 0}
              title={
                attendanceSessions.length === 0
                  ? "Programa una clase para tomar asistencia"
                  : "Tomar asistencia"
              }
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Calendar className="h-4 w-4" />
              Asistencia
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGradesSummaryOpen(true)}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Acta de Notas
            </Button>

            {canManageContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportGradesOpen(true)}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Importar notas
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL: NAVEGACIÓN LATERAL + PANEL DE CONTENIDO ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] items-start">
        {/* ── PANEL IZQUIERDO: SYLLABUS Y NAVEGACIÓN ── */}
        <aside className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm lg:sticky lg:top-20 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                Temario del Curso
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Selecciona una semana para gestionar sesiones y materiales
              </p>
            </div>
            {canManageContent && (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0 rounded-lg border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                onClick={() => setIsCreateModuleOpen(true)}
                title="Añadir Semana"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            )}
          </div>

          {modules.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/25 p-4 text-center">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aún no has estructurado este curso en semanas o módulos.
              </p>
              {canManageContent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const presetWeeks = [
                        {
                          title: "Módulo 1 — Fundamentos y Entorno",
                          description:
                            "Conceptos iniciales, herramientas y configuración de la materia.",
                          order: 1,
                        },
                        {
                          title: "Módulo 2 — Desarrollo y Práctica Core",
                          description:
                            "Profundización teórica y laboratorio práctico de la semana.",
                          order: 2,
                        },
                        {
                          title: "Módulo 3 — Proyectos y Casos Reales",
                          description:
                            "Resolución de casos de estudio y entregables integradores.",
                          order: 3,
                        },
                        {
                          title: "Módulo 4 — Evaluación Final y Cierre",
                          description:
                            "Presentación final del curso y revisión de calificaciones.",
                          order: 4,
                        },
                      ];
                      for (const week of presetWeeks) {
                        await fetchApi(`/academic/cohorts/${cohortId}/modules`, {
                          method: "POST",
                          body: JSON.stringify(week),
                        });
                      }
                      loadData();
                      toast.success("Estructura base de 4 semanas creada");
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Generar Estructura (4 Semanas)
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {modules.map((mod, idx) => {
                const isActive =
                  selectedModule !== "students" && selectedModule?.id === mod.id;
                const cleanedTitle = cleanAcademicTitle(
                  mod.title,
                  cohort,
                  `Semana ${idx + 1}`
                );
                // Evitar "Semana 1: Semana 1" si el título limpio ya es igual a "Semana X"
                const isRedundantWeekTitle = new RegExp(
                  `^semana\\s*0?${idx + 1}$`,
                  "i"
                ).test(cleanedTitle.trim());
                const displayTitle = isRedundantWeekTitle
                  ? mod.description?.trim() || `Contenido de la Semana ${idx + 1}`
                  : cleanedTitle;

                const sessionsLen = mod.sessions?.length || 0;
                const materialsLen = mod.materials?.length || 0;

                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setSelectedModule(mod)}
                    className={`group w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-md dark:border-primary dark:bg-primary dark:text-primary-foreground"
                        : "border-border/60 bg-background/60 hover:border-primary/40 hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          isActive
                            ? "bg-white/15 text-teal-200"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        Semana {idx + 1}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          isActive ? "text-slate-300" : "text-muted-foreground"
                        }`}
                      >
                        {sessionsLen} {sessionsLen === 1 ? "clase" : "clases"} ·{" "}
                        {materialsLen} mat.
                      </span>
                    </div>
                    <p
                      className={`text-xs font-semibold leading-snug line-clamp-2 ${
                        isActive ? "text-white" : "text-foreground"
                      }`}
                      title={mod.title}
                    >
                      {displayTitle}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {canManageContent && modules.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModuleOpen(true)}
              className="w-full gap-1.5 rounded-xl border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir nueva semana
            </Button>
          )}

          {/* Sección de vistas globales del curso */}
          <div className="border-t border-border/60 pt-3 space-y-1.5">
            <p className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Seguimiento y Evaluación
            </p>
            <button
              type="button"
              onClick={() => setSelectedModule(null)}
              className={`w-full flex items-center justify-between rounded-xl border p-3 text-left text-xs font-bold transition-all cursor-pointer ${
                selectedModule === null
                  ? "border-slate-900 bg-slate-900 text-white shadow-md dark:border-primary dark:bg-primary"
                  : "border-border/60 bg-background/60 text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Tareas y Evaluaciones
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  selectedModule === null
                    ? "bg-white/20 text-white"
                    : pendingDeliverablesCount > 0
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {evaluations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedModule("students")}
              className={`w-full flex items-center justify-between rounded-xl border p-3 text-left text-xs font-bold transition-all cursor-pointer ${
                selectedModule === "students"
                  ? "border-slate-900 bg-slate-900 text-white shadow-md dark:border-primary dark:bg-primary"
                  : "border-border/60 bg-background/60 text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Lista de Estudiantes
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  selectedModule === "students"
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {cohort.students?.length || 0}
              </span>
            </button>
          </div>
        </aside>

        {/* ── PANEL DERECHO: CONTENIDO DINÁMICO ── */}
        <div className="space-y-6 min-w-0">
          {selectedModule === "students" ? (
            <div className="space-y-5 animate-fade-in-up">
              <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    <Users className="h-3.5 w-3.5" />
                    Padrón Académico
                  </span>
                  <h3 className="mt-1 text-xl font-bold text-foreground">
                    Estudiantes Matriculados ({cohort.students?.length || 0})
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lista oficial de alumnos inscritos en esta edición y emisión de certificados.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Buscar alumno o correo..."
                      className="h-9 w-full sm:w-56 rounded-xl border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <Button
                    onClick={downloadStudentsCSV}
                    className="gap-1.5 rounded-xl cursor-pointer"
                    variant="outline"
                    size="sm"
                    disabled={!cohort.students?.length}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {studentsLoadError ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center text-red-700 dark:text-red-300"
                >
                  <p className="font-medium">{studentsLoadError}</p>
                  <Button onClick={() => void loadData()} variant="outline" size="sm">
                    Reintentar carga
                  </Button>
                </div>
              ) : !cohort.students || cohort.students.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="font-semibold text-foreground">
                    No hay estudiantes matriculados en esta cohorte aún
                  </p>
                  <p className="text-xs mt-1">
                    Cuando los alumnos completen su inscripción aparecerán automáticamente en este listado.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/30 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          <th className="py-3.5 px-6">Estudiante</th>
                          <th className="py-3.5 px-6">Correo electrónico</th>
                          <th className="py-3.5 px-6 text-center">Estado</th>
                          <th className="py-3.5 px-6 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {filteredStudents.map((student: User) => (
                          <tr key={student.id} className="hover:bg-muted/25 transition-colors">
                            <td className="py-3.5 px-6 font-semibold flex items-center gap-3">
                              <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-extrabold text-primary">
                                {student.firstName?.charAt(0)}
                                {student.lastName?.charAt(0)}
                              </div>
                              <div>
                                <p className="text-foreground font-bold">
                                  {student.firstName} {student.lastName}
                                </p>
                                {student.dni && (
                                  <p className="text-[11px] font-mono text-muted-foreground">
                                    DNI: {student.dni}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-6 text-muted-foreground">
                              <a
                                href={`mailto:${student.email}`}
                                className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                {student.email}
                              </a>
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Matriculado
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              {canManageContent && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 rounded-lg cursor-pointer"
                                  onClick={() => setCertificateStudent(student)}
                                >
                                  <Award className="h-3.5 w-3.5 text-amber-500" />
                                  Certificado
                                </Button>
                              )}
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
            <div className="space-y-6 animate-fade-in-up">
              {/* ── TARJETA ENCABEZADO DEL MÓDULO / SEMANA ── */}
              <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-primary">
                        Semana {selectedModuleIndex + 1} de {modules.length}
                      </span>
                      {selectedModule.title !==
                        cleanAcademicTitle(selectedModule.title, cohort) && (
                        <span className="text-[11px] font-mono text-muted-foreground truncate max-w-xs">
                          {selectedModule.title}
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
                      {cleanAcademicTitle(
                        selectedModule.title,
                        cohort,
                        `Semana ${selectedModuleIndex + 1}`
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedModule.description ||
                        "Gestiona las sesiones en vivo y el material descargable correspondiente a esta semana."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {modules.length > 1 && (
                      <div className="flex items-center gap-1 mr-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg cursor-pointer"
                          disabled={selectedModuleIndex <= 0}
                          onClick={() =>
                            selectedModuleIndex > 0 &&
                            setSelectedModule(modules[selectedModuleIndex - 1])
                          }
                          title="Semana anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg cursor-pointer"
                          disabled={
                            selectedModuleIndex < 0 ||
                            selectedModuleIndex >= modules.length - 1
                          }
                          onClick={() =>
                            selectedModuleIndex < modules.length - 1 &&
                            setSelectedModule(modules[selectedModuleIndex + 1])
                          }
                          title="Siguiente semana"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {canManageContent && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg text-xs cursor-pointer"
                          onClick={() => handleEditModule(selectedModule)}
                          title="Editar módulo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg border-destructive/30 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                          onClick={() => handleDeleteModule(selectedModule.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── SECCIÓN: CLASES EN VIVO ── */}
              <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      <PlayCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                        Clases en Vivo
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                          {selectedModule.sessions?.length || 0}
                        </span>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Sesiones síncronas por videoconferencia y grabaciones de clase
                      </p>
                    </div>
                  </div>
                  {canManageContent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                      onClick={() => setIsAddSessionOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Programar
                    </Button>
                  )}
                </div>

                {!selectedModule.sessions || selectedModule.sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
                    <Video className="mx-auto h-7 w-7 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-semibold text-foreground">
                      No has programado clases para esta semana
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Programa una sesión en vivo con enlace de Google Meet o Zoom para tus estudiantes.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {selectedModule.sessions.map((session: ClassSession) => {
                      const cleanSessionTitle = cleanAcademicTitle(
                        session.title,
                        cohort,
                        session.title
                      );
                      const sessionDate = new Date(session.date);
                      const isUpcoming = sessionDate.getTime() >= now - 3600000;

                      return (
                        <div
                          key={session.id}
                          className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/70 p-4 transition hover:border-primary/30 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div
                              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                isUpcoming
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "border-border bg-muted/50 text-muted-foreground"
                              }`}
                            >
                              <Video className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-sm text-foreground">
                                  {cleanSessionTitle}
                                </p>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    isUpcoming
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isUpcoming ? "Programada" : "Realizada"}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5 text-primary" />
                                  {new Intl.DateTimeFormat("es-PE", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                    timeZone: session.timeZone || "America/Lima",
                                  }).format(sessionDate)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-primary" />
                                  {session.durationMinutes || 60} min
                                </span>
                                <span className="text-[11px] opacity-80">
                                  {session.timeZone || "America/Lima"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Acciones agrupadas a la derecha */}
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
                            {session.meetLink && (
                              <>
                                <a
                                  href={session.meetLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Button
                                    size="sm"
                                    className="h-8 gap-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-primary dark:text-primary-foreground cursor-pointer"
                                  >
                                    <Video className="h-3.5 w-3.5" />
                                    Iniciar Meet
                                  </Button>
                                </a>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 rounded-lg cursor-pointer"
                                  title="Copiar enlace de la sesión"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(session.meetLink || "");
                                    toast.success("Enlace de la clase copiado al portapapeles");
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}

                            {session.recordingUrl && (
                              <a
                                href={session.recordingUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 rounded-lg cursor-pointer"
                                >
                                  <PlayCircle className="h-3.5 w-3.5 text-primary" />
                                  Ver grabación
                                </Button>
                              </a>
                            )}

                            {canManageContent && (
                              <div className="flex items-center gap-1 border-l border-border/60 pl-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg cursor-pointer"
                                  title="Editar sesión"
                                  onClick={() => handleEditSession(session)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Eliminar sesión"
                                  className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer"
                                  onClick={() => handleDeleteSession(session.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── SECCIÓN: MATERIAL DE ESTUDIO ── */}
              <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Download className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                        Material de Estudio
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                          {selectedModule.materials?.length || 0}
                        </span>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Diapositivas, lecturas PDF, guías de laboratorio y recursos descargables
                      </p>
                    </div>
                  </div>
                  {canManageContent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                      onClick={() => setIsAddMaterialOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Añadir Material
                    </Button>
                  )}
                </div>

                {!selectedModule.materials || selectedModule.materials.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
                    <FileText className="mx-auto h-7 w-7 text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-semibold text-foreground">
                      No has subido materiales en esta semana
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Comparte presentaciones PDF, guías prácticas o enlaces de referencia para la clase.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {selectedModule.materials.map((mat: Material) => {
                      const fileHref = resolveFileUrl(mat.fileUrl);
                      return (
                        <div
                          key={mat.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 p-4 transition hover:border-primary/40 hover:shadow-sm"
                        >
                          <a
                            href={fileHref}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3.5 min-w-0 flex-1 group"
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {mat.title}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                  {mat.type || "RECURSO"}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                                  Abrir <ExternalLink className="h-3 w-3" />
                                </span>
                              </div>
                            </div>
                          </a>

                          {canManageContent && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg cursor-pointer"
                                title="Editar material"
                                onClick={() => handleEditMaterial(mat)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Eliminar material"
                                className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer"
                                onClick={() => handleDeleteMaterial(mat.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          ) : (
            /* ── SECCIÓN: TAREAS Y EVALUACIONES ── */
            <div className="space-y-5 animate-fade-in-up">
              <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Evaluación Continua
                  </span>
                  <h3 className="mt-1 text-xl font-bold text-foreground">
                    Tareas Publicadas ({evaluations.length})
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Revisa las entregas de tus estudiantes, asigna calificaciones y brinda retroalimentación.
                  </p>
                </div>
                {canManageContent && (
                  <Button
                    size="sm"
                    onClick={() => setIsCreateEvalOpen(true)}
                    className="gap-1.5 rounded-xl cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Crear Tarea
                  </Button>
                )}
              </div>

              {evaluations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-muted-foreground">
                  <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="font-semibold text-foreground">
                    No has publicado ninguna tarea para esta cohorte
                  </p>
                  <p className="text-xs mt-1">
                    Usa el botón «Crear Tarea» para publicar proyectos, entregables o cuestionarios.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {evaluations.map((ev) => {
                    const totalStudents = cohort.students?.length || 0;
                    const submittedCount = ev.deliverables?.length || 0;
                    const gradedCount =
                      ev.deliverables?.filter((d) => d.status === "GRADED").length || 0;

                    return (
                      <div
                        key={ev.id}
                        className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm space-y-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-bold text-foreground">
                                {cleanAcademicTitle(ev.title, cohort, ev.title)}
                              </h4>
                              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                                Peso: {ev.weight}%
                              </span>
                              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                Máx: {ev.maxScore} pts
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                Límite: {new Date(ev.dueDate).toLocaleString("es-PE")}
                              </span>
                              <span>
                                Entregas: <strong>{submittedCount}</strong> / {totalStudents} ·
                                Calificadas: <strong>{gradedCount}</strong>
                              </span>
                            </div>
                          </div>

                          {canManageContent && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 rounded-lg text-xs cursor-pointer"
                                title="Editar tarea"
                                onClick={() => handleEditEvaluation(ev)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                title="Retirar tarea"
                                className="h-8 gap-1 rounded-lg border-destructive/30 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                                onClick={() => handleDeleteEvaluation(ev.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Retirar
                              </Button>
                            </div>
                          )}
                        </div>

                        {ev.description && (
                          <p className="text-sm text-muted-foreground bg-muted/30 p-3.5 rounded-xl border border-border/50">
                            {ev.description}
                          </p>
                        )}

                        <div className="border-t border-border/60 pt-4">
                          <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">
                            Estado de entregas por estudiante ({totalStudents})
                          </h5>

                          {totalStudents === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No hay estudiantes matriculados.
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {cohort.students?.map((student: User) => {
                                const studentDeliverable = ev.deliverables?.find(
                                  (deliverable: Deliverable) =>
                                    deliverable.studentId === student.id
                                );

                                return (
                                  <div
                                    key={student.id}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 p-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-foreground truncate">
                                        {student.firstName} {student.lastName}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {student.email}
                                      </p>
                                    </div>
                                    {studentDeliverable ? (
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span
                                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                            studentDeliverable.status === "GRADED"
                                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                          }`}
                                        >
                                          {studentDeliverable.status === "GRADED"
                                            ? `Calificado (${studentDeliverable.score ?? "-"})`
                                            : "Por Calificar"}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs rounded-lg cursor-pointer"
                                          onClick={() => {
                                            if (ev.kind === "QUIZ" || ev.rubric?.length)
                                              router.push(`/dashboard/aula/${cohortId}`);
                                            else
                                              setGradingDeliverable({
                                                evaluation: ev,
                                                student,
                                                deliverable: studentDeliverable,
                                              });
                                          }}
                                        >
                                          Calificar
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground italic shrink-0">
                                        Sin entrega
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateEvaluationModal
        isOpen={isCreateEvalOpen}
        onClose={() => setIsCreateEvalOpen(false)}
        onSuccess={() => {
          loadData();
          setIsCreateEvalOpen(false);
        }}
        cohortId={cohortId}
      />

      <CreateModuleModal
        isOpen={isCreateModuleOpen}
        onClose={() => setIsCreateModuleOpen(false)}
        onSuccess={() => {
          loadData();
          setIsCreateModuleOpen(false);
        }}
        cohortId={cohortId}
      />

      {selectedModule && selectedModule !== "students" && (
        <>
          <AddMaterialModal
            isOpen={isAddMaterialOpen}
            onClose={() => setIsAddMaterialOpen(false)}
            onSuccess={() => {
              loadData();
              setIsAddMaterialOpen(false);
            }}
            moduleId={selectedModule.id}
          />
          <AddSessionModal
            isOpen={isAddSessionOpen}
            onClose={() => setIsAddSessionOpen(false)}
            onSuccess={() => {
              loadData();
              setIsAddSessionOpen(false);
            }}
            moduleId={selectedModule.id}
          />
        </>
      )}

      {gradingDeliverable && (
        <GradeDeliverableModal
          isOpen={true}
          onClose={() => setGradingDeliverable(null)}
          onSuccess={() => {
            loadData();
            setGradingDeliverable(null);
          }}
          evaluation={gradingDeliverable.evaluation}
          student={gradingDeliverable.student}
          deliverable={gradingDeliverable.deliverable}
        />
      )}

      <TakeAttendanceModal
        isOpen={isAttendanceOpen}
        onClose={() => setIsAttendanceOpen(false)}
        cohort={cohort}
        sessions={attendanceSessions}
      />

      <GradesSummaryModal
        isOpen={isGradesSummaryOpen}
        onClose={() => setIsGradesSummaryOpen(false)}
        cohort={cohort}
      />

      <EditContentModal
        key={editingContent ? `${editingContent.kind}-${editingContent.id}` : "edit-content-closed"}
        content={editingContent}
        onClose={() => setEditingContent(null)}
        onSuccess={loadData}
      />

      <GenerateCertificateModal
        cohortId={cohortId}
        student={certificateStudent}
        isOpen={Boolean(certificateStudent)}
        onClose={() => setCertificateStudent(null)}
        onSuccess={() => undefined}
      />

      <ImportGradesModal
        key={isImportGradesOpen ? "import-grades-open" : "import-grades-closed"}
        cohortId={cohortId}
        evaluations={evaluations}
        students={cohort.students || []}
        isOpen={isImportGradesOpen}
        onClose={() => setIsImportGradesOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
