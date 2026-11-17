import type { Metadata } from "next";
import { absoluteSiteUrl, getPublicSettings } from "@/lib/public-seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const academyName = settings?.academyName || "NTS KIDS";
  return {
    title: { absolute: `Iniciar Sesión en el Campus Virtual | ${academyName}` },
    description: `Accede de forma segura al campus virtual de ${academyName} para ingresar a tus clases en vivo, materiales, entregas y certificados.`,
    alternates: { canonical: absoluteSiteUrl("/login") },
    robots: { index: false, follow: true },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
