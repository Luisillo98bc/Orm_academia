import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";

export function CreateEvaluationModal({ isOpen, onClose, onSuccess, cohortId }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, cohortId: string }) {
  const [formData, setFormData] = useState({ title: "", description: "", weight: 20, maxScore: 20, dueDate: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Convert local datetime to ISO
    let formattedDueDate = undefined;
    if (formData.dueDate) {
      formattedDueDate = new Date(formData.dueDate).toISOString();
    }

    try {
      await fetchApi("/evaluations", {
        method: "POST",
        body: JSON.stringify({
          cohortId,
          title: formData.title,
          description: formData.description,
          weight: Number(formData.weight),
          maxScore: Number(formData.maxScore),
          dueDate: formattedDueDate,
          isPublished: true
        }),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al crear la tarea"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Crear evaluación" onClose={() => { if (!loading) onClose(); }}>

      <Card className="relative w-full max-w-lg glass border-border/70">
        <button aria-label="Cerrar ventana" onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Publicar Nueva Tarea</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="teacher-create-evaluation-modal-0" className="text-sm">Título de la Tarea</label>
              <Input id="teacher-create-evaluation-modal-0" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Ej. Práctica Calificada 1" />
            </div>
            <div className="space-y-2">
              <label htmlFor="teacher-create-evaluation-modal-1" className="text-sm">Descripción e Instrucciones</label>
              <textarea id="teacher-create-evaluation-modal-1"
                required
                className="w-full flex min-h-[100px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Detalla lo que el estudiante debe hacer..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="teacher-create-evaluation-modal-2" className="text-sm">Peso en nota final (%)</label>
                <Input id="teacher-create-evaluation-modal-2" type="number" required min={0} max={100} value={formData.weight} onChange={(e) => setFormData({...formData, weight: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label htmlFor="teacher-create-evaluation-modal-3" className="text-sm">Nota Máxima Posible</label>
                <Input id="teacher-create-evaluation-modal-3" type="number" required min={1} max={100} value={formData.maxScore} onChange={(e) => setFormData({...formData, maxScore: Number(e.target.value)})} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="teacher-create-evaluation-modal-4" className="text-sm">Fecha Límite</label>
              <Input id="teacher-create-evaluation-modal-4" type="datetime-local" required value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} />
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publicar Tarea
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
