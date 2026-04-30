import { cn } from "@/lib/cn";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
  /** Mobile card primary line */
  mobileLabel?: string;
};

export function DataTable<T extends object>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No data yet.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 shadow-card">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-card md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/90">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 font-semibold text-gray-700",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-gray-50 transition-colors last:border-0 hover:bg-brand-green-soft/40"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3 text-gray-800", col.className)}
                  >
                    {col.render
                      ? col.render(row)
                      : String(
                          (row as Record<string, unknown>)[col.key] ?? "—",
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-card"
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex justify-between gap-3 border-b border-gray-100 py-2 last:border-0 last:pb-0 first:pt-0"
              >
                <span className="text-xs font-medium text-gray-500">
                  {col.mobileLabel ?? col.header}
                </span>
                <span className="text-right text-sm text-gray-900">
                  {col.render
                    ? col.render(row)
                    : String(
                        (row as Record<string, unknown>)[col.key] ?? "—",
                      )}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}
