
import ExcelJS from 'exceljs';

export async function loadWorkbookFromBuffer(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

export function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  for (let i = 0; i < 10; i++) {
    const row = sheet.getRow(i + 1);
    const values = row.values as any[];
    if (values.includes('Артикул') && values.includes('Код цвета')) {
      return i + 1;
    }
  }
  throw new Error('Заголовок не найден');
}

export function getHeaderColumnMap(headerRow: ExcelJS.Row): Record<string, number> {
  const map: Record<string, number> = {};
  (headerRow.values as string[]).forEach((v, i) => {
    if (typeof v === 'string') map[v.trim()] = i;
  });
  return map;
}

export function getSizeHeaders(sheet: ExcelJS.Worksheet, headerRowIndex: number, startCol: number): string[] {
  const sizeRow = sheet.getRow(headerRowIndex - 1);
    // @ts-expect-error
  return sizeRow.values.slice(startCol) as string[];
}