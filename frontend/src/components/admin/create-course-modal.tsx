import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";

export function CreateCourseModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    promotionalVideoUrl: "",
    whatYouWillLearn: "",
    requirements: "",
    targetAudience: "",
    level: "BEGINNER",
    durationHours: 0
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const close = () => {
    if (loading) return;
    if (createdCourseId) onSuccess();
    setCreatedCourseId(null);
    onClose();
  };
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    let courseId = createdCourseId;
    try {
      if (!courseId) {
        const course = await fetchApi("/academic/courses", {
          method: "POST",
          body: JSON.stringify({ ...formData, durationHours: Number(formData.durationHours) }),
        });
        courseId = course.id;
        setCreatedCourseId(courseId);
      }

      if (imageFile && courseId) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", imageFile);
        await fetchApi(`/academic/courses/${courseId}/image`, {
          method: "POST",
          body: formDataUpload
        });
      }

      onSuccess();
      setCreatedCourseId(null);
      onClose();
    } catch (err: unknown) {
      setError(courseId ? "El curso ya fue creado. No se pudo subir la imagen; puedes intentarlo de nuevo." : getErrorMessage(err, "Error al crear curso"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Crear curso" onClose={close}>

      <Card className="w-full max-w-2xl bg-background shadow-2xl border-border relative animate-scale-in max-h-[90vh] overflow-y-auto">
        <button type="button" disabled={loading} onClick={close} aria-label="Cerrar formulario" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle id="create-course-title">Crear Nuevo Curso</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {createdCourseId && <p role="status" className="text-sm">El curso ya fue creado. Puedes reintentar la imagen o cerrar el formulario.</p>}
            <fieldset disabled={Boolean(createdCourseId)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="course-code" className="text-sm">Código</label>
                <Input id="course-code" required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="CS101" />
              </div>
              <div className="space-y-2">
                <label htmlFor="course-hours" className="text-sm">Horas</label>
                <Input id="course-hours" type="number" required min={1} value={formData.durationHours} onChange={(e) => setFormData({...formData, durationHours: Number(e.target.value)})} />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="course-name" className="text-sm">Nombre</label>
              <Input id="course-name" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label htmlFor="course-description" className="text-sm">Descripción Breve</label>
              <Input id="course-description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="course-video" className="text-sm">URL Video Promocional</label>
                <Input id="course-video" value={formData.promotionalVideoUrl} onChange={(e) => setFormData({...formData, promotionalVideoUrl: e.target.value})} placeholder="https://youtube.com/..." />
              </div>
              <div className="space-y-2">
                <label htmlFor="course-audience" className="text-sm">Público Objetivo</label>
                <Input id="course-audience" value={formData.targetAudience} onChange={(e) => setFormData({...formData, targetAudience: e.target.value})} placeholder="Niños de 10 a 14 años..." />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="course-outcomes" className="text-sm">¿Qué aprenderán? (Separado por saltos de línea)</label>
              <textarea id="course-outcomes"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                value={formData.whatYouWillLearn}
                onChange={(e) => setFormData({...formData, whatYouWillLearn: e.target.value})}
                placeholder="- Fundamentos de Python&#10;- Lógica de programación"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="course-requirements" className="text-sm">Requisitos (Separado por saltos de línea)</label>
              <textarea id="course-requirements"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={formData.requirements}
                onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                placeholder="- Computadora con internet&#10;- Ganas de aprender"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="course-level" className="text-sm">Nivel</label>
              <select id="course-level"
                value={formData.level}
                onChange={(e) => setFormData({...formData, level: e.target.value})}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="BEGINNER">Principiante</option>
                <option value="INTERMEDIATE">Intermedio</option>
                <option value="ADVANCED">Avanzado</option>
              </select>
            </div>
            </fieldset>
            <div className="space-y-2">
              <label htmlFor="course-image" className="text-sm">Imagen (Opcional)</label>
              <Input id="course-image"
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
              <Button type="button" variant="ghost" disabled={loading} onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {createdCourseId ? "Reintentar imagen" : "Crear"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
