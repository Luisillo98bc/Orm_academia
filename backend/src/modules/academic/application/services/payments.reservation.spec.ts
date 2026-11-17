import { BadRequestException, ConflictException } from '@nestjs/common';
import axios from 'axios';
import { PaymentsService } from './payments.service';

const futureReservation = () => new Date(Date.now() + 48 * 60 * 60 * 1000);

describe('PaymentsService reservation and charge guards', () => {
  const originalMode = process.env.PAYMENTS_MODE;

  afterEach(() => {
    process.env.PAYMENTS_MODE = originalMode;
    jest.restoreAllMocks();
  });

  it('creates a paid checkout with a 48-hour reservation', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: 'cohort-1', maxStudents: 2 }]),
      enrollment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn<Promise<unknown>, [{ data: { reservationExpiresAt: Date } }]>()
          .mockResolvedValue({
            id: 'enrollment-1',
            status: 'PENDING_PAYMENT',
          }),
      },
      payment: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'payment-1', status: 'PENDING' }),
      },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
      enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new PaymentsService(
      prisma as never,
      {
        findById: jest.fn().mockResolvedValue({
          hasCapacity: true,
          isOperational: true,
          endDate: new Date(Date.now() + 86_400_000),
          discountPercentage: 0,
          discountEndsAt: null,
          price: '100.00',
          name: 'Cohorte',
        }),
      } as never,
      {} as never,
      { attachPayment: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await service.checkout('student-1', 'cohort-1', 'EFECTIVO');
    const data = tx.enrollment.create.mock.calls[0][0].data;
    expect(data.reservationExpiresAt).toBeInstanceOf(Date);
    expect(data.reservationExpiresAt.getTime()).toBeGreaterThan(
      Date.now() + 47 * 60 * 60 * 1000,
    );
    expect(data.reservationExpiresAt.getTime()).toBeLessThan(
      Date.now() + 49 * 60 * 60 * 1000,
    );
  });

  it('does not approve a payment after its reservation expires', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          status: 'PENDING',
          enrollmentId: 'enrollment-1',
          enrollment: {
            userId: 'student-1',
            reservationExpiresAt: new Date(Date.now() - 1),
          },
        }),
        update: jest.fn(),
      },
      enrollment: { update: jest.fn() },
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
      {} as never,
    );

    await expect(service.approvePayment('payment-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.payment.update).not.toHaveBeenCalled();
  });

  it('does not call Culqi when another request owns the charge attempt', async () => {
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = 'sk_test_secure_key';
    const payment = {
      id: 'payment-1',
      status: 'PENDING',
      amount: '100.00',
      enrollmentId: 'enrollment-1',
      enrollment: {
        userId: 'student-1',
        reservationExpiresAt: futureReservation(),
        cohort: { name: 'Cohorte', course: { name: 'Curso' } },
      },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      $transaction: jest.fn((callback: (value: unknown) => unknown) =>
        callback({
          payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        }),
      ),
    };
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
        'token-1',
        's@test.com',
        'student-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(post).not.toHaveBeenCalled();
  });
});
