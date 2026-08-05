import { moneyToMinorUnits, moneyToString, toMoney } from './money';

describe('money helpers', () => {
  it('preserva importes decimales exactos', () => {
    expect(toMoney('0.10').plus('0.20').toFixed(2)).toBe('0.30');
    expect(moneyToString('1250')).toBe('1250.00');
  });

  it('convierte a céntimos sin aritmética IEEE-754', () => {
    expect(moneyToMinorUnits('199.99')).toBe(19999);
    expect(() => moneyToMinorUnits('1.001')).toThrow('más de dos decimales');
  });
});
