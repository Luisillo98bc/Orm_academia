import type { Metadata } from "next";
import {
  absoluteSiteUrl,
  getPublicCourses,
  getPublicSettings,
  siteUrl,
} from "@/lib/public-seo";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, courses] = await Promise.all([
    getPublicSettings(),
    getPublicCourses(),
  ]);
  const academyName = settings?.academyName || "NTS KIDS";
  const courseList =
    Array.from(new Set(courses.map((c) => c.name).filter(Boolean))).slice(0, 5).join(", ") ||
    "Programación, Robótica, Desarrollo Web Fullstack, Python, Diseño UX/UI y Cloud";

  const title = `Catálogo de Cursos en Vivo de Programación y Tecnología | ${academyName}`;
  const description = `Explora el catálogo completo de cursos y talleres de ${academyName}: ${courseList}. Clases en vivo, modalidad virtual o presencial, pago en cuotas y certificado digital con QR.`;
  const url = absoluteSiteUrl("/cursos");

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: academyName,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    metadataBase: new URL(siteUrl),
  };
}

export default function PublicCatalogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
