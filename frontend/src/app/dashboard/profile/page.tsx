"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { API_URL, fetchApi, getErrorMessage } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, UserCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export default function ProfilePage() {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: ""
  });
  
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (user) {
      setFormData(prev => ({
      ...prev,
      firstName: user.firstName || "",
      lastName: user.lastName || ""
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
        lastName: formData.lastName
      };
      
      if (formData.password) {
        updateData.password = formData.password;
      }

      await fetchApi("/users/me", {
        method: "PATCH",
        body: JSON.stringify(updateData)
      });
      
      toast.success("Perfil actualizado correctamente");
      setFormData(prev => ({ ...prev, password: "", confirmPassword: "" }));
      
      // Opt: reload the page or update user context
      setTimeout(() => window.location.reload(), 1000);
      
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
      
      toast.success("Foto de perfil actualizada. Recarga para ver los cambios.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="glass border-white/20">
            <CardContent className="flex flex-col items-center pt-6 relative">
              <div className="h-32 w-32 rounded-full bg-primary/10 flex items-center justify-center mb-4 overflow-hidden relative group border-4 border-background shadow-xl">
                {user.profilePicture ? (
                  <Image unoptimized width={128} height={128} src={`${API_URL.replace('/api/v1', '')}${user.profilePicture}`} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="h-20 w-20 text-primary" />
                )}
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Upload className="h-6 w-6 text-white mb-1" />
                  <span className="text-white text-xs font-semibold">Cambiar</span>
                  <input 
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
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card className="glass border-white/20">
            <CardHeader>
              <CardTitle>Configuración de Cuenta</CardTitle>
              <CardDescription>
                Actualiza tus datos personales y contraseña.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre</label>
                    <Input 
                      required 
                      value={formData.firstName} 
                      onChange={e => setFormData({...formData, firstName: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Apellido</label>
                    <Input 
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

                <div className="border-t pt-4 mt-6">
                  <h3 className="font-semibold mb-4">Cambiar Contraseña</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nueva Contraseña</label>
                      <Input 
                        type="password" 
                        placeholder="Dejar en blanco para no cambiar"
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Confirmar Contraseña</label>
                      <Input 
                        type="password" 
                        placeholder="Dejar en blanco para no cambiar"
                        value={formData.confirmPassword} 
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                        minLength={8}
                      />
                    </div>
                  </div>
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
