import type { Metadata } from "next";
import { absoluteSiteUrl, getPublicSettings } from "@/lib/public-seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const academyName = settings?.academyName || "NTS KIDS";
  return {
    title: { absolute: `Recuperar Contraseña | ${academyName}` },
    description: `Restablece el acceso a tu cuenta del campus virtual de ${academyName}.`,
    alternates: { canonical: absoluteSiteUrl("/forgot-password") },
    robots: { index: false, follow: true },
  };
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
