interface Column {
  key: string;
  header: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  emptyMessage?: string;
}

export default function DataTable({ columns, data, emptyMessage = 'Aucune donnée' }: DataTableProps) {
  return (
    <table className="w-full border-collapse text-sm mt-4">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr><td colSpan={columns.length} className="p-6 text-center text-gray-text">{emptyMessage}</td></tr>
        ) : (
          data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-light transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="p-3 border-b border-gray-border">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
