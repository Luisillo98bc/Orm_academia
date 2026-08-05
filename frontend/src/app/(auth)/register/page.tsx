"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { GraduationCap, Loader2 } from "lucide-react";

import { Suspense } from "react";

function RegisterContent() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validaciones
    if (formData.firstName.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }
    if (formData.lastName.trim().length < 2) {
      setError("El apellido debe tener al menos 2 caracteres");
      return;
    }
    if (!formData.email.includes("@") || !formData.email.includes(".")) {
      setError("Ingresa un correo electrónico válido");
      return;
    }
    if (formData.password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres");
      return;
    }

    setLoading(true);

    try {
      await fetchApi("/auth/register", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      
      // Auto redirect to login
      let redirectUrl = "/login?registered=true";
      if (cohortId) {
        redirectUrl += `&cohortId=${cohortId}`;
      }
      router.push(redirectUrl);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al registrarse"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4 bg-muted/10 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-primary/20 rounded-full blur-3xl -z-10 mix-blend-multiply opacity-50 dark:opacity-20 animate-blob"></div>
      
      <Card className="w-full max-w-md glass border-white/20 dark:border-white/10 shadow-xl">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Crea tu cuenta</CardTitle>
          <CardDescription>
            Únete a nuestra plataforma y comienza a aprender hoy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="firstName">Nombre</label>
                <Input
                  id="firstName"
                  placeholder="Juan"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="bg-background/50 focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="lastName">Apellido</label>
                <Input
                  id="lastName"
                  placeholder="Pérez"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="bg-background/50 focus:bg-background"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">Correo electrónico</label>
              <Input
                id="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="bg-background/50 focus:bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">Contraseña</label>
              <Input
                id="password"
                type="password"
                placeholder="Min 8 caracteres"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                className="bg-background/50 focus:bg-background"
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-md bg-destructive/15 text-destructive text-sm font-medium">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Crear cuenta"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border/50 pt-6">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{" "}
            <Link href={cohortId ? `/login?cohortId=${cohortId}` : "/login"} className="font-semibold text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
