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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const course = await fetchApi("/academic/courses", {
        method: "POST",
        body: JSON.stringify({ ...formData, durationHours: Number(formData.durationHours) }),
      });

      if (imageFile && course && course.id) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", imageFile);
        await fetchApi(`/academic/courses/${course.id}/image`, {
          method: "POST",
          body: formDataUpload
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al crear curso"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl bg-background shadow-2xl border-border relative animate-scale-in max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Crear Nuevo Curso</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm">Código</label>
                <Input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="CS101" />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Horas</label>
                <Input type="number" required min={1} value={formData.durationHours} onChange={(e) => setFormData({...formData, durationHours: Number(e.target.value)})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm">Nombre</label>
              <Input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Descripción Breve</label>
              <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm">URL Video Promocional</label>
                <Input value={formData.promotionalVideoUrl} onChange={(e) => setFormData({...formData, promotionalVideoUrl: e.target.value})} placeholder="https://youtube.com/..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Público Objetivo</label>
                <Input value={formData.targetAudience} onChange={(e) => setFormData({...formData, targetAudience: e.target.value})} placeholder="Niños de 10 a 14 años..." />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm">¿Qué aprenderán? (Separado por saltos de línea)</label>
              <textarea 
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                value={formData.whatYouWillLearn} 
                onChange={(e) => setFormData({...formData, whatYouWillLearn: e.target.value})} 
                placeholder="- Fundamentos de Python&#10;- Lógica de programación"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm">Requisitos (Separado por saltos de línea)</label>
              <textarea 
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={formData.requirements} 
                onChange={(e) => setFormData({...formData, requirements: e.target.value})} 
                placeholder="- Computadora con internet&#10;- Ganas de aprender"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm">Nivel</label>
              <select 
                value={formData.level} 
                onChange={(e) => setFormData({...formData, level: e.target.value})}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="BEGINNER">Principiante</option>
                <option value="INTERMEDIATE">Intermedio</option>
                <option value="ADVANCED">Avanzado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm">Imagen (Opcional)</label>
              <Input 
                type="file" 
                accept="image/*" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setImageFile(e.target.files[0]);
                  }
                }} 
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
