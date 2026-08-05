import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(query: string) {
    if (!query || query.trim().length < 2) {
      return { courses: [], users: [], cohorts: [] };
    }

    const searchTerm = query.trim();

    const [courses, users, cohorts] = await Promise.all([
      // Buscar cursos
      this.prisma.course.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { code: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
          level: true,
          imageUrl: true,
        },
        take: 5,
      }),

      // Buscar usuarios
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          roles: {
            select: { role: { select: { name: true } } },
          },
        },
        take: 5,
      }),

      // Buscar cohortes
      this.prisma.cohort.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { course: { name: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          startDate: true,
          course: { select: { name: true } },
        },
        take: 5,
      }),
    ]);

    return {
      courses,
      users: users.map((u) => ({
        ...u,
        roles: u.roles.map((r) => r.role.name),
      })),
      cohorts,
    };
  }
}
