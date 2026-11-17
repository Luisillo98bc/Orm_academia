import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { moneyToString } from '../../../../shared/utils/money';
import { escapeCsvText, withCsvBom } from '../../../../shared/utils/csv';
import {
  monthlyReceivedPayments,
  receiptDateFilter,
  totalReceivedPayments,
} from './payment-receipts';
import {
  normalizePagination,
  paginatedResult,
} from '../../../../shared/pagination/pagination';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private dateRange(startDate?: string, endDate?: string) {
    const range: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00.000-05:00`);
      if (!Number.isNaN(start.getTime())) range.gte = start;
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999-05:00`);
      if (!Number.isNaN(end.getTime())) range.lte = end;
    }
    return Object.keys(range).length > 0 ? range : undefined;
  }

  /** KPIs generales del sistema */
  async getSummary(startDate?: string, endDate?: string) {
    const enrollmentDate = this.dateRange(startDate, endDate);
    const paymentDate = this.dateRange(startDate, endDate);
    const [
      totalUsers,
      totalCourses,
      activeCohorts,
      totalEnrollments,
      totalRevenue,
      pendingPayments,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.course.count({ where: { deletedAt: null } }),
      this.prisma.cohort.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.enrollment.count({
        where: {
          deletedAt: null,
          ...(enrollmentDate ? { enrolledAt: enrollmentDate } : {}),
        },
      }),
      totalReceivedPayments(this.prisma, paymentDate),
      this.prisma.payment.count({
        where: {
          status: 'PENDING',
          ...(paymentDate ? { createdAt: paymentDate } : {}),
        },
      }),
    ]);

    return {
      totalUsers,
      totalCourses,
      activeCohorts,
      totalEnrollments,
      totalRevenue: moneyToString(totalRevenue),
      pendingPayments,
    };
  }

  async getEnrollmentsReport(page = 1, limit = 20, search?: string) {
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
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          cohort: {
            select: { name: true, course: { select: { name: true } } },
          },
        },
        orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return paginatedResult(
      enrollments,
      pagination.page,
      pagination.limit,
      total,
    );
  }

  /** Matrículas agrupadas por mes (últimos 12 meses) */
  async getEnrollmentsByMonth(startDate?: string, endDate?: string) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        enrolledAt: this.dateRange(startDate, endDate) ?? {
          gte: twelveMonthsAgo,
        },
        deletedAt: null,
      },
      select: { enrolledAt: true },
      orderBy: { enrolledAt: 'asc' },
    });

    // Agrupar por mes
    const monthMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }

    for (const e of enrollments) {
      const d = new Date(e.enrolledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key)) {
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      }
    }

    return Array.from(monthMap.entries()).map(([month, count]) => ({
      month,
      label: this.formatMonth(month),
      count,
    }));
  }

  /** Ingresos por mes (últimos 12 meses) */
  async getRevenueByMonth(startDate?: string, endDate?: string) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const payments = await monthlyReceivedPayments(
      this.prisma,
      this.dateRange(startDate, endDate) ?? { gte: twelveMonthsAgo },
    );

    const monthMap = new Map<string, Prisma.Decimal>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, new Prisma.Decimal(0));
    }

    for (const p of payments) {
      const key = p.month;
      if (monthMap.has(key)) {
        monthMap.set(
          key,
          (monthMap.get(key) ?? new Prisma.Decimal(0)).add(p.total),
        );
      }
    }

    return Array.from(monthMap.entries()).map(([month, total]) => ({
      month,
      label: this.formatMonth(month),
      total: total.toFixed(2),
    }));
  }

  /** Top cursos por cantidad de matrículas */
  async getCoursesRanking() {
    const courses = await this.prisma.course.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        cohorts: {
          select: {
            _count: { select: { enrollments: true } },
          },
        },
      },
    });

    const ranked = courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      totalEnrollments: c.cohorts.reduce(
        (sum, coh) => sum + coh._count.enrollments,
        0,
      ),
    }));

    ranked.sort((a, b) => b.totalEnrollments - a.totalEnrollments);
    return ranked.slice(0, 10);
  }

  /** Porcentaje de asistencia promedio por cohorte activa */
  async getAttendanceSummary() {
    const cohorts = await this.prisma.cohort.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        classAttendances: {
          select: { isPresent: true },
        },
        _count: { select: { enrollments: true } },
      },
    });

    return cohorts.map((c) => {
      const total = c.classAttendances.length;
      const present = c.classAttendances.filter((a) => a.isPresent).length;
      return {
        id: c.id,
        name: c.name,
        totalStudents: c._count.enrollments,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });
  }

  /** Distribución de notas por cohorte */
  async getGradesDistribution(cohortId?: string) {
    const where: Prisma.GradeWhereInput = {
      deletedAt: null,
      status: 'PUBLISHED',
    };
    if (cohortId) {
      where.deliverable = { evaluation: { cohortId } };
    }

    const grades = await this.prisma.grade.findMany({
      where,
      select: { score: true },
    });

    // Agrupar en rangos
    const ranges = [
      { label: '0-5', min: 0, max: 5, count: 0 },
      { label: '6-10', min: 6, max: 10, count: 0 },
      { label: '11-13', min: 11, max: 13, count: 0 },
      { label: '14-16', min: 14, max: 16, count: 0 },
      { label: '17-18', min: 17, max: 18, count: 0 },
      { label: '19-20', min: 19, max: 20, count: 0 },
    ];

    for (const g of grades) {
      for (const r of ranges) {
        if (g.score >= r.min && g.score <= r.max) {
          r.count++;
          break;
        }
      }
    }

    return ranges.map((r) => ({ range: r.label, count: r.count }));
  }

  /** Distribución de métodos de pago (completados) */
  async getPaymentMethodsDistribution() {
    return this.prisma.$queryRaw<{ method: string; count: number }[]>`
      SELECT method, COUNT(*)::integer AS count FROM payment_receipts
      GROUP BY method ORDER BY method`;
  }

  async getFinancialProfitability(startDate?: string, endDate?: string) {
    const range = this.dateRange(startDate, endDate);
    const [payments, costs, activeEnrollments] = await Promise.all([
      this.prisma.$queryRaw<
        {
          amount: Prisma.Decimal;
          courseId: string;
          course: string;
          enrollmentId: string;
        }[]
      >(Prisma.sql`
        SELECT SUM(r.amount) AS amount, c.course_id AS "courseId", course.name AS course,
               p.enrollment_id AS "enrollmentId"
        FROM payment_receipts r JOIN payments p ON p.id = r.payment_id
        JOIN enrollments e ON e.id = p.enrollment_id JOIN cohorts c ON c.id = e.cohort_id
        JOIN courses course ON course.id = c.course_id
        ${receiptDateFilter(range)}
        GROUP BY c.course_id, course.name, p.enrollment_id
      `),
      this.prisma.operatingCost.findMany({
        where: range
          ? {
              periodStart: { lte: range.lte || new Date() },
              OR: [
                { periodEnd: null },
                { periodEnd: { gte: range.gte || new Date(0) } },
              ],
            }
          : undefined,
        select: { amount: true, label: true, courseId: true, cohortId: true },
      }),
      this.prisma.enrollment.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { cohort: { select: { price: true } } },
      }),
    ]);
    const revenue = payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const totalCosts = costs.reduce(
      (sum, cost) => sum + Number(cost.amount),
      0,
    );
    const projection = activeEnrollments.reduce(
      (sum, enrollment) => sum + Number(enrollment.cohort.price),
      0,
    );
    const byCourse = new Map<
      string,
      { courseId: string; course: string; revenue: number; enrollments: number }
    >();
    payments.forEach((payment) => {
      const row = byCourse.get(payment.courseId) || {
        courseId: payment.courseId,
        course: payment.course,
        revenue: 0,
        enrollments: 0,
      };
      row.revenue += Number(payment.amount);
      row.enrollments += 1;
      byCourse.set(payment.courseId, row);
    });
    return {
      revenue: revenue.toFixed(2),
      costs: totalCosts.toFixed(2),
      profit: (revenue - totalCosts).toFixed(2),
      margin: revenue
        ? Math.round(((revenue - totalCosts) / revenue) * 10000) / 100
        : 0,
      projectedRevenue: projection.toFixed(2),
      costsCount: costs.length,
      byCourse: Array.from(byCourse.values()).map((row) => ({
        ...row,
        revenue: row.revenue.toFixed(2),
      })),
    };
  }

  async listOperatingCosts() {
    return this.prisma.operatingCost.findMany({
      orderBy: { periodStart: 'desc' },
      include: {
        course: { select: { name: true } },
        cohort: { select: { name: true } },
      },
      take: 100,
    });
  }

  async createOperatingCost(
    userId: string,
    input: {
      label: string;
      amount: number;
      periodStart: string;
      periodEnd?: string;
      courseId?: string;
      cohortId?: string;
      notes?: string;
    },
  ) {
    return this.prisma.operatingCost.create({
      data: {
        createdById: userId,
        label: input.label.trim().slice(0, 200),
        amount: input.amount,
        periodStart: new Date(input.periodStart),
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
        courseId: input.courseId || null,
        cohortId: input.cohortId || null,
        notes: input.notes?.trim().slice(0, 2000),
      },
    });
  }

  async deleteOperatingCost(id: string) {
    return this.prisma.operatingCost.delete({ where: { id } });
  }

  /** CSV financiero para conciliación de pagos en efectivo. */
  async exportPaymentsCsv(
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const payments = await this.prisma.$queryRaw<
      {
        createdAt: Date;
        method: string;
        amount: Prisma.Decimal;
        status: string;
        validatedAt: Date | null;
        rejectedAt: Date | null;
        installmentNumber: number;
        enrollment: {
          user: { firstName: string; lastName: string; email: string };
          cohort: { name: string; course: { name: string } };
        };
      }[]
    >(Prisma.sql`
      SELECT r.paid_at AS "createdAt", r.amount, r.method, r.status,
             r.validated_at AS "validatedAt", r.rejected_at AS "rejectedAt",
             r.installment_number AS "installmentNumber",
             json_build_object('user', json_build_object('firstName', u.first_name,
               'lastName', u.last_name, 'email', u.email), 'cohort',
               json_build_object('name', c.name, 'course', json_build_object('name', course.name))) AS enrollment
      FROM (
        SELECT payment_id, installment_number, amount, method, paid_at,
               'COMPLETED' AS status, paid_at AS validated_at, NULL::timestamp AS rejected_at
        FROM payment_receipts
        UNION ALL
        SELECT id, installment_number, amount, method::text, created_at,
               status::text, validated_at, rejected_at FROM payments WHERE status <> 'COMPLETED'
      ) r JOIN payments p ON p.id = r.payment_id JOIN enrollments e ON e.id = p.enrollment_id
      JOIN users u ON u.id = e.user_id JOIN cohorts c ON c.id = e.cohort_id
      JOIN courses course ON course.id = c.course_id
      ${receiptDateFilter(this.dateRange(startDate, endDate))}
      ORDER BY r.paid_at DESC, r.payment_id, r.installment_number
    `);

    const header =
      'Fecha,Estudiante,Email,Curso,Cohorte,Método,Monto,Estado,Validado,Rechazado,Cuota';
    const rows = payments.map((payment) =>
      [
        new Date(payment.createdAt).toISOString().split('T')[0],
        escapeCsvText(
          `${payment.enrollment.user.firstName} ${payment.enrollment.user.lastName}`,
        ),
        escapeCsvText(payment.enrollment.user.email),
        escapeCsvText(payment.enrollment.cohort.course.name),
        escapeCsvText(payment.enrollment.cohort.name),
        payment.method,
        payment.amount.toFixed(2),
        payment.status,
        payment.validatedAt
          ? new Date(payment.validatedAt).toISOString().split('T')[0]
          : '',
        payment.rejectedAt
          ? new Date(payment.rejectedAt).toISOString().split('T')[0]
          : '',
        payment.installmentNumber,
      ].join(','),
    );

    return withCsvBom([header, ...rows].join('\n'));
  }

  private formatMonth(key: string): string {
    const [year, month] = key.split('-');
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
    return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
  }

  // ── EXPORTACIÓN CSV ──

  /** CSV de alumnos matriculados en una cohorte */
  async exportStudentsCsv(
    cohortId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        cohortId,
        deletedAt: null,
        ...(this.dateRange(startDate, endDate)
          ? { enrolledAt: this.dateRange(startDate, endDate) }
          : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        payment: { select: { status: true, method: true, amount: true } },
      },
      orderBy: { enrolledAt: 'asc' },
    });

    const header =
      'Nombre,Apellido,Email,Estado Matrícula,Método Pago,Monto,Estado Pago,Fecha Matrícula';
    const rows = enrollments.map((e) => {
      return [
        escapeCsvText(e.user.firstName),
        escapeCsvText(e.user.lastName),
        escapeCsvText(e.user.email),
        e.status,
        e.payment?.method || 'N/A',
        e.payment?.amount?.toFixed(2) || '0.00',
        e.payment?.status || 'N/A',
        new Date(e.enrolledAt).toISOString().split('T')[0],
      ].join(',');
    });

    return withCsvBom([header, ...rows].join('\n'));
  }

  /** CSV de calificaciones consolidadas de una cohorte */
  async exportGradesCsv(
    cohortId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const [evaluations, enrollments, grades] = await Promise.all([
      this.prisma.evaluation.findMany({
        where: {
          cohortId,
          deletedAt: null,
          ...(this.dateRange(startDate, endDate)
            ? { createdAt: this.dateRange(startDate, endDate) }
            : {}),
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.enrollment.findMany({
        where: { cohortId, deletedAt: null },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      // Obtener todas las calificaciones de la cohorte
      this.prisma.grade.findMany({
        where: {
          deliverable: { evaluation: { cohortId } },
          deletedAt: null,
        },
        include: {
          deliverable: { select: { studentId: true, evaluationId: true } },
        },
      }),
    ]);

    // Crear un mapa rápido
    const gradeMap = new Map<string, number>();
    grades.forEach((g) => {
      gradeMap.set(
        `${g.deliverable.studentId}_${g.deliverable.evaluationId}`,
        g.score,
      );
    });

    const evalHeaders = evaluations
      .map((e) => escapeCsvText(`${e.title} (${e.weight}%)`))
      .join(',');
    const header = `Nombre,Apellido,Email,${evalHeaders},Promedio Ponderado`;

    const rows = enrollments.map((e) => {
      let totalWeight = 0;
      let weightedSum = 0;
      const scores = evaluations.map((ev) => {
        const score = gradeMap.get(`${e.user.id}_${ev.id}`);
        if (score !== undefined) {
          totalWeight += ev.weight;
          weightedSum += (score / ev.maxScore) * ev.weight;
        }
        return score !== undefined ? score.toFixed(1) : '-';
      });

      const avg =
        totalWeight > 0 ? ((weightedSum / totalWeight) * 20).toFixed(2) : '-';

      return [
        escapeCsvText(e.user.firstName),
        escapeCsvText(e.user.lastName),
        escapeCsvText(e.user.email),
        ...scores,
        avg,
      ].join(',');
    });

    return withCsvBom([header, ...rows].join('\n'));
  }

  /** CSV de asistencia de una cohorte */
  async exportAttendanceCsv(
    cohortId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const attendances = await this.prisma.classAttendance.findMany({
      where: {
        cohortId,
        ...(this.dateRange(startDate, endDate)
          ? { date: this.dateRange(startDate, endDate) }
          : {}),
      },
      include: {
        student: { select: { firstName: true, lastName: true, email: true } },
        session: {
          select: {
            title: true,
            module: { select: { title: true } },
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { sessionId: 'asc' },
        { student: { lastName: 'asc' } },
      ],
    });

    const header =
      'Fecha,Sesión,Módulo,Nombre,Apellido,Email,Presente,Justificado,Observación';
    const rows = attendances.map((a) => {
      return [
        new Date(a.date).toISOString().split('T')[0],
        escapeCsvText(a.session?.title || 'Sin sesión vinculada'),
        escapeCsvText(a.session?.module.title || ''),
        escapeCsvText(a.student.firstName),
        escapeCsvText(a.student.lastName),
        escapeCsvText(a.student.email),
        a.isPresent ? 'Sí' : 'No',
        a.isExcused ? 'Sí' : 'No',
        escapeCsvText(a.observation || ''),
      ].join(',');
    });

    return withCsvBom([header, ...rows].join('\n'));
  }
}
