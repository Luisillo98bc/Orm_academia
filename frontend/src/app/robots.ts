import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/public-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/cursos",
        "/programas/",
        "/cohorts/",
        "/verify/",
        "/verify-certificate/",
        "/libro-de-reclamaciones",
        "/privacy",
        "/terms",
      ],
      disallow: ["/dashboard/", "/api/", "/login", "/register", "/checkout/"],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}
