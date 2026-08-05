"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { GraduationCap, Loader2, Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import { Suspense } from "react";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");
  const registered = searchParams.get("registered");
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("Ingresa un correo electrónico válido");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres");
      return;
    }

    setLoading(true);

    try {
      const data = await fetchApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      login(data.user);
      
      if (cohortId && data.user.roles.includes("ESTUDIANTE")) {
        router.push(`/checkout/${cohortId}`);
        return;
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al iniciar sesión"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 bg-muted/10 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl -z-10 mix-blend-multiply opacity-50 dark:opacity-20 animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -z-10 mix-blend-multiply opacity-50 dark:opacity-20 animate-pulse-slow" />

      <Card className="w-full max-w-md glass-card border-border/80 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="space-y-3 text-center pb-6 pt-8">
          <div className="mx-auto bg-gradient-to-tr from-primary to-indigo-500 w-14 h-14 rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <GraduationCap className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight">Bienvenido de nuevo</CardTitle>
          <CardDescription className="text-sm">
            {registered ? "¡Registro exitoso! Por favor, inicia sesión." : "Ingresa tus credenciales para acceder a tu campus virtual"}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 md:px-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="email">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11 rounded-xl bg-background/60 focus:bg-background border-border/80"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="password">
                  Contraseña
                </label>
                <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-11 rounded-xl bg-background/60 focus:bg-background border-border/80"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-indigo-600 hover:opacity-95 gap-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a la Plataforma</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-border/60 py-6 bg-muted/20">
          <p className="text-sm text-muted-foreground">
            ¿Aún no tienes una cuenta?{" "}
            <Link
              href={cohortId ? `/register?cohortId=${cohortId}` : "/register"}
              className="font-bold text-primary hover:underline"
            >
              Regístrate gratis
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
