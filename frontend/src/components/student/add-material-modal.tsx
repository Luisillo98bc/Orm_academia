"use client";

import { useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X, Upload, Link2 } from "lucide-react";

export function AddMaterialModal({
  isOpen,
  onClose,
  onSuccess,
  moduleId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  moduleId: string;
}) {
  const [mode, setMode] = useState<"file" | "link">("file");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("PDF");
  const [fileUrl, setFileUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "file") {
        if (!selectedFile) {
          throw new Error("Por favor selecciona un archivo de tu equipo.");
        }
        const formDataUpload = new FormData();
        formDataUpload.append("file", selectedFile);
        formDataUpload.append("title", title.trim() || selectedFile.name);
        formDataUpload.append("type", type);

        await fetchApi(`/academic/cohorts/modules/${moduleId}/materials/upload`, {
          method: "POST",
          body: formDataUpload,
        });
      } else {
        if (!fileUrl.trim()) {
          throw new Error("Por favor ingresa la URL del enlace o video.");
        }
        await fetchApi(`/academic/cohorts/modules/${moduleId}/materials`, {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            type,
            fileUrl: fileUrl.trim(),
          }),
        });
      }

      onSuccess();
      onClose();
      // Reset form
      setTitle("");
      setFileUrl("");
      setSelectedFile(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al añadir material"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <Card className="w-full max-w-lg bg-card border-border shadow-2xl relative rounded-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-xl font-bold text-foreground">
            Añadir Contenido / Material al Curso
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Publica documentos (PDF, Word, PPT, Excel), archivos multimedia o enlaces de video.
          </p>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === "file"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="h-4 w-4" />
              Subir Archivo (Word/PDF/PPT/Video)
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === "link"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link2 className="h-4 w-4" />
              Vincular Enlace / YouTube
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Título del Contenido
              </label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Lectura Principal Semana 2 — Guía PDF"
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Categoría de Contenido
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
              >
                <option value="PDF">📄 PDF / Documento (Word, PPT, Excel)</option>
                <option value="VIDEO">🎥 Video (MP4, YouTube, Vimeo)</option>
                <option value="IMAGE">🖼️ Imagen / Infografía</option>
                <option value="LINK">🔗 Enlace Externo (Google Drive, Notion, GitHub)</option>
              </select>
            </div>

            {mode === "file" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  Seleccionar Archivo
                </label>
                <div className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-5 text-center transition-colors bg-muted/20">
                  <input
                    type="file"
                    required
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        setSelectedFile(file);
                        if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }}
                    className="w-full text-xs cursor-pointer text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                  />
                  {selectedFile && (
                    <p className="mt-2 text-xs font-bold text-primary">
                      ✓ Seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  URL del Enlace o Video
                </label>
                <Input
                  required
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="Ej. https://www.youtube.com/watch?v=... o https://drive.google.com/..."
                  className="rounded-xl"
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
                {error}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="rounded-xl px-6">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Añadir al Temario
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
