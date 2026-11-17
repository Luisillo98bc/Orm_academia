import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(query: string, actor?: { id: string; roles?: string[] }) {
    if (!query || query.trim().length < 2) {
      return {
        courses: [],
        users: [],
        cohorts: [],
        prospects: [],
        payments: [],
        supportTickets: [],
      };
    }

    const searchTerm = query.trim();

    const staff = Boolean(
      actor?.roles?.some((role) => ['ADMIN', 'RRHH'].includes(role)),
    );
    const isTeacher = Boolean(actor?.roles?.includes('DOCENTE'));
    const isStudent = Boolean(actor?.roles?.includes('ESTUDIANTE'));

    const cohortRoleFilter = staff
      ? {}
      : isTeacher
        ? { teachers: { some: { id: actor?.id } } }
        : isStudent
          ? {
              OR: [
                {
                  enrollments: {
                    some: { userId: actor?.id, deletedAt: null },
                  },
                },
                { isActive: true, course: { isPublished: true } },
              ],
            }
          : {};

    const [courses, users, cohorts, prospects, payments, supportTickets] =
      await Promise.all([
        // Buscar cursos
        this.prisma.course.findMany({
          where: {
            deletedAt: null,
            ...(staff ? {} : { isPublished: true }),
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
        staff
          ? this.prisma.user.findMany({
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
            })
          : Promise.resolve([]),

        // Buscar cohortes
        this.prisma.cohort.findMany({
          where: {
            deletedAt: null,
            ...cohortRoleFilter,
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              {
                course: { name: { contains: searchTerm, mode: 'insensitive' } },
              },
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
        staff
          ? this.prisma.prospect.findMany({
              where: {
                OR: [
                  { name: { contains: searchTerm, mode: 'insensitive' } },
                  { email: { contains: searchTerm, mode: 'insensitive' } },
                  { phone: { contains: searchTerm } },
                ],
              },
              select: { id: true, name: true, email: true, status: true },
              take: 5,
            })
          : Promise.resolve([]),
        this.prisma.payment.findMany({
          where: staff
            ? {
                enrollment: {
                  OR: [
                    {
                      user: {
                        OR: [
                          {
                            email: {
                              contains: searchTerm,
                              mode: 'insensitive',
                            },
                          },
                          {
                            firstName: {
                              contains: searchTerm,
                              mode: 'insensitive',
                            },
                          },
                          {
                            lastName: {
                              contains: searchTerm,
                              mode: 'insensitive',
                            },
                          },
                        ],
                      },
                    },
                    {
                      cohort: {
                        name: { contains: searchTerm, mode: 'insensitive' },
                      },
                    },
                  ],
                },
              }
            : {
                enrollment: {
                  userId: actor?.id,
                  OR: [
                    {
                      user: {
                        email: { contains: searchTerm, mode: 'insensitive' },
                      },
                    },
                    {
                      cohort: {
                        name: { contains: searchTerm, mode: 'insensitive' },
                      },
                    },
                  ],
                },
              },
          select: {
            id: true,
            amount: true,
            status: true,
            enrollment: {
              select: {
                user: { select: { firstName: true, lastName: true } },
                cohort: { select: { name: true } },
              },
            },
          },
          take: 5,
        }),
        this.prisma.supportTicket.findMany({
          where: {
            ...(staff ? {} : { requesterId: actor?.id }),
            OR: [
              { subject: { contains: searchTerm, mode: 'insensitive' } },
              { description: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
          select: { id: true, subject: true, status: true, priority: true },
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
      prospects,
      payments,
      supportTickets,
    };
  }
}
