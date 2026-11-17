import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { firstValueFrom, of } from 'rxjs';
import { DecimalSerializationInterceptor } from './decimal-serialization.interceptor';

describe('DecimalSerializationInterceptor', () => {
  it('serializa decimales monetarios anidados como strings de dos decimales', async () => {
    const interceptor = new DecimalSerializationInterceptor();
    const next = {
      handle: () =>
        of({
          amount: new Prisma.Decimal('10.5'),
          payrolls: [{ totalAmount: new Prisma.Decimal('2000') }],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
    } as CallHandler;

    const result = await firstValueFrom(
      interceptor.intercept({} as ExecutionContext, next),
    );

    expect(result).toEqual({
      amount: '10.50',
      payrolls: [{ totalAmount: '2000.00' }],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  });
});
