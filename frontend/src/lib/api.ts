export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

let refreshPromise: Promise<boolean> | null = null;

export function getErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function buildHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function renewSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function announceExpiredSession() {
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
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: buildHeaders(options),
    credentials: "include",
  });

  const isAuthEndpoint = endpoint.startsWith("/auth/");
  if (response.status === 401 && retryAfterRefresh && !isAuthEndpoint) {
    if (await renewSession()) {
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
      credentials: "include",
    });
  } finally {
    announceExpiredSession();
  }
}

export async function downloadApiFile(endpoint: string, filename: string): Promise<void> {
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
