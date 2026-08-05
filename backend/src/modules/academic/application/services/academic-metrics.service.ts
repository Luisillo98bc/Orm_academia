import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { moneyToString } from '../../../../shared/utils/money';

@Injectable()
export class AcademicMetricsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardMetrics() {
    // 1. Ganancias Totales (Pagos completados)
    const totalRevenueResult = await this.prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'COMPLETED',
      },
    });
    const totalRevenue = moneyToString(totalRevenueResult._sum.amount ?? 0);

    // 2. Total Alumnos Matriculados (Activos y Completados)
    const totalStudents = await this.prisma.enrollment.count({
      where: {
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
    });

    // 3. Total Cohortes Activos
    const activeCohorts = await this.prisma.cohort.count({
      where: {
        isActive: true,
        deletedAt: null,
      },
    });

    // 4. Ingresos por mes (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); // Primer día de hace 5 meses

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: sixMonthsAgo },
      },
      select: {
        amount: true,
        updatedAt: true,
      },
    });

    const revenueByMonth = this.aggregateRevenueByMonth(payments);

    return {
      totalRevenue,
      totalStudents,
      activeCohorts,
      revenueByMonth,
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
}
