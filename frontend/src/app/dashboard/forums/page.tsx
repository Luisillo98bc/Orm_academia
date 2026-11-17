"use client";

import { useEffect, useState, useEffectEvent } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Loader2,
  MessageSquare,
  Plus,
  Users,
  MessagesSquare,
  ChevronRight,
  Calendar,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  X,
  Send,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Cohort as AcademicCohort, Enrollment } from "@/types/domain";
import { PageHeader } from "@/components/dashboard/page-header";
import { useConfirm } from "@/components/confirm-provider";
import { EditContentModal, type EditableContent } from "@/components/teacher/edit-content-modal";

interface Forum {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  author?: { id: string; firstName: string; lastName: string };
  _count: { messages: number };
  messages?: { createdAt: string; author: { firstName: string; lastName: string } }[];
}

interface Cohort {
  id: string;
  name: string;
  isActive: boolean;
  course?: { name: string };
  cohort?: { name: string; course: { name: string } };
}

export default function ForumsPage() {
  const { user } = useAuth();
  const confirmAction = useConfirm();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [forums, setForums] = useState<Forum[]>([]);
  const [loadingForums, setLoadingForums] = useState(false);
  const [showCreateForum, setShowCreateForum] = useState(false);
  const [newForumTitle, setNewForumTitle] = useState("");
  const [newForumDescription, setNewForumDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [expandedForums, setExpandedForums] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [unanswered, setUnanswered] = useState(false);
  const [recentFirst, setRecentFirst] = useState(true);
  const visibleForums = forums.filter(forum => `${forum.title} ${forum.description || ""}`.toLowerCase().includes(search.toLowerCase()) && (!unanswered || forum._count.messages === 0)).sort((a, b) => recentFirst ? new Date(b.messages?.[0]?.createdAt || b.createdAt).getTime() - new Date(a.messages?.[0]?.createdAt || a.createdAt).getTime() : a.title.localeCompare(b.title));
  const [editingForum, setEditingForum] = useState<EditableContent | null>(null);

  const toggleExpand = (forumId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedForums((prev) => ({ ...prev, [forumId]: !prev[forumId] }));
  };

  const role = user?.roles?.[0];
  const isAdminOrTeacher = role === "ADMIN" || role === "DOCENTE";

  const loadCohorts = async () => {
    setLoading(true);
    try {
      if (role === "ESTUDIANTE") {
        // Get enrolled cohorts
        const enrollments = await fetchApi("/academic/enrollments/me");
        const enrollmentItems: Enrollment[] = enrollments?.data || enrollments || [];
        const mapped = enrollmentItems.filter((enrollment: Enrollment) => enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED").map((enrollment: Enrollment) => ({
          id: enrollment.cohort?.id || enrollment.cohortId,
          name: enrollment.cohort?.name || "Cohorte",
          isActive: true,
          course: enrollment.cohort?.course || { name: "Curso" },
        }));
        setCohorts(mapped);
        if (mapped.length > 0) {
          setSelectedCohort(mapped[0].id);
        }
      } else {
        // El backend devuelve todas para ADMIN y solo las asignadas para DOCENTE.
        const data = await fetchApi("/academic/cohorts");
        const cohortItems: AcademicCohort[] = data?.data || data || [];
        setCohorts(
          cohortItems.map((cohort: AcademicCohort) => ({
            id: cohort.id,
            name: cohort.name,
            isActive: cohort.isActive,
            course: cohort.course || { name: "Curso" },
          }))
        );
        if (cohortItems.length > 0) {
          setSelectedCohort(cohortItems[0].id);
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar cohortes"));
    } finally {
      setLoading(false);
    }
  };

    const loadCohortsEffect = useEffectEvent(loadCohorts);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCohortsEffect();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const loadForums = async (cohortId: string) => {
    setLoadingForums(true);
    try {
      const data = await fetchApi(
        `/communication/cohorts/${cohortId}/forums`
      );
      setForums(data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar foros"));
    } finally {
      setLoadingForums(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (selectedCohort) {
      loadForums(selectedCohort);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedCohort]);

  const handleCreateForum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForumTitle.trim() || !selectedCohort) return;
    setCreating(true);
    setError("");
    try {
      await fetchApi(`/communication/cohorts/${selectedCohort}/forums`, {
        method: "POST",
        body: JSON.stringify({
          title: newForumTitle,
          description: newForumDescription,
        }),
      });
      setSuccess("Foro creado exitosamente");
      setNewForumTitle("");
      setNewForumDescription("");
      setShowCreateForum(false);
      await loadForums(selectedCohort);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al crear el foro"));
    } finally {
      setCreating(false);
    }
  };

  const handleEditForum = (forum: Forum, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingForum({ kind: "forum", id: forum.id, title: forum.title, description: forum.description });
  };

  const handleDeleteForum = async (forum: Forum, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!(await confirmAction({ title: "Eliminar foro", description: `Se eliminará “${forum.title}” junto con sus mensajes. Esta acción no se puede deshacer.`, confirmLabel: "Eliminar foro" }))) return;

    try {
      await fetchApi(`/communication/forums/${forum.id}`, { method: "DELETE" });
      setSuccess("Foro eliminado correctamente");
      await loadForums(selectedCohort);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo eliminar el foro"));
    }
  };

  const selectedCohortData = cohorts.find((c) => c.id === selectedCohort);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Cargando foros...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader eyebrow="Comunidad académica" title="Foros de discusión" description="Participa en las conversaciones de tus cohortes y comparte con la comunidad." />

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-2 p-4 text-green-600 bg-green-100 rounded-lg dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <p>{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {cohorts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-6 rounded-full bg-muted/50 mb-6">
            <MessagesSquare className="h-16 w-16 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Sin cohortes</h3>
          <p className="text-muted-foreground max-w-md">
            No tienes cohortes asignadas aún.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Cohort selector sidebar */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Cohortes
            </h3>
            <div className="space-y-1">
              {cohorts.map((cohort, index) => (
                <button
                  key={cohort.id ? `cohort-${cohort.id}-${index}` : `cohort-idx-${index}`}
                  onClick={() => setSelectedCohort(cohort.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all text-sm ${
                    selectedCohort === cohort.id
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "hover:bg-muted text-foreground border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{cohort.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {cohort.course?.name || ""}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Forums list */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">
                  {selectedCohortData?.name || "Selecciona una cohorte"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedCohortData?.course?.name || ""}
                </p>
              </div>
              {isAdminOrTeacher && selectedCohort && (
                <Button
                  onClick={() => setShowCreateForum(!showCreateForum)}
                  className="gap-2 shadow-md"
                  size="sm"
                >
                  {showCreateForum ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {showCreateForum ? "Cancelar" : "Nuevo Foro"}
                </Button>
              )}
            </div>

            {/* Create forum form */}
            {showCreateForum && (
              <form
                onSubmit={handleCreateForum}
                className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-card glass p-5"
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">
                      Título del foro / Tema de discusión
                    </label>
                    <Input
                      placeholder="Ej: Debate - Dudas y entregables de la Semana 3..."
                      value={newForumTitle}
                      onChange={(e) => setNewForumTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">
                      Instrucciones / Descripción de la Tarea
                    </label>
                    <textarea
                      placeholder="Describe el tema o la tarea que deben realizar antes de comentar..."
                      value={newForumDescription}
                      onChange={(e) => setNewForumDescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="submit"
                    disabled={creating}
                    className="gap-2"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Crear Foro de Tarea
                  </Button>
                </div>
              </form>
            )}

            <div className="workspace-toolbar mb-4"><label className="min-w-36 flex-1">Buscar tema<Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Título o descripción" /></label><label className="!flex !flex-row items-center"><input type="checkbox" checked={unanswered} onChange={event => setUnanswered(event.target.checked)} />Sin respuestas ({forums.filter(forum => forum._count.messages === 0).length})</label><label>Orden<select value={recentFirst ? "recent" : "name"} onChange={event => setRecentFirst(event.target.value === "recent")}><option value="recent">Actividad reciente</option><option value="name">Título</option></select></label></div>
            {loadingForums ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : visibleForums.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-border/50 rounded-xl bg-card/50">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  No hay foros para esta cohorte y estos filtros.
                </p>
                {isAdminOrTeacher && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Crea el primer foro para iniciar la discusión.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleForums.map((forum, index) => (
                  <div
                    key={forum.id ? `forum-${forum.id}-${index}` : `forum-idx-${index}`}
                    onClick={() =>
                      router.push(`/dashboard/forums/${forum.id}`)
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        router.push(`/dashboard/forums/${forum.id}`);
                      }
                    }}
                    className="w-full text-left rounded-xl border border-border/50 bg-card glass p-5 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 mt-1">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div>
                            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {forum.title}
                            </h4>
                            {forum.author && (
                              <p className="text-xs text-muted-foreground font-medium">
                                Creado por: {forum.author.firstName} {forum.author.lastName}
                              </p>
                            )}
                          </div>
                          {forum.description && (
                            <div className="text-sm text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/20 space-y-1">
                              <p className={cn(
                                "leading-relaxed whitespace-pre-wrap text-xs",
                                !expandedForums[forum.id] && "line-clamp-2"
                              )}>
                                {forum.description}
                              </p>
                              {forum.description.length > 100 && (
                                <span
                                  onClick={(e) => toggleExpand(forum.id, e)}
                                  className="text-xs text-primary hover:underline font-bold mt-1 inline-block cursor-pointer"
                                >
                                  {expandedForums[forum.id] ? "Ver menos" : "Ver completo"}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {forum._count.messages} mensaje
                              {forum._count.messages !== 1 ? "s" : ""}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(
                                forum.createdAt
                              ).toLocaleDateString("es-ES")}
                            </span>
                            {forum.messages && forum.messages.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-primary/80">
                                  Último msj: {new Date(forum.messages[0].createdAt).toLocaleDateString("es-ES")} por {forum.messages[0].author.firstName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        {isAdminOrTeacher && (
                          <>
                            <button
                              type="button"
                              onClick={(event) => handleEditForum(forum, event)}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              aria-label={`Editar ${forum.title}`}
                              title="Editar foro"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => handleDeleteForum(forum, event)}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Eliminar ${forum.title}`}
                              title="Eliminar foro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <ChevronRight className="mt-2 h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <EditContentModal
        key={editingForum ? `${editingForum.kind}-${editingForum.id}` : "edit-forum-closed"}
        content={editingForum}
        onClose={() => setEditingForum(null)}
        onSuccess={async () => {
          setSuccess("Foro actualizado correctamente");
          await loadForums(selectedCohort);
        }}
      />
    </div>
  );
}
