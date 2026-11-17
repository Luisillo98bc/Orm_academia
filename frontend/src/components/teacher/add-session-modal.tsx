import { Modal } from "@/components/ui/modal";
import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";

export function AddSessionModal({ isOpen, onClose, onSuccess, moduleId }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, moduleId: string }) {
  const [formData, setFormData] = useState({ title: "", date: "", meetLink: "", recordingUrl: "", durationMinutes: 60, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima' });
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
          meetLink: formData.meetLink,
          recordingUrl: formData.recordingUrl,
          durationMinutes: formData.durationMinutes,
          timeZone: formData.timeZone,
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
    <Modal title="Agregar sesión" onClose={() => { if (!loading) onClose(); }}>

      <Card className="w-full max-w-md glass relative">
        <button aria-label="Cerrar ventana" onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <CardHeader>
          <CardTitle>Programar Clase en Vivo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="teacher-add-session-modal-0" className="text-sm">Título de la Sesión</label>
              <Input id="teacher-add-session-modal-0" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Ej. Clase 1: Fundamentos" />
            </div>
            <div className="space-y-2">
              <label htmlFor="teacher-add-session-modal-1" className="text-sm">Fecha y Hora</label>
              <Input id="teacher-add-session-modal-1" aria-label="Fecha y hora de clase" type="datetime-local" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
              <p className="text-xs text-muted-foreground">Hora local de tu dispositivo · {formData.timeZone}</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="teacher-add-session-modal-2" className="text-sm">Duración (minutos)</label>
              <Input id="teacher-add-session-modal-2" aria-label="Duración de clase" type="number" min={5} max={720} value={formData.durationMinutes} onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="teacher-add-session-modal-3" className="text-sm">Enlace de grabación (opcional)</label>
              <Input id="teacher-add-session-modal-3" aria-label="Grabación de clase" type="url" value={formData.recordingUrl} onChange={(e) => setFormData({ ...formData, recordingUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label htmlFor="teacher-add-session-modal-4" className="text-sm">Enlace a Google Meet</label>
              <Input id="teacher-add-session-modal-4" value={formData.meetLink} onChange={(e) => setFormData({...formData, meetLink: e.target.value})} placeholder="https://meet.google.com/..." />
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

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
    </Modal>
  );
}
