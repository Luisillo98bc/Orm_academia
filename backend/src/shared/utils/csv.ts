/**
 * Escapa un campo de texto para CSV:
 * 1. Neutraliza fórmulas de hojas de cálculo (CSV Formula Injection: =, +, -, @).
 * 2. Duplica comillas dobles internas según RFC 4180.
 * 3. Envuelve el valor entre comillas dobles.
 */
export function escapeCsvText(value: unknown): string {
  const raw =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '';
  const sanitized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${sanitized.replaceAll('"', '""')}"`;
}

/**
 * Antepone el BOM UTF-8 (\uFEFF) al contenido CSV para que Excel en Windows
 * reconozca tildes y eñes correctamente sin necesidad de importar datos.
 */
export function withCsvBom(csvContent: string): string {
  return csvContent.startsWith('\uFEFF') ? csvContent : `\uFEFF${csvContent}`;
}
