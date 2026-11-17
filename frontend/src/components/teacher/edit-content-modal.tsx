"use client";

import { Modal } from "@/components/ui/modal";
import { useEffect, useRef, useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, BookOpen, CalendarClock, Eye, FileText, Loader2, MessageSquare, X } from "lucide-react";

export type EditableContentKind = "module" | "session" | "material" | "evaluation" | "forum";

export interface EditableContent {
  kind: EditableContentKind;
  id: string;
  title: string;
  description?: string | null;
  date?: string | null;
  meetLink?: string | null;
  recordingUrl?: string | null;
  durationMinutes?: number;
  timeZone?: string;
  fileUrl?: string | null;
  weight?: number;
  maxScore?: number;
  dueDate?: string | null;
}

interface EditContentModalProps {
  content: EditableContent | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

interface FormState {
  title: string;
  description: string;
  date: string;
  meetLink: string;
  recordingUrl: string;
  durationMinutes: string;
  timeZone: string;
  fileUrl: string;
  weight: string;
  maxScore: string;
  dueDate: string;
}

const emptyForm: FormState = {
  title: "",
  description: "",
  date: "",
  meetLink: "",
  recordingUrl: "",
  durationMinutes: "60",
  timeZone: "America/Lima",
  fileUrl: "",
  weight: "",
  maxScore: "",
  dueDate: "",
};

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function getFormForContent(content: EditableContent): FormState {
  return {
    title: content.title,
    description: content.description || "",
    date: toLocalDateTime(content.date),
    meetLink: content.meetLink || "",
    recordingUrl: content.recordingUrl || "",
    durationMinutes: String(content.durationMinutes || 60),
    timeZone: content.timeZone || "America/Lima",
    fileUrl: content.fileUrl || "",
    weight: content.weight === undefined ? "" : String(content.weight),
    maxScore: content.maxScore === undefined ? "" : String(content.maxScore),
    dueDate: toLocalDateTime(content.dueDate),
  };
}

const contentConfig: Record<EditableContentKind, { title: string; description: string; icon: typeof BookOpen }> = {
  module: { title: "Editar módulo", description: "Actualiza el nombre y la descripción del módulo.", icon: BookOpen },
  session: { title: "Editar sesión", description: "Corrige la fecha, el horario o el enlace de la clase.", icon: CalendarClock },
  material: { title: "Editar material", description: "Actualiza el nombre y el enlace del recurso.", icon: FileText },
  evaluation: { title: "Editar evaluación", description: "Modifica las instrucciones, ponderación o fecha límite.", icon: FileText },
  forum: { title: "Editar foro", description: "Corrige el título o las instrucciones del tema.", icon: MessageSquare },
};

export function EditContentModal({ content, onClose, onSuccess }: EditContentModalProps) {
  const [form, setForm] = useState<FormState>(() => (content ? getFormForContent(content) : emptyForm));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!content) return;
    const focusTimer = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [content]);


  if (!content) return null;

  const config = contentConfig[content.kind];
  const Icon = config.icon;
  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("El título es obligatorio.");
      titleRef.current?.focus();
      return;
    }

    if ((content.kind === "session" || content.kind === "evaluation") && !form.date && !form.dueDate) {
      setError("Completa la fecha requerida.");
      return;
    }

    setSaving(true);
    try {
      let endpoint = "";
      let body: Record<string, string | number | boolean | null> = {};

      if (content.kind === "module") {
        endpoint = `/academic/cohorts/modules/${content.id}`;
        body = { title: form.title, description: form.description };
      } else if (content.kind === "session") {
        endpoint = `/academic/cohorts/sessions/${content.id}`;
        body = {
          title: form.title,
          date: new Date(form.date).toISOString(),
          meetLink: form.meetLink,
          recordingUrl: form.recordingUrl,
          durationMinutes: Number(form.durationMinutes),
          timeZone: form.timeZone,
        };
      } else if (content.kind === "material") {
        endpoint = `/academic/cohorts/materials/${content.id}`;
        body = { title: form.title, fileUrl: form.fileUrl };
      } else if (content.kind === "evaluation") {
        endpoint = `/evaluations/${content.id}`;
        body = {
          title: form.title,
          description: form.description,
          weight: Number(form.weight),
          maxScore: Number(form.maxScore),
          dueDate: new Date(form.dueDate).toISOString(),
        };
      } else {
        endpoint = `/communication/forums/${content.id}`;
        body = { title: form.title, description: form.description };
      }

      await fetchApi(endpoint, { method: "PATCH", body: JSON.stringify(body) });
      await onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo guardar el cambio."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar contenido" onClose={() => { if (!saving) onClose(); }}>
      <Card
        className="w-full max-w-xl max-h-[min(760px,calc(100vh-2rem))] overflow-y-auto border-border/80 bg-card shadow-2xl"
      >
        <CardHeader className="relative border-b border-border/60 pb-5">
          <div className="flex items-start gap-3 pr-8">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle id="edit-content-title" className="text-xl">{config.title}</CardTitle>
              <CardDescription className="mt-1">{config.description}</CardDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="absolute right-5 top-5 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Cerrar ventana de edición"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="mb-5 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div><p className="text-sm font-semibold">Vista previa para estudiantes</p><p className="text-xs text-muted-foreground">Comprueba cómo se verá antes de publicar el cambio.</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => setPreview((value) => !value)} className="gap-2"><Eye className="h-4 w-4" />{preview ? "Ocultar" : "Vista previa"}</Button>
          </div>
          {preview && <div className="mb-5 rounded-xl border border-border bg-background p-4" aria-live="polite"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{config.title.replace("Editar ", "")}</p><h3 className="mt-2 text-lg font-semibold">{form.title || "Sin título"}</h3>{form.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{form.description}</p>}{content.kind === "session" && form.date && <p className="mt-3 text-sm font-medium">Clase: {new Date(form.date).toLocaleString("es-PE")}</p>}{content.kind === "evaluation" && form.dueDate && <p className="mt-3 text-sm font-medium">Entrega hasta: {new Date(form.dueDate).toLocaleString("es-PE")}</p>}{content.kind === "material" && form.fileUrl && <p className="mt-3 truncate text-sm text-primary">Recurso: {form.fileUrl}</p>}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="edit-content-title-field" className="text-sm font-semibold">Título</label>
              <Input
                ref={titleRef}
                id="edit-content-title-field"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                aria-invalid={Boolean(error && !form.title.trim())}
                maxLength={300}
                required
              />
            </div>

            {(content.kind === "module" || content.kind === "evaluation" || content.kind === "forum") && (
              <div className="space-y-2">
                <label htmlFor="edit-content-description" className="text-sm font-semibold">Descripción e instrucciones</label>
                <textarea
                  id="edit-content-description"
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            )}

            {content.kind === "session" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="edit-session-date" className="text-sm font-semibold">Fecha y hora</label>
                  <Input id="edit-session-date" type="datetime-local" value={form.date} onChange={(event) => update("date", event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="edit-session-duration" className="text-sm font-semibold">Duración (minutos)</label>
                  <Input id="edit-session-duration" type="number" min={5} max={720} value={form.durationMinutes} onChange={(event) => update("durationMinutes", event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="edit-session-timezone" className="text-sm font-semibold">Zona horaria (IANA)</label>
                  <Input id="edit-session-timezone" value={form.timeZone} onChange={(event) => update("timeZone", event.target.value)} placeholder="America/Lima" required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="edit-session-link" className="text-sm font-semibold">Enlace de Meet <span className="font-normal text-muted-foreground">(opcional)</span></label>
                  <Input id="edit-session-link" type="url" value={form.meetLink} onChange={(event) => update("meetLink", event.target.value)} placeholder="https://meet.google.com/..." />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="edit-session-recording" className="text-sm font-semibold">Grabación de la sesión <span className="font-normal text-muted-foreground">(opcional)</span></label>
                  <Input id="edit-session-recording" type="url" value={form.recordingUrl} onChange={(event) => update("recordingUrl", event.target.value)} placeholder="https://..." />
                </div>
              </div>
            )}

            {content.kind === "material" && (
              <div className="space-y-2">
                <label htmlFor="edit-material-url" className="text-sm font-semibold">URL del material</label>
                <Input id="edit-material-url" type="url" value={form.fileUrl} onChange={(event) => update("fileUrl", event.target.value)} required />
              </div>
            )}

            {content.kind === "evaluation" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="edit-evaluation-weight" className="text-sm font-semibold">Peso (%)</label>
                  <Input id="edit-evaluation-weight" type="number" min={0} max={100} value={form.weight} onChange={(event) => update("weight", event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="edit-evaluation-max" className="text-sm font-semibold">Nota máxima</label>
                  <Input id="edit-evaluation-max" type="number" min={1} max={100} value={form.maxScore} onChange={(event) => update("maxScore", event.target.value)} required />
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <label htmlFor="edit-evaluation-due" className="text-sm font-semibold">Fecha límite</label>
                  <Input id="edit-evaluation-due" type="datetime-local" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} required />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="min-w-32">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
