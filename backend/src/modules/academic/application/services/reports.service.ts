import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { moneyToString } from '../../../../shared/utils/money';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** KPIs generales del sistema */
  async getSummary() {
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
      this.prisma.enrollment.count({ where: { deletedAt: null } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED' },
      }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      totalUsers,
      totalCourses,
      activeCohorts,
      totalEnrollments,
      totalRevenue: moneyToString(totalRevenue._sum.amount ?? 0),
      pendingPayments,
    };
  }

  /** Matrículas agrupadas por mes (últimos 12 meses) */
  async getEnrollmentsByMonth() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        enrolledAt: { gte: twelveMonthsAgo },
        deletedAt: null,
      },
      select: { enrolledAt: true },
      orderBy: { enrolledAt: 'asc' },
    });

    // Agrupar por mes
    const monthMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
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
  async getRevenueByMonth() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: twelveMonthsAgo },
      },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthMap = new Map<string, Prisma.Decimal>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, new Prisma.Decimal(0));
    }

    for (const p of payments) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key)) {
        monthMap.set(
          key,
          (monthMap.get(key) ?? new Prisma.Decimal(0)).add(p.amount),
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
    const where: any = { deletedAt: null, status: 'PUBLISHED' };
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
    const payments = await this.prisma.payment.findMany({
      where: { status: 'COMPLETED' },
      select: { method: true },
    });

    const counts = new Map<string, number>();
    for (const p of payments) {
      counts.set(p.method, (counts.get(p.method) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([method, count]) => ({
      method,
      count,
    }));
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
  async exportStudentsCsv(cohortId: string): Promise<string> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { cohortId, deletedAt: null },
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
        `"${e.user.firstName}"`,
        `"${e.user.lastName}"`,
        `"${e.user.email}"`,
        e.status,
        e.payment?.method || 'N/A',
        e.payment?.amount?.toFixed(2) || '0.00',
        e.payment?.status || 'N/A',
        new Date(e.enrolledAt).toISOString().split('T')[0],
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  /** CSV de calificaciones consolidadas de una cohorte */
  async exportGradesCsv(cohortId: string): Promise<string> {
    const evaluations = await this.prisma.evaluation.findMany({
      where: { cohortId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { cohortId, deletedAt: null },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Obtener todas las calificaciones de la cohorte
    const grades = await this.prisma.grade.findMany({
      where: {
        deliverable: { evaluation: { cohortId } },
        deletedAt: null,
      },
      include: {
        deliverable: { select: { studentId: true, evaluationId: true } },
      },
    });

    // Crear un mapa rápido
    const gradeMap = new Map<string, number>();
    grades.forEach((g) => {
      gradeMap.set(
        `${g.deliverable.studentId}_${g.deliverable.evaluationId}`,
        g.score,
      );
    });

    const evalHeaders = evaluations
      .map((e) => `"${e.title} (${e.weight}%)"`)
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
        `"${e.user.firstName}"`,
        `"${e.user.lastName}"`,
        `"${e.user.email}"`,
        ...scores,
        avg,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  /** CSV de asistencia de una cohorte */
  async exportAttendanceCsv(cohortId: string): Promise<string> {
    const attendances = await this.prisma.classAttendance.findMany({
      where: { cohortId },
      include: {
        student: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ date: 'asc' }, { student: { lastName: 'asc' } }],
    });

    const header =
      'Fecha,Nombre,Apellido,Email,Presente,Justificado,Observación';
    const rows = attendances.map((a) => {
      return [
        new Date(a.date).toISOString().split('T')[0],
        `"${a.student.firstName}"`,
        `"${a.student.lastName}"`,
        `"${a.student.email}"`,
        a.isPresent ? 'Sí' : 'No',
        a.isExcused ? 'Sí' : 'No',
        `"${a.observation || ''}"`,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }
}
