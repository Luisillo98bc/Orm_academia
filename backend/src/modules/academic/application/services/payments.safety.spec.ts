import { ConflictException } from '@nestjs/common';
import axios from 'axios';
import { PaymentsService } from './payments.service';

describe('payment safety regressions', () => {
  const oldMode = process.env.PAYMENTS_MODE;
  const oldKey = process.env.CULQI_SECRET_KEY;
  beforeEach(() => {
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = 'sk_test_fixture';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (oldMode === undefined) delete process.env.PAYMENTS_MODE;
    else process.env.PAYMENTS_MODE = oldMode;
    if (oldKey === undefined) delete process.env.CULQI_SECRET_KEY;
    else process.env.CULQI_SECRET_KEY = oldKey;
  });
  const payment = () => ({
    id: 'payment-1',
    status: 'PENDING',
    amount: '100.00',
    createdAt: new Date(),
    enrollmentId: 'enrollment-1',
    enrollment: {
      userId: 'student-1',
      reservationExpiresAt: new Date(Date.now() + 86_400_000),
      cohort: { name: 'Cohorte', course: { name: 'Curso' } },
    },
  });

  it('registra un cargo conciliado tardío sin activar la matrícula', async () => {
    const stored = {
      ...payment(),
      chargeAttemptKey: 'attempt',
      enrollment: {
        ...payment().enrollment,
        reservationExpiresAt: new Date(Date.now() - 1000),
      },
    };
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(stored),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      enrollment: { update: jest.fn() },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(stored) },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        data: [
          {
            id: 'charge-1',
            amount: 10000,
            currency_code: 'PEN',
            metadata: { paymentId: 'payment-1' },
          },
        ],
      },
    });
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const reconcile = (
      service as unknown as {
        reconcileCulqiPayment: (id: string) => Promise<unknown>;
      }
    ).reconcileCulqiPayment.bind(service);
    await expect(reconcile('payment-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          culqiChargeId: 'charge-1',
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });

  it('no reactiva un pago rechazado al recibir un webhook de cargo', async () => {
    const prisma = {
      payment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ ...payment(), status: 'REJECTED' }),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service as never, 'verifyCulqiEvent').mockResolvedValue({
      type: 'charge.creation.succeeded',
      data: { id: 'charge-1', metadata: { paymentId: 'payment-1' } },
    } as never);
    await expect(
      service.handleCulqiWebhook({ id: 'event-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('never charges again when a stale attempt cannot be reconciled', async () => {
    const stored = {
      ...payment(),
      chargeAttemptKey: 'previous-attempt',
      chargeStartedAt: new Date(Date.now() - 3_600_000),
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(stored) },
      $transaction: jest.fn(),
    };
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: [] } });
    const post = jest.spyOn(axios, 'post');
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.processChargeWithToken(
        'payment-1',
        'new-token',
        's@example.com',
        'student-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(post).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([500, 502, 503, 504])(
    'keeps the charge attempt after an uncertain HTTP %i response',
    async (status) => {
      const tx = {
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const prisma = {
        payment: {
          findUnique: jest.fn().mockResolvedValue(payment()),
          update: jest.fn(),
        },
        $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
          callback(tx),
        ),
      };
      jest.spyOn(axios, 'post').mockRejectedValue({
        isAxiosError: true,
        response: { status, data: {} },
      });
      const service = new PaymentsService(
        prisma as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(
        service.processChargeWithToken(
          'payment-1',
          'token',
          's@example.com',
          'student-1',
        ),
      ).rejects.toThrow();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    },
  );

  it('does not let concurrent approval and rejection overwrite each other', async () => {
    let status = 'PENDING';
    let enrollmentStatus = 'PENDING_PAYMENT';
    const tx = {
      payment: {
        findUnique: jest
          .fn()
          .mockImplementation(() => Promise.resolve({ ...payment(), status })),
        update: jest
          .fn()
          .mockImplementation(
            ({
              where,
              data,
            }: {
              where: { status?: string };
              data: { status: string };
            }) => {
              if (where.status && where.status !== status)
                return Promise.reject(new Error('State changed'));
              status = data.status;
              return Promise.resolve({ ...payment(), status });
            },
          ),
      },
      enrollment: {
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: { status: string } }) => {
            enrollmentStatus = data.status;
            return Promise.resolve({});
          }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      { markPayment: jest.fn() } as never,
    );
    const results = await Promise.allSettled([
      service.approvePayment('payment-1'),
      service.rejectPayment('payment-1', 'Comprobante incorrecto'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(status).toBe('COMPLETED');
    expect(enrollmentStatus).toBe('ACTIVE');
  });

  it('sends confirmations only after commit and keeps a successful approval if analytics fails', async () => {
    let committed = false;
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment()),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'payment-1', status: 'COMPLETED' }),
      },
      enrollment: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(payment().enrollment),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-1',
          email: 's@example.com',
          firstName: 'Ana',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (value: typeof tx) => Promise<unknown>) => {
          const result = await callback(tx);
          committed = true;
          return result;
        },
      ),
    };
    const mail = {
      sendPaymentApproved: jest.fn().mockImplementation(() => {
        expect(committed).toBe(true);
        return Promise.resolve();
      }),
      sendEnrollmentConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    const analytics = {
      markPayment: jest.fn().mockRejectedValue(new Error('analytics down')),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      mail as never,
      analytics as never,
    );
    await expect(service.approvePayment('payment-1')).resolves.toMatchObject({
      status: 'COMPLETED',
    });
    expect(mail.sendPaymentApproved).toHaveBeenCalledTimes(1);
  });
});
