import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AuthProvider } from "@/components/auth-provider";

import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Academia Virtual — Plataforma de Aprendizaje",
  description: "Plataforma educativa integral con cursos en vivo, evaluaciones, certificados y comunidad. Aprende con expertos y transforma tu carrera.",
  keywords: ["academia", "cursos online", "educación", "LMS", "aprendizaje virtual"],
};

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
            <Toaster position="top-right" richColors closeButton />
            <Navbar />
            <main className="flex-1 flex flex-col min-h-0">
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
