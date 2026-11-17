import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { totalReceivedPayments } from './payment-receipts';

export const CONVERSION_EVENTS = [
  'LANDING_VIEW',
  'PROGRAM_VIEW',
  'WHATSAPP_CLICK',
  'REGISTRATION_STARTED',
  'CHECKOUT_STARTED',
  'PAYMENT_METHOD_SELECTED',
  'CHECKOUT_CREATED',
  'VOUCHER_SUBMITTED',
  'PAYMENT_COMPLETED',
  'CHECKOUT_FAILED',
] as const;

type ConversionEventName = (typeof CONVERSION_EVENTS)[number];

interface TrackEventInput {
  event: string;
  sessionId: string;
  path?: string;
  cohortId?: string;
  paymentId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ConversionAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(input: TrackEventInput) {
    if (!CONVERSION_EVENTS.includes(input.event as ConversionEventName)) {
      throw new BadRequestException('Evento de conversión inválido');
    }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(input.sessionId || '')) {
      throw new BadRequestException('Sesión analítica inválida');
    }
    if (input.cohortId && !/^[0-9a-f-]{36}$/i.test(input.cohortId)) {
      throw new BadRequestException('Cohorte inválida');
    }

    const metadata = input.metadata
      ? (Object.fromEntries(
          Object.entries(input.metadata).slice(0, 20),
        ) as Prisma.InputJsonObject)
      : undefined;

    await this.prisma.conversionEvent.create({
      data: {
        event: input.event,
        sessionId: input.sessionId,
        path: input.path?.slice(0, 500),
        cohortId: input.cohortId,
        paymentId: input.paymentId,
        metadata,
      },
    });

    return { received: true };
  }

  async attachPayment(
    sessionId: string | undefined,
    cohortId: string,
    paymentId?: string,
  ) {
    if (!sessionId) return;
    await this.track({
      event: 'CHECKOUT_CREATED',
      sessionId,
      cohortId,
      paymentId,
      path: '/dashboard/checkout',
    });
  }

  async markPayment(
    paymentId: string,
    event: 'PAYMENT_COMPLETED' | 'VOUCHER_SUBMITTED' | 'CHECKOUT_FAILED',
  ) {
    const checkout = await this.prisma.conversionEvent.findFirst({
      where: { paymentId, event: 'CHECKOUT_CREATED' },
      orderBy: { occurredAt: 'desc' },
    });
    if (!checkout) return;
    await this.track({
      event,
      sessionId: checkout.sessionId,
      cohortId: checkout.cohortId || undefined,
      paymentId,
      path: '/dashboard/checkout',
    });
  }

  async getFunnel(days = 30) {
    const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const since = new Date(Date.now() - safeDays * 86_400_000);
    const funnelEvents: ConversionEventName[] = [
      'LANDING_VIEW',
      'PROGRAM_VIEW',
      'CHECKOUT_STARTED',
      'CHECKOUT_CREATED',
      'PAYMENT_COMPLETED',
    ];

    const counts = await Promise.all(
      funnelEvents.map(async (event) => ({
        event,
        count: (
          await this.prisma.conversionEvent.findMany({
            where: { event, occurredAt: { gte: since } },
            distinct: ['sessionId'],
            select: { sessionId: true },
          })
        ).length,
      })),
    );

    const map = new Map(counts.map((item) => [item.event, item.count]));
    const landingViews = map.get('LANDING_VIEW') || 0;
    const checkoutStarts = map.get('CHECKOUT_STARTED') || 0;
    const completed = map.get('PAYMENT_COMPLETED') || 0;
    const [whatsappClicks, failures, pendingPayments, completedRevenue] =
      await Promise.all([
        this.prisma.conversionEvent.count({
          where: { event: 'WHATSAPP_CLICK', occurredAt: { gte: since } },
        }),
        this.prisma.conversionEvent.count({
          where: { event: 'CHECKOUT_FAILED', occurredAt: { gte: since } },
        }),
        this.prisma.payment.count({
          where: { status: 'PENDING', createdAt: { gte: since } },
        }),
        totalReceivedPayments(this.prisma, { gte: since }),
      ]);

    return {
      days: safeDays,
      funnel: counts,
      landingToCheckoutRate: landingViews
        ? Number(((checkoutStarts / landingViews) * 100).toFixed(1))
        : 0,
      checkoutConversionRate: checkoutStarts
        ? Number(((completed / checkoutStarts) * 100).toFixed(1))
        : 0,
      whatsappClicks,
      failures,
      pendingPayments,
      completedRevenue: completedRevenue.toFixed(2),
    };
  }

  async getConversionByProgram(days = 30) {
    const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const since = new Date(Date.now() - safeDays * 86_400_000);
    const events = await this.prisma.conversionEvent.findMany({
      where: {
        occurredAt: { gte: since },
        cohortId: { not: null },
        event: {
          in: ['PROGRAM_VIEW', 'CHECKOUT_STARTED', 'PAYMENT_COMPLETED'],
        },
      },
      select: { cohortId: true, event: true, sessionId: true },
    });
    const cohortIds = [
      ...new Set(
        events
          .map((event) => event.cohortId)
          .filter((cohortId): cohortId is string => Boolean(cohortId)),
      ),
    ];
    const cohorts = await this.prisma.cohort.findMany({
      where: { id: { in: cohortIds } },
      select: { id: true, courseId: true, course: { select: { name: true } } },
    });
    const byCohort = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
    const grouped = new Map<
      string,
      {
        courseId: string;
        courseName: string;
        views: Set<string>;
        checkouts: Set<string>;
        payments: Set<string>;
      }
    >();
    for (const event of events) {
      if (!event.cohortId) continue;
      const cohort = byCohort.get(event.cohortId);
      if (!cohort) continue;
      const current = grouped.get(cohort.courseId) || {
        courseId: cohort.courseId,
        courseName: cohort.course.name,
        views: new Set<string>(),
        checkouts: new Set<string>(),
        payments: new Set<string>(),
      };
      if (event.event === 'PROGRAM_VIEW') current.views.add(event.sessionId);
      if (event.event === 'CHECKOUT_STARTED')
        current.checkouts.add(event.sessionId);
      if (event.event === 'PAYMENT_COMPLETED')
        current.payments.add(event.sessionId);
      grouped.set(cohort.courseId, current);
    }
    return [...grouped.values()]
      .map((item) => ({
        courseId: item.courseId,
        courseName: item.courseName,
        programViews: item.views.size,
        checkoutStarts: item.checkouts.size,
        completedPayments: item.payments.size,
        conversionRate: item.checkouts.size
          ? Number(
              ((item.payments.size / item.checkouts.size) * 100).toFixed(1),
            )
          : 0,
      }))
      .sort((a, b) => b.completedPayments - a.completedPayments);
  }

  async getRetention(days = 180) {
    const safeDays = Math.min(Math.max(Number(days) || 180, 30), 730);
    const since = new Date(Date.now() - safeDays * 86_400_000);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { enrolledAt: { gte: since }, deletedAt: null },
      select: {
        userId: true,
        status: true,
        enrolledAt: true,
        cohort: {
          select: {
            id: true,
            name: true,
            course: { select: { name: true } },
            syllabusModules: {
              select: { materials: { select: { id: true } } },
            },
          },
        },
      },
    });
    const userIds = [...new Set(enrollments.map((item) => item.userId))];
    const materialIds = [
      ...new Set(
        enrollments.flatMap((item) =>
          item.cohort.syllabusModules.flatMap((module) =>
            module.materials.map((material) => material.id),
          ),
        ),
      ),
    ];
    const progress =
      userIds.length && materialIds.length
        ? await this.prisma.materialProgress.findMany({
            where: { userId: { in: userIds }, materialId: { in: materialIds } },
            select: {
              userId: true,
              materialId: true,
              completedAt: true,
              updatedAt: true,
            },
          })
        : [];

    const rows = enrollments.map((enrollment) => {
      const total = enrollment.cohort.syllabusModules.reduce(
        (sum, module) => sum + module.materials.length,
        0,
      );
      const ids = new Set(
        enrollment.cohort.syllabusModules.flatMap((module) =>
          module.materials.map((material) => material.id),
        ),
      );
      const completed = progress.filter(
        (item) =>
          item.userId === enrollment.userId &&
          ids.has(item.materialId) &&
          item.completedAt,
      ).length;
      const progressPercent = total ? Math.round((completed / total) * 100) : 0;
      const ageDays = Math.floor(
        (Date.now() - enrollment.enrolledAt.getTime()) / 86_400_000,
      );
      return { ...enrollment, total, completed, progressPercent, ageDays };
    });
    const mature = rows.filter((row) => row.ageDays >= 7);
    const mature30 = rows.filter((row) => row.ageDays >= 30);
    const byCohort = new Map<string, typeof rows>();
    rows.forEach((row) =>
      byCohort.set(row.cohort.id, [
        ...(byCohort.get(row.cohort.id) || []),
        row,
      ]),
    );
    return {
      days: safeDays,
      summary: {
        enrolled: rows.length,
        active: rows.filter((row) => row.status === 'ACTIVE').length,
        completed: rows.filter((row) => row.status === 'COMPLETED').length,
        atRisk: rows.filter(
          (row) =>
            row.ageDays >= 14 &&
            row.progressPercent < 30 &&
            row.status === 'ACTIVE',
        ).length,
        retention7d: mature.length
          ? Number(
              (
                (mature.filter((row) => row.status !== 'DROPPED').length /
                  mature.length) *
                100
              ).toFixed(1),
            )
          : 0,
        retention30d: mature30.length
          ? Number(
              (
                (mature30.filter((row) => row.status !== 'DROPPED').length /
                  mature30.length) *
                100
              ).toFixed(1),
            )
          : 0,
      },
      cohorts: [...byCohort.entries()]
        .map(([cohortId, items]) => ({
          cohortId,
          cohortName: items[0].cohort.name,
          courseName: items[0].cohort.course.name,
          enrolled: items.length,
          averageProgress: Math.round(
            items.reduce((sum, item) => sum + item.progressPercent, 0) /
              items.length,
          ),
          atRisk: items.filter(
            (item) =>
              item.ageDays >= 14 &&
              item.progressPercent < 30 &&
              item.status === 'ACTIVE',
          ).length,
          completed: items.filter((item) => item.status === 'COMPLETED').length,
        }))
        .sort((a, b) => b.atRisk - a.atRisk),
    };
  }

  async getOperationalOverview(days = 30) {
    const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const since = new Date(Date.now() - safeDays * 86_400_000);
    const [
      users,
      newUsers,
      enrollments,
      completedEnrollments,
      pendingPayments,
      completedPayments,
      deliveries,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.user.count({
        where: { createdAt: { gte: since }, deletedAt: null },
      }),
      this.prisma.enrollment.count({
        where: { enrolledAt: { gte: since }, deletedAt: null },
      }),
      this.prisma.enrollment.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: since },
          deletedAt: null,
        },
      }),
      this.prisma.payment.count({
        where: { status: 'PENDING', createdAt: { gte: since } },
      }),
      totalReceivedPayments(this.prisma, { gte: since }),
      this.prisma.notificationDelivery.groupBy({
        by: ['channel', 'status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    return {
      days: safeDays,
      users,
      newUsers,
      enrollments,
      completedEnrollments,
      pendingPayments,
      revenue: completedPayments.toFixed(2),
      notificationDeliveries: deliveries.map((item) => ({
        channel: item.channel,
        status: item.status,
        count: item._count._all,
      })),
    };
  }
}
