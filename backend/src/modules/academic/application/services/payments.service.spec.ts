import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { PaymentsService } from './payments.service';

describe('PaymentsService webhook verification', () => {
  const originalKey = process.env.CULQI_SECRET_KEY;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.CULQI_SECRET_KEY = originalKey;
  });

  it('rejects webhook bodies without a valid Culqi event ID', async () => {
    process.env.CULQI_SECRET_KEY = 'sk_test_secure_key';
    const service = new PaymentsService({} as never, {} as never, {} as never);

    await expect(
      service.handleCulqiWebhook({ type: 'order' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not process a completed payment twice', async () => {
    process.env.CULQI_SECRET_KEY = 'sk_test_secure_key';
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
    );

    await expect(
      service.handleCulqiWebhook({ id: 'evt_test_123456' }),
    ).resolves.toEqual({ received: true, duplicate: true });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });
});
