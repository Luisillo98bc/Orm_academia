// Keep the app shell up to date. The previous version cached `/` first and
// could keep an old landing page after a deployment or visual update.
const CACHE_NAME = "academia-static-v5";
const STATIC_ASSETS = ["/pwa-icon.svg", "/manifest.webmanifest", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("academia-static-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  )
    return;

  // HTML is the source of truth for the current Next.js build. Always try
  // the network first for navigations so a reload cannot resurrect an old
  // page shell from the service-worker cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("/offline")),
    );
    return;
  }

  // Solo estas rutas públicas usan la caché compartida entre cuentas.
  // Las imágenes privadas, respuestas de API y datos de Next.js usan la red.
  // Los archivos compilados ya tienen caché HTTP por su nombre con hash.
  const url = new URL(request.url);
  if (!STATIC_ASSETS.includes(url.pathname) || url.search) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
