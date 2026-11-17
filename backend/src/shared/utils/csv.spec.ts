import { escapeCsvText, withCsvBom } from './csv';

describe('csv utils', () => {
  it('escapa comillas dobles internas y envuelve en comillas', () => {
    expect(escapeCsvText('Curso "Avanzado"')).toBe('"Curso ""Avanzado"""');
    expect(escapeCsvText(null)).toBe('""');
    expect(escapeCsvText(undefined)).toBe('""');
  });

  it('neutraliza fórmulas peligrosas (CSV injection)', () => {
    expect(escapeCsvText("=CMD|' /C calc'!A0")).toBe("\"'=CMD|' /C calc'!A0\"");
    expect(escapeCsvText('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(escapeCsvText('-10+20')).toBe('"\'-10+20"');
    expect(escapeCsvText('@IMPORTXML()')).toBe('"\'@IMPORTXML()"');
  });

  it('antepone BOM UTF-8 sin duplicarlo', () => {
    const csv = withCsvBom('Nombre,Apellido\n"Ana","Pérez"');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(withCsvBom(csv)).toBe(csv);
  });
});
