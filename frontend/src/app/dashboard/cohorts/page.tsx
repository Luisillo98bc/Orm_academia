"use client";

import type { Cohort, User } from "@/types/domain";

import { useState, useEffect } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  PlusCircle,
  Calendar,
  BookOpen,
  Users,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  Settings,
  UserCheck,
  UserX,
  Copy,
} from "lucide-react";
import { CreateCohortModal } from "@/components/admin/create-cohort-modal";
import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/dashboard/page-header";
import { getCohortImageUrl } from "@/lib/media";
import { useConfirm } from "@/components/confirm-provider";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";
import { Input } from "@/components/ui/input";

export default function CohortsPage() {
  const { user } = useAuth();
  const confirmAction = useConfirm();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [teachersList, setTeachersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [recentClonedIds, setRecentClonedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.sessionStorage.getItem("academy:recent-cloned-cohorts");
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  const isClonedName = (name?: string) =>
    Boolean(name && (/^\[CLON\]/i.test(name.trim()) || /\(Nueva Edici[oó]n\)/i.test(name) || /\(Clon\)/i.test(name)));

  const stage = (cohort: Cohort) => !cohort.isActive ? "closed" : new Date(cohort.endDate) < new Date() ? "finished" : new Date(cohort.startDate) > new Date() ? "upcoming" : "running";
  const stageLabel: Record<string, string> = { closed: "Cerrada", finished: "Finalizada", upcoming: "Próximo inicio", running: "En curso" };

  const filteredCohorts = cohorts
    .filter(
      (cohort) =>
        `${cohort.name} ${cohort.course?.name || ""} ${cohort.teachers?.map((t) => `${t.firstName} ${t.lastName}`).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!stateFilter || (stateFilter === "no-teacher" ? !cohort.teachers?.length : stage(cohort) === stateFilter)),
    )
    .toSorted((a, b) => {
      const aRecentIdx = recentClonedIds.indexOf(a.id);
      const bRecentIdx = recentClonedIds.indexOf(b.id);
      if (aRecentIdx !== -1 || bRecentIdx !== -1) {
        if (aRecentIdx === -1) return 1;
        if (bRecentIdx === -1) return -1;
        return aRecentIdx - bRecentIdx;
      }
      const aClone = isClonedName(a.name) ? 1 : 0;
      const bClone = isClonedName(b.name) ? 1 : 0;
      if (aClone !== bClone) return bClone - aClone;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  const [editForm, setEditForm] = useState({
    name: "",
    modality: "ONLINE",
    schedule: "",
    maxStudents: 30,
    price: "0.00",
    installments: 1,
    startDate: "",
    endDate: "",
    discountPercentage: 0,
    discountEndsAt: "",
    teacherIds: [] as string[],
  });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [cohortsData, teachersData] = await Promise.all([
        fetchApi("/academic/cohorts"),
        fetchApi("/users?role=DOCENTE&limit=100").catch(() => []),
      ]);
      setCohorts(cohortsData || []);
      setTeachersList(teachersData?.data || teachersData || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar las cohortes"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleEdit = (c: Cohort) => {
    setEditing(c);
    setEditImageFile(null);
    const assignedIds = c.teachers?.map((t: User) => t.id) || [];

    setEditForm({
      name: c.name || "",
      modality: c.modality || "ONLINE",
      schedule: c.schedule || "",
      maxStudents: c.maxCapacity || c.maxStudents || 30,
      price: String(c.price ?? "0.00"),
      installments: Math.max(1, Number(c.installments || 1)),
      startDate: c.startDate ? new Date(c.startDate).toISOString().split("T")[0] : "",
      endDate: c.endDate ? new Date(c.endDate).toISOString().split("T")[0] : "",
      discountPercentage: c.discountPercentage || 0,
      discountEndsAt: c.discountEndsAt ? new Date(c.discountEndsAt).toISOString().slice(0, 16) : "",
      teacherIds: assignedIds,
    });
  };

  const toggleEditTeacher = (teacherId: string) => {
    setEditForm((prev) => {
      const exists = prev.teacherIds.includes(teacherId);
      if (exists) {
        return { ...prev, teacherIds: prev.teacherIds.filter((id) => id !== teacherId) };
      } else {
        return { ...prev, teacherIds: [...prev.teacherIds, teacherId] };
      }
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        modality: editForm.modality,
        schedule: editForm.schedule,
        maxStudents: Number(editForm.maxStudents),
        price: editForm.price,
        installments: Math.max(1, Number(editForm.installments || 1)),
        startDate: new Date(editForm.startDate).toISOString(),
        endDate: new Date(editForm.endDate).toISOString(),
        teacherIds: editForm.teacherIds,
      };

      if (editForm.discountPercentage !== undefined) {
        payload.discountPercentage = Number(editForm.discountPercentage);
      }
      if (editForm.discountEndsAt) {
        payload.discountEndsAt = new Date(editForm.discountEndsAt).toISOString();
      } else {
        payload.discountEndsAt = null;
      }

      await fetchApi(`/academic/cohorts/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (editImageFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", editImageFile);
        await fetchApi(`/academic/cohorts/${editing.id}/image`, {
          method: "POST",
          body: formDataUpload,
        });
      }
      setSuccess("Cohorte y docentes asignados actualizados correctamente");
      setEditing(null);
      loadData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al actualizar la cohorte"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction({ title: "Eliminar cohorte", description: "La cohorte dejará de estar disponible. Verifica que no tenga matrículas activas.", confirmLabel: "Eliminar cohorte" }))) return;
    try {
      await fetchApi(`/academic/cohorts/${id}`, { method: "DELETE" });
      setSuccess("Cohorte eliminada correctamente");
      loadData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al eliminar"));
    }
  };

  const handleDuplicate = async (c: Cohort) => {
    setCloningId(c.id);
    setError("");
    try {
      const nextStart = new Date(c.startDate);
      nextStart.setDate(nextStart.getDate() + 30);
      const nextEnd = new Date(c.endDate);
      nextEnd.setDate(nextEnd.getDate() + 30);
      const baseName = c.name
        .replace(/^\[CLON\]\s*/i, "")
        .replace(/\s*\(Nueva Edici[oó]n\)/gi, "")
        .trim();
      const clonedName = `[CLON] ${baseName} (Nueva Edición)`;

      const created = await fetchApi(`/academic/cohorts/${c.id}/duplicate`, {
        method: "POST",
        body: JSON.stringify({
          name: clonedName,
          startDate: nextStart.toISOString(),
          endDate: nextEnd.toISOString(),
          maxStudents: Number(c.maxCapacity || c.maxStudents || 30),
          price: String(c.price ?? "0.00"),
        }),
      }).catch(() =>
        fetchApi("/academic/cohorts", {
          method: "POST",
          body: JSON.stringify({
            name: clonedName,
            courseId: c.courseId,
            startDate: nextStart.toISOString(),
            endDate: nextEnd.toISOString(),
            maxStudents: Number(c.maxCapacity || c.maxStudents || 30),
            price: Number(c.price || 0),
            installments: Math.max(1, Number(c.installments || 1)),
            modality: c.modality || "ONLINE",
            schedule: c.schedule || undefined,
            teacherIds: c.teachers?.map((t) => t.id) || [],
          }),
        })
      );

      const createdId = created?.id as string | undefined;
      if (createdId) {
        setRecentClonedIds((prev) => {
          const next = [createdId, ...prev.filter((id) => id !== createdId)];
          try {
            window.sessionStorage.setItem("academy:recent-cloned-cohorts", JSON.stringify(next));
          } catch {
            // Optional storage
          }
          return next;
        });
      }

      setSearch("");
      setStateFilter("");
      setSuccess(`¡Listo! Se creó "${clonedName}" y se ubicó al inicio de la tabla.`);
      const updatedCohorts = await fetchApi("/academic/cohorts");
      setCohorts(updatedCohorts || []);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo clonar la cohorte"));
    } finally {
      setCloningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.roles[0] !== "ADMIN") {
    return <div className="p-8 text-center text-red-500 font-bold">Acceso Denegado</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operación académica" title="Gestión de cohortes y docentes" description="Asigna docentes y administra las fechas, vacantes y condiciones de cada clase." actions={<Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Abrir Nueva Cohorte
        </Button>} />

      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
          <button onClick={() => setError("")} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex flex-wrap items-center gap-3 p-4 text-green-700 bg-green-100 rounded-xl dark:bg-green-900/30 dark:text-green-300 border border-green-500/20">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
          {recentClonedIds[0] && cohorts.some((c) => c.id === recentClonedIds[0]) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const target = cohorts.find((c) => c.id === recentClonedIds[0]);
                if (target) handleEdit(target);
              }}
              className="ml-2 h-8 rounded-lg border-green-600/30 bg-white/80 text-xs font-bold text-green-800 hover:bg-white dark:bg-slate-900 dark:text-green-300 cursor-pointer"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar clon ahora
            </Button>
          )}
          <button onClick={() => setSuccess("")} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <SummaryStrip items={[{ label: "Cohortes", value: cohorts.length }, { label: "En curso", value: cohorts.filter(c => stage(c) === "running").length }, { label: "Próximos inicios", value: cohorts.filter(c => stage(c) === "upcoming").length }, { label: "Sin docente", value: cohorts.filter(c => c.isActive && !c.teachers?.length).length }]} />
      <div className="workspace-toolbar"><label className="min-w-48 flex-1">Buscar cohorte<Input placeholder="Curso, cohorte o docente" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Estado<select value={stateFilter} onChange={e => setStateFilter(e.target.value)}><option value="">Todos</option><option value="upcoming">Próximo inicio</option><option value="running">En curso</option><option value="finished">Finalizadas</option><option value="closed">Cerradas</option><option value="no-teacher">Sin docente</option></select></label>{(search || stateFilter) && <Button variant="ghost" onClick={() => { setSearch(""); setStateFilter(""); }}>Limpiar filtros</Button>}</div>
      <div className="bg-card rounded-2xl border border-border/50 overflow-x-auto shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/60 border-b border-border/50 font-bold">
            <tr>
              <th className="px-6 py-4 font-semibold">Imagen</th>
              <th className="px-6 py-4 font-semibold">Nombre Cohorte</th>
              <th className="px-6 py-4 font-semibold">Curso</th>
              <th className="px-6 py-4 font-semibold">Profesor(es) Asignado(s)</th>
              <th className="px-6 py-4 font-semibold">Fechas</th>
              <th className="px-6 py-4 font-semibold">Matriculados</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredCohorts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                  No hay cohortes que coincidan con esta vista.
                </td>
              </tr>
            ) : (
              filteredCohorts.map((cohort) => {
                const isFull = cohort.enrolledCount >= cohort.maxCapacity;
                const assignedTeachers = cohort.teachers || [];
                const isRecentClone = recentClonedIds.includes(cohort.id);
                const isClone = isRecentClone || isClonedName(cohort.name);

                return (
                  <tr
                    key={cohort.id}
                    className={`transition-colors ${
                      isClone
                        ? "bg-indigo-500/[0.06] hover:bg-indigo-500/[0.11] dark:bg-indigo-500/[0.12] dark:hover:bg-indigo-500/[0.18]"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <td className={`px-6 py-4 ${isClone ? "border-l-4 border-l-indigo-600" : ""}`}>
                      <div className="relative h-12 w-20 overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-slate-900 via-blue-950 to-primary/80">
                        {getCohortImageUrl(cohort) ? (
                          <Image unoptimized fill sizes="80px" src={getCohortImageUrl(cohort)!} alt={`Imagen de ${cohort.name}`} className="object-cover" />
                        ) : (
                          <BookOpen className="absolute inset-0 m-auto h-5 w-5 text-white/60" aria-hidden="true" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {isRecentClone && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                            <Copy className="h-3 w-3" /> Recién clonado
                          </span>
                        )}
                        {!isRecentClone && isClone && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                            <Copy className="h-3 w-3" /> Clon
                          </span>
                        )}
                        <span className="font-bold text-primary">{cohort.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium">{stageLabel[stage(cohort)]}</span>
                        {(cohort.installments ?? 1) > 1 ? (
                          <span className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                            Mensual ({cohort.installments} cuotas de S/ {Number(cohort.price || 0).toFixed(2)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Pago único: S/ {Number(cohort.price || 0).toFixed(2)}
                          </span>
                        )}
                        {!cohort.schedule && <span className="text-xs text-amber-700 dark:text-amber-400">Horario pendiente</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <BookOpen className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate max-w-[160px] font-medium">{cohort.course?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {assignedTeachers.length > 0 ? (
                          assignedTeachers.map((t: User) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                            >
                              <UserCheck className="h-3 w-3" />
                              {t.firstName} {t.lastName}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <UserX className="h-3 w-3" /> Sin Profesor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {new Date(cohort.startDate).toLocaleDateString()} -{" "}
                          {new Date(cohort.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isFull
                            ? "bg-red-500/10 text-red-500"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {cohort.enrolledCount} / {cohort.maxCapacity} alumnos
                      </span>
                      <div className="mt-2 h-1.5 min-w-24 overflow-hidden rounded-full bg-muted" role="meter" aria-label={`Ocupación de ${cohort.name}`} aria-valuemin={0} aria-valuemax={Math.max(1, cohort.maxCapacity)} aria-valuenow={Math.min(cohort.enrolledCount, Math.max(1, cohort.maxCapacity))}><div className={isFull ? "h-full bg-amber-500" : "h-full bg-accent"} style={{ width: `${Math.min(100, cohort.maxCapacity > 0 ? cohort.enrolledCount / cohort.maxCapacity * 100 : 0)}%` }} /></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/dashboard/classes/${cohort.id}`}>
                          <Button size="sm" variant="outline" className="rounded-lg text-xs" title="Configurar Aula Virtual">
                            <Settings className="h-3.5 w-3.5 mr-1" /> Aula
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cloningId === cohort.id}
                          onClick={() => void handleDuplicate(cohort)}
                          className="rounded-lg text-xs gap-1 cursor-pointer border-indigo-500/30 text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-300"
                          title="Clonar cohorte y colocar al inicio"
                        >
                          {cloningId === cohort.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Clonar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(cohort)}
                          className="rounded-lg"
                          title="Editar cohorte y docentes"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          onClick={() => handleDelete(cohort.id)}
                          title="Eliminar cohorte"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Edición de Cohorte y Asignación de Profesores */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditing(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 text-foreground">Editar Cohorte</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {editing.course?.name} — {editing.name}
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Nombre de la Cohorte</label>
                <input
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              {/* Selector e Instructor / Profesores */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  Profesores Asignados (Selecciona / Desvincula)
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Marca los docentes a cargo o desmarca para desvincular un profesor del curso.
                </p>

                <div className="max-h-36 overflow-y-auto border border-border/50 rounded-lg p-2 bg-background space-y-1.5">
                  {teachersList.length === 0 ? (
                    <p className="text-muted-foreground text-center py-2">
                      No hay docentes registrados en la plataforma.
                    </p>
                  ) : (
                    teachersList.map((teacher: User) => {
                      const isAssigned = editForm.teacherIds.includes(teacher.id);

                      return (
                        <label
                          key={teacher.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isAssigned
                              ? "bg-primary/10 border-primary/40 font-bold text-foreground"
                              : "border-border/40 hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => toggleEditTeacher(teacher.id)}
                              className="rounded border-gray-300 accent-primary"
                            />
                            <span>
                              {teacher.firstName} {teacher.lastName}
                            </span>
                          </div>
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {teacher.email}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Modalidad</label>
                  <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={editForm.modality} onChange={(e) => setEditForm({ ...editForm, modality: e.target.value })}>
                    <option value="ONLINE">Online</option><option value="PRESENCIAL">Presencial</option><option value="HIBRIDA">Híbrida</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Horario</label>
                  <input className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={editForm.schedule} onChange={(e) => setEditForm({ ...editForm, schedule: e.target.value })} placeholder="Ej. Lun y Mié, 7:00 p. m." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Capacidad Máxima</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                    value={editForm.maxStudents}
                    onChange={(e) => setEditForm({ ...editForm, maxStudents: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="font-semibold text-primary block mb-1">Modalidad de Cobro</label>
                  <select
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                    value={editForm.installments}
                    onChange={(e) => setEditForm({ ...editForm, installments: Number(e.target.value) })}
                  >
                    <option value={1}>Pago único (1 cuota)</option>
                    <option value={2}>Mensual — 2 meses (2 cuotas)</option>
                    <option value={3}>Mensual — 3 meses (3 cuotas)</option>
                    <option value={4}>Mensual — 4 meses (4 cuotas)</option>
                    <option value={5}>Mensual — 5 meses (5 cuotas)</option>
                    <option value={6}>Mensual — 6 meses (6 cuotas)</option>
                    <option value={12}>Mensual — 12 meses (12 cuotas)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {editForm.installments > 1 ? "Monto por Mensualidad / Cuota (S/)" : "Precio Único (S/)"}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
                {editForm.installments > 1 && (
                  <p className="mt-1 text-[11px] font-medium text-primary">
                    El estudiante abonará {editForm.installments} mensualidades de S/ {Number(editForm.price || 0).toFixed(2)} desde «Mis Pagos».
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Fecha de Fin</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div>
                  <label className="font-bold text-amber-500 block mb-1">Dscto (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                    value={editForm.discountPercentage}
                    onChange={(e) => setEditForm({ ...editForm, discountPercentage: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-500 block mb-1">Fin Oferta</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                    value={editForm.discountEndsAt}
                    onChange={(e) => setEditForm({ ...editForm, discountEndsAt: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-blue-500 block mb-1">Nuevo Flyer (Opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-xs"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setEditImageFile(e.target.files[0]);
                    }
                  }}
                />
              </div>

              <div className="pt-3 border-t border-border/40 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={editLoading} className="rounded-xl px-6">
                  {editLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Guardar Cambios
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateCohortModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadData();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
