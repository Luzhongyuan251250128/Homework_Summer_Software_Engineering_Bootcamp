import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  muted?: boolean;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
  /** 可选的「操作」尾列（如删除/恢复按钮），整列右对齐。 */
  renderRowAction?: (row: T) => ReactNode;
}

/**
 * 数据密集表格：列定义驱动渲染；数字单元格自动右对齐 + 表格数字对齐；
 * mono 单元格（仓库路径/版本号/日期）使用等宽字体；可选操作尾列。
 */
export default function Table<T>({ columns, rows, rowKey, empty, renderRowAction }: TableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === "right" ? "num" : ""}>
                {c.header}
              </th>
            ))}
            {renderRowAction && <th className="num">操作</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => {
                const cell = c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "");
                const numeric =
                  typeof cell === "number" ||
                  (typeof cell === "string" && cell.trim() !== "" && !Number.isNaN(Number(cell)));
                const classes = [
                  c.align === "right" ? "num" : "",
                  c.mono ? "mono" : "",
                  c.muted ? "muted" : "",
                  numeric && c.align === undefined ? "num" : "",
                  c.className ?? "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <td key={c.key} className={classes}>
                    {cell}
                  </td>
                );
              })}
              {renderRowAction && (
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  {renderRowAction(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
