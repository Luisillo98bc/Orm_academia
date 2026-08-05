import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";

export function AddSessionModal({ isOpen, onClose, onSuccess, moduleId }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, moduleId: string }) {
  const [formData, setFormData] = useState({ title: "", date: "", meetLink: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      await fetchApi(`/academic/cohorts/modules/${moduleId}/sessions`, {
        method: "POST",
        body: JSON.stringify({
          title: formData.title,
          date: new Date(formData.date).toISOString(),
          meetLink: formData.meetLink
        }),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al programar sesión"));
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
          <CardTitle>Programar Clase en Vivo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Título de la Sesión</label>
              <Input required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Ej. Clase 1: Fundamentos" />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Fecha y Hora</label>
              <Input type="datetime-local" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Enlace a Google Meet</label>
              <Input value={formData.meetLink} onChange={(e) => setFormData({...formData, meetLink: e.target.value})} placeholder="https://meet.google.com/..." />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Programar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
