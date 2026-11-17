import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { AuthProvider } from "@/components/auth-provider";
import { ConfirmProvider } from "@/components/confirm-provider";
import { PrivacyConsentBanner } from "@/components/privacy-consent-banner";
import { PwaRegister } from "@/components/pwa-register";
import { OfflineIndicator } from "@/components/offline-indicator";
import { GoogleAnalytics } from "@/components/google-analytics";
import {
  absoluteSiteUrl,
  getPublicCourses,
  getPublicSettings,
  siteUrl,
} from "@/lib/public-seo";

import { Toaster } from "sonner";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, courses] = await Promise.all([
    getPublicSettings(),
    getPublicCourses(),
  ]);

  const academyName = settings?.academyName || "NTS KIDS";
  const courseNames = Array.from(
    new Set(courses.map((course) => course.name).filter(Boolean)),
  );
  const serviceSummary =
    courseNames.length > 0
      ? courseNames.slice(0, 5).join(", ")
      : "Programación, Robótica, Desarrollo Web Fullstack, Python, Diseño UX/UI y Cloud Computing";

  const title = `${academyName} | Academia de Cursos Virtuales en Vivo y Tecnología`;
  const description =
    settings?.description ||
    `${academyName}: talleres y cursos en vivo de ${serviceSummary} para niños, adolescentes y jóvenes. Clases prácticas por Google Meet, seguimiento en campus virtual, pago en cuotas y certificados digitales verificables con QR.`;

  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${academyName}`,
    },
    description,
    keywords: [
      academyName,
      "NTS KIDS",
      "cursos de programación para niños",
      "cursos de programación para adolescentes y jóvenes",
      "talleres de robótica educativa",
      "clases de tecnología en vivo",
      "curso de desarrollo web fullstack",
      "curso de python y datos",
      "curso de diseño ux ui",
      "curso de cloud computing",
      "marketing digital y analítica",
      "certificados digitales con QR",
      "academia virtual de tecnología",
      ...courseNames,
    ],
    alternates: {
      canonical: absoluteSiteUrl("/"),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    ...(googleVerification
      ? {
          verification: {
            google: googleVerification,
          },
        }
      : {}),
    openGraph: {
      type: "website",
      locale: "es_PE",
      url: absoluteSiteUrl("/"),
      siteName: academyName,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ConfirmProvider>
              <Toaster position="top-right" richColors closeButton />
              <GoogleAnalytics />
              <PwaRegister />
              <OfflineIndicator />
              <Navbar />
              <a href="#main-content" className="skip-link">Saltar al contenido</a>
              <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-h-0 outline-none">
                {children}
              </main>
              <Footer />
              <FloatingWhatsApp />
              <PrivacyConsentBanner />
            </ConfirmProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
