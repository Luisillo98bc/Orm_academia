import { Prisma } from '@prisma/client';

export type MonetaryValue = Prisma.Decimal | string | number;

export function toMoney(value: MonetaryValue): Prisma.Decimal {
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite()) throw new RangeError('El importe no es finito');
  return decimal;
}

export function moneyToString(value: MonetaryValue): string {
  return toMoney(value).toFixed(2);
}

export function moneyToMinorUnits(value: MonetaryValue): number {
  const minorUnits = toMoney(value).mul(100);
  if (!minorUnits.isInteger()) {
    throw new RangeError('El importe no puede tener más de dos decimales');
  }
  if (minorUnits.abs().greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('El importe excede el rango seguro');
  }
  return minorUnits.toNumber();
}
