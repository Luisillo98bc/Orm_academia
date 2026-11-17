import { fetchApi } from "@/lib/api";

const CATALOG_TTL_MS = 5 * 60 * 1000;
const PREFIX = "academy:public-catalog:";
const inFlight = new Map<string, Promise<unknown>>();

type CacheEntry<T> = { value: T; expiresAt: number };

function readCache<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return entry && entry.expiresAt > Date.now() ? entry : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ value, expiresAt: Date.now() + CATALOG_TTL_MS }));
  } catch {
    // Storage may be unavailable in private browsing; the API remains the source of truth.
  }
}

export async function fetchCatalogApi<T>(endpoint: string, key = endpoint): Promise<T> {
  const cached = readCache<T>(key);
  if (cached) return cached.value;

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const requestPromise = (async () => {
    try {
      const value = (await fetchApi(endpoint)) as T;
      writeCache(key, value);
      return value;
    } catch (error) {
      const stale = typeof window !== "undefined" ? window.sessionStorage.getItem(`${PREFIX}${key}`) : null;
      if (stale) {
        try {
          return (JSON.parse(stale) as CacheEntry<T>).value;
        } catch {
          /* ignore malformed cache */
        }
      }
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, requestPromise);
  return requestPromise;
}
