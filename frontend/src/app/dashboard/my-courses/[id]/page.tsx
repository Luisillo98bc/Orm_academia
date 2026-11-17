"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { SectionSkeleton } from "@/components/dashboard/data-section";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchApi, getErrorMessage, resolveFileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, FileText, MessageSquare, PlayCircle, BookOpen, Download, BarChart3, TrendingUp, Video, CheckCircle2, CalendarDays, Printer } from "lucide-react";
import { EvaluateTeacherModal } from "@/components/student/evaluate-teacher-modal";
import { WeeklyTaskTracker } from "@/components/student/weekly-task-tracker";
import { RecoveryScreen } from "@/components/system/recovery-screen";
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
import { toast } from "sonner";

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
    if (idx > 0 && lower === parts[idx - 1].toLowerCase()) return false;
    if (idx < parts.length - 1 && cohortParts.has(lower)) return false;
    if (idx < parts.length - 1 && /^demo\d+$/i.test(part)) return false;
    return true;
  });

  return (filtered.length > 0 ? filtered.join(" · ") : parts[parts.length - 1]).trim();
}


export default function StudentCourseDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [resumeMaterialId, setResumeMaterialId] = useState<string | null>(null);
  const [progressError, setProgressError] = useState("");
  const cohortId = params.id as string;

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]); // Para evaluaciones sueltas
  const [loading, setLoading] = useState(true);

  const [selectedModule, setSelectedModule] = useState<SyllabusModule | null>(null);
  const [isEvaluateOpen, setIsEvaluateOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [isEmitting, setIsEmitting] = useState(false);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [mods, evals, myEnrollments, myCertificates, progressData] = await Promise.all([
        fetchApi(`/academic/cohorts/${cohortId}/modules`),
        fetchApi(`/evaluations/cohort/${cohortId}`),
        fetchApi("/academic/enrollments/me"),
        fetchApi("/certificates/me").catch(() => null),
        fetchApi(`/academic/cohorts/${cohortId}/my-progress`).catch(() => null),
      ]);
      if (progressData) setProgress(progressData);
      setProgressError(progressData ? "" : "No pudimos consultar tu progreso. Vuelve a cargar el curso para recuperar tu avance.");

      setModules(mods || []);

      const enrollmentItems = myEnrollments?.data || myEnrollments || [];
      const myEnrollment = enrollmentItems.find((item: Enrollment) => item.cohortId === cohortId);
      setEnrollment(myEnrollment || null);
      setCohort(myEnrollment?.cohort || null);

      if (myCertificates?.data && myEnrollment) {
        const cert = myCertificates.data.find((item: Certificate) => item.enrollmentId === myEnrollment.id);
        setCertificate(cert || null);
      }

      // EvaluationController returns { data: [...] } unlike other endpoints
      const evalsData = evals?.data || evals || [];
      setEvaluations(Array.isArray(evalsData) ? evalsData : []);

      if (mods && mods.length > 0) {
        let lastModuleId: string | null = null;
        try { lastModuleId = window.localStorage.getItem(`academy:last-module:${user?.id}:${cohortId}`); } catch { /* Storage is optional. */ }
        const resume = new URLSearchParams(window.location.search).get("resume") === "1";
        const completedIds = new Set(progressData?.materialProgress?.filter((item: { completed: boolean }) => item.completed).map((item: { materialId: string }) => item.materialId) || []);
        const nextModule = resume && progressData ? mods.find((module: SyllabusModule) => module.materials?.some((material) => !completedIds.has(material.id))) : null;
        const nextMaterial = nextModule?.materials?.find((material: Material) => !completedIds.has(material.id));
        setSelectedModule(nextModule || mods.find((module: SyllabusModule) => module.id === lastModuleId) || mods[0]);
        setResumeMaterialId(nextMaterial?.id || null);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, "No se pudo cargar el detalle del curso"));
    } finally {
      setLoading(false);
    }
  };

  const toggleMaterial = async (materialId: string) => {
    const completed = Boolean(progress?.materialProgress?.find((item) => item.materialId === materialId)?.completed);
    const nextCompleted = !completed;
    const previousProgress = progress;

    // Optimistic UI update so the material toggle and progress bar respond immediately
    if (progress) {
      const existing = progress.materialProgress || [];
      const hasEntry = existing.some((item) => item.materialId === materialId);
      const updatedMaterialProgress = hasEntry
        ? existing.map((item) => (item.materialId === materialId ? { ...item, completed: nextCompleted } : item))
        : [...existing, { materialId, title: "", moduleId: selectedModule?.id || "", completed: nextCompleted }];
      setProgress({
        ...progress,
        materialProgress: updatedMaterialProgress,
      });
    }

    try {
      await fetchApi(`/academic/materials/${materialId}/progress`, {
        method: "PATCH",
        body: JSON.stringify({ completed: nextCompleted }),
      });
      const nextProgress = await fetchApi(`/academic/cohorts/${cohortId}/my-progress`);
      setProgress(nextProgress);
    } catch (err) {
      setProgress(previousProgress);
      toast.error(getErrorMessage(err, "No se pudo actualizar el progreso del material"));
    }
  };

  const loadDataEffect = useEffectEvent(loadData);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDataEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cohortId]);

  useEffect(() => {
    try {
      if (selectedModule && user) window.localStorage.setItem(`academy:last-module:${user.id}:${cohortId}`, selectedModule.id);
    } catch { /* Storage is optional. */ }
  }, [cohortId, selectedModule, user]);

  useEffect(() => {
    if (loading || !resumeMaterialId) return;
    const target = document.getElementById(`material-${resumeMaterialId}`);
    target?.scrollIntoView({ block: "center" });
    target?.focus({ preventScroll: true });
  }, [loading, resumeMaterialId]);

  if (loading) {
    return <SectionSkeleton label="Cargando contenido del curso" />;
  }

  if (loadError && !cohort) {
    return (
      <RecoveryScreen
        kind="error"
        compact
        onRetry={() => void loadData()}
      />
    );
  }

  if (!cohort) {
    return (
      <RecoveryScreen
        kind="not-found"
        compact
      />
    );
  }

  const selectedModuleIndex = selectedModule ? modules.findIndex((module) => module.id === selectedModule.id) : -1;
  const completionByMaterial = new Set(progress?.materialProgress?.filter((item) => item.completed).map((item) => item.materialId) || []);

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
      toast.error("Error al emitir certificado: " + getErrorMessage(err));
    } finally {
      setIsEmitting(false);
    }
  };

  const handleDownloadAcademicRecord = () => {
    const win = window.open("", "_blank", "width=860,height=760");
    if (!win) {
      toast.error("Permite las ventanas emergentes para descargar tu constancia académica en PDF.");
      return;
    }

    const studentName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Estudiante";
    const courseName = cohort.course?.name || cohort.name || "Programa Académico";
    const startStr = cohort.startDate ? new Date(cohort.startDate).toLocaleDateString("es-PE") : "Por definir";
    const endStr = cohort.endDate ? new Date(cohort.endDate).toLocaleDateString("es-PE") : "Por definir";
    const issueDate = new Date().toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const statusLabel =
      enrollment?.status === "COMPLETED"
        ? "CULMINADO / APROBADO"
        : "MATRICULADO / EN CURSO";

    const gradesRows =
      progress?.grades && progress.grades.length > 0
        ? progress.grades
            .map(
              (g) => `
          <tr>
            <td>${g.title}</td>
            <td style="text-align:center;">${g.weight}%</td>
            <td style="text-align:center;font-weight:700;">${g.score !== null ? `${g.score} / ${g.maxScore}` : "Pendiente"}</td>
            <td style="text-align:center;">${g.status === "PUBLISHED" ? "Calificada" : g.status === "PENDING" ? "En revisión" : "Por entregar"}</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="4" style="text-align:center;color:#64748b;">No hay evaluaciones registradas aún en esta edición.</td></tr>`;

    const modulesRows =
      modules.length > 0
        ? modules
            .map((m, idx) => {
              const totalMats = m.materials?.length || 0;
              const doneMats = m.materials?.filter((mat) => completionByMaterial.has(mat.id)).length || 0;
              return `
          <tr>
            <td>Semana ${idx + 1}: <strong>${m.title}</strong></td>
            <td style="text-align:center;">${totalMats > 0 ? `${doneMats}/${totalMats} materiales` : "Publicado"}</td>
          </tr>`;
            })
            .join("")
        : `<tr><td colspan="2" style="text-align:center;color:#64748b;">Sin módulos publicados.</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Constancia de Matrícula y Récord Académico - ${courseName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; background: #f8fafc; padding: 28px 16px; }
    .sheet { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(15,23,42,0.06); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 18px; margin-bottom: 22px; gap: 16px; }
    .header h1 { font-size: 20px; font-weight: 800; color: #0f766e; }
    .header p { font-size: 12px; color: #64748b; margin-top: 4px; }
    .badge { border: 2px solid #0f766e; background: #f0fdfa; color: #0f766e; padding: 8px 14px; border-radius: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .field span { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; }
    .field strong { font-size: 13px; color: #0f172a; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; text-align: center; background: #ffffff; }
    .kpi .val { font-size: 20px; font-weight: 800; color: #0f766e; }
    .kpi .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
    h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #334155; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #0f172a; color: #fff; font-size: 11px; text-transform: uppercase; padding: 8px 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .footer { margin-top: 24px; border-top: 1px dashed #cbd5e1; padding-top: 14px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }
    .actions { max-width: 760px; margin: 0 auto 14px; display: flex; justify-content: flex-end; }
    .btn { background: #0f766e; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border: 1px solid #cbd5e1; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div>
        <h1>CONSTANCIA DE MATRÍCULA Y RÉCORD ACADÉMICO</h1>
        <p>Emitido el ${issueDate}</p>
      </div>
      <div class="badge">${statusLabel}</div>
    </div>

    <div class="grid">
      <div class="field"><span>Estudiante</span><strong>${studentName}</strong></div>
      <div class="field"><span>Correo Electrónico</span><strong>${user?.email || "-"}</strong></div>
      <div class="field"><span>Programa Académico</span><strong>${courseName}</strong></div>
      <div class="field"><span>Edición / Cohorte</span><strong>${cohort.name}</strong></div>
      <div class="field"><span>Periodo Académico</span><strong>${startStr} al ${endStr}</strong></div>
      <div class="field"><span>Código de Matrícula</span><strong>${(enrollment?.id || cohort.id).slice(0, 10).toUpperCase()}</strong></div>
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="val">${progress?.progressPercent ?? 0}%</div>
        <div class="lbl">Avance del Programa (${progress?.completedModules ?? 0}/${progress?.modules ?? modules.length} módulos)</div>
      </div>
      <div class="kpi">
        <div class="val">${progress?.attendance?.rate ?? 0}%</div>
        <div class="lbl">Asistencia Registrada</div>
      </div>
      <div class="kpi">
        <div class="val">${progress?.averageScore ?? 0}</div>
        <div class="lbl">Promedio Ponderado</div>
      </div>
    </div>

    <h3>Boleta de Calificaciones</h3>
    <table>
      <thead>
        <tr>
          <th>Evaluación / Entregable</th>
          <th style="text-align:center;">Peso</th>
          <th style="text-align:center;">Calificación</th>
          <th style="text-align:center;">Estado</th>
        </tr>
      </thead>
      <tbody>${gradesRows}</tbody>
    </table>

    <h3>Estructura Curricular y Avance</h3>
    <table>
      <thead>
        <tr>
          <th>Módulo / Semana</th>
          <th style="text-align:center;">Avance de Materiales</th>
        </tr>
      </thead>
      <tbody>${modulesRows}</tbody>
    </table>

    <div class="footer">
      Documento académico generado desde el Campus Virtual.<br/>
      ${certificate ? `Certificado Oficial Emitido — Código de verificación: <strong>${certificate.code}</strong>` : "Válido para trámites internos y acreditación de estudios en curso."}
    </div>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[80vh]">
      {/* ── PANEL IZQUIERDO: SYLLABUS ── */}
      <div className="w-full md:w-1/3 lg:w-1/4 space-y-4">
        <div className="glass p-4 rounded-xl border border-border sticky top-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Ruta de aprendizaje
          </h3>
          <div className="mb-4 rounded-lg bg-primary/[0.06] p-3" aria-label="Resumen de la ruta de aprendizaje">
            <div className="flex items-center justify-between text-xs font-semibold"><span>Avance de la ruta</span><span className="text-primary">{progress?.progressPercent ?? 0}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress?.progressPercent ?? 0}%` }} /></div>
            <p className="mt-2 text-[11px] text-muted-foreground">Completa materiales y tareas de cada módulo para avanzar.</p>
          </div>
          <div className="space-y-2">
            {modules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay módulos publicados.</p>
            ) : (
            modules.map((mod, idx) => {
              const completedMaterials = mod.materials?.filter((material) => completionByMaterial.has(material.id)).length || 0;
              const totalMaterials = mod.materials?.length || 0;
              const cleanedTitle = cleanAcademicTitle(mod.title, cohort, `Semana ${idx + 1}`);
              const isRedundantWeek = new RegExp(`^semana\\s*0?${idx + 1}$`, "i").test(cleanedTitle.trim());
              const labelText = isRedundantWeek ? `Semana ${idx + 1}` : `Semana ${idx + 1}: ${cleanedTitle}`;
              return (
              <button
                key={mod.id}
                onClick={() => setSelectedModule(mod)}
                aria-current={selectedModule?.id === mod.id ? "page" : undefined}
                className={`w-full text-left p-3 rounded-lg transition-all text-sm font-medium ${
                  selectedModule?.id === mod.id
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                  <span className="flex items-center justify-between gap-2"><span>{labelText}</span>{totalMaterials > 0 && <span className="text-[10px] opacity-75">{completedMaterials}/{totalMaterials}</span>}</span>
              </button>
              );
            })
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
            <p className="mt-1 text-sm text-muted-foreground">{cohort.name} · {modules.length} módulos de aprendizaje</p>
            {progress && (
              <div className="mt-4 max-w-xl rounded-xl border border-border/50 bg-card/70 p-3">
                <div className="flex items-center justify-between text-xs font-medium"><span>Tu progreso</span><span className="text-primary">{progress.progressPercent}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.progressPercent}%` }} /></div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{progress.completedModules} de {progress.modules} módulos completados</span>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`rounded-md border px-1.5 py-0.5 font-semibold ${progress.attendance?.rate >= 80 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted/40 text-muted-foreground"}`}>
                      Asistencia: {progress.attendance?.rate ?? 0}%
                    </span>
                    <span className={`rounded-md border px-1.5 py-0.5 font-semibold ${progress.averageScore >= 11 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted/40 text-muted-foreground"}`}>
                      Promedio: {progress.averageScore ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            )}
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
          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2">
              <Link href={`/dashboard/aula/${cohortId}`}>
                <BookOpen className="h-4 w-4" /> Ir al Aula Virtual
              </Link>
            </Button>
            <Link href="/dashboard/calendar">
              <Button variant="outline" className="hidden items-center gap-2 sm:flex">
                <CalendarDays className="h-4 w-4" /> Calendario
              </Button>
            </Link>
            <Link href={`/dashboard/classes/${cohortId}/forum`}>
              <Button variant="outline" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Foro
              </Button>
            </Link>
            <Button variant="outline" onClick={handleDownloadAcademicRecord} className="flex items-center gap-2 cursor-pointer">
              <Printer className="h-4 w-4" /> Constancia / Boleta PDF
            </Button>
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

                <div className="rounded-xl border border-border/50 bg-card p-4" aria-labelledby="certificate-requirements-title">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h4 id="certificate-requirements-title" className="font-semibold">Requisitos para certificarte</h4><span className="text-xs text-muted-foreground">Avance académico</span></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className={`rounded-lg border p-3 text-sm ${progress.completedModules === progress.modules ? "border-emerald-500/30 bg-emerald-500/10" : "border-border"}`}><span className="font-semibold">{progress.completedModules === progress.modules ? "✓" : "1."} Ruta completa</span><p className="mt-1 text-xs text-muted-foreground">{progress.completedModules}/{progress.modules} módulos</p></div><div className={`rounded-lg border p-3 text-sm ${progress.attendance.rate >= 80 ? "border-emerald-500/30 bg-emerald-500/10" : "border-border"}`}><span className="font-semibold">{progress.attendance.rate >= 80 ? "✓" : "2."} Asistencia mínima</span><p className="mt-1 text-xs text-muted-foreground">{progress.attendance.rate}% registrado</p></div><div className={`rounded-lg border p-3 text-sm ${progress.averageScore >= 11 ? "border-emerald-500/30 bg-emerald-500/10" : "border-border"}`}><span className="font-semibold">{progress.averageScore >= 11 ? "✓" : "3."} Nota aprobatoria</span><p className="mt-1 text-xs text-muted-foreground">Promedio {progress.averageScore}</p></div></div>
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
                        key={`${r.sessionId || 'legacy'}-${r.date}-${i}`}
                        title={`${new Date(r.date).toLocaleDateString()}${r.sessionTitle ? ` · ${r.sessionTitle}` : ''} - ${r.isPresent ? 'Presente' : r.isExcused ? 'Justificado' : 'Ausente'}`}
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
              <h3 className="text-2xl font-bold mb-2">{cleanAcademicTitle(selectedModule.title, cohort, selectedModule.title)}</h3>
              <p className="text-muted-foreground">{selectedModule.description}</p>
              {progressError && <p role="alert" className="mt-3 text-sm text-destructive">{progressError}</p>}
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
                        <p className="font-bold">{cleanAcademicTitle(session.title, cohort, session.title)}</p>
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
                  {selectedModule.materials?.map((mat: Material) => {
                    const completed = Boolean(progress?.materialProgress?.find((item) => item.materialId === mat.id)?.completed);
                    return (
                      <div key={mat.id} id={`material-${mat.id}`} tabIndex={-1} className={`glass scroll-mt-5 rounded-xl border p-4 focus:outline-2 focus:outline-primary ${resumeMaterialId === mat.id ? "border-primary bg-primary/5" : "border-border"}`}>
                        {resumeMaterialId === mat.id && <p className="mb-3 text-xs font-semibold text-primary">Siguiente material pendiente</p>}
                        <a href={resolveFileUrl(mat.fileUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-primary">
                          <FileText className="h-8 w-8 text-primary opacity-80" />
                          <div><p className="font-bold text-sm">{mat.title}</p><p className="text-xs text-muted-foreground">{mat.type}</p></div>
                        </a>
                        <Button type="button" variant={completed ? "secondary" : "outline"} size="sm" className="mt-3 w-full gap-2" onClick={() => toggleMaterial(mat.id)}>
                          <CheckCircle2 className="h-4 w-4" /> {completed ? "Completado" : "Marcar como completado"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="flex flex-col justify-between gap-3 border-t border-border/50 pt-5 sm:flex-row">
              <Button type="button" variant="outline" className="gap-2" disabled={selectedModuleIndex <= 0} onClick={() => setSelectedModule(modules[selectedModuleIndex - 1])}>
                <ArrowLeft className="h-4 w-4" /> Módulo anterior
              </Button>
              <Button type="button" className="gap-2" disabled={selectedModuleIndex < 0 || selectedModuleIndex >= modules.length - 1} onClick={() => setSelectedModule(modules[selectedModuleIndex + 1])}>
                Siguiente módulo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in-up">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Mis Tareas y Entregables Semanales
            </h3>

            <WeeklyTaskTracker evaluations={evaluations} />
          </div>
        )}

      </div>

      <EvaluateTeacherModal
        isOpen={isEvaluateOpen}
        onClose={() => setIsEvaluateOpen(false)}
        cohort={cohort}
      />
    </div>
  );
}
