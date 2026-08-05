import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";

export function CreateModuleModal({ isOpen, onClose, onSuccess, cohortId }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, cohortId: string }) {
  const [formData, setFormData] = useState({ title: "", description: "", order: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      await fetchApi(`/academic/cohorts/${cohortId}/modules`, {
        method: "POST",
        body: JSON.stringify(formData),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al crear el módulo"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md glass relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Crear Semana / Módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Título de la Semana</label>
              <Input required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Ej. Semana 1: Introducción" />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Descripción (Opcional)</label>
              <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Orden</label>
              <Input type="number" min={1} required value={formData.order} onChange={(e) => setFormData({...formData, order: Number(e.target.value)})} />
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
