import type { MetadataRoute } from "next";
import {
  absoluteSiteUrl,
  getPublicCohorts,
  getPublicCourses,
} from "@/lib/public-seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, cohorts] = await Promise.all([
    getPublicCourses(),
    getPublicCohorts(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteSiteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteSiteUrl("/cursos"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteSiteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteSiteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteSiteUrl("/libro-de-reclamaciones"), changeFrequency: "yearly", priority: 0.2 },
  ];

  return [
    ...staticRoutes,
    ...courses.map((course) => ({
      url: absoluteSiteUrl(`/programas/${course.id}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...cohorts.map((cohort) => ({
      url: absoluteSiteUrl(`/cohorts/${cohort.id}`),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
