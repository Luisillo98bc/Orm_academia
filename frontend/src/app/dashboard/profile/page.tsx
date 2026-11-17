"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { getMediaUrl } from "@/lib/media";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, UserCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { PageHeader } from "@/components/dashboard/page-header";
import { SummaryStrip } from "@/components/dashboard/workspace-tabs";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dni: "",
    phone: "",
    address: "",
    district: "",
    province: "",
    department: "",
    password: "",
    confirmPassword: ""
  });

  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const profileFields = { firstName: "nombre", lastName: "apellido", dni: "DNI", phone: "celular", address: "dirección", district: "distrito", province: "provincia", department: "departamento" };
  const missing = Object.entries(profileFields).filter(([key]) => !formData[key as keyof typeof formData].trim()).map(([, label]) => label);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (user) {
      setFormData(prev => ({
      ...prev,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      dni: user.dni || "",
      phone: user.phone || "",
      address: user.address || "",
      district: user.district || "",
      province: user.province || "",
      department: user.department || ""
      }));
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const updateData: Record<string, string> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dni: formData.dni,
        phone: formData.phone,
        address: formData.address,
        district: formData.district,
        province: formData.province,
        department: formData.department
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      await fetchApi("/users/me", {
        method: "PATCH",
        body: JSON.stringify(updateData)
      });

      await refreshUser();
      toast.success("Perfil actualizado correctamente");
      setFormData(prev => ({ ...prev, password: "", confirmPassword: "" }));

    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Error al actualizar el perfil"));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setUploadingAvatar(true);
    try {
      await fetchApi("/users/me/avatar", {
        method: "POST",
        body: formData
      });

      await refreshUser();
      toast.success("Foto de perfil actualizada correctamente");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Cuenta personal" title="Mi perfil" description="Mantén actualizados tus datos de contacto y la información de tu ficha académica." />
      <SummaryStrip items={[{ label: "Ficha completada", value: `${Math.round((8 - missing.length) / 8 * 100)}%`, detail: "Identificación y contacto" }, { label: "Acceso", value: "Cuenta personal", detail: user.email }]} />
      {missing.length > 0 && <p className="workspace-note">Completa: {missing.join(", ")}. Estos datos se utilizan en tu ficha y comunicaciones de la academia.</p>}
      <nav aria-label="Secciones del perfil" className="flex flex-wrap gap-4 text-sm font-semibold text-primary"><a href="#profile-personal" className="hover:underline">Datos personales</a><a href="#profile-security" className="hover:underline">Contraseña y seguridad</a></nav>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="glass border-border/70">
            <CardContent className="flex flex-col items-center pt-6 relative">
              <div className="h-32 w-32 rounded-full bg-primary/10 flex items-center justify-center mb-4 overflow-hidden relative group border-4 border-background shadow-xl">
                {user.profilePicture ? (
                  <Image unoptimized width={128} height={128} src={getMediaUrl(user.profilePicture) || ""} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="h-20 w-20 text-primary" />
                )}
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity cursor-pointer">
                  <Upload className="h-6 w-6 text-white mb-1" />
                  <span className="text-white text-xs font-semibold">Cambiar</span>
                  <input
                    aria-label="Cambiar foto de perfil"
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </div>
              </div>
              {uploadingAvatar && <Loader2 className="h-4 w-4 animate-spin text-primary absolute top-2 right-2" />}
              <h2 className="text-xl font-bold">{user.firstName} {user.lastName}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="mt-4 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-primary bg-primary/10 border-transparent">
                {user.roles[0]}
              </div>
              {!user.profileComplete && <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-700">Completa tus datos para mantener tu ficha académica actualizada.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="glass border-border/70">
            <CardHeader>
              <CardTitle>Configuración de Cuenta</CardTitle>
              <CardDescription>
                Actualiza tus datos personales y contraseña.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent id="profile-personal" className="space-y-4 scroll-mt-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="profile-firstName" className="text-sm font-medium">Nombre</label>
                    <Input id="profile-firstName"
                      required
                      value={formData.firstName}
                      onChange={e => setFormData({...formData, firstName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="profile-lastName" className="text-sm font-medium">Apellido</label>
                    <Input id="profile-lastName"
                      required
                      value={formData.lastName}
                      onChange={e => setFormData({...formData, lastName: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Correo Electrónico (No editable)</label>
                  <Input disabled value={user.email} className="bg-muted/50" />
                </div>

                <div className="border-t pt-5">
                  <h3 className="font-semibold">Datos de identificación y contacto</h3>
                  <p className="mb-4 mt-1 text-sm text-muted-foreground">Necesarios para tu ficha académica y comunicaciones institucionales.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><label htmlFor="profile-dni" className="text-sm font-medium">DNI</label><Input id="profile-dni" inputMode="numeric" maxLength={8} pattern="[0-9]{8}" required value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value.replace(/\D/g, "")})} placeholder="12345678" /></div>
                    <div className="space-y-2"><label htmlFor="profile-phone" className="text-sm font-medium">Celular</label><Input id="profile-phone" inputMode="tel" maxLength={12} required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/[^\d+]/g, "")})} placeholder="987654321" /></div>
                    <div className="space-y-2 sm:col-span-2"><label htmlFor="profile-address" className="text-sm font-medium">Dirección de domicilio</label><Input id="profile-address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Av. Ejemplo 123, urbanización..." /></div>
                    <div className="space-y-2"><label htmlFor="profile-district" className="text-sm font-medium">Distrito</label><Input id="profile-district" required value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} /></div>
                    <div className="space-y-2"><label htmlFor="profile-province" className="text-sm font-medium">Provincia</label><Input id="profile-province" required value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} /></div>
                    <div className="space-y-2"><label htmlFor="profile-department" className="text-sm font-medium">Departamento</label><Input id="profile-department" required value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} placeholder="Lima" /></div>
                  </div>
                </div>

                <div id="profile-security" className="border-t pt-4 mt-6 scroll-mt-5">
                  <h3 className="font-semibold mb-4">Cambiar Contraseña</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="profile-password" className="text-sm font-medium">Nueva Contraseña</label>
                      <Input id="profile-password"
                        type="password"
                        placeholder="Dejar en blanco para no cambiar"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-confirmPassword" className="text-sm font-medium">Confirmar Contraseña</label>
                      <Input id="profile-confirmPassword"
                        type="password"
                        placeholder="Dejar en blanco para no cambiar"
                        value={formData.confirmPassword}
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                        minLength={8}
                      />
                    </div>
                  </div>
                  {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && <p role="alert" className="mt-2 text-sm text-destructive">Las contraseñas no coinciden.</p>}
                </div>

              </CardContent>
              <CardFooter className="flex justify-end border-t border-border/50 bg-muted/20 px-6 py-4">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar Cambios
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
