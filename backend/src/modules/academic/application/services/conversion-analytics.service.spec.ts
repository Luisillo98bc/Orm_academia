import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConversionAnalyticsService } from './conversion-analytics.service';

describe('ConversionAnalyticsService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    conversionEvent: {
      create: jest.fn<
        Promise<unknown>,
        [{ data: { metadata: Record<string, unknown> } }]
      >(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    payment: { count: jest.fn(), aggregate: jest.fn() },
    cohort: { findMany: jest.fn() },
    enrollment: { findMany: jest.fn(), count: jest.fn() },
    materialProgress: { findMany: jest.fn() },
    user: { count: jest.fn() },
    notificationDelivery: { groupBy: jest.fn() },
  };

  let service: ConversionAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversionAnalyticsService(prisma as never);
  });

  it('valida y registra eventos con metadatos acotados', async () => {
    const metadata = Object.fromEntries(
      Array.from({ length: 25 }, (_, index) => [`key-${index}`, index]),
    );

    await expect(
      service.track({
        event: 'LANDING_VIEW',
        sessionId: 'session-1',
        path: 'x'.repeat(600),
        metadata,
      }),
    ).resolves.toEqual({ received: true });

    expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'LANDING_VIEW',
        sessionId: 'session-1',
        path: 'x'.repeat(500),
        metadata: expect.objectContaining({
          'key-19': 19,
        }) as jest.AsymmetricMatcher,
      }) as jest.AsymmetricMatcher,
    });
    expect(
      Object.keys(prisma.conversionEvent.create.mock.calls[0][0].data.metadata),
    ).toHaveLength(20);
  });

  it.each([
    [{ event: 'INVALID', sessionId: 'session-1' }],
    [{ event: 'LANDING_VIEW', sessionId: 'short' }],
    [{ event: 'LANDING_VIEW', sessionId: 'session-1', cohortId: 'bad-id' }],
  ])('rechaza datos inválidos: %o', async (input) => {
    await expect(service.track(input as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.conversionEvent.create).not.toHaveBeenCalled();
  });

  it('asocia un pago solo cuando existe sesión', async () => {
    await service.attachPayment(undefined, 'cohort-id');
    expect(prisma.conversionEvent.create).not.toHaveBeenCalled();

    await service.attachPayment(
      'session-1',
      '123e4567-e89b-12d3-a456-426614174000',
      'payment-1',
    );
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'CHECKOUT_CREATED',
          paymentId: 'payment-1',
        }) as jest.AsymmetricMatcher,
      }),
    );
    prisma.conversionEvent.findFirst.mockResolvedValue(null);
    await expect(
      service.markPayment('missing-payment', 'PAYMENT_COMPLETED'),
    ).resolves.toBeUndefined();
  });

  it('marca el pago a partir del checkout original', async () => {
    prisma.conversionEvent.findFirst.mockResolvedValue({
      sessionId: 'session-1',
      cohortId: '123e4567-e89b-12d3-a456-426614174000',
    });

    await service.markPayment('payment-1', 'PAYMENT_COMPLETED');

    expect(prisma.conversionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'PAYMENT_COMPLETED',
          sessionId: 'session-1',
          paymentId: 'payment-1',
        }) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('calcula el embudo, límites de días e ingresos completados', async () => {
    prisma.conversionEvent.findMany.mockImplementation(
      ({ where }: { where: { event: string } }) =>
        Promise.resolve(
          where.event === 'LANDING_VIEW' || where.event === 'CHECKOUT_STARTED'
            ? [{ sessionId: `${where.event}-1` }]
            : where.event === 'PAYMENT_COMPLETED'
              ? [{ sessionId: 'payment-session' }]
              : [],
        ),
    );
    prisma.conversionEvent.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    prisma.payment.count.mockResolvedValue(2);
    prisma.$queryRaw.mockResolvedValue([
      { amount: new Prisma.Decimal('245.50') },
    ]);

    await expect(service.getFunnel(999)).resolves.toEqual(
      expect.objectContaining({
        days: 365,
        landingToCheckoutRate: 100,
        checkoutConversionRate: 100,
        whatsappClicks: 3,
        failures: 1,
        pendingPayments: 2,
        completedRevenue: '245.50',
      }),
    );
  });

  it('agrupa conversiones por curso y calcula retención', async () => {
    prisma.conversionEvent.findMany.mockResolvedValue([
      { cohortId: null, event: 'PROGRAM_VIEW', sessionId: 'ignored' },
      {
        cohortId: 'missing-cohort',
        event: 'PROGRAM_VIEW',
        sessionId: 'ignored-2',
      },
      { cohortId: 'cohort-1', event: 'PROGRAM_VIEW', sessionId: 's-1' },
      { cohortId: 'cohort-1', event: 'CHECKOUT_STARTED', sessionId: 's-2' },
      { cohortId: 'cohort-1', event: 'PAYMENT_COMPLETED', sessionId: 's-2' },
      { cohortId: 'cohort-2', event: 'PROGRAM_VIEW', sessionId: 's-3' },
    ]);
    prisma.cohort.findMany.mockResolvedValue([
      { id: 'cohort-1', courseId: 'course-1', course: { name: 'Curso 1' } },
      { id: 'cohort-2', courseId: 'course-2', course: { name: 'Curso 2' } },
    ]);
    await expect(service.getConversionByProgram()).resolves.toEqual([
      expect.objectContaining({
        courseId: 'course-1',
        completedPayments: 1,
        conversionRate: 100,
      }),
      expect.objectContaining({
        courseId: 'course-2',
        programViews: 1,
        completedPayments: 0,
        conversionRate: 0,
      }),
    ]);

    const enrolledAt = new Date(Date.now() - 40 * 86_400_000);
    prisma.enrollment.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        status: 'ACTIVE',
        enrolledAt,
        cohort: {
          id: 'cohort-1',
          name: 'Cohorte 1',
          course: { name: 'Curso 1' },
          syllabusModules: [{ materials: [{ id: 'material-1' }] }],
        },
      },
      {
        userId: 'student-2',
        status: 'ACTIVE',
        enrolledAt,
        cohort: {
          id: 'cohort-2',
          name: 'Cohorte 2',
          course: { name: 'Curso 2' },
          syllabusModules: [{ materials: [{ id: 'material-2' }] }],
        },
      },
    ]);
    prisma.materialProgress.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        materialId: 'material-1',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await expect(service.getRetention(1)).resolves.toEqual(
      expect.objectContaining({
        days: 30,
        summary: expect.objectContaining({
          enrolled: 2,
          active: 2,
        }) as jest.AsymmetricMatcher,
        cohorts: expect.arrayContaining([
          expect.objectContaining({ averageProgress: 100 }),
        ]) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('devuelve el resumen operativo y normaliza el rango', async () => {
    prisma.user.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
    prisma.enrollment.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    prisma.payment.count.mockResolvedValue(3);
    prisma.$queryRaw.mockResolvedValue([
      { amount: new Prisma.Decimal('300.00') },
    ]);
    prisma.notificationDelivery.groupBy.mockResolvedValue([
      { channel: 'EMAIL', status: 'SENT', _count: { _all: 4 } },
    ]);

    await expect(service.getOperationalOverview(0)).resolves.toEqual({
      days: 30,
      users: 10,
      newUsers: 2,
      enrollments: 4,
      completedEnrollments: 1,
      pendingPayments: 3,
      revenue: '300.00',
      notificationDeliveries: [{ channel: 'EMAIL', status: 'SENT', count: 4 }],
    });
  });
});
