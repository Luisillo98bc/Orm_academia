import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const isHttpsProduction =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_API_URL?.startsWith("https://");
const apiOrigin = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003/api/v1",
    ).origin;
  } catch {
    return "http://localhost:3003";
  }
})();
const websocketOrigin = apiOrigin.replace(/^http/, "ws");
const localApiOrigin = "http://localhost:3003";
const localWebsocketOrigin = "ws://localhost:3003";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Google Identity Services opens a cross-origin popup and needs the
  // opener relationship preserved for the callback handshake.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      // React's development runtime uses eval for enhanced error stacks.
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://accounts.google.com/gsi/client https://static.cloudflareinsights.com`,
      "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
      `img-src 'self' data: blob: ${apiOrigin} ${localApiOrigin} https:`,
      "font-src 'self' data: https:",
      `connect-src 'self' ${apiOrigin} ${websocketOrigin} ${localApiOrigin} ${localWebsocketOrigin} https://accounts.google.com/gsi/`,
      "frame-src 'self' https://accounts.google.com/gsi/",
      "worker-src 'self'",
      ...(isHttpsProduction ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
  ...(isHttpsProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Evita agotar la memoria al construir en una VM pequeña.
  experimental: { cpus: 2 },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/course-images/:path*", headers: [...securityHeaders, { key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // El shell del campus cambia con cada despliegue. Evita que el navegador
      // conserve el HTML anterior y siga apuntando a un bundle viejo.
      { source: "/", headers: [...securityHeaders, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/dashboard/:path*", headers: [...securityHeaders, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/login", headers: [...securityHeaders, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/register", headers: [...securityHeaders, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/forgot-password", headers: [...securityHeaders, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/reset-password", headers: [...securityHeaders, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
