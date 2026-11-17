const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1";
const LOCAL_API_URL = "http://localhost:3003/api/v1";

function isLoopbackApiUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// The same Docker frontend is reachable directly on localhost and through
// Cloudflare. Keep browser sessions on the origin they were opened from so
// local cookies are not sent to the public hostname (and vice versa).
const isLocalBrowser =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

// In local development, respect frontend/.env.local (usually port 4000).
// When the Docker image was built with a public API URL but is opened through
// localhost, use the local Docker port instead of making a public round-trip.
export const API_URL =
  isLocalBrowser && !isLoopbackApiUrl(PUBLIC_API_URL)
    ? LOCAL_API_URL
    : PUBLIC_API_URL;
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

const TAB_ACCESS_TOKEN_KEY = `av:tab-access-token:${API_ORIGIN}`;
const TAB_REFRESH_TOKEN_KEY = `av:tab-refresh-token:${API_ORIGIN}`;
const SESSION_REVISION_KEY = `av:session-revision:${API_ORIGIN}`;

export function getTabAccessToken(): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(TAB_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function getTabRefreshToken(): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(TAB_REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeTabTokensFromResponse(response: Response): void {
  if (typeof window === "undefined" || !response?.headers) return;
  try {
    const nextAccess = response.headers.get("x-tab-access-token");
    const nextRefresh = response.headers.get("x-tab-refresh-token");
    if (nextAccess) {
      window.sessionStorage.setItem(TAB_ACCESS_TOKEN_KEY, nextAccess);
    }
    if (nextRefresh) {
      window.sessionStorage.setItem(TAB_REFRESH_TOKEN_KEY, nextRefresh);
    }
  } catch {
    // Fallback silencioso a cookies si sessionStorage está restringido.
  }
}

export function clearTabTokens(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TAB_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(TAB_REFRESH_TOKEN_KEY);
    window.sessionStorage.removeItem(SESSION_REVISION_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function appendTabTokenQuery(downloadUrl: string): string {
  const tabToken = getTabAccessToken();
  if (!tabToken) return downloadUrl;
  return `${downloadUrl}&token=${encodeURIComponent(tabToken)}`;
}

/** Convierte rutas locales del backend en enlaces navegables desde Next.js. */
export function resolveFileUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return "";
  if (/^(https?:|data:|blob:)/i.test(fileUrl)) return fileUrl;
  if (fileUrl.startsWith("storage://")) {
    return appendTabTokenQuery(
      `${API_URL}/storage/download?ref=${encodeURIComponent(fileUrl)}`,
    );
  }
  // Los documentos antiguos /uploads se descargan autenticados. Las imágenes
  // públicas usan getImageUrl/media y no pasan por esta función.
  if (fileUrl.startsWith("/uploads/")) {
    return appendTabTokenQuery(
      `${API_URL}/storage/download?ref=${encodeURIComponent(fileUrl)}`,
    );
  }
  if (fileUrl.startsWith("/")) return `${API_ORIGIN}${fileUrl}`;
  return fileUrl;
}

let refreshPromise: Promise<boolean> | null = null;

function readSessionRevision(): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(SESSION_REVISION_KEY);
  } catch {
    return null;
  }
}

export function getErrorMessage(
  error: unknown,
  fallback = "Ocurrió un error inesperado",
) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function buildHeaders(options: RequestInit, endpoint = ""): Headers {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;
  if (
    hasBody &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const cleanEndpoint = endpoint.split("?")[0];
  const isPublicAuthMutation = [
    "/auth/login",
    "/auth/google",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].includes(cleanEndpoint);

  if (!isPublicAuthMutation && !headers.has("Authorization")) {
    const tabAccess = getTabAccessToken();
    if (tabAccess) {
      headers.set("Authorization", `Bearer ${tabAccess}`);
    }
  }
  if (
    (cleanEndpoint === "/auth/refresh" || cleanEndpoint === "/auth/logout") &&
    !headers.has("X-Tab-Refresh-Token")
  ) {
    const tabRefresh = getTabRefreshToken();
    if (tabRefresh) {
      headers.set("X-Tab-Refresh-Token", tabRefresh);
    }
  }
  return headers;
}

async function renewSession(failedRevision: string | null): Promise<boolean> {
  if (!refreshPromise) {
    const renew = async () => {
      if (readSessionRevision() !== failedRevision) return true;
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: buildHeaders({ method: "POST" }, "/auth/refresh"),
        credentials: "include",
      });
      if (response.ok && typeof window !== "undefined") {
        storeTabTokensFromResponse(response);
        try {
          window.sessionStorage.setItem(
            SESSION_REVISION_KEY,
            crypto.randomUUID(),
          );
        } catch {
          // Las cookies siguen funcionando si el navegador restringe el almacenamiento.
        }
      }
      return response.ok;
    };
    refreshPromise = renew()
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Si una pestaña se abrió heredando únicamente la cookie del navegador,
 * obtiene y fija sus propios tokens en sessionStorage para aislarla de otras pestañas.
 */
export async function ensureTabSessionIsolated(): Promise<void> {
  if (typeof window === "undefined") return;
  if (getTabAccessToken() && getTabRefreshToken()) return;
  await renewSession(readSessionRevision()).catch(() => false);
}

function announceExpiredSession() {
  clearTabTokens();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:expired"));
  }
}

async function errorFromResponse(response: Response): Promise<Error> {
  let message = "Ocurrió un error en la solicitud";
  try {
    const errorData = await response.clone().json();
    message = errorData.message || message;
  } catch {
    // La respuesta puede no ser JSON.
  }
  return new Error(message);
}

export async function fetchApiResponse(
  endpoint: string,
  options: RequestInit = {},
  retryAfterRefresh = true,
): Promise<Response> {
  const sessionRevision = readSessionRevision();
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: buildHeaders(options, endpoint),
    credentials: "include",
  });

  if (response.ok) {
    storeTabTokensFromResponse(response);
  }

  const isSessionEndpoint = [
    "/auth/login",
    "/auth/google",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].includes(endpoint.split("?")[0]);
  if (response.status === 401 && retryAfterRefresh && !isSessionEndpoint) {
    if (await renewSession(sessionRevision)) {
      return fetchApiResponse(endpoint, options, false);
    }
    announceExpiredSession();
  }

  if (!response.ok) throw await errorFromResponse(response);
  return response;
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const response = await fetchApiResponse(endpoint, options);
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) return response.json();
  return response.text();
}

export async function logoutSession(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: buildHeaders({ method: "POST" }, "/auth/logout"),
      credentials: "include",
    });
  } finally {
    announceExpiredSession();
  }
}

export async function downloadApiFile(
  endpoint: string,
  filename: string,
): Promise<void> {
  const response = await fetchApiResponse(endpoint);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
