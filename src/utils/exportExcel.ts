import * as XLSX from 'xlsx';

interface ExportColumn {
  header: string;
  key: string;
  transform?: (value: unknown) => string | number;
}

export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  fileName: string
) {
  const rows = data.map((row) =>
    columns.reduce((acc, col) => {
      const val = row[col.key];
      acc[col.header] = col.transform ? col.transform(val) : (val ?? '');
      return acc;
    }, {} as Record<string, unknown>)
  );

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths = columns.map((col) => ({
    wch: Math.max(
      col.header.length,
      ...rows.map((r) => String(r[col.header] ?? '').length)
    ) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
