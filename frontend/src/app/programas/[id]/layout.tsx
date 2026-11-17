import type { Metadata } from "next";
import {
  absoluteMediaUrl,
  absoluteSiteUrl,
  getPublicCourse,
  getPublicSettings,
  siteUrl,
} from "@/lib/public-seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [course, settings] = await Promise.all([
    getPublicCourse(id),
    getPublicSettings(),
  ]);
  const academyName = settings?.academyName || "NTS KIDS";
  const title = course
    ? `Curso de ${course.name} en Vivo con Certificado QR | ${academyName}`
    : `Programa Académico en Vivo | ${academyName}`;
  const description =
    course?.description ||
    settings?.description ||
    `Conoce el temario, fechas de inicio, modalidad en vivo, pago en cuotas y certificación con QR de ${course?.name || "nuestros programas"} en ${academyName}.`;
  const url = absoluteSiteUrl(`/programas/${id}`);
  const image = absoluteMediaUrl(course?.imageUrl);

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
      ...(image ? { images: [{ url: image, alt: course?.name || title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    metadataBase: new URL(siteUrl),
  };
}

export default function PublicProgramLayout({ children }: { children: React.ReactNode }) {
  return children;
}
