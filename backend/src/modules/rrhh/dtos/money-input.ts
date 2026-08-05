import type { TransformFnParams } from 'class-transformer';

export function normalizeMoneyInput({ value }: TransformFnParams): unknown {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : value;
}
