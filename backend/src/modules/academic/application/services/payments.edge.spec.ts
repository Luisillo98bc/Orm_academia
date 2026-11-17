/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PaymentsService } from './payments.service';

describe('PaymentsService — validación y operaciones administrativas', () => {
  const originalMode = process.env.PAYMENTS_MODE;
  const originalKey = process.env.CULQI_SECRET_KEY;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.PAYMENTS_MODE = originalMode;
    process.env.CULQI_SECRET_KEY = originalKey;
  });

  it('aprueba pagos pendientes y activa la matrícula', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          status: 'PENDING',
          enrollmentId: 'enrollment-1',
          amount: '100.00',
          enrollment: { userId: 'student-1' },
        }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'payment-1', status: 'COMPLETED' }),
      },
      enrollment: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          cohort: { name: 'Cohorte', course: { name: 'Curso' } },
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-1',
          email: 'student@test.com',
          firstName: 'Ana',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const mail = {
      sendPaymentApproved: jest.fn().mockResolvedValue(undefined),
      sendEnrollmentConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    const analytics = { markPayment: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      mail as never,
      analytics as never,
      notifications as never,
    );

    await expect(service.approvePayment('payment-1')).resolves.toEqual({
      id: 'payment-1',
      status: 'COMPLETED',
    });
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: { status: 'ACTIVE' },
    });
    expect(notifications.createNotification).toHaveBeenCalled();
    expect(analytics.markPayment).toHaveBeenCalledWith(
      'payment-1',
      'PAYMENT_COMPLETED',
    );
  });

  it('rechaza pagos con motivo válido y valida entradas administrativas', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          status: 'PENDING',
          enrollmentId: 'enrollment-1',
          enrollment: { userId: 'student-1' },
        }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'payment-1', status: 'REJECTED' }),
      },
      enrollment: { update: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      notifications as never,
    );
    await expect(
      service.rejectPayment('payment-1', '  Datos no válidos  '),
    ).resolves.toEqual({ id: 'payment-1', status: 'REJECTED' });
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: { status: 'SUSPENDED' },
    });
    await expect(
      service.rejectPayment('payment-1', 'no'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lista mis pagos y pagos pendientes con paginación', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const prisma = {
      payment: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'payment-1', status: 'PENDING' }]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.getMyPayments('student-1', 2, 5)).resolves.toEqual({
      data: [
        { id: 'payment-1', status: 'PENDING', operationNumber: 'ORD-PAYMENT-' },
      ],
      pagination: { page: 2, limit: 5, total: 1, totalPages: 1 },
    });
    await expect(service.getAllPendingPayments(1, 10)).resolves.toEqual({
      data: [
        { id: 'payment-1', status: 'PENDING', operationNumber: 'ORD-PAYMENT-' },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it('crea una orden Culqi y procesa un cargo exitoso', async () => {
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = 'sk_test_valid';
    const payment = {
      id: 'payment-1',
      status: 'PENDING',
      amount: '125.50',
      enrollmentId: 'enrollment-1',
      enrollment: {
        userId: 'student-1',
        cohort: { name: 'Cohorte', course: { name: 'Curso' } },
      },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn(),
      },
      enrollment: { update: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ email: 'student@test.com', firstName: 'Ana' }),
      },
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback({
          payment: { update: jest.fn() },
          enrollment: { update: jest.fn() },
        }),
      ),
    };
    const mail = {
      sendPaymentApproved: jest.fn().mockResolvedValue(undefined),
      sendEnrollmentConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    const analytics = { markPayment: jest.fn().mockResolvedValue(undefined) };
    const post = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { id: 'order-1' } } as never);
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      mail as never,
      analytics as never,
    );
    await expect(
      service.createCulqiOrder(
        'payment-1',
        'student-1',
        'student@test.com',
        'Ana',
        'Prueba',
        '',
      ),
    ).resolves.toEqual(
      expect.objectContaining({ orderId: 'order-1', amount: 12550 }),
    );

    post.mockResolvedValue({
      data: { id: 'charge-1', outcome: { type: 'authorized' } },
    } as never);
    await expect(
      service.processChargeWithToken(
        'payment-1',
        'token-1',
        'student@test.com',
        'student-1',
      ),
    ).resolves.toEqual({
      message: '¡Pago procesado exitosamente!',
      chargeId: 'charge-1',
      status: 'COMPLETED',
    });
  });

  it('rechaza ordenar o pagar cuando no existe el pago', async () => {
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = 'sk_test_valid';
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.createCulqiOrder('missing', 'user', 'a@test.com', 'A', 'B', ''),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.processChargeWithToken('missing', 'token', 'a@test.com', 'user'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
