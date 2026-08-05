import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, X, Link as LinkIcon } from "lucide-react";
import type { Evaluation } from "@/types/domain";

export function SubmitDeliverableModal({ isOpen, onClose, onSuccess, evaluation }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, evaluation: Evaluation }) {
  const [formData, setFormData] = useState({ fileUrl: "", comment: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await fetchApi("/evaluations/deliver", {
        method: "POST",
        body: JSON.stringify({
          evaluationId: evaluation.id,
          fileUrl: formData.fileUrl,
          fileName: "Entrega mediante URL",
          comment: formData.comment || "Sin comentarios"
        }),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al enviar la tarea"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md glass border-white/20 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Entregar Tarea</CardTitle>
          <CardDescription>Estás entregando: {evaluation.title}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Enlace a tu trabajo (GitHub, Drive, etc)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="url" 
                  required 
                  className="pl-9"
                  placeholder="https://..."
                  value={formData.fileUrl} 
                  onChange={(e) => setFormData({...formData, fileUrl: e.target.value})} 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm">Comentarios al Profesor (Opcional)</label>
              <textarea 
                className="w-full flex min-h-[80px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={formData.comment} 
                onChange={(e) => setFormData({...formData, comment: e.target.value})} 
                placeholder="Hola profe, aquí le dejo el link del repositorio..."
              />
            </div>
            
            {error && <p className="text-sm text-destructive">{error}</p>}
            
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar Entrega
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
