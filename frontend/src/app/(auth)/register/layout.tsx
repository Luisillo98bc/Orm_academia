import type { Metadata } from "next";
import { absoluteSiteUrl, getPublicSettings } from "@/lib/public-seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const academyName = settings?.academyName || "NTS KIDS";
  return {
    title: { absolute: `Crear Cuenta en el Campus Virtual | ${academyName}` },
    description: `Crea tu perfil de estudiante en ${academyName} e inscríbete en nuestros programas en vivo.`,
    alternates: { canonical: absoluteSiteUrl("/register") },
    robots: { index: false, follow: true },
  };
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
