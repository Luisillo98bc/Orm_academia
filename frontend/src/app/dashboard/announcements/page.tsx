"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  CheckCircle,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Globe,
  Pencil,
  ExternalLink,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { useConfirm } from "@/components/confirm-provider";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";
import Image from "next/image";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  targetAudience: string;
  isActive: boolean;
  showOnLanding: boolean;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  createdAt: string;
  landingStartsAt?: string | null;
  landingEndsAt?: string | null;
  author: { firstName: string; lastName: string };
}

const CTA_DESTINATION_OPTIONS = [
  { label: "Sección Cursos Landing (/#cursos)", value: "/#cursos" },
  { label: "Catálogo de Cursos Campus (/dashboard/catalog)", value: "/dashboard/catalog" },
  { label: "Formulario de Registro (/register)", value: "/register" },
  { label: "Iniciar Sesión (/login)", value: "/login" },
  { label: "Sección Nosotros (/#beneficios)", value: "/#beneficios" },
  { label: "Sección Contacto (/#contacto)", value: "/#contacto" },
  { label: "URL Personalizada / Enlace Externo", value: "CUSTOM" },
];

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatScheduleDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const confirmAction = useConfirm();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("");
  const [publishOnSave, setPublishOnSave] = useState(true);
  const announcementState = (ann: Announcement) => !ann.isActive ? "draft" : ann.showOnLanding && ann.landingEndsAt && new Date(ann.landingEndsAt) < new Date() ? "expired" : ann.showOnLanding && ann.landingStartsAt && new Date(ann.landingStartsAt) > new Date() ? "scheduled" : "published";
  const visibleAnnouncements = announcements.filter(ann => `${ann.title} ${ann.content}`.toLowerCase().includes(search.toLowerCase()) && (!visibility || announcementState(ann) === visibility));

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("info");
  const [targetAudience, setTargetAudience] = useState("ALL");
  const [showOnLanding, setShowOnLanding] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaDestination, setCtaDestination] = useState("/#cursos");
  const [customCtaUrl, setCustomCtaUrl] = useState("");
  const [landingStartsAt, setLandingStartsAt] = useState("");
  const [landingEndsAt, setLandingEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.roles?.[0] === "ADMIN";

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi(isAdmin ? "/communication/announcements/manage" : "/communication/announcements");
      setAnnouncements(data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cargar anuncios"));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadAnnouncements(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadAnnouncements]);

  const resetForm = () => {
    setPublishOnSave(true);
    setTitle("");
    setContent("");
    setType("info");
    setTargetAudience("ALL");
    setShowOnLanding(false);
    setImageUrl("");
    setCtaText("");
    setCtaDestination("/#cursos");
    setCustomCtaUrl("");
    setLandingStartsAt("");
    setLandingEndsAt("");
    setEditingId(null);
    setShowForm(false);
  };

  const handleEditClick = (ann: Announcement) => {
    setPublishOnSave(ann.isActive);
    setEditingId(ann.id);
    setTitle(ann.title);
    setContent(ann.content);
    setType(ann.type || "info");
    setTargetAudience(ann.targetAudience || "ALL");
    setShowOnLanding(ann.showOnLanding || false);
    setImageUrl(ann.imageUrl || "");
    setCtaText(ann.ctaText || "");
    setLandingStartsAt(toDateTimeLocal(ann.landingStartsAt));
    setLandingEndsAt(toDateTimeLocal(ann.landingEndsAt));

    const url = ann.ctaUrl || "";
    const matched = CTA_DESTINATION_OPTIONS.find((opt) => opt.value === url);
    if (matched) {
      setCtaDestination(url);
      setCustomCtaUrl("");
    } else if (url) {
      setCtaDestination("CUSTOM");
      setCustomCtaUrl(url);
    } else {
      setCtaDestination("/#cursos");
      setCustomCtaUrl("");
    }

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (showOnLanding) {
      if (!landingEndsAt) {
        setError("Define una fecha de término para mostrar el anuncio en la landing.");
        setSubmitting(false);
        return;
      }
      if (landingStartsAt && new Date(landingEndsAt) <= new Date(landingStartsAt)) {
        setError("La fecha de término debe ser posterior al inicio.");
        setSubmitting(false);
        return;
      }
    }

    const finalCtaUrl = ctaDestination === "CUSTOM" ? customCtaUrl.trim() : ctaDestination;
    const normalizedCtaUrl = /^\/(?!\/)/.test(finalCtaUrl)
      ? new URL(finalCtaUrl, window.location.origin).toString()
      : finalCtaUrl;

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        type,
        targetAudience,
        isActive: publishOnSave,
        showOnLanding,
        imageUrl: imageUrl.trim() || undefined,
        ctaText: ctaText.trim() || undefined,
        ctaUrl: normalizedCtaUrl || undefined,
        landingStartsAt: showOnLanding && landingStartsAt ? new Date(landingStartsAt).toISOString() : null,
        landingEndsAt: showOnLanding && landingEndsAt ? new Date(landingEndsAt).toISOString() : null,
      };

      if (editingId) {
        await fetchApi(`/communication/announcements/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess("Anuncio actualizado exitosamente");
      } else {
        await fetchApi("/communication/announcements", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess(publishOnSave ? "Anuncio publicado exitosamente" : "Borrador guardado exitosamente");
      }

      resetForm();
      await loadAnnouncements();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al guardar anuncio"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction({ title: "Eliminar anuncio", description: "El anuncio dejará de estar disponible para los usuarios. Esta acción no se puede deshacer.", confirmLabel: "Eliminar" }))) return;
    setDeleting(id);
    setError("");
    try {
      await fetchApi(`/communication/announcements/${id}`, {
        method: "DELETE",
      });
      setSuccess("Anuncio eliminado");
      await loadAnnouncements();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al eliminar anuncio"));
    } finally {
      setDeleting(null);
    }
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTypeStyle = (t: string) => {
    switch (t) {
      case "warning":
        return "border-amber-500/20 bg-amber-500/5";
      case "success":
        return "border-green-500/20 bg-green-500/5";
      default:
        return "border-blue-500/20 bg-blue-500/5";
    }
  };

  const getAudienceLabel = (a: string) => {
    switch (a) {
      case "TEACHERS":
        return "Docentes";
      case "STUDENTS":
        return "Estudiantes";
      default:
        return "Todos";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando anuncios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Comunicación institucional" title="Tablón de anuncios" description={isAdmin ? "Crea, edita y gestiona los anuncios de la academia." : "Consulta los anuncios y avisos importantes de la academia."} actions={isAdmin ? <Button
            onClick={() => {
              if (showForm) resetForm();
              else {
                resetForm();
                setShowForm(true);
              }
            }}
            className="gap-2"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancelar" : "Nuevo Anuncio"}
          </Button> : undefined} />

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-2 p-4 text-green-600 bg-green-100 rounded-xl dark:bg-green-900/30 dark:text-green-400 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-100 rounded-xl dark:bg-red-900/30 dark:text-red-400 animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Form (Create / Edit) */}
      {showForm && isAdmin && (
        <form
          onSubmit={handleSubmitForm}
          className="rounded-2xl border border-primary/20 bg-card p-6 md:p-8 space-y-6 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <h3 className="font-bold text-xl flex items-center gap-2 text-foreground">
              {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Send className="h-5 w-5 text-primary" />}
              {editingId ? "Editar Anuncio" : "Publicar Nuevo Anuncio"}
            </h3>
            <span className="text-xs text-muted-foreground font-medium">
              {editingId ? "Actualizando aviso existente" : "Creando nuevo aviso"}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Título del Anuncio</label>
              <Input
                placeholder="Ej: ¡Nuevos cursos disponibles para el próximo mes!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-semibold mb-1.5 block">Tipo de Aviso</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                >
                  <option value="info">ℹ️ Informativo</option>
                  <option value="warning">⚠️ Advertencia</option>
                  <option value="success">✅ Éxito / Promoción</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-semibold mb-1.5 block">Dirigido a</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                >
                  <option value="ALL">Todos los Usuarios</option>
                  <option value="TEACHERS">Solo Docentes</option>
                  <option value="STUDENTS">Solo Estudiantes</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">Contenido del Anuncio</label>
            <textarea
              placeholder="Escribe el mensaje detallado..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Landing Banner Settings */}
          <div className="border border-border/70 rounded-2xl p-5 space-y-4 bg-muted/20">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnLanding}
                onChange={(e) => setShowOnLanding(e.target.checked)}
                className="h-5 w-5 rounded border-border accent-primary cursor-pointer"
              />
              <div>
                <span className="text-sm font-bold text-foreground">Mostrar como Banner en la Landing Page</span>
                <p className="text-xs text-muted-foreground">
                  Aparecerá en el carrusel destacado de la página de inicio pública.
                </p>
              </div>
            </label>

            {showOnLanding && (
              <div className="space-y-4 pt-2 border-t border-border/40">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      URL de Imagen del Banner (Opcional)
                    </label>
                    <Input
                      placeholder="https://ejemplo.com/banner.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Texto del Botón Acción (CTA)
                    </label>
                    <Input
                      placeholder="Ej: Ver Cursos o Explorar Programas"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                {/* Destino del Botón con Selector Fácil */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    ¿A dónde dirigiŕa el Botón? (Destino de la ruta)
                  </label>
                  <select
                    value={ctaDestination}
                    onChange={(e) => setCtaDestination(e.target.value)}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium focus:ring-2 focus:ring-primary/40 outline-none mb-2"
                  >
                    {CTA_DESTINATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {ctaDestination === "CUSTOM" && (
                    <div className="mt-2">
                      <Input
                        placeholder="Escribe la URL o ruta (Ej: /#cursos o https://...)"
                        value={customCtaUrl}
                        onChange={(e) => setCustomCtaUrl(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="landing-starts-at" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Inicio de publicación (Opcional)
                      </label>
                      <Input
                        id="landing-starts-at"
                        type="datetime-local"
                        value={landingStartsAt}
                        onChange={(e) => setLandingStartsAt(e.target.value)}
                        max={landingEndsAt || undefined}
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label htmlFor="landing-ends-at" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Término de publicación (Obligatorio)
                      </label>
                      <Input
                        id="landing-ends-at"
                        type="datetime-local"
                        value={landingEndsAt}
                        onChange={(e) => setLandingEndsAt(e.target.value)}
                        min={landingStartsAt || undefined}
                        required={showOnLanding}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 text-primary" />
                    <span>Ruta seleccionada: <strong className="text-foreground">{ctaDestination === "CUSTOM" ? customCtaUrl || "(vacío)" : ctaDestination}</strong></span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-border bg-background p-5" aria-label="Vista previa del anuncio"><p className="page-eyebrow">Vista previa · {showOnLanding ? "Portada y campus" : "Campus"}</p>{imageUrl && <Image unoptimized width={640} height={240} src={imageUrl} alt="Imagen del anuncio" className="mb-4 max-h-48 w-full rounded-lg object-cover" />}<h3>{title || "Título del anuncio"}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{content || "Tu mensaje aparecerá aquí."}</p>{ctaText && <span className="mt-3 inline-block rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{ctaText}</span>}<p className="mt-4 text-xs text-muted-foreground">Dirigido a: {getAudienceLabel(targetAudience)}</p></aside>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publishOnSave} onChange={event => setPublishOnSave(event.target.checked)} />Publicar al guardar. Desmarca para conservar como borrador.</label>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 shadow-lg shadow-primary/20 rounded-xl px-6"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {!publishOnSave ? "Guardar borrador" : editingId ? "Guardar Cambios" : "Publicar Anuncio"}
            </Button>
          </div>
        </form>
      )}

      {/* Announcements List */}
      {isAdmin && <><SummaryStrip items={[{ label: "Publicados", value: announcements.filter(ann => announcementState(ann) === "published").length }, { label: "Borradores / pausados", value: announcements.filter(ann => !ann.isActive).length }, { label: "Programados en portada", value: announcements.filter(ann => announcementState(ann) === "scheduled").length }]} /><div className="workspace-toolbar"><label className="min-w-48 flex-1">Buscar anuncio<Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Título o contenido" /></label><label>Visibilidad<select value={visibility} onChange={event => setVisibility(event.target.value)}><option value="">Todos</option><option value="published">Publicados</option><option value="draft">Borradores / pausados</option><option value="scheduled">Programados en portada</option><option value="expired">Vencidos en portada</option></select></label></div></>}
      {visibleAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-border/50">
          <div className="p-6 rounded-full bg-muted/50 mb-4">
            <Megaphone className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-bold mb-1">Sin anuncios publicados</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            No hay anuncios activos en el tablón en este momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className={`rounded-2xl border p-5 md:p-6 flex gap-4 transition-all hover:shadow-lg ${getTypeStyle(ann.type)}`}
            >
              <div className="mt-0.5 shrink-0">{getTypeIcon(ann.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-foreground text-lg">
                      {ann.title}
                    </h4>
                    <p className="text-sm text-foreground/85 mt-2 leading-relaxed whitespace-pre-wrap">
                      {ann.content}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                        onClick={() => handleEditClick(ann)}
                        title="Editar anuncio"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        disabled={deleting === ann.id}
                        onClick={() => handleDelete(ann.id)}
                        title="Eliminar anuncio"
                      >
                        {deleting === ann.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-muted-foreground border-t border-border/40 pt-3">
                  <span>
                    {new Date(ann.createdAt).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span>•</span>
                  <span>
                    Por {ann.author?.firstName} {ann.author?.lastName}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                    {getAudienceLabel(ann.targetAudience)}
                  </span>
                  {ann.showOnLanding && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400 font-semibold">
                        <Globe className="h-3 w-3" />
                        Landing ({ann.ctaUrl || "/#cursos"})
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        {ann.landingEndsAt
                          ? `Hasta ${formatScheduleDate(ann.landingEndsAt)}`
                          : "Sin fecha de término"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
