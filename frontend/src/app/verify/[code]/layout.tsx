import type { Metadata } from "next";
import { absoluteSiteUrl, getPublicSettings, siteUrl } from "@/lib/public-seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const settings = await getPublicSettings();
  const academyName = settings?.academyName || "NTS KIDS";
  const title = `Verificación Oficial de Certificado Digital (${code}) | ${academyName}`;
  const description = `Valida la autenticidad del certificado digital con código QR ${code} emitido por ${academyName}.`;
  const url = absoluteSiteUrl(`/verify/${code}`);

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

export default function VerifyCertificateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
