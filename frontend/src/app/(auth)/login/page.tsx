"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { GraduationCap, Loader2, ShieldCheck } from "lucide-react";

function LoginContent() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [googleCredential, setGoogleCredential] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");
  const { login, user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || loading) return;
    const destination = cohortId && user.roles.includes("ESTUDIANTE")
      ? `/dashboard/checkout?cohortId=${cohortId}`
      : "/dashboard";
    router.replace(destination);
  }, [authLoading, cohortId, loading, router, user]);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setError("");
    setLoading(true);

    try {
      const data = await fetchApi("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential, ...(twoFactorCode ? { otpCode: twoFactorCode } : {}) }),
      });

      if (data.twoFactorRequired) {
        setGoogleCredential(credential);
        setTwoFactorRequired(true);
        setTwoFactorCode("");
        return;
      }
      login(data.user);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No fue posible iniciar sesión con Google"));
    } finally {
      setLoading(false);
    }
  }, [login, twoFactorCode]);

  const verifyTwoFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(twoFactorCode) || !googleCredential) {
      setError("Ingresa un código 2FA válido de 6 dígitos");
      return;
    }
    await handleGoogleCredential(googleCredential);
  };

  if (authLoading || user) {
    return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4"><Loader2 className="h-10 w-10 animate-spin text-primary" aria-label="Cargando sesión" /></div>;
  }

  return (
    <div className="auth-shell relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-muted/10 p-4">
      <div className="absolute left-1/4 top-1/4 -z-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl dark:opacity-20" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl dark:opacity-20" />

      <Card className="glass-card w-full max-w-md overflow-hidden rounded-2xl border-border/80 shadow-lg">
        <CardHeader className="space-y-3 pb-6 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20"><GraduationCap className="h-7 w-7" /></div>
          <CardTitle className="text-2xl font-black tracking-tight"><h1 className="text-2xl font-black tracking-tight">Accede a tu campus</h1></CardTitle>
          <CardDescription className="text-sm">Inicia sesión de forma segura con tu cuenta de Google.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 px-6 md:px-8">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-center">
            <p className="text-sm font-semibold text-foreground">Una sola cuenta para aprender</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Tu perfil se crea automáticamente como estudiante al ingresar por primera vez.</p>
          </div>

          {twoFactorRequired ? (
            <form onSubmit={verifyTwoFactor} className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div><p className="text-sm font-semibold">Verificación adicional</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Abre Google Authenticator e ingresa el código de seis dígitos para continuar.</p></div>
              <Input autoFocus inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" aria-label="Código de autenticación de seis dígitos" className="text-center text-lg tracking-[0.4em]" />
              <Button type="submit" className="w-full" disabled={loading || twoFactorCode.length !== 6}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{loading ? "Verificando…" : "Verificar y acceder"}</Button>
              <button type="button" className="w-full text-xs font-semibold text-primary hover:underline" onClick={() => { setTwoFactorRequired(false); setGoogleCredential(""); setTwoFactorCode(""); }}>Usar otra cuenta de Google</button>
            </form>
          ) : (
            <div className="space-y-3">
              <GoogleLoginButton onCredential={handleGoogleCredential} disabled={loading} />
              {loading && <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Validando tu cuenta…</p>}
            </div>
          )}

          {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm font-medium text-destructive">{error}</div>}

          <div className="flex items-start gap-3 rounded-xl bg-muted/45 p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Usamos la verificación de Google para proteger el acceso a tu información académica.</span></div>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/60 bg-muted/20 py-6"><p className="text-sm text-muted-foreground">¿Necesitas información? <Link href="/#contacto" className="font-bold text-primary hover:underline">Contáctanos</Link></p></CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}><LoginContent /></Suspense>;
}
