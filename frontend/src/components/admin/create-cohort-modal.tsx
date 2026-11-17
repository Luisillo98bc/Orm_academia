import { Modal } from "@/components/ui/modal";
import { useState, useEffect } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";
import type { Course, User } from "@/types/domain";

export function CreateCohortModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedCourseId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCourseId?: string;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [formData, setFormData] = useState({ courseId: preselectedCourseId || "", teacherIds: [] as string[], name: "", modality: "ONLINE", schedule: "", maxStudents: 30, price: "0.00", installments: 1, startDate: "", endDate: "", discountPercentage: 0, discountEndsAt: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (isOpen) {
      setImageFile(null);
      setError("");
      setFetching(true);
      Promise.all([
      fetchApi("/academic/courses"),
      fetchApi("/users?role=DOCENTE&limit=100")
      ])
      .then(([coursesData, teachersData]) => {
        setCourses(coursesData || []);
        const teachersList = teachersData?.data || teachersData || [];
        setTeachers(teachersList);
        const initialCourseId =
          preselectedCourseId && coursesData?.some((c: Course) => c.id === preselectedCourseId)
            ? preselectedCourseId
            : coursesData?.[0]?.id || "";
        if (initialCourseId) {
          setFormData((prev) => ({ ...prev, courseId: initialCourseId }));
        }
        if (teachersList.length > 0) {
          setFormData((prev) => ({ ...prev, teacherIds: [teachersList[0].id] }));
        }
      })
      .catch(() => setError("Error al cargar dependencias"))
      .finally(() => setFetching(false));
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, preselectedCourseId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const dataToSubmit: Record<string, unknown> = {
        ...formData,
        maxStudents: Number(formData.maxStudents),
        installments: Math.max(1, Number(formData.installments || 1)),
        price: formData.price,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
      };

      if (formData.discountPercentage > 0) {
        dataToSubmit.discountPercentage = Number(formData.discountPercentage);
      }
      if (formData.discountEndsAt) {
        dataToSubmit.discountEndsAt = new Date(formData.discountEndsAt).toISOString();
      }

      const cohort = await fetchApi("/academic/cohorts", {
        method: "POST",
        body: JSON.stringify(dataToSubmit),
      });

      if (imageFile && cohort && cohort.id) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", imageFile);
        await fetchApi(`/academic/cohorts/${cohort.id}/image`, {
          method: "POST",
          body: formDataUpload
        });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al crear cohorte"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Crear cohorte" onClose={() => { if (!loading) onClose(); }}>

      <Card className="w-full max-w-md bg-background shadow-2xl border-border relative max-h-[90vh] overflow-y-auto animate-scale-in">
        <button type="button" onClick={onClose} aria-label="Cerrar formulario" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Abrir Nueva Cohorte</CardTitle>
        </CardHeader>
        <CardContent>
          {fetching ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : courses.length === 0 || teachers.length === 0 ? (
            <div className="text-center text-sm text-destructive pb-4">
              <p>Debes crear al menos un Curso y un Profesor primero.</p>
              <Button className="mt-4" onClick={onClose}>Cerrar</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="admin-create-cohort-modal-0" className="text-sm">Curso</label>
                <select id="admin-create-cohort-modal-0"
                  required
                  value={formData.courseId}
                  onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm">Profesores (Selecciona al menos 1)</label>
                <div className="max-h-32 overflow-y-auto border border-input rounded-md p-2 bg-background/50 space-y-1">
                  {teachers.map(t => (
                    <label key={t.id} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={formData.teacherIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, teacherIds: [...formData.teacherIds, t.id] });
                          } else {
                            setFormData({ ...formData, teacherIds: formData.teacherIds.filter(id => id !== t.id) });
                          }
                        }}
                      />
                      <span>{t.firstName} {t.lastName}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="admin-create-cohort-modal-3" className="text-sm">Nombre de Cohorte</label>
                <Input id="admin-create-cohort-modal-3" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Ej. Promoción 2026-I" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="admin-create-cohort-modal-4" className="text-sm">Cupos Máximos</label>
                  <Input id="admin-create-cohort-modal-4" type="number" required min={1} value={formData.maxStudents} onChange={(e) => setFormData({...formData, maxStudents: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-create-cohort-modal-installments" className="text-sm font-semibold text-primary">Modalidad de Cobro</label>
                  <select
                    id="admin-create-cohort-modal-installments"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: Number(e.target.value) })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              <div className="space-y-1.5">
                <label htmlFor="admin-create-cohort-modal-5" className="text-sm">
                  {formData.installments > 1 ? `Monto por Mensualidad / Cuota (S/)` : `Precio Único (S/)`}
                </label>
                <Input id="admin-create-cohort-modal-5" type="number" required min={0} step="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                {formData.installments > 1 && (
                  <p className="text-[11px] font-medium text-primary">
                    El estudiante pagará {formData.installments} cuotas mensuales de S/ {Number(formData.price || 0).toFixed(2)} (Total programa: S/ {(Number(formData.price || 0) * formData.installments).toFixed(2)}).
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="admin-create-cohort-modal-6" className="text-sm">Modalidad</label>
                  <select id="admin-create-cohort-modal-6" value={formData.modality} onChange={(e) => setFormData({...formData, modality: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="ONLINE">Online</option><option value="PRESENCIAL">Presencial</option><option value="HIBRIDA">Híbrida</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-create-cohort-modal-7" className="text-sm">Horario</label>
                  <Input id="admin-create-cohort-modal-7" value={formData.schedule} onChange={(e) => setFormData({...formData, schedule: e.target.value})} placeholder="Ej. Lun y Mié, 7:00 p. m." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="admin-create-cohort-modal-8" className="text-sm">Inicio</label>
                  <Input id="admin-create-cohort-modal-8" type="date" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-create-cohort-modal-9" className="text-sm">Fin</label>
                  <Input id="admin-create-cohort-modal-9" type="date" required value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                <div className="space-y-2">
                  <label htmlFor="admin-create-cohort-modal-10" className="text-sm text-amber-500 font-bold">Dscto (%) FOMO</label>
                  <Input id="admin-create-cohort-modal-10" type="number" min={0} max={100} value={formData.discountPercentage} onChange={(e) => setFormData({...formData, discountPercentage: Number(e.target.value)})} placeholder="Ej. 30" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-create-cohort-modal-11" className="text-sm text-amber-500 font-bold">Fin de Dscto</label>
                  <Input id="admin-create-cohort-modal-11" type="datetime-local" value={formData.discountEndsAt} onChange={(e) => setFormData({...formData, discountEndsAt: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="admin-create-cohort-modal-12" className="text-sm font-bold text-blue-500">Flyer de la Cohorte (Opcional)</label>
                <Input id="admin-create-cohort-modal-12"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setImageFile(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Crear
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
