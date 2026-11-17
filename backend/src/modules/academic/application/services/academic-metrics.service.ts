import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { moneyToString } from '../../../../shared/utils/money';
import {
  monthlyReceivedPayments,
  totalReceivedPayments,
} from './payment-receipts';
import {
  normalizePagination,
  paginatedResult,
} from '../../../../shared/pagination/pagination';

@Injectable()
export class AcademicMetricsService {
  constructor(private prisma: PrismaService) {}

  async getPublicStats() {
    const now = new Date();
    const [courses, cohorts, students, certificates] = await Promise.all([
      this.prisma.course.count({
        where: { isPublished: true, deletedAt: null },
      }),
      this.prisma.cohort.count({
        where: {
          isActive: true,
          deletedAt: null,
          endDate: { gte: now },
          course: { isPublished: true, deletedAt: null },
        },
      }),
      this.prisma.enrollment.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.certificate.count({ where: { revokedAt: null } }),
    ]);

    return { courses, cohorts, students, certificates };
  }

  async getDashboardMetrics() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

    const [totalRevenueResult, totalStudents, activeCohorts, payments] =
      await Promise.all([
        // 1. Ganancias Totales (Pagos completados)
        totalReceivedPayments(this.prisma),
        // 2. Total Alumnos Matriculados (Activos y Completados)
        this.prisma.enrollment.count({
          where: {
            status: { in: ['ACTIVE', 'COMPLETED'] },
          },
        }),
        // 3. Total Cohortes Activos
        this.prisma.cohort.count({
          where: {
            isActive: true,
            deletedAt: null,
          },
        }),
        // 4. Ingresos por mes (últimos 6 meses)
        monthlyReceivedPayments(this.prisma, { gte: sixMonthsAgo }),
      ]);

    const totalRevenue = moneyToString(totalRevenueResult);
    const revenueByMonth = this.aggregateRevenueByMonth(
      payments.map((payment) => ({
        amount: payment.total,
        updatedAt: new Date(`${payment.month}-01T12:00:00Z`),
      })),
    );

    return {
      totalRevenue,
      totalStudents,
      activeCohorts,
      revenueByMonth,
    };
  }

  async getDataQualitySummary() {
    const [courses, cohorts, users, payments] = await Promise.all([
      this.prisma.course.findMany({
        where: {
          deletedAt: null,
          OR: [{ durationHours: 0 }, { imageUrl: null }, { description: null }],
        },
        select: {
          id: true,
          name: true,
          durationHours: true,
          imageUrl: true,
          description: true,
        },
        take: 100,
      }),
      this.prisma.cohort.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          OR: [
            { schedule: null },
            { maxStudents: 0 },
            { teachers: { none: {} } },
          ],
        },
        select: {
          id: true,
          name: true,
          schedule: true,
          maxStudents: true,
          teachers: { select: { id: true } },
        },
        take: 100,
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          isActive: true,
          OR: [{ firstName: '' }, { lastName: '' }, { phone: null }],
        },
      }),
      this.prisma.payment.count({ where: { amount: { lte: 0 } } }),
    ]);
    return {
      score: Math.max(
        0,
        100 - courses.length * 2 - cohorts.length * 2 - users - payments,
      ),
      counts: {
        courses: courses.length,
        cohorts: cohorts.length,
        users,
        payments,
      },
      courses,
      cohorts,
    };
  }

  private aggregateRevenueByMonth(
    payments: { amount: Prisma.Decimal; updatedAt: Date }[],
  ) {
    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const dataMap = new Map<string, Prisma.Decimal>();

    // Inicializar los últimos 6 meses con 0
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const label = `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      dataMap.set(label, new Prisma.Decimal(0));
    }

    // Sumar montos
    payments.forEach((p) => {
      const label = `${months[p.updatedAt.getMonth()]} ${p.updatedAt.getFullYear().toString().substring(2)}`;
      if (dataMap.has(label)) {
        dataMap.set(label, dataMap.get(label)!.add(p.amount));
      }
    });

    return Array.from(dataMap.entries()).map(([month, revenue]) => ({
      month,
      revenue: revenue.toFixed(2),
    }));
  }

  async getStudentsExportData() {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        user: true,
        cohort: {
          include: {
            course: true,
          },
        },
      },
    });

    return enrollments.map((e) => ({
      Alumno: `${e.user.firstName} ${e.user.lastName}`,
      Email: e.user.email,
      Curso: e.cohort.course?.name || 'Desconocido',
      Cohorte: e.cohort.name,
      FechaInscripcion: e.enrolledAt.toISOString().split('T')[0],
      Estado: e.status,
    }));
  }

  async getEnrollmentsPage(page = 1, limit = 20, search?: string) {
    const pagination = normalizePagination(page, limit);
    const cleanSearch = search?.trim();
    const where: Prisma.EnrollmentWhereInput = {
      deletedAt: null,
      ...(cleanSearch
        ? {
            OR: [
              {
                user: {
                  OR: [
                    {
                      firstName: { contains: cleanSearch, mode: 'insensitive' },
                    },
                    {
                      lastName: { contains: cleanSearch, mode: 'insensitive' },
                    },
                    { email: { contains: cleanSearch, mode: 'insensitive' } },
                  ],
                },
              },
              {
                cohort: {
                  name: { contains: cleanSearch, mode: 'insensitive' },
                },
              },
              {
                cohort: {
                  course: {
                    name: { contains: cleanSearch, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [enrollments, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          cohort: { include: { course: { select: { name: true } } } },
        },
        orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return paginatedResult(
      enrollments.map((enrollment) => ({
        id: enrollment.id,
        Alumno: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
        Email: enrollment.user.email,
        Curso: enrollment.cohort.course?.name || 'Desconocido',
        Cohorte: enrollment.cohort.name,
        FechaInscripcion: enrollment.enrolledAt.toISOString().split('T')[0],
        Estado: enrollment.status,
      })),
      pagination.page,
      pagination.limit,
      total,
    );
  }
}
