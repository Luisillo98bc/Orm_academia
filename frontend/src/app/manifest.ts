import type { MetadataRoute } from "next";
import { getPublicSettings } from "@/lib/public-seo";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getPublicSettings();
  const name = settings?.academyName || "Academia Virtual";
  return {
    name,
    short_name: name.slice(0, 12),
    description: settings?.description || "Campus virtual para aprender, enseñar y gestionar programas.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#102a43",
    lang: "es",
    icons: [{ src: "/pwa-icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" }],
  };
}
