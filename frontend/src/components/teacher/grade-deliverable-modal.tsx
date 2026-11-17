import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { fetchApi, getErrorMessage, resolveFileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";
import type { Deliverable, Evaluation, User } from "@/types/domain";

export function GradeDeliverableModal({ isOpen, onClose, onSuccess, evaluation, student, deliverable }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, evaluation: Evaluation, student: User, deliverable: Deliverable }) {

  const [formData, setFormData] = useState({ score: 0, feedback: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await fetchApi(`/classroom/deliverables/${deliverable.id}/grade`, {
        method: "POST",
        body: JSON.stringify({
          score: Number(formData.score),
          feedback: formData.feedback
        }),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al calificar"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Calificar entrega" onClose={() => { if (!loading) onClose(); }}>

      <Card className="relative w-full max-w-md glass border-border/70">
        <button aria-label="Cerrar ventana" onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Calificar Entrega</CardTitle>
          <p className="text-sm text-muted-foreground">Estudiante: {student.firstName} {student.lastName}</p>
          <p className="text-xs text-primary font-semibold">Tarea: {evaluation.title}</p>
        </CardHeader>
        <CardContent>

          <div className="bg-muted/50 p-4 rounded-lg mb-6 border border-border/50">
            <h4 className="text-sm font-semibold mb-2">Trabajo Entregado</h4>
            <a href={resolveFileUrl(deliverable.fileUrl)} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline break-all">
              {deliverable.fileUrl}
            </a>
            <p className="text-xs text-muted-foreground mt-2">{`“${deliverable.comment || 'Sin comentarios'}”`}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="teacher-grade-deliverable-modal-0" className="text-sm">Calificación (0 - {evaluation.maxScore})</label>
              <Input id="teacher-grade-deliverable-modal-0" type="number" required min={0} max={evaluation.maxScore} value={formData.score} onChange={(e) => setFormData({...formData, score: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label htmlFor="teacher-grade-deliverable-modal-1" className="text-sm">Retroalimentación / Comentarios</label>
              <textarea id="teacher-grade-deliverable-modal-1"
                required
                className="w-full flex min-h-[80px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={formData.feedback}
                onChange={(e) => setFormData({...formData, feedback: e.target.value})}
                placeholder="Buen trabajo, pero te faltó..."
              />
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar Nota
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
