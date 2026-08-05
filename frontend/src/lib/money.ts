export type Money = string;

export function moneyToNumber(value: Money | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: Money | number | null | undefined): string {
  return moneyToNumber(value).toFixed(2);
}

export function moneyToMinorUnits(value: Money | number): number {
  const normalized = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error("El importe debe tener máximo dos decimales");

  const units = Number(match[1]);
  const decimals = (match[2] ?? "").padEnd(2, "0");
  const result = units * 100 + Number(decimals);
  if (!Number.isSafeInteger(result)) throw new Error("El importe excede el rango seguro");
  return result;
}
