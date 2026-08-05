function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function spreadsheetCell(value: unknown) {
  const type =
    typeof value === 'number'
      ? 'Number'
      : typeof value === 'boolean'
        ? 'Boolean'
        : 'String';
  const normalized = typeof value === 'boolean' ? Number(value) : value;
  return `<Cell><Data ss:Type="${type}">${escapeXml(normalized)}</Data></Cell>`;
}

function safeCsvValue(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Exporta datos a un archivo SpreadsheetML compatible con Excel. */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string = 'exportacion',
  sheetName: string = 'Datos',
) {
  if (!data?.length) {
    console.warn('No hay datos para exportar a Excel');
    return;
  }

  const headers = Object.keys(data[0]);
  const headerRow = `<Row>${headers.map(spreadsheetCell).join('')}</Row>`;
  const dataRows = data
    .map(
      (row) =>
        `<Row>${headers.map((header) => spreadsheetCell(row[header])).join('')}</Row>`,
    )
    .join('');
  const safeSheetName = escapeXml(sheetName.slice(0, 31));
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${safeSheetName}"><Table>${headerRow}${dataRows}</Table></Worksheet>
</Workbook>`;

  downloadBlob(
    new Blob(['\uFEFF', workbook], {
      type: 'application/vnd.ms-excel;charset=utf-8',
    }),
    `${filename}_${new Date().toISOString().slice(0, 10)}.xls`,
  );
}

/** Exporta datos a CSV UTF-8 y neutraliza fórmulas peligrosas. */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string = 'exportacion',
) {
  if (!data?.length) {
    console.warn('No hay datos para exportar a CSV');
    return;
  }

  const headers = Object.keys(data[0]);
  const csv = [
    headers.map(safeCsvValue).join(','),
    ...data.map((row) =>
      headers.map((header) => safeCsvValue(row[header])).join(','),
    ),
  ].join('\r\n');

  downloadBlob(
    new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
    `${filename}_${new Date().toISOString().slice(0, 10)}.csv`,
  );
}
