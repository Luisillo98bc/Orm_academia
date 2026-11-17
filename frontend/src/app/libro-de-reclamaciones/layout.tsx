import type { Metadata } from "next";
import { absoluteSiteUrl, getPublicSettings, siteUrl } from "@/lib/public-seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const academyName = settings?.academyName || "NTS KIDS";
  const title = `Libro de Reclamaciones Virtual | ${academyName}`;
  const description = `Libro de Reclamaciones Virtual oficial de ${academyName} conforme al Código de Protección y Defensa del Consumidor (INDECOPI).`;
  const url = absoluteSiteUrl("/libro-de-reclamaciones");

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
    metadataBase: new URL(siteUrl),
  };
}

export default function LibroDeReclamacionesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
