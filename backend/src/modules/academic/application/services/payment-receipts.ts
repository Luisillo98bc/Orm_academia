import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

export type ReceiptDateRange = { gte?: Date; lte?: Date };

export function receiptDateFilter(range?: ReceiptDateRange) {
  return Prisma.sql`WHERE 1=1
    ${range?.gte ? Prisma.sql`AND r.paid_at >= ${range.gte}` : Prisma.empty}
    ${range?.lte ? Prisma.sql`AND r.paid_at <= ${range.lte}` : Prisma.empty}`;
}

export async function totalReceivedPayments(
  prisma: PrismaService,
  range?: ReceiptDateRange,
) {
  const rows = await prisma.$queryRaw<{ amount: Prisma.Decimal }[]>(Prisma.sql`
    SELECT COALESCE(SUM(r.amount), 0) AS amount FROM payment_receipts r
    ${receiptDateFilter(range)}
  `);
  return rows[0].amount;
}

export function monthlyReceivedPayments(
  prisma: PrismaService,
  range: ReceiptDateRange,
) {
  return prisma.$queryRaw<
    { month: string; total: Prisma.Decimal }[]
  >(Prisma.sql`
    SELECT to_char(r.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima', 'YYYY-MM') AS month,
           SUM(r.amount) AS total
    FROM payment_receipts r ${receiptDateFilter(range)}
    GROUP BY 1 ORDER BY 1
  `);
}
