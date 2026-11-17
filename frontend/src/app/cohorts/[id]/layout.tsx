import type { Metadata } from "next";
import {
  absoluteMediaUrl,
  absoluteSiteUrl,
  getPublicCohort,
  getPublicSettings,
  siteUrl,
} from "@/lib/public-seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [cohort, settings] = await Promise.all([
    getPublicCohort(id),
    getPublicSettings(),
  ]);
  const academyName = settings?.academyName || "NTS KIDS";
  const courseName = cohort?.course?.name || cohort?.name || "Programa académico";
  const title = `Matrícula Abierta: ${courseName} (${cohort?.name || "Edición en vivo"}) | ${academyName}`;
  const description =
    cohort?.course?.description ||
    `Consulta horarios, modalidad en vivo, facilidad de pago en cuotas, docentes y certificación con QR de ${courseName} en ${academyName}.`;
  const url = absoluteSiteUrl(`/cohorts/${id}`);
  const image = absoluteMediaUrl(cohort?.imageUrl || cohort?.course?.imageUrl);

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
      ...(image ? { images: [{ url: image, alt: courseName }] } : {}),
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

export default function PublicCohortLayout({ children }: { children: React.ReactNode }) {
  return children;
}
