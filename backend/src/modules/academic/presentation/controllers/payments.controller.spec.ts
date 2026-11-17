import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import type { PaymentsService } from '../../application/services/payments.service';
import type { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import type { AuditService } from '../../../audit/audit.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let payments: Record<string, jest.Mock>;
  let storage: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  const user = {
    id: 'student-1',
    email: 'student@example.com',
    roles: ['ESTUDIANTE'],
    permissions: [],
  };

  beforeEach(() => {
    payments = {
      checkout: jest.fn().mockResolvedValue({ id: 'payment-1' }),
      createCulqiOrder: jest.fn().mockResolvedValue({ id: 'order-1' }),
      processChargeWithToken: jest
        .fn()
        .mockResolvedValue({ status: 'COMPLETED' }),
      uploadVoucher: jest.fn().mockResolvedValue({ id: 'payment-1' }),
      assertVoucherUploadAllowed: jest
        .fn()
        .mockResolvedValue({ voucherUrl: null }),
      approvePayment: jest
        .fn()
        .mockResolvedValue({ id: 'payment-1', status: 'COMPLETED' }),
      rejectPayment: jest.fn().mockResolvedValue({
        id: 'payment-1',
        status: 'REJECTED',
        rejectionReason: 'bad',
      }),
      getMyPayments: jest.fn().mockResolvedValue([]),
      getAllPendingPayments: jest.fn().mockResolvedValue([]),
      handleCulqiWebhook: jest.fn().mockResolvedValue({ received: true }),
    };
    storage = {
      uploadFile: jest.fn().mockResolvedValue('https://cdn/voucher.pdf'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    controller = new PaymentsController(
      payments as unknown as PaymentsService,
      storage as unknown as StorageService,
      audit as unknown as AuditService,
    );
    delete process.env.PAYMENTS_MODE;
  });

  afterEach(() => {
    delete process.env.PAYMENTS_MODE;
  });

  it('accepts cash checkout in offline mode and rejects online methods', async () => {
    await controller.checkout(user, {
      cohortId: 'cohort-1',
      method: 'EFECTIVO',
      analyticsSessionId: 'analytics-1',
      idempotencyKey: 'idem-1',
    });
    expect(payments.checkout).toHaveBeenCalledWith(
      'student-1',
      'cohort-1',
      'EFECTIVO',
      'analytics-1',
      'idem-1',
    );

    await expect(
      controller.checkout(user, {
        cohortId: 'cohort-1',
        method: 'TARJETA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts online checkout and validates Culqi inputs', async () => {
    process.env.PAYMENTS_MODE = 'ONLINE';
    await controller.checkout(user, {
      cohortId: 'cohort-1',
      method: 'YAPE',
    });
    await controller.createOrder(user, {
      paymentId: 'payment-1',
      phone: '999',
    });
    await controller.processCharge(user, {
      paymentId: 'payment-1',
      tokenId: 'token-1',
    });

    expect(payments.checkout).toHaveBeenCalledWith(
      'student-1',
      'cohort-1',
      'YAPE',
      undefined,
      undefined,
    );
    expect(payments.createCulqiOrder).toHaveBeenCalledWith(
      'payment-1',
      'student-1',
      'student@example.com',
      'Estudiante',
      '',
      '999',
    );
    await expect(
      controller.createOrder(user, { paymentId: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.processCharge(user, { paymentId: '', tokenId: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uploads vouchers and validates the file', async () => {
    await controller.uploadVoucher(
      'payment-1',
      { originalname: 'voucher.pdf' } as Express.Multer.File,
      user,
    );
    expect(storage.uploadFile).toHaveBeenCalledWith(
      expect.anything(),
      'vouchers',
    );
    expect(payments.uploadVoucher).toHaveBeenCalledWith(
      'payment-1',
      'https://cdn/voucher.pdf',
      'student-1',
    );
    await expect(
      controller.uploadVoucher('payment-1', undefined as never, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not store files when the payment cannot accept a voucher', async () => {
    payments.assertVoucherUploadAllowed.mockRejectedValue(
      new BadRequestException('Pago no disponible'),
    );
    await expect(
      controller.uploadVoucher('payment-1', {} as Express.Multer.File, user),
    ).rejects.toThrow();
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('removes a new file if the payment changes during the upload', async () => {
    payments.uploadVoucher.mockRejectedValue(new Error('Concurrent approval'));
    await expect(
      controller.uploadVoucher('payment-1', {} as Express.Multer.File, user),
    ).rejects.toThrow('Concurrent approval');
    expect(storage.deleteFile).toHaveBeenCalledWith('https://cdn/voucher.pdf');
  });

  it('removes only the replaced pending voucher after saving its replacement', async () => {
    payments.assertVoucherUploadAllowed.mockResolvedValue({
      voucherUrl: 'storage://local/vouchers/previous.pdf',
    });
    await controller.uploadVoucher(
      'payment-1',
      {} as Express.Multer.File,
      user,
    );
    expect(storage.deleteFile).toHaveBeenCalledWith(
      'storage://local/vouchers/previous.pdf',
    );
  });

  it('approves/rejects payments and records audit entries', async () => {
    const request = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    } as never;
    await controller.approvePayment('payment-1', user, request);
    await controller.rejectPayment(
      'payment-1',
      { reason: 'bad' },
      user,
      request,
    );

    expect(audit.log).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: 'student-1', ipAddress: '127.0.0.1' }),
      'APPROVE_PAYMENT',
      'Payment',
      'payment-1',
      undefined,
      expect.anything(),
    );
    expect(audit.log).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'REJECT_PAYMENT',
      'Payment',
      'payment-1',
      undefined,
      { status: 'REJECTED', reason: 'bad' },
    );
  });

  it('delegates student, admin and webhook endpoints', async () => {
    await controller.getMyPayments(user, { page: 2, limit: 10 });
    await controller.getAllPendingPayments({ page: 1, limit: 20 });
    await controller.culqiWebhook({ event: 'charge.succeeded' });

    expect(payments.getMyPayments).toHaveBeenCalledWith('student-1', 2, 10);
    expect(payments.getAllPendingPayments).toHaveBeenCalledWith(1, 20);
    expect(payments.handleCulqiWebhook).toHaveBeenCalledWith({
      event: 'charge.succeeded',
    });
  });
});
