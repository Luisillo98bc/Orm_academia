"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Award, Building2, Globe2, KeyRound, Loader2, Megaphone, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CertificateTemplateSettings, PlatformSettings } from "@/types/domain";
import { WorkspaceTabs } from "@/components/dashboard/workspace-tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { WhatsAppLogo } from "@/components/whatsapp-logo";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

const emptySettings = {
  academyName: "Academia Virtual",
  legalName: "",
  taxId: "",
  tagline: "",
  description: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#2563eb",
  whatsappNumber: "",
  supportEmail: "",
  salesEmail: "",
  address: "",
  facebookUrl: "",
  instagramUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  xUrl: "",
  heroEyebrow: "",
  heroTitle: "",
  heroSubtitle: "",
  termsUrl: "",
  privacyUrl: "",
};

const defaultCertificateTemplate: CertificateTemplateSettings = {
  version: "v1",
  primaryColor: "#0ea5e9",
  academyLabel: "ACADEMIA VIRTUAL",
  completionTitle: "CERTIFICADO DE FINALIZACIÓN",
  gradesTitle: "CERTIFICADO DE NOTAS",
  signatureLabel: "Dirección Académica",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [certificateTemplate, setCertificateTemplate] = useState<CertificateTemplateSettings>(defaultCertificateTemplate);
  const [saved, setSaved] = useState("");
  const current = JSON.stringify({ settings, certificateTemplate });
  const dirty = !!saved && current !== saved;
  useUnsavedChanges(dirty, { title: "¿Salir sin guardar la configuración?", description: "Los cambios de esta pantalla se perderán. Guarda la configuración antes de salir para aplicarlos." });

  useEffect(() => {
    fetchApi("/settings")
      .then((data: PlatformSettings) => {
        const values = { ...emptySettings };
        for (const key of Object.keys(values) as Array<keyof typeof values>) {
          values[key] = String(data?.[key] || values[key] || "");
        }
        setSettings(values);
        setCertificateTemplate({ ...defaultCertificateTemplate, ...(data?.certificateTemplate ?? {}) });
        setSaved(JSON.stringify({ settings: values, certificateTemplate: { ...defaultCertificateTemplate, ...(data?.certificateTemplate ?? {}) } }));
      })
      .catch(() => toast.error("No se pudo cargar la configuración"))
      .finally(() => setLoading(false));
    fetchApi("/auth/2fa/status")
      .then((data: { enabled?: boolean }) => setTwoFactorEnabled(Boolean(data?.enabled)))
      .catch(() => undefined);
  }, []);

  const update = (key: keyof typeof settings, value: string) => setSettings((current) => ({ ...current, [key]: value }));
  const updateCertificateTemplate = (key: keyof CertificateTemplateSettings, value: string) => setCertificateTemplate((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await fetchApi("/settings", { method: "PATCH", body: JSON.stringify({ ...settings, certificateTemplate }) });
      setSaved(current);
      toast.success("Configuración institucional actualizada");
    } catch {
      toast.error("No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const setupTwoFactor = async () => {
    setTwoFactorBusy(true);
    try {
      const data = await fetchApi("/auth/2fa/setup", { method: "POST" });
      setTwoFactorSetup(data);
      toast.success("Clave 2FA generada. Escanea el código con tu autenticador.");
    } catch {
      toast.error("No se pudo preparar la verificación 2FA");
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const enableTwoFactor = async () => {
    setTwoFactorBusy(true);
    try {
      await fetchApi("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code: twoFactorCode }) });
      setTwoFactorEnabled(true);
      setTwoFactorSetup(null);
      setTwoFactorCode("");
      toast.success("2FA activado para tu cuenta de administrador");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "El código 2FA no es válido");
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    setTwoFactorBusy(true);
    try {
      await fetchApi("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ code: twoFactorCode }) });
      setTwoFactorEnabled(false);
      setTwoFactorCode("");
      toast.success("2FA desactivado");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "El código 2FA no es válido");
    } finally {
      setTwoFactorBusy(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const field = (key: keyof typeof settings, label: string, placeholder = "", type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key} className="inline-flex items-center gap-2">{key === "whatsappNumber" && <WhatsAppLogo className="h-4 w-4" />}{label}</Label>
      <Input id={key} type={type} value={settings[key]} placeholder={placeholder} onChange={(event) => update(key, event.target.value)} />
    </div>
  );

  return (
    <div className="space-y-7 pb-16">
      <PageHeader eyebrow="Administración de la plataforma" title="Configuración institucional" description="Controla la identidad, los canales comerciales y el contenido principal de la web." actions={<Button onClick={save} disabled={saving} className="min-w-40">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar cambios
        </Button>} />
      <p role="status" className={`text-xs ${dirty ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{dirty ? "Tienes cambios sin guardar" : "Configuración guardada"}</p>

      <WorkspaceTabs label="Secciones de configuración" tabs={[
        { id: "institution", label: "Institución", content: <section className="dashboard-panel p-6"><div className="mb-6 flex items-center gap-3"><Building2 className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Identidad institucional</h2><p className="text-sm text-muted-foreground">Información corporativa y recursos de marca.</p></div></div>
        <div className="grid gap-5 md:grid-cols-2">
          {field("academyName", "Nombre comercial", "Academia Virtual")}
          {field("legalName", "Razón social", "Empresa Educativa S.A.C.")}
          {field("taxId", "RUC / Identificación fiscal", "20123456789")}
          {field("tagline", "Eslogan", "Formación que transforma")}
          {field("logoUrl", "URL del logotipo", "https://...")}
          {field("faviconUrl", "URL del favicon", "https://...")}
          <div className="space-y-2"><Label htmlFor="primaryColor">Color principal</Label><div className="flex gap-3"><Input id="primaryColor" type="color" value={settings.primaryColor || "#2563eb"} onChange={(event) => update("primaryColor", event.target.value)} className="w-16 p-1" /><Input value={settings.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} /></div></div>
          {settings.logoUrl && <div className="flex min-h-20 items-center justify-center rounded-lg border bg-muted/30 p-3"><Image unoptimized width={180} height={60} src={settings.logoUrl} alt="Vista previa del logo" className="max-h-14 w-auto object-contain" /></div>}
          <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Descripción institucional</Label><textarea id="description" value={settings.description} onChange={(event) => update("description", event.target.value)} rows={4} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Describe brevemente la academia y su propósito." /></div>
          <aside aria-label="Vista previa de identidad" className="rounded-xl border bg-background p-5 md:col-span-2" style={{ borderTop: `4px solid ${settings.primaryColor}` }}><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vista previa de identidad</p><h3 className="mt-3">{settings.academyName}</h3><p className="mt-1 text-sm text-muted-foreground">{settings.tagline || "Tu propuesta de formación"}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{settings.description || "La descripción institucional aparecerá aquí."}</p></aside>
        </div>
      </section> },
        { id: "certificates", label: "Certificados", content: <section className="dashboard-panel p-6"><div className="mb-6 flex items-center gap-3"><Award className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Plantilla de certificados</h2><p className="text-sm text-muted-foreground">Personaliza el contenido visual que se usa en los certificados PDF.</p></div></div>
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="certificatePrimaryColor">Color del certificado</Label><Input id="certificatePrimaryColor" type="color" value={certificateTemplate.primaryColor} onChange={(event) => updateCertificateTemplate("primaryColor", event.target.value)} className="h-11 w-full p-1" /></div>
            <div className="space-y-2"><Label htmlFor="certificateAcademyLabel">Nombre institucional</Label><Input id="certificateAcademyLabel" value={certificateTemplate.academyLabel} onChange={(event) => updateCertificateTemplate("academyLabel", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="certificateCompletionTitle">Título de finalización</Label><Input id="certificateCompletionTitle" value={certificateTemplate.completionTitle} onChange={(event) => updateCertificateTemplate("completionTitle", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="certificateGradesTitle">Título de notas</Label><Input id="certificateGradesTitle" value={certificateTemplate.gradesTitle} onChange={(event) => updateCertificateTemplate("gradesTitle", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="certificateSignatureLabel">Texto de firma</Label><Input id="certificateSignatureLabel" value={certificateTemplate.signatureLabel} onChange={(event) => updateCertificateTemplate("signatureLabel", event.target.value)} /></div>
          </div>
          <div className="rounded-xl border-4 p-5 text-center shadow-inner" style={{ borderColor: `${certificateTemplate.primaryColor}55` }}>
            <p className="text-xs font-bold tracking-[0.28em]" style={{ color: certificateTemplate.primaryColor }}>{certificateTemplate.academyLabel || "ACADEMIA VIRTUAL"}</p>
            <div className="mx-auto my-4 h-px w-24" style={{ backgroundColor: `${certificateTemplate.primaryColor}66` }} />
            <p className="text-xl font-bold text-foreground">{certificateTemplate.completionTitle || "CERTIFICADO DE FINALIZACIÓN"}</p>
            <p className="mt-5 text-xs text-muted-foreground">Se otorga el presente documento a:</p>
            <p className="mt-2 font-serif text-2xl font-semibold">Nombre del estudiante</p>
            <p className="mt-4 text-base font-semibold" style={{ color: certificateTemplate.primaryColor }}>Nombre del curso</p>
            <p className="mt-8 text-xs text-muted-foreground">{certificateTemplate.signatureLabel || "Dirección Académica"}</p>
          </div>
        </div>
      </section> },
        { id: "security", label: "Seguridad", content: <section className="dashboard-panel p-6"><div className="mb-6 flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Seguridad de administrador</h2><p className="text-sm text-muted-foreground">Protege tu acceso con un código temporal de Google Authenticator, Authy u otra aplicación TOTP.</p></div></div>
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-muted/20 p-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3"><KeyRound className={`mt-0.5 h-5 w-5 ${twoFactorEnabled ? "text-emerald-600" : "text-amber-600"}`} /><div><p className="font-semibold">{twoFactorEnabled ? "Verificación 2FA activa" : "Verificación 2FA no configurada"}</p><p className="mt-1 text-sm text-muted-foreground">{twoFactorEnabled ? "Se solicitará un código después de validar tu cuenta de Google." : "Recomendado para proteger pagos, usuarios, contratos y certificados."}</p></div></div>
          {!twoFactorEnabled && !twoFactorSetup && <Button onClick={() => void setupTwoFactor()} disabled={twoFactorBusy} className="shrink-0">Configurar 2FA</Button>}
          {twoFactorEnabled && <div className="flex flex-col gap-2 sm:flex-row"><Input inputMode="numeric" maxLength={6} value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código actual" aria-label="Código actual de 2FA" /><Button variant="outline" onClick={() => void disableTwoFactor()} disabled={twoFactorBusy || twoFactorCode.length !== 6}>Desactivar</Button></div>}
        </div>
        {twoFactorSetup && <div className="mt-5 flex flex-col items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5 text-center sm:flex-row sm:items-start sm:text-left"><Image src={twoFactorSetup.qrCodeDataUrl} alt="Código QR para configurar 2FA" width={180} height={180} className="rounded-lg bg-white p-2" /><div className="space-y-3"><div><p className="font-semibold">1. Escanea el código QR</p><p className="text-sm text-muted-foreground">Después ingresa el código de seis dígitos que muestra tu aplicación.</p></div><p className="break-all rounded-lg bg-background p-3 font-mono text-xs text-muted-foreground">Clave manual: {twoFactorSetup.secret}</p><div className="flex gap-2"><Input inputMode="numeric" maxLength={6} value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de 6 dígitos" aria-label="Código para activar 2FA" /><Button onClick={() => void enableTwoFactor()} disabled={twoFactorBusy || twoFactorCode.length !== 6}>Activar</Button></div></div></div>}
      </section> },
        { id: "website", label: "Portada web", content: <section className="dashboard-panel p-6"><div className="mb-6 flex items-center gap-3"><Megaphone className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Mensaje comercial</h2><p className="text-sm text-muted-foreground">Contenido principal mostrado en la portada.</p></div></div>
        <div className="grid gap-5">
          {field("heroEyebrow", "Etiqueta superior", "Formación profesional en línea")}
          {field("heroTitle", "Título principal", "Aprende habilidades que puedes aplicar desde el primer día")}
          <div className="space-y-2"><Label htmlFor="heroSubtitle">Descripción principal</Label><textarea id="heroSubtitle" value={settings.heroSubtitle} onChange={(event) => update("heroSubtitle", event.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>
          <aside aria-label="Vista previa de portada" className="rounded-xl bg-muted/40 p-6"><p className="page-eyebrow">Vista previa · {settings.heroEyebrow}</p><h3 className="max-w-xl !text-2xl">{settings.heroTitle || "Título principal de la portada"}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{settings.heroSubtitle || "Descripción de tu propuesta educativa."}</p></aside>
        </div>
      </section> },
        { id: "contact", label: "Contacto y legal", content: <section className="dashboard-panel p-6"><div className="mb-6 flex items-center gap-3"><Globe2 className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Contacto, redes y legal</h2><p className="text-sm text-muted-foreground">Usados en la landing, prospectos y pie de página.</p></div></div>
        <div className="grid gap-5 md:grid-cols-2">
          {field("whatsappNumber", "WhatsApp comercial", "51987654321")}
          {field("salesEmail", "Correo comercial", "ventas@academia.com", "email")}
          {field("supportEmail", "Correo de soporte", "soporte@academia.com", "email")}
          {field("address", "Dirección", "Lima, Perú")}
          {field("facebookUrl", "Facebook", "https://facebook.com/...")}
          {field("instagramUrl", "Instagram", "https://instagram.com/...")}
          {field("linkedinUrl", "LinkedIn", "https://linkedin.com/company/...")}
          {field("youtubeUrl", "YouTube", "https://youtube.com/@...")}
          {field("tiktokUrl", "TikTok", "https://tiktok.com/@...")}
          {field("xUrl", "X (Twitter)", "https://x.com/...")}
          {field("termsUrl", "URL de términos", "https://...")}
          {field("privacyUrl", "URL de privacidad", "https://...")}
        </div>
      </section> },
      ]} />
    </div>
  );
}
