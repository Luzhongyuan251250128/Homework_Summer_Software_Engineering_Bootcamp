import type { ReactNode } from "react";
import Icon from "./Icon";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/** 空态：图标 + 标题 + 可选描述与引导操作。 */
export default function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        {icon ?? <Icon name="inbox" size={22} />}
      </div>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
