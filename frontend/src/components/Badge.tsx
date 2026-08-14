import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}

/** 通用徽章：语义色软底 + 深色文字（对比度达标），可选状态圆点。 */
export default function Badge({ tone = "neutral", dot = false, children }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * 风险等级徽章：high → 高（danger）/ medium → 中（warning）/ low → 低（success）。
 * 未知等级按 neutral 展示原值，避免信息丢失。
 */
export function RiskBadge({ level }: { level: string }) {
  const key = String(level).toLowerCase();
  if (key === "high" || key === "high-risk") {
    return <Badge tone="danger" dot>高风险</Badge>;
  }
  if (key === "medium" || key === "mid" || key === "medium-risk") {
    return <Badge tone="warning" dot>中风险</Badge>;
  }
  if (key === "low" || key === "low-risk") {
    return <Badge tone="success" dot>低风险</Badge>;
  }
  return <Badge tone="neutral">{level}</Badge>;
}
