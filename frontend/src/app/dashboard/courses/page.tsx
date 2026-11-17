"use client";

import type { Cohort, Course } from "@/types/domain";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  fetchApi,
  getErrorMessage,
} from "@/lib/api";
import { getMediaUrl } from "@/lib/media";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GraduationCap,
  ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { CreateCourseModal } from "@/components/admin/create-course-modal";
import { CreateCohortModal } from "@/components/admin/create-cohort-modal";
import { PageHeader } from "@/components/dashboard/page-header";
import { useConfirm } from "@/components/confirm-provider";
import { toast } from "sonner";

const LEVEL_LABELS: Record<string, { label: string; class: string }> = {
  BEGINNER: {
    label: "Principiante",
    class: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  INTERMEDIATE: {
    label: "Intermedio",
    class: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  ADVANCED: {
    label: "Avanzado",
    class: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
};

export default function CoursesPage() {
  const { user } = useAuth();
  const confirmAction = useConfirm();

  const [courses, setCourses] = useState<Course[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Filtros y vista
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [publishedFilter, setPublishedFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [preview, setPreview] = useState<Course | null>(null);
  const missingFields = (course: Course) => [!course.description?.trim() && "descripción", !course.imageUrl && "portada", !course.durationHours && "duración", !course.whatYouWillLearn?.trim() && "objetivos"].filter(Boolean) as string[];

  // Modales
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [isCreateCohortOpen, setIsCreateCohortOpen] = useState(false);
  const [selectedCourseForCohort, setSelectedCourseForCohort] = useState<Course | null>(null);

  // Edición
  const [editing, setEditing] = useState<Course | null>(null);
  const [editTab, setEditTab] = useState<"general" | "marketing" | "media">("general");
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    promotionalVideoUrl: "",
    whatYouWillLearn: "",
    requirements: "",
    targetAudience: "",
    level: "BEGINNER",
    durationHours: 0,
    isPublished: true,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const [coursesData, cohortsData] = await Promise.all([
        fetchApi("/academic/courses"),
        fetchApi("/academic/cohorts").catch(() => []),
      ]);
      setCourses(coursesData || []);
      setCohorts(cohortsData || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar los cursos"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchApi("/academic/courses"),
      fetchApi("/academic/cohorts").catch(() => []),
    ])
      .then(([coursesData, cohortsData]) => {
        if (!active) return;
        setCourses(coursesData || []);
        setCohorts(cohortsData || []);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getErrorMessage(err, "Error al cargar los cursos"));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Mapeo de cohortes activas por curso
  const cohortsByCourseId = useMemo(() => {
    const map = new Map<string, Cohort[]>();
    for (const c of cohorts) {
      if (!c.courseId) continue;
      const list = map.get(c.courseId) || [];
      list.push(c);
      map.set(c.courseId, list);
    }
    return map;
  }, [cohorts]);

  // Cursos filtrados
  const filteredCourses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return courses.filter((course) => {
      if (term) {
        const matchesCode = course.code?.toLowerCase().includes(term);
        const matchesName = course.name?.toLowerCase().includes(term);
        const matchesDesc = course.description?.toLowerCase().includes(term);
        if (!matchesCode && !matchesName && !matchesDesc) return false;
      }
      if (levelFilter !== "ALL" && course.level !== levelFilter) {
        return false;
      }
      if (publishedFilter === "PUBLISHED" && !course.isPublished) {
        return false;
      }
      if (publishedFilter === "DRAFT" && course.isPublished) {
        return false;
      }
      if (publishedFilter === "WITH_COHORTS") {
        const cList = cohortsByCourseId.get(course.id) || [];
        if (cList.length === 0) return false;
      }
      if (publishedFilter === "INCOMPLETE" && !missingFields(course).length) return false;
      return true;
    });
  }, [courses, search, levelFilter, publishedFilter, cohortsByCourseId]);

  // Métricas de cabecera
  const metrics = useMemo(() => {
    const total = courses.length;
    const published = courses.filter((c) => c.isPublished).length;
    const withActiveCohorts = courses.filter(
      (c) => (cohortsByCourseId.get(c.id) || []).length > 0
    ).length;
    const totalCohorts = cohorts.length;
    return { total, published, withActiveCohorts, totalCohorts };
  }, [courses, cohorts, cohortsByCourseId]);

  const handleEdit = (c: Course) => {
    setEditing(c);
    setEditTab("general");
    setEditForm({
      name: c.name,
      description: c.description || "",
      promotionalVideoUrl: c.promotionalVideoUrl || "",
      whatYouWillLearn: c.whatYouWillLearn || "",
      requirements: c.requirements || "",
      targetAudience: c.targetAudience || "",
      level: c.level,
      durationHours: c.durationHours,
      isPublished: c.isPublished ?? true,
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditLoading(true);
    try {
      await fetchApi(`/academic/courses/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          durationHours: Number(editForm.durationHours),
        }),
      });
      toast.success("Curso actualizado correctamente");
      setEditing(null);
      void loadData(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al actualizar curso"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleTogglePublish = async (course: Course) => {
    setTogglingPublishId(course.id);
    const nextState = !course.isPublished;
    try {
      await fetchApi(`/academic/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: nextState }),
      });
      toast.success(
        nextState
          ? `«${course.name}» ahora está visible en el catálogo público`
          : `«${course.name}» fue cambiado a modo borrador`
      );
      void loadData(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo cambiar el estado de publicación"));
    } finally {
      setTogglingPublishId(null);
    }
  };

  const handleCourseImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    courseId: string
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setUploadingImage(true);
    try {
      await fetchApi(`/academic/courses/${courseId}/image`, {
        method: "POST",
        body: formData,
      });
      toast.success("Portada actualizada correctamente");
      void loadData(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al subir imagen"));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = async (course: Course) => {
    const hasCohorts = (cohortsByCourseId.get(course.id) || []).length > 0;
    const description = hasCohorts
      ? `Atención: este curso tiene ${cohortsByCourseId.get(course.id)!.length} cohorte(s) asociada(s). Si lo eliminas, se ocultará del catálogo general.`
      : "El curso se retirará del catálogo. Puedes restaurarlo más tarde desde la papelera si es necesario.";

    if (
      !(await confirmAction({
        title: `¿Eliminar «${course.name}»?`,
        description,
        confirmLabel: "Sí, eliminar curso",
      }))
    )
      return;

    try {
      await fetchApi(`/academic/courses/${course.id}`, { method: "DELETE" });
      toast.success("Curso enviado a la papelera");
      void loadData(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al eliminar el curso"));
    }
  };

  const handleOpenCohortModal = (course: Course) => {
    setSelectedCourseForCohort(course);
    setIsCreateCohortOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando catálogo de cursos…</p>
      </div>
    );
  }

  if (
    !user ||
    !user.roles?.some((r) =>
      typeof r === "string" ? r === "ADMIN" : (r as { name?: string })?.name === "ADMIN"
    )
  ) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-sm font-medium text-destructive">
        Acceso restringido: Se requieren permisos de Administrador para gestionar el catálogo académico.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <PageHeader
        eyebrow="Catálogo Académico"
        title="Gestión de Cursos"
        description="Administra la oferta académica, configura programas y habilita nuevas ediciones para los estudiantes."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => void loadData(true)}
              title="Recargar catálogo"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button onClick={() => setIsCreateCourseOpen(true)} className="gap-2 shadow-sm">
              <PlusCircle className="h-4 w-4" />
              Nuevo Curso
            </Button>
          </div>
        }
      />

      {/* Alertas */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError("")} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Fila de Indicadores Minimalistas (KPIs) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Programas Registrados</span>
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{metrics.total}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Cursos en base de datos</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Publicados en Web</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {metrics.published}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Visibles para postulantes</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Con Ediciones Abiertas</span>
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {metrics.withActiveCohorts}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Listos para matrícula</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total de Cohortes</span>
            <GraduationCap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{metrics.totalCohorts}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Grupos históricos y activos</p>
        </div>
      </div>

      {/* Barra de Filtros y Control Unificada */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Buscador */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código..."
              className="h-9 pl-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro de Nivel */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filtrar por nivel"
          >
            <option value="ALL">Todos los niveles</option>
            <option value="BEGINNER">Principiante</option>
            <option value="INTERMEDIATE">Intermedio</option>
            <option value="ADVANCED">Avanzado</option>
          </select>

          {/* Filtro de Publicación */}
          <select
            value={publishedFilter}
            onChange={(e) => setPublishedFilter(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filtrar por estado de publicación"
          >
            <option value="ALL">Todos los estados</option>
            <option value="PUBLISHED">Solo publicados</option>
            <option value="DRAFT">Solo borradores</option>
            <option value="WITH_COHORTS">Con cohortes abiertas</option>
            <option value="INCOMPLETE">Información por completar</option>
          </select>

          {(search || levelFilter !== "ALL" || publishedFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setLevelFilter("ALL");
                setPublishedFilter("ALL");
              }}
              className="h-9 text-xs text-primary"
            >
              Limpiar
            </Button>
          )}
        </div>

        {/* Alternador de Vista (Tabla vs. Grid) y Contador */}
        <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-2 sm:border-0 sm:pt-0">
          <span className="text-xs font-medium text-muted-foreground">
            {filteredCourses.length}{" "}
            {filteredCourses.length === 1 ? "curso encontrado" : "cursos encontrados"}
          </span>

          <div className="flex items-center rounded-xl border border-border/60 bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista de tabla"
              aria-label="Vista de tabla"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista de cuadrícula"
              aria-label="Vista de cuadrícula"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Estado Vacío */}
      {filteredCourses.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/50 py-16 text-center">
          <div className="rounded-full bg-muted/60 p-4">
            <BookOpen className="h-8 w-8 text-muted-foreground/80" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">No se encontraron cursos</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {search || levelFilter !== "ALL" || publishedFilter !== "ALL"
              ? "Prueba cambiando los filtros o la búsqueda ingresada."
              : "Aún no hay cursos registrados en el catálogo. Comienza creando el primero."}
          </p>
          {search || levelFilter !== "ALL" || publishedFilter !== "ALL" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setLevelFilter("ALL");
                setPublishedFilter("ALL");
              }}
              className="mt-4"
            >
              Restablecer filtros
            </Button>
          ) : (
            <Button onClick={() => setIsCreateCourseOpen(true)} size="sm" className="mt-4 gap-2">
              <PlusCircle className="h-4 w-4" />
              Crear primer curso
            </Button>
          )}
        </div>
      )}

      {/* VISTA 1: TABLA PROFESIONAL Y ESPACIOSA */}
      {filteredCourses.length > 0 && viewMode === "table" && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border/50 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Curso
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Nivel
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Duración
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Ediciones
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Visibilidad
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredCourses.map((course) => {
                  const courseCohorts = cohortsByCourseId.get(course.id) || [];
                  const activeCohortsCount = courseCohorts.filter(
                    (c) => c.isActive && new Date(c.endDate).getTime() >= Date.now()
                  ).length;
                  const levelBadge = LEVEL_LABELS[course.level] || {
                    label: course.level,
                    class: "border-border bg-muted text-muted-foreground",
                  };

                  return (
                    <tr
                      key={course.id}
                      className="group transition-colors hover:bg-muted/20"
                    >
                      {/* Portada, Nombre y Código */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3.5">
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted shadow-sm">
                            {course.imageUrl ? (
                              <Image
                                unoptimized
                                width={44}
                                height={44}
                                src={getMediaUrl(course.imageUrl) || ""}
                                alt={course.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary/60">
                                <BookOpen className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                              {course.name}
                            </p>
                            {missingFields(course).length > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Por completar: {missingFields(course).join(", ")}</p>}
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-primary/80">
                                {course.code}
                              </span>
                              {course.description && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[280px]">
                                    {course.description}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Nivel */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${levelBadge.class}`}
                        >
                          {levelBadge.label}
                        </span>
                      </td>

                      {/* Duración */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{course.durationHours > 0 ? `${course.durationHours} h` : "Flexible"}</span>
                        </div>
                      </td>

                      {/* Cohortes */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {activeCohortsCount > 0 ? (
                          <Link
                            href="/dashboard/cohorts"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            title="Ver cohortes en su panel"
                          >
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            <span>
                              {activeCohortsCount}{" "}
                              {activeCohortsCount === 1 ? "cohorte abierta" : "cohortes abiertas"}
                            </span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenCohortModal(course)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                            title="Crear primera cohorte"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span>Abrir edición</span>
                          </button>
                        )}
                      </td>

                      {/* Visibilidad Web */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <button
                          type="button"
                          disabled={togglingPublishId === course.id}
                          onClick={() => handleTogglePublish(course)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                            course.isPublished
                              ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          title="Clic para cambiar visibilidad pública"
                        >
                          {togglingPublishId === course.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                course.isPublished ? "bg-emerald-500" : "bg-muted-foreground/60"
                              }`}
                            />
                          )}
                          <span>{course.isPublished ? "Publicado" : "Borrador"}</span>
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setPreview(course)}>Vista previa</Button>
                          {/* Abrir cohorte rápida */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenCohortModal(course)}
                            className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-primary"
                            title="Abrir nueva cohorte de este curso"
                          >
                            <PlusCircle className="h-3.5 w-3.5 mr-1" />
                            Cohorte
                          </Button>

                          {/* Ver en landing pública */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            asChild
                            title="Ver en la página de Cursos"
                          >
                            <Link href="/cursos" target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>

                          {/* Editar */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(course)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Editar curso"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          {/* Eliminar */}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(course)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Eliminar curso"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 2: CUADRÍCULA / GRID VISUAL ELEGANTE */}
      {filteredCourses.length > 0 && viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => {
            const courseCohorts = cohortsByCourseId.get(course.id) || [];
            const activeCohortsCount = courseCohorts.filter(
              (c) => c.isActive && new Date(c.endDate).getTime() >= Date.now()
            ).length;
            const levelBadge = LEVEL_LABELS[course.level] || {
              label: course.level,
              class: "border-border bg-muted text-muted-foreground",
            };

            return (
              <div
                key={course.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  {/* Portada */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border/50 bg-muted">
                    {course.imageUrl ? (
                      <Image
                        unoptimized
                        fill
                        src={getMediaUrl(course.imageUrl) || ""}
                        alt={course.name}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary/40">
                        <BookOpen className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase backdrop-blur-md ${levelBadge.class}`}
                      >
                        {levelBadge.label}
                      </span>
                    </div>
                    <div className="absolute right-2.5 top-2.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(course)}
                        disabled={togglingPublishId === course.id}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md transition-colors ${
                          course.isPublished
                            ? "bg-emerald-600/90 text-white"
                            : "bg-black/60 text-white/80"
                        }`}
                      >
                        {course.isPublished ? "Publicado" : "Borrador"}
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="mt-3.5">
                    <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                      {course.code}
                    </p>
                    <h3 className="mt-1 font-semibold text-foreground group-hover:text-primary transition-colors">
                      {course.name}
                    </h3>
                    {missingFields(course).length > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Por completar: {missingFields(course).join(", ")}</p>}
                    {course.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {course.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Pie de Tarjeta */}
                <div className="mt-4 border-t border-border/50 pt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {course.durationHours > 0 ? `${course.durationHours} hrs` : "Flexible"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {activeCohortsCount > 0
                        ? `${activeCohortsCount} ${activeCohortsCount === 1 ? "cohorte" : "cohortes"}`
                        : "Sin cohortes"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPreview(course)}>Vista previa</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCohortModal(course)}
                      className="h-8 flex-1 text-xs"
                    >
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                      Cohorte
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(course)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Editar curso"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(course)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Eliminar curso"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE EDICIÓN PROFESIONAL CON PESTAÑAS */}
      {preview && <Modal title={`Vista previa de ${preview.name}`} onClose={() => setPreview(null)}><article className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">{preview.imageUrl && <div className="relative h-48"><Image unoptimized fill src={getMediaUrl(preview.imageUrl) || ""} alt={preview.name} className="object-cover" /></div>}<div className="space-y-4 p-6"><div className="flex items-start justify-between gap-3"><div><p className="page-eyebrow">Vista previa · {preview.isPublished ? "Publicado" : "Borrador"}</p><h2>{preview.name}</h2></div><Button variant="ghost" size="icon" aria-label="Cerrar vista previa" onClick={() => setPreview(null)}><X className="h-5 w-5" /></Button></div><p className="text-sm text-muted-foreground">{preview.description || "Agrega una descripción para explicar el programa."}</p><p className="text-sm font-medium">{LEVEL_LABELS[preview.level]?.label || preview.level} · {preview.durationHours} horas</p><section><h3>Qué aprenderás</h3><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{preview.whatYouWillLearn || "Objetivos pendientes de completar."}</p></section><section><h3>Requisitos</h3><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{preview.requirements || "Sin requisitos especificados."}</p></section>{missingFields(preview).length > 0 && <p className="workspace-note">Revisa antes de publicar: {missingFields(preview).join(", ")}.</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPreview(null)}>Cerrar</Button><Button onClick={() => { handleEdit(preview); setPreview(null); }}>Editar información</Button></div></div></article></Modal>}
      {editing && (
        <Modal title="Editar Curso" onClose={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            {/* Header del Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
              <div>
                <p className="page-eyebrow">Edición de Programa</p>
                <h2 className="mt-0.5 text-xl font-bold text-foreground">{editing.name}</h2>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">Código: {editing.code}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(null)}
                className="h-8 w-8 rounded-full"
                aria-label="Cerrar modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Pestañas Limpias */}
            <div className="mt-4 flex border-b border-border/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEditTab("general")}
                className={`border-b-2 px-4 py-2.5 transition-colors ${
                  editTab === "general"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Datos Generales
              </button>
              <button
                type="button"
                onClick={() => setEditTab("marketing")}
                className={`border-b-2 px-4 py-2.5 transition-colors ${
                  editTab === "marketing"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Contenido & Alcance
              </button>
              <button
                type="button"
                onClick={() => setEditTab("media")}
                className={`border-b-2 px-4 py-2.5 transition-colors ${
                  editTab === "media"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Portada & Visibilidad
              </button>
            </div>

            {/* Contenido según pestaña */}
            <div className="mt-5 max-h-[60vh] overflow-y-auto pr-1">
              {editTab === "general" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground">Nombre del Curso</label>
                    <Input
                      className="mt-1 text-sm"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Ej. Desarrollo Web Fullstack"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground">Nivel</label>
                      <select
                        className="mt-1 flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={editForm.level}
                        onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                      >
                        <option value="BEGINNER">Principiante</option>
                        <option value="INTERMEDIATE">Intermedio</option>
                        <option value="ADVANCED">Avanzado</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground">Duración Estimada (Horas)</label>
                      <Input
                        type="number"
                        min={0}
                        className="mt-1 text-sm"
                        value={editForm.durationHours}
                        onChange={(e) =>
                          setEditForm({ ...editForm, durationHours: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground">Descripción Resumida</label>
                    <textarea
                      className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm min-h-[90px] focus:outline-none focus:ring-1 focus:ring-primary"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Breve resumen del enfoque del programa..."
                    />
                  </div>
                </div>
              )}

              {editTab === "marketing" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground">Video Promocional (URL)</label>
                      <Input
                        className="mt-1 text-sm"
                        value={editForm.promotionalVideoUrl}
                        onChange={(e) =>
                          setEditForm({ ...editForm, promotionalVideoUrl: e.target.value })
                        }
                        placeholder="https://youtube.com/..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground">Público Objetivo</label>
                      <Input
                        className="mt-1 text-sm"
                        value={editForm.targetAudience}
                        onChange={(e) =>
                          setEditForm({ ...editForm, targetAudience: e.target.value })
                        }
                        placeholder="Ej. Profesionales, estudiantes universitarios..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      ¿Qué aprenderán? (Un punto por línea)
                    </label>
                    <textarea
                      className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm min-h-[90px] focus:outline-none focus:ring-1 focus:ring-primary"
                      value={editForm.whatYouWillLearn}
                      onChange={(e) =>
                        setEditForm({ ...editForm, whatYouWillLearn: e.target.value })
                      }
                      placeholder="- Arquitectura limpia&#10;- React y Next.js&#10;- APIs REST con NestJS"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Requisitos Previos (Un punto por línea)
                    </label>
                    <textarea
                      className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm min-h-[70px] focus:outline-none focus:ring-1 focus:ring-primary"
                      value={editForm.requirements}
                      onChange={(e) => setEditForm({ ...editForm, requirements: e.target.value })}
                      placeholder="- Conocimientos básicos de computación&#10;- Conexión a internet"
                    />
                  </div>
                </div>
              )}

              {editTab === "media" && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-foreground">Imagen de Portada Actual</label>
                    <div className="mt-2 flex items-center gap-4 rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                        {editing.imageUrl ? (
                          <Image
                            unoptimized
                            fill
                            src={getMediaUrl(editing.imageUrl) || ""}
                            alt={editing.name}
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">Reemplazar portada</p>
                        <p>Formatos recomendados: JPG, PNG o WebP (16:9, ej. 1280x720).</p>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-primary hover:underline">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Seleccionar archivo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleCourseImageUpload(e, editing.id)}
                            disabled={uploadingImage}
                            className="sr-only"
                          />
                        </label>
                        {uploadingImage && (
                          <p className="flex items-center gap-1 text-primary">
                            <Loader2 className="h-3 w-3 animate-spin" /> Subiendo imagen…
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Publicación en Catálogo Web</p>
                        <p className="text-xs text-muted-foreground">
                          Si está activo, los visitantes podrán ver este curso en la página pública.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={editForm.isPublished}
                        onChange={(e) =>
                          setEditForm({ ...editForm, isPublished: e.target.checked })
                        }
                        className="h-4 w-4 rounded accent-primary"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer con Acciones */}
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/50 pt-4">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={editLoading}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={editLoading} className="gap-2">
                {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Crear Curso */}
      <CreateCourseModal
        isOpen={isCreateCourseOpen}
        onClose={() => setIsCreateCourseOpen(false)}
        onSuccess={() => {
          void loadData(true);
          setIsCreateCourseOpen(false);
          toast.success("Curso creado correctamente");
        }}
      />

      {/* Modal Crear Cohorte vinculada al curso */}
      {isCreateCohortOpen && (
        <CreateCohortModal
          isOpen={isCreateCohortOpen}
          onClose={() => {
            setIsCreateCohortOpen(false);
            setSelectedCourseForCohort(null);
          }}
          onSuccess={() => {
            void loadData(true);
            setIsCreateCohortOpen(false);
            setSelectedCourseForCohort(null);
            toast.success("Nueva cohorte abierta correctamente");
          }}
          preselectedCourseId={selectedCourseForCohort?.id}
        />
      )}
    </div>
  );
}
