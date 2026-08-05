"use client";

import { useState, useEffect } from "react";
import { API_URL, fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    logoUrl: "",
    whatsappNumber: "",
    supportEmail: "",
    facebookUrl: "",
    instagramUrl: "",
  });

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`);
      if (!res.ok) throw new Error("Error fetching settings");
      const data = await res.json();
      if (data) {
        setSettings({
          logoUrl: data.logoUrl || "",
          whatsappNumber: data.whatsappNumber || "",
          supportEmail: data.supportEmail || "",
          facebookUrl: data.facebookUrl || "",
          instagramUrl: data.instagramUrl || "",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchSettings();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi("/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      
      toast.success("Configuración actualizada", {
        description: "Los cambios ahora son visibles en la plataforma."
      });
      // Force reload to update navbar if logo changed
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración Global</h1>
        <p className="text-muted-foreground">
          Administra la información de contacto y el diseño principal de la academia.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identidad y Contacto</CardTitle>
          <CardDescription>
            Estos datos se mostrarán en la barra de navegación y el pie de página de la web principal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <div className="flex gap-4">
              {settings.logoUrl && (
                <div className="w-16 h-16 rounded-lg bg-black flex items-center justify-center overflow-hidden border">
                  <Image unoptimized width={64} height={64} src={settings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <Input
                  value={settings.logoUrl}
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                  placeholder="https://ejemplo.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Ingresa la URL de la imagen. Próximamente se habilitará la subida de archivos directos.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número de WhatsApp</Label>
              <Input
                value={settings.whatsappNumber}
                onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                placeholder="51999999999"
              />
              <p className="text-xs text-muted-foreground">Incluye el código de país sin el signo +</p>
            </div>
            
            <div className="space-y-2">
              <Label>Correo de Soporte</Label>
              <Input
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                placeholder="soporte@academia.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Facebook URL (Opcional)</Label>
              <Input
                value={settings.facebookUrl}
                onChange={(e) => setSettings({ ...settings, facebookUrl: e.target.value })}
                placeholder="https://facebook.com/..."
              />
            </div>

            <div className="space-y-2">
              <Label>Instagram URL (Opcional)</Label>
              <Input
                value={settings.instagramUrl}
                onChange={(e) => setSettings({ ...settings, instagramUrl: e.target.value })}
                placeholder="https://instagram.com/..."
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 py-4 px-6 border-t flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Guardar Cambios
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
