export type StatTone = "accent" | "success" | "warning" | "danger";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
}

/**
 * 统计卡：左侧语义色轨道 + 标签在上、大号表格数字在下（数值原样渲染，
 * 不做格式化，保证与接口原始值一致）。
 */
export default function StatCard({ label, value, hint, tone = "accent" }: StatCardProps) {
  return (
    <div className={`stat-card ${tone !== "accent" ? `stat-card--${tone}` : ""}`.trim()}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
