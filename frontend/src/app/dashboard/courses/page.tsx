"use client";

import type { Course } from "@/types/domain";

import { useState, useEffect } from "react";
import { API_URL, fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Loader2, AlertCircle, PlusCircle, BookOpen, Pencil, Trash2, X, CheckCircle2, ImageIcon } from "lucide-react";
import { CreateCourseModal } from "@/components/admin/create-course-modal";

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({ 
    name: "", 
    description: "", 
    promotionalVideoUrl: "",
    whatYouWillLearn: "",
    requirements: "",
    targetAudience: "",
    level: "BEGINNER", 
    durationHours: 0 
  });
  const [editLoading, setEditLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadCourses = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchApi("/academic/courses");
      setCourses(data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar los cursos"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCourses();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleEdit = (c: Course) => {
    setEditing(c);
    setEditForm({ 
      name: c.name, 
      description: c.description || "", 
      promotionalVideoUrl: c.promotionalVideoUrl || "",
      whatYouWillLearn: c.whatYouWillLearn || "",
      requirements: c.requirements || "",
      targetAudience: c.targetAudience || "",
      level: c.level, 
      durationHours: c.durationHours 
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
      setSuccess("Curso actualizado correctamente");
      setEditing(null);
      loadCourses();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al actualizar"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleCourseImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, courseId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setUploadingImage(true);
    try {
      await fetchApi(`/academic/courses/${courseId}/image`, {
        method: "POST",
        body: formData
      });
      
      setSuccess("Imagen del curso actualizada");
      loadCourses();
      
      // Update editing state to reflect new image if possible, or close it
      setEditing(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al subir imagen"));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este curso?")) return;
    try {
      await fetchApi(`/academic/courses/${id}`, { method: "DELETE" });
      setSuccess("Curso eliminado correctamente");
      loadCourses();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al eliminar"));
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user || user.roles[0] !== "ADMIN") {
    return <div className="p-8 text-center text-red-500 font-bold">Acceso Denegado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Cursos</h2>
          <p className="text-muted-foreground mt-1">Catálogo de cursos ofrecidos por la academia.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" /> Crear Curso
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 text-green-600 bg-green-100 rounded-lg dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <p>{success}</p>
          <button onClick={() => setSuccess("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden glass">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
            <tr>
              <th className="px-6 py-4 font-medium">Imagen</th>
              <th className="px-6 py-4 font-medium">Código</th>
              <th className="px-6 py-4 font-medium">Nombre del Curso</th>
              <th className="px-6 py-4 font-medium">Nivel</th>
              <th className="px-6 py-4 font-medium">Duración (Hrs)</th>
              <th className="px-6 py-4 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No hay cursos registrados todavía.
                </td>
              </tr>
            ) : (
              courses.map((course) => (
                <tr key={course.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    {course.imageUrl ? (
                      <div className="h-10 w-16 rounded overflow-hidden bg-muted">
                        <Image unoptimized width={64} height={40} src={`${API_URL.replace('/api/v1', '')}${course.imageUrl}`} alt={course.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-10 w-16 rounded bg-primary/10 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-primary/50" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-primary">{course.code}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{course.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      {course.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">{course.durationHours} h</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(course)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(course.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Edición */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl border border-border/50 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto glass relative">
            <button onClick={() => setEditing(null)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            <h3 className="text-xl font-bold mb-4">Editar Curso</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                <input className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Descripción Breve</label>
                <textarea className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm min-h-[60px]" value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">URL Video Promocional</label>
                  <input className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm" value={editForm.promotionalVideoUrl} onChange={(e) => setEditForm({...editForm, promotionalVideoUrl: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Público Objetivo</label>
                  <input className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm" value={editForm.targetAudience} onChange={(e) => setEditForm({...editForm, targetAudience: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">¿Qué aprenderán? (Por líneas)</label>
                <textarea className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm min-h-[80px]" value={editForm.whatYouWillLearn} onChange={(e) => setEditForm({...editForm, whatYouWillLearn: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Requisitos (Por líneas)</label>
                <textarea className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm min-h-[60px]" value={editForm.requirements} onChange={(e) => setEditForm({...editForm, requirements: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nivel</label>
                <select className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm" value={editForm.level} onChange={(e) => setEditForm({...editForm, level: e.target.value})}>
                  <option value="BEGINNER">BEGINNER</option>
                  <option value="INTERMEDIATE">INTERMEDIATE</option>
                  <option value="ADVANCED">ADVANCED</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Duración (horas)</label>
                <input type="number" className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm" value={editForm.durationHours} onChange={(e) => setEditForm({...editForm, durationHours: Number(e.target.value)})} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Imagen del Curso (Opcional)</label>
                <div className="mt-1 flex items-center gap-4">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleCourseImageUpload(e, editing.id)}
                    disabled={uploadingImage}
                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  {uploadingImage && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>
              <Button onClick={handleSaveEdit} disabled={editLoading} className="w-full">
                {editLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateCourseModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => { loadCourses(); setIsModalOpen(false); }} 
      />
    </div>
  );
}
