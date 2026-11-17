import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { PaymentsService } from '../src/modules/academic/application/services/payments.service';

describe('Conciliación concurrente con PostgreSQL', () => {
  it('mantiene un único estado al competir un webhook y una conciliación', async () => {
    const db = new PrismaClient();
    const suffix = Date.now();
    const user = await db.user.create({
      data: {
        email: `race-${suffix}@example.invalid`,
        firstName: 'Prueba',
        lastName: 'Prueba',
        passwordHash: 'fixture',
      },
    });
    const course = await db.course.create({
      data: { code: `R${suffix}`, name: 'Prueba' },
    });
    const cohort = await db.cohort.create({
      data: {
        courseId: course.id,
        name: 'Prueba',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        price: 100,
      },
    });
    const enrollment = await db.enrollment.create({
      data: {
        userId: user.id,
        cohortId: cohort.id,
        status: 'PENDING_PAYMENT',
        reservationExpiresAt: new Date(Date.now() + 3600000),
      },
    });
    const payment = await db.payment.create({
      data: {
        enrollmentId: enrollment.id,
        amount: 100,
        method: 'TARJETA',
        status: 'PENDING',
        chargeAttemptKey: 'attempt',
      },
    });
    const oldMode = process.env.PAYMENTS_MODE;
    const oldKey = process.env.CULQI_SECRET_KEY;
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = 'sk_test_fixture';
    const service = new PaymentsService(
      db as never,
      {} as never,
      {} as never,
      { markPayment: jest.fn() } as never,
    );
    const charge = {
      id: 'charge-race',
      amount: 10000,
      currency_code: 'PEN',
      metadata: { paymentId: payment.id },
    };
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: [charge] } });
    jest.spyOn(service as never, 'verifyCulqiEvent').mockResolvedValue({
      type: 'charge.creation.succeeded',
      data: charge,
    } as never);
    try {
      const reconcile = (
        service as unknown as {
          reconcileCulqiPayment: (id: string) => Promise<unknown>;
        }
      ).reconcileCulqiPayment.bind(service);
      await Promise.allSettled([
        reconcile(payment.id),
        service.handleCulqiWebhook({ id: 'event-race' }),
      ]);
      expect(
        (await db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
          .status,
      ).toBe('COMPLETED');
      expect(
        (
          await db.enrollment.findUniqueOrThrow({
            where: { id: enrollment.id },
          })
        ).status,
      ).toBe('ACTIVE');
    } finally {
      jest.restoreAllMocks();
      if (oldMode === undefined) delete process.env.PAYMENTS_MODE;
      else process.env.PAYMENTS_MODE = oldMode;
      if (oldKey === undefined) delete process.env.CULQI_SECRET_KEY;
      else process.env.CULQI_SECRET_KEY = oldKey;
      await db.payment.delete({ where: { id: payment.id } });
      await db.enrollment.delete({ where: { id: enrollment.id } });
      await db.cohort.delete({ where: { id: cohort.id } });
      await db.course.delete({ where: { id: course.id } });
      await db.user.delete({ where: { id: user.id } });
      await db.$disconnect();
    }
  });
});
