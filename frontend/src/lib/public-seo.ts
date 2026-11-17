import type { Cohort, Course, PlatformSettings } from "@/types/domain";

const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1").replace(/\/$/, "");
const apiOrigin = publicApiUrl.replace(/\/api\/v1\/?$/, "");

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
if (process.env.NODE_ENV === "production" && !configuredSiteUrl) {
  throw new Error("NEXT_PUBLIC_SITE_URL es obligatorio en producción para generar SEO absoluto.");
}

export const siteUrl = (configuredSiteUrl || "http://localhost:3002").replace(/\/$/, "");

async function fetchPublic<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${publicApiUrl}${endpoint}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function absoluteSiteUrl(path: string) {
  return new URL(path, `${siteUrl}/`).toString();
}

export function absoluteMediaUrl(path?: string | null) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/course-images/")) return absoluteSiteUrl(path);
  if (path.startsWith("/uploads/")) return `${apiOrigin}${path}`;
  if (path.startsWith("storage://")) {
    return `${publicApiUrl}/storage/public?ref=${encodeURIComponent(path)}`;
  }
  return `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function getPublicSettings() {
  return fetchPublic<PlatformSettings>("/settings/public");
}

export async function getPublicCourses() {
  return (await fetchPublic<Course[]>("/academic/public/courses")) ?? [];
}

export async function getPublicCohorts() {
  return (await fetchPublic<Cohort[]>("/academic/public/cohorts")) ?? [];
}

export async function getPublicCourse(id: string) {
  const courses = await getPublicCourses();
  return courses.find((course) => course.id === id) ?? null;
}

export async function getPublicCohort(id: string) {
  const cohorts = await getPublicCohorts();
  return cohorts.find((cohort) => cohort.id === id) ?? null;
}
