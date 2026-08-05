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
} from "lucide-react";
import { CreateCohortModal } from "@/components/admin/create-cohort-modal";
import Link from "next/link";

export default function CohortsPage() {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [teachersList, setTeachersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);

  const [editForm, setEditForm] = useState({
    name: "",
    maxStudents: 30,
    price: "0.00",
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
        fetchApi("/users?role=DOCENTE").catch(() => []),
      ]);
      setCohorts(cohortsData || []);
      setTeachersList(teachersData || []);
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
      maxStudents: c.maxCapacity || c.maxStudents || 30,
      price: c.price || "0.00",
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
        maxStudents: Number(editForm.maxStudents),
        price: editForm.price,
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
    if (!confirm("¿Estás seguro de que deseas eliminar esta cohorte?")) return;
    try {
      await fetchApi(`/academic/cohorts/${id}`, { method: "DELETE" });
      setSuccess("Cohorte eliminada correctamente");
      loadData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al eliminar"));
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Cohortes y Profesores</h2>
          <p className="text-muted-foreground mt-1">
            Asigna, cambia o desvincula docentes y administra las fechas y vacantes de los cursos.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 rounded-xl">
          <PlusCircle className="h-4 w-4" /> Abrir Nueva Cohorte
        </Button>
      </div>

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
        <div className="flex items-center gap-2 p-4 text-green-600 bg-green-100 rounded-xl dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <p className="text-sm">{success}</p>
          <button onClick={() => setSuccess("")} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/60 border-b border-border/50 font-bold">
            <tr>
              <th className="px-6 py-4 font-semibold">Nombre Cohorte</th>
              <th className="px-6 py-4 font-semibold">Curso</th>
              <th className="px-6 py-4 font-semibold">Profesor(es) Asignado(s)</th>
              <th className="px-6 py-4 font-semibold">Fechas</th>
              <th className="px-6 py-4 font-semibold">Matriculados</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {cohorts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                  No hay cohortes abiertas todavía.
                </td>
              </tr>
            ) : (
              cohorts.map((cohort) => {
                const isFull = cohort.enrolledCount >= cohort.maxCapacity;
                const assignedTeachers = cohort.teachers || [];

                return (
                  <tr key={cohort.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground text-primary">{cohort.name}</div>
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
                  <label className="font-semibold text-foreground block mb-1">Capacidad Máxima</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                    value={editForm.maxStudents}
                    onChange={(e) => setEditForm({ ...editForm, maxStudents: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Precio (S/)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  />
                </div>
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
