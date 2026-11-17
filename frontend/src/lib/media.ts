import { API_URL } from "@/lib/api";

const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

/** Convierte una ruta del backend en una URL que pueda renderizar Next/Image. */
export function getMediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('storage://')) {
    return `${API_URL}/storage/public?ref=${encodeURIComponent(path)}`;
  }
  // Assets empaquetados por el frontend (por ejemplo, portadas demo).
  if (path.startsWith("/course-images/")) return path;
  // Los recursos legacy del backend viven bajo el prefijo global de la API.
  if (path.startsWith("/uploads/")) return `${API_URL}${path}`;
  return `${API_ORIGIN}${path}`;
}

/** La imagen propia de la cohorte tiene prioridad sobre la del curso. */
export function getCohortImageUrl(cohort?: {
  imageUrl?: string | null;
  course?: { imageUrl?: string | null } | null;
}) {
  return getMediaUrl(cohort?.imageUrl || cohort?.course?.imageUrl);
}
