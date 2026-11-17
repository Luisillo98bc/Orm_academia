import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from '../src/modules/academic/application/services/payments.service';
import { ReportsService } from '../src/modules/academic/application/services/reports.service';
import { TwoFactorService } from '../src/modules/auth/infrastructure/two-factor.service';
import { StorageService } from '../src/shared/infrastructure/storage/storage.service';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Monthly receipts and 2FA with PostgreSQL', () => {
  const db = new PrismaClient();
  let userId: string;
  let cohortId: string;
  let courseId: string;
  let enrollmentId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    const user = await db.user.create({
      data: {
        email: `receipts-${suffix}@example.invalid`,
        firstName: 'Receipt',
        lastName: 'Fixture',
        passwordHash: 'fixture',
      },
    });
    userId = user.id;
    courseId = (
      await db.course.create({
        data: { code: `RC${suffix}`, name: 'Receipts fixture' },
      })
    ).id;
    cohortId = (
      await db.cohort.create({
        data: {
          courseId,
          name: 'Monthly fixture',
          price: 150,
          installments: 2,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        },
      })
    ).id;
    enrollmentId = (
      await db.enrollment.create({
        data: { cohortId, userId, status: 'ACTIVE' },
      })
    ).id;
  });

  afterAll(async () => {
    await db.enrollment.deleteMany({ where: { id: enrollmentId } });
    await db.cohort.deleteMany({ where: { id: cohortId } });
    await db.course.deleteMany({ where: { id: courseId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it('retains previous revenue, counts each installment once and stops at the agreed total', async () => {
    const reports = new ReportsService(db as never);
    const before = new Prisma.Decimal(
      (await reports.getSummary()).totalRevenue,
    );
    const payment = await db.payment.create({
      data: {
        enrollmentId,
        amount: 150,
        method: 'YAPE',
        status: 'COMPLETED',
        installmentNumber: 1,
        paidInstallments: 1,
        totalInstallments: 2,
        validatedAt: new Date('2026-08-15T12:00:00Z'),
        installmentHistory: [
          {
            installmentNumber: 1,
            amount: '150.00',
            method: 'YAPE',
            status: 'COMPLETED',
            validatedAt: '2026-08-15T12:00:00Z',
            voucherUrl: 'storage://local/vouchers/first.pdf',
          },
        ],
      },
    });
    const payments = new PaymentsService(
      db as never,
      {} as never,
      {
        sendPaymentApproved: jest.fn().mockResolvedValue(true),
        sendEnrollmentConfirmation: jest.fn().mockResolvedValue(true),
      } as never,
      { markPayment: jest.fn().mockResolvedValue(undefined) } as never,
    );
    await db.cohort.update({
      where: { id: cohortId },
      data: { installments: 12 },
    });
    const next = await payments.startNextInstallment(
      payment.id,
      userId,
      'PLIN',
    );
    expect(next.totalInstallments).toBe(2);
    expect((await reports.getSummary()).totalRevenue).toBe(
      before.add(150).toFixed(2),
    );
    const storage = new StorageService(
      new ConfigService({
        STORAGE_PROVIDER: 'local',
        PRIVATE_STORAGE_DIR: '/scratch/private',
      }),
      db as never,
    );
    await expect(
      storage.assertReferenceAccess('storage://local/vouchers/first.pdf', {
        id: userId,
        roles: ['ESTUDIANTE'],
      }),
    ).resolves.toBeUndefined();
    await expect(
      storage.assertReferenceAccess('storage://local/vouchers/first.pdf', {
        id: 'other-student',
        roles: ['ESTUDIANTE'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await payments.approvePayment(payment.id);
    expect((await reports.getSummary()).totalRevenue).toBe(
      before.add(300).toFixed(2),
    );
    const rows = await db.$queryRaw<
      { amount: Prisma.Decimal }[]
    >`SELECT amount FROM payment_receipts WHERE payment_id = ${payment.id}::uuid`;
    expect(rows).toHaveLength(2);
    expect(
      rows
        .reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0))
        .toFixed(2),
    ).toBe('300.00');
    expect(
      (await reports.getSummary('2026-08-15', '2026-08-15')).totalRevenue,
    ).toBe('150.00');
    expect(await reports.exportPaymentsCsv()).toContain('Receipt Fixture');
    await expect(
      payments.startNextInstallment(payment.id, userId, 'PLIN'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
    ).toBe('COMPLETED');
  });

  it('preserves a legacy single payment when applying the corrective migration', async () => {
    const cohort = await db.cohort.create({
      data: {
        courseId,
        name: 'Legacy paid course',
        price: 300,
        installments: 3,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-04-01'),
      },
    });
    try {
      const enrollment = await db.enrollment.create({
        data: { cohortId: cohort.id, userId, status: 'ACTIVE' },
      });
      const payment = await db.payment.create({
        data: {
          enrollmentId: enrollment.id,
          amount: 300,
          method: 'EFECTIVO',
          status: 'COMPLETED',
          totalInstallments: 3,
          paidInstallments: 1,
          createdAt: new Date('2026-01-01'),
        },
      });
      const sql = readFileSync(
        resolve(
          __dirname,
          '../../database/prisma/migrations/20261116220000_preserve_payment_receipts/migration.sql',
        ),
        'utf8',
      );
      const statement = sql.match(/UPDATE payments p[\s\S]*?;/)?.[0];
      if (!statement)
        throw new Error('Corrective migration statement is missing');
      await db.$executeRawUnsafe(statement);
      expect(
        await db.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).toMatchObject({
        totalInstallments: 1,
        paidInstallments: 1,
        status: 'COMPLETED',
        nextDueDate: null,
      });
    } finally {
      await db.enrollment.deleteMany({ where: { cohortId: cohort.id } });
      await db.cohort.delete({ where: { id: cohort.id } });
    }
  });

  it('stores the encrypted factor without truncation and never resets an active factor', async () => {
    const twoFactor = new TwoFactorService(
      db as never,
      new ConfigService({
        NODE_ENV: 'production',
        TWO_FACTOR_ENCRYPTION_KEY: 'fixture-2fa-key-at-least-32-characters',
      }),
    );
    await twoFactor.setup(userId, 'admin@example.invalid');
    const saved = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(saved.twoFactorSecret?.length).toBeGreaterThan(64);
    const verify = jest
      .spyOn(twoFactor, 'verifyStoredCode')
      .mockReturnValue(true);
    await twoFactor.enable(userId, '123456');
    verify.mockRestore();
    await expect(
      twoFactor.setup(userId, 'admin@example.invalid'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: userId } }))
        .twoFactorEnabled,
    ).toBe(true);
  });
});
