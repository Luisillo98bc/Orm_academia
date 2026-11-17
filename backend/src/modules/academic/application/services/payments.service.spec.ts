import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { PaymentsService } from './payments.service';

describe('PaymentsService webhook verification', () => {
  it('separa los pagos pendientes del historial paginado', async () => {
    const payment = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const service = new PaymentsService(
      { payment } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.getAllPendingPayments(1, 20);
    expect(payment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
    await service.getAllPendingPayments(2, 20, true);
    expect(payment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { status: { in: ['COMPLETED', 'REJECTED'] } },
        skip: 20,
        take: 20,
      }),
    );
  });
  const originalKey = process.env.CULQI_SECRET_KEY;
  const originalPaymentsMode = process.env.PAYMENTS_MODE;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.CULQI_SECRET_KEY = originalKey;
    process.env.PAYMENTS_MODE = originalPaymentsMode;
  });

  it('rejects online methods while cash-only mode is active', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const service = new PaymentsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.checkout('student-id', 'cohort-id', 'TARJETA'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects webhook bodies without a valid Culqi event ID', async () => {
    process.env.CULQI_SECRET_KEY = 'sk_test_secure_key';
    process.env.PAYMENTS_MODE = 'online';
    const service = new PaymentsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.handleCulqiWebhook({ type: 'order' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not process a completed payment twice', async () => {
    process.env.CULQI_SECRET_KEY = 'sk_test_secure_key';
    process.env.PAYMENTS_MODE = 'online';
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        id: 'evt_test_123456',
        type: 'order.status.changed',
        data: {
          id: 'ord_test_123456',
          state: 'paid',
          metadata: {
            paymentId: 'payment-id',
            enrollmentId: 'enrollment-id',
          },
        },
      },
    });

    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-id',
          enrollmentId: 'enrollment-id',
          status: 'COMPLETED',
        }),
        update: jest.fn(),
      },
      enrollment: { update: jest.fn(), findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.handleCulqiWebhook({ id: 'evt_test_123456' }),
    ).resolves.toEqual({ received: true, duplicate: true });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });

  it('does not allow replacing a voucher after payment validation', async () => {
    const update = jest.fn();
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
        update,
      },
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      { markPayment: jest.fn() } as never,
    );

    await expect(
      service.uploadVoucher(
        'payment-id',
        'storage://local/vouchers/file.pdf',
        'student-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not allow creating a Culqi order for another user payment', async () => {
    process.env.PAYMENTS_MODE = 'online';
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          enrollment: { userId: 'owner-id' },
        }),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createCulqiOrder(
        'payment-id',
        'attacker-id',
        'attacker@example.com',
        'Attacker',
        'User',
        '',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    process.env.PAYMENTS_MODE = 'cash';
    const cashService = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      cashService.createCulqiOrder(
        'payment-id',
        'owner-id',
        'owner@example.com',
        'Owner',
        'User',
        '',
      ),
    ).rejects.toThrow('pagos en línea están deshabilitados');
  });

  it('does not allow charging another user payment with a Culqi token', async () => {
    process.env.PAYMENTS_MODE = 'online';
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          enrollment: { userId: 'owner-id' },
        }),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.processChargeWithToken(
        'payment-id',
        'token-id',
        'attacker@example.com',
        'attacker-id',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a free enrollment atomically and confirms it by email', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: 'cohort-id', maxStudents: 10 }]),
      enrollment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'enrollment-id', status: 'ACTIVE' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'student@example.com',
          firstName: 'Ana',
        }),
      },
    };
    const prisma = {
      enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const cohort = {
      hasCapacity: true,
      isOperational: true,
      endDate: new Date(Date.now() + 86_400_000),
      discountPercentage: 0,
      discountEndsAt: null,
      price: '0.00',
      courseName: 'Curso gratuito',
      name: 'Cohorte gratuita',
    };
    const mail = {
      sendEnrollmentConfirmation: jest.fn().mockResolvedValue(undefined),
    };
    const analytics = { attachPayment: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentsService(
      prisma as never,
      { findById: jest.fn().mockResolvedValue(cohort) } as never,
      mail as never,
      analytics as never,
      notifications as never,
    );

    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).resolves.toMatchObject({
      message: 'Matrícula exitosa gratuita',
      operationNumber: 'MAT-ENROLLME',
    });
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: { userId: 'student-id', cohortId: 'cohort-id', status: 'ACTIVE' },
    });
    expect(mail.sendEnrollmentConfirmation).toHaveBeenCalled();
    mail.sendEnrollmentConfirmation.mockRejectedValue(new Error('smtp down'));
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).resolves.toMatchObject({ message: 'Matrícula exitosa gratuita' });
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).rejects.toBeInstanceOf(NotFoundException);
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'cohort-id', maxStudents: 0 }]);
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a pending payment for a paid enrollment and notifies the student', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const createPayment = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({ id: 'payment-id', status: 'PENDING' });
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: 'cohort-id', maxStudents: 10 }]),
      enrollment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'enrollment-id',
          status: 'PENDING_PAYMENT',
        }),
      },
      payment: {
        create: createPayment,
      },
    };
    const prisma = {
      enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const cohort = {
      hasCapacity: true,
      isOperational: true,
      endDate: new Date(Date.now() + 86_400_000),
      discountPercentage: 0,
      discountEndsAt: null,
      price: '125.00',
      name: 'Cohorte pagada',
    };
    const analytics = { attachPayment: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentsService(
      prisma as never,
      { findById: jest.fn().mockResolvedValue(cohort) } as never,
      {} as never,
      analytics as never,
      notifications as never,
    );

    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO', 'session-1'),
    ).resolves.toMatchObject({
      message: 'Enrollment y pago creados. Proceda con el pago.',
      operationNumber: 'ORD-PAYMENT-',
    });
    const paymentCreateCall = createPayment.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(paymentCreateCall.data).toMatchObject({
      method: 'EFECTIVO',
      status: 'PENDING',
    });
    expect(analytics.attachPayment).toHaveBeenCalledWith(
      'session-1',
      'cohort-id',
      'payment-id',
    );
    expect(notifications.createNotification).toHaveBeenCalled();
  });

  it('recovers idempotent, pending and rejected checkouts', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const cohort = {
      hasCapacity: true,
      isOperational: true,
      endDate: new Date(Date.now() + 86_400_000),
      discountPercentage: 10,
      discountEndsAt: new Date(Date.now() + 86_400_000),
      price: '100.00',
      name: 'Cohort',
    };
    const attachPayment = jest.fn();
    const previous = {
      id: 'payment-1',
      enrollment: { userId: 'student-id' },
      status: 'PENDING',
    };
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValueOnce(previous),
        update: jest.fn().mockResolvedValue({ id: 'payment-2' }),
      },
      enrollment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enrollment-1',
          payment: { id: 'payment-2', status: 'PENDING' },
        }),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback({
          enrollment: {
            update: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
          },
          payment: { update: jest.fn().mockResolvedValue({ id: 'payment-3' }) },
        }),
      ),
    };
    const service = new PaymentsService(
      prisma as never,
      { findById: jest.fn().mockResolvedValue(cohort) } as never,
      {} as never,
      { attachPayment } as never,
    );
    await expect(
      service.checkout(
        'student-id',
        'cohort-id',
        'EFECTIVO',
        undefined,
        ' key ',
      ),
    ).resolves.toMatchObject({
      resumed: true,
      operationNumber: 'ORD-PAYMENT-',
    });
    prisma.payment.findUnique.mockResolvedValueOnce({
      id: 'payment-4',
      enrollment: { userId: 'other' },
    });
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO', undefined, 'key'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.payment.findUnique.mockResolvedValueOnce(null);
    prisma.enrollment.findUnique.mockResolvedValueOnce({
      id: 'enrollment-1',
      payment: { id: 'payment-2', status: 'REJECTED' },
    });
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO', 'session'),
    ).resolves.toMatchObject({ resumed: true });
    expect(attachPayment).toHaveBeenCalled();
  });

  it('creates Culqi orders and maps Culqi failures', async () => {
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = 'sk_test_secure_key';
    const payment = {
      id: 'payment-1',
      amount: '25.00',
      status: 'PENDING',
      enrollmentId: 'enrollment-1',
      enrollment: {
        userId: 'student-id',
        cohort: { name: 'Cohort', course: { name: 'Course' } },
      },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'order-1' } });
    await expect(
      service.createCulqiOrder(
        'payment-1',
        'student-id',
        's@example.com',
        'Ada',
        'Lovelace',
        '',
      ),
    ).resolves.toMatchObject({ orderId: 'order-1', amount: 2500 });
    jest.spyOn(axios, 'post').mockRejectedValue({
      response: { data: { user_message: 'Rejected by Culqi' } },
      isAxiosError: true,
    });
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    await expect(
      service.createCulqiOrder(
        'payment-1',
        'student-id',
        's@example.com',
        'Ada',
        'Lovelace',
        '9',
      ),
    ).rejects.toThrow('Rejected by Culqi');
    payment.status = 'COMPLETED';
    await expect(
      service.createCulqiOrder(
        'payment-1',
        'student-id',
        's@example.com',
        'Ada',
        'Lovelace',
        '',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('charges a token and activates the enrollment', async () => {
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = 'sk_test_secure_key';
    const payment = {
      id: 'payment-1',
      amount: '25.00',
      status: 'PENDING',
      enrollmentId: 'enrollment-1',
      enrollment: {
        userId: 'student-id',
        cohort: { name: 'Cohort', course: { name: 'Course' } },
      },
    };
    const tx = {
      payment: { update: jest.fn() },
      enrollment: { update: jest.fn() },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ email: 's@example.com', firstName: 'Ada' }),
      },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { id: 'charge-1', outcome: { type: 'authorized' } },
    });
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {
        sendPaymentApproved: jest.fn().mockResolvedValue(undefined),
        sendEnrollmentConfirmation: jest.fn().mockResolvedValue(undefined),
      } as never,
      { markPayment: jest.fn().mockResolvedValue(undefined) } as never,
    );
    await expect(
      service.processChargeWithToken(
        'payment-1',
        'tok-1',
        's@example.com',
        'student-id',
      ),
    ).resolves.toMatchObject({ chargeId: 'charge-1', status: 'COMPLETED' });
    expect(tx.payment.update).toHaveBeenCalled();
    expect(tx.enrollment.update).toHaveBeenCalled();
    jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('culqi down'));
    await expect(
      service.processChargeWithToken(
        'payment-1',
        'tok-1',
        's@example.com',
        'student-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { id: 'charge-2', outcome: { type: 'authorized' } },
    });
    const mail = service as unknown as {
      mailService: {
        sendPaymentApproved: jest.Mock;
        sendEnrollmentConfirmation: jest.Mock;
      };
    };
    mail.mailService.sendPaymentApproved.mockRejectedValue(new Error('mail'));
    mail.mailService.sendEnrollmentConfirmation.mockRejectedValue(
      new Error('mail'),
    );
    await expect(
      service.processChargeWithToken(
        'payment-1',
        'tok-1',
        's@example.com',
        'student-id',
      ),
    ).resolves.toMatchObject({ chargeId: 'charge-2' });
  });

  it('approves and rejects manual payments and paginates payment lists', async () => {
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          status: 'PENDING',
          enrollmentId: 'enrollment-1',
          amount: '10.00',
          enrollment: { userId: 'student-id' },
        }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'payment-1', status: 'COMPLETED' }),
      },
      enrollment: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          cohort: { name: 'Cohort', course: { name: 'Course' } },
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-id',
          email: 's@example.com',
          firstName: 'Ada',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
      payment: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'payment-2', status: 'PENDING' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'payment-2' }]),
        count: jest.fn().mockResolvedValue(1),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'payment-2', status: 'PENDING' }),
      },
    };
    const analytics = { markPayment: jest.fn() };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {
        sendPaymentApproved: jest.fn().mockResolvedValue(undefined),
        sendEnrollmentConfirmation: jest.fn().mockResolvedValue(undefined),
      } as never,
      analytics as never,
    );
    await expect(service.approvePayment('payment-1')).resolves.toEqual({
      id: 'payment-1',
      status: 'COMPLETED',
    });
    const approvalMail = service as unknown as {
      mailService: {
        sendPaymentApproved: jest.Mock;
        sendEnrollmentConfirmation: jest.Mock;
      };
    };
    approvalMail.mailService.sendPaymentApproved.mockRejectedValue(
      new Error('mail down'),
    );
    approvalMail.mailService.sendEnrollmentConfirmation.mockRejectedValue(
      new Error('mail down'),
    );
    tx.payment.findUnique.mockResolvedValue({
      id: 'payment-mail',
      status: 'PENDING',
      enrollmentId: 'enrollment-1',
      amount: '10.00',
      enrollment: { userId: 'student-id' },
    });
    await expect(service.approvePayment('payment-mail')).resolves.toBeDefined();
    tx.payment.findUnique.mockResolvedValueOnce(null);
    await expect(service.approvePayment('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    tx.payment.findUnique.mockResolvedValueOnce({
      id: 'payment-1',
      status: 'COMPLETED',
      enrollmentId: 'enrollment-1',
      enrollment: { userId: 'student-id' },
    });
    await expect(service.approvePayment('payment-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.uploadVoucher('payment-2', 'storage://voucher', 'student-id'),
    ).resolves.toEqual({
      id: 'payment-2',
      status: 'PENDING',
    });
    await expect(
      service.rejectPayment('payment-2', ' reason valid '),
    ).resolves.toEqual({
      id: 'payment-1',
      status: 'COMPLETED',
    });
    tx.payment.findUnique.mockResolvedValueOnce({
      id: 'payment-2',
      status: 'COMPLETED',
      enrollmentId: 'enrollment-1',
      enrollment: { userId: 'student-id' },
    });
    await expect(
      service.rejectPayment('payment-2', 'another valid reason'),
    ).rejects.toBeInstanceOf(BadRequestException);
    tx.payment.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.rejectPayment('missing', 'another valid reason'),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.payment.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.uploadVoucher('missing', 'storage://voucher', 'student-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getMyPayments('student-id', 2, 5),
    ).resolves.toMatchObject({ pagination: { total: 1 } });
    await expect(service.getAllPendingPayments(1, 5)).resolves.toMatchObject({
      pagination: { total: 1 },
    });
  });

  it('procesa un webhook Culqi completo y traduce errores de verificación', async () => {
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = 'sk_test_secure_key';
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        type: 'order.status.changed',
        data: {
          id: 'order-1',
          state: 'paid',
          amount: 2500,
          currency_code: 'PEN',
          metadata: {
            paymentId: 'payment-1',
            enrollmentId: 'enrollment-1',
            userId: 'user-1',
          },
        },
      },
    });
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          enrollmentId: 'enrollment-1',
          status: 'PENDING',
          amount: '25.00',
        }),
        update: jest.fn(),
      },
      enrollment: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          cohort: { name: 'Cohort', course: { name: 'Course' } },
        }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ email: 'user@test.com', firstName: 'Ada' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const mail = {
      sendPaymentApproved: jest.fn().mockResolvedValue(true),
      sendEnrollmentConfirmation: jest.fn().mockResolvedValue(true),
    };
    const analytics = { markPayment: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      mail as never,
      analytics as never,
    );
    await expect(
      service.handleCulqiWebhook({ id: 'evt_test_123' }),
    ).resolves.toEqual({ received: true });
    expect(tx.payment.update).toHaveBeenCalled();
    expect(mail.sendPaymentApproved).toHaveBeenCalled();
    expect(analytics.markPayment).toHaveBeenCalledWith(
      'payment-1',
      'PAYMENT_COMPLETED',
    );

    tx.payment.findUnique.mockResolvedValueOnce({
      id: 'payment-1',
      enrollmentId: 'enrollment-1',
      status: 'PENDING',
      amount: '30.00',
    });
    tx.payment.update.mockClear();
    await expect(
      service.handleCulqiWebhook({ id: 'evt_test_123' }),
    ).rejects.toThrow(
      'El importe de la orden no coincide con el pago registrado',
    );
    expect(tx.payment.update).not.toHaveBeenCalled();

    tx.payment.findUnique.mockResolvedValue(null);
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        type: 'order.status.changed',
        data: {
          id: 'order-invalid',
          state: 'paid',
          metadata: {
            paymentId: 'missing-payment',
            enrollmentId: 'enrollment-1',
          },
        },
      },
    });
    await expect(
      service.handleCulqiWebhook({ id: 'evt_test_invalid' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    jest.spyOn(axios, 'get').mockRejectedValue(new Error('culqi offline'));
    await expect(
      service.handleCulqiWebhook({ id: 'evt_test_456' }),
    ).rejects.toThrow();
  });

  it('rechaza Culqi sin configuración y valida estados terminales', async () => {
    process.env.PAYMENTS_MODE = 'online';
    process.env.CULQI_SECRET_KEY = '';
    const payment = {
      id: 'payment-1',
      status: 'COMPLETED',
      amount: '10.00',
      enrollmentId: 'enrollment-1',
      enrollment: { userId: 'student-id' },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.handleCulqiWebhook({ id: 'evt_test_123' }),
    ).rejects.toThrow();
    await expect(
      service.processChargeWithToken(
        'payment-1',
        'token',
        'user@test.com',
        'student-id',
      ),
    ).rejects.toThrow();
    payment.status = 'PENDING';
    await expect(
      service.createCulqiOrder(
        'payment-1',
        'student-id',
        'user@test.com',
        'Ada',
        'Lovelace',
        '',
      ),
    ).rejects.toThrow();
  });

  it('cubre validaciones de cupo, estado e idempotencia del checkout', async () => {
    process.env.PAYMENTS_MODE = 'cash';
    const cohort = {
      hasCapacity: false,
      isOperational: true,
      endDate: new Date(Date.now() + 86_400_000),
      discountPercentage: 0,
      discountEndsAt: null,
      price: '50.00',
      name: 'Cohort',
    };
    const repository = { findById: jest.fn().mockResolvedValue(cohort) };
    const prisma = {
      enrollment: { findUnique: jest.fn() },
      payment: { update: jest.fn().mockResolvedValue({ id: 'payment-1' }) },
    };
    const service = new PaymentsService(
      prisma as never,
      repository as never,
      {} as never,
      { attachPayment: jest.fn() } as never,
    );
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).rejects.toThrow();
    cohort.hasCapacity = true;
    cohort.isOperational = false;
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).rejects.toThrow();
    cohort.isOperational = true;
    cohort.endDate = new Date(Date.now() - 1_000);
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).rejects.toThrow();
    cohort.endDate = new Date(Date.now() + 86_400_000);
    prisma.enrollment.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).rejects.toThrow();
    prisma.enrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      payment: { id: 'payment-1', status: 'PENDING' },
    });
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).resolves.toMatchObject({ resumed: true });

    const notifications = {
      createNotification: jest.fn().mockRejectedValue(new Error('push down')),
    };
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: 'cohort-id', maxStudents: 10 }]),
      enrollment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'enrollment-2' }),
      },
      payment: { create: jest.fn().mockResolvedValue({ id: 'payment-2' }) },
    };
    const paidPrisma = {
      enrollment: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const paidService = new PaymentsService(
      paidPrisma as never,
      {
        findById: jest.fn().mockResolvedValue({ ...cohort, price: '50.00' }),
      } as never,
      {} as never,
      { attachPayment: jest.fn() } as never,
      notifications as never,
    );
    await expect(
      paidService.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).resolves.toMatchObject({
      operationNumber: 'ORD-PAYMENT-',
    });
    repository.findById.mockResolvedValue(null);
    await expect(
      service.checkout('student-id', 'cohort-id', 'EFECTIVO'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('habilita la siguiente mensualidad conservando el historial de cuotas aprobadas', async () => {
    const existingPayment = {
      id: 'payment-monthly-1',
      enrollmentId: 'enrollment-monthly-1',
      amount: '150.00',
      method: 'YAPE',
      status: 'COMPLETED',
      installmentNumber: 1,
      totalInstallments: 3,
      paidInstallments: 1,
      installmentHistory: null,
      voucherUrl: 'storage://local/vouchers/mes1.png',
      validatedAt: new Date('2026-11-01T10:00:00Z'),
      createdAt: new Date('2026-11-01T09:00:00Z'),
      enrollment: {
        id: 'enrollment-monthly-1',
        userId: 'student-id',
        cohort: {
          id: 'cohort-monthly-1',
          name: 'Promoción Mensual',
          installments: 3,
          course: { name: 'Desarrollo Web Fullstack' },
        },
      },
    };
    const tx = {
      enrollment: {
        update: jest
          .fn()
          .mockResolvedValue({ id: 'enrollment-monthly-1', status: 'ACTIVE' }),
      },
      payment: {
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              ...existingPayment,
              ...data,
            }),
          ),
      },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(existingPayment),
      },
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

    const next = await service.startNextInstallment(
      'payment-monthly-1',
      'student-id',
      'PLIN',
    );
    expect(next).toMatchObject({
      status: 'PENDING',
      method: 'PLIN',
      installmentNumber: 2,
      totalInstallments: 3,
      paidInstallments: 1,
      voucherUrl: null,
    });
    expect(Array.isArray(next.installmentHistory)).toBe(true);
    expect(next.installmentHistory).toHaveLength(1);
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-monthly-1' },
      data: { status: 'ACTIVE', reservationExpiresAt: null },
    });
  });
});
