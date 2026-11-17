import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, X, Link as LinkIcon } from "lucide-react";
import type { Evaluation } from "@/types/domain";
import { useSubmissionDraft } from "@/lib/use-submission-draft";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { useConfirm } from "@/components/confirm-provider";

export function SubmitDeliverableModal({ isOpen, onClose, onSuccess, evaluation }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, evaluation: Evaluation }) {
  const { draft: formData, updateDraft: setFormData, clearDraft, notice, ready } = useSubmissionDraft(evaluation.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const dirty = Boolean(formData.fileUrl || formData.comment);
  useUnsavedChanges(isOpen && dirty);
  const close = async () => {
    if (loading) return;
    if (dirty && !await confirm({ title: "¿Cerrar sin enviar?", description: "El enlace y los comentarios quedan como borrador en esta pestaña. La tarea todavía no se ha enviado.", confirmLabel: "Guardar y cerrar", destructive: false })) return;
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await fetchApi(`/classroom/evaluations/${evaluation.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          fileUrl: formData.fileUrl,
          fileName: "Entrega mediante URL",
          comment: formData.comment || "Sin comentarios"
        }),
      });
      clearDraft();
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al enviar la tarea"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Entregar tarea" onClose={() => void close()}>

      <Card className="relative w-full max-w-md glass border-border/70">
        <button aria-label="Cerrar ventana" type="button" disabled={loading} onClick={() => void close()} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Entregar Tarea</CardTitle>
          <CardDescription>Estás entregando: {evaluation.title}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="deliverable-url" className="text-sm">Enlace a tu trabajo (GitHub, Drive, etc)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="url"
                  id="deliverable-url"
                  disabled={!ready || loading}
                  aria-describedby="deliverable-hint"
                  required
                  className="pl-9"
                  placeholder="https://..."
                  value={formData.fileUrl}
                  onChange={(e) => setFormData({...formData, fileUrl: e.target.value})}
                />
              </div>
              <p id="deliverable-hint" className="text-xs text-muted-foreground">Usa un enlace completo y permite el acceso al docente.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="deliverable-comment" className="text-sm">Comentarios al Profesor (Opcional)</label>
              <textarea
                id="deliverable-comment"
                disabled={!ready || loading}
                maxLength={10000}
                className="w-full flex min-h-[80px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={formData.comment}
                onChange={(e) => setFormData({...formData, comment: e.target.value})}
                placeholder="Hola profe, aquí le dejo el link del repositorio..."
              />
            </div>

            {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={loading} onClick={() => void close()}>Cerrar</Button>
              <Button type="submit" disabled={loading || !ready}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar Entrega
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
