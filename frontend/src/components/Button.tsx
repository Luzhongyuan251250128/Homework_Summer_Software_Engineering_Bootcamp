import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

/**
 * 设计系统按钮。
 * primary：主要操作（青瓷实底）；secondary：常规操作（描边）；
 * danger：破坏性操作（浅红底 + 红字）；ghost：弱操作（无底）。
 * 说明：`type` 默认透传（表单内请显式传 type="submit"）。
 */
export default function Button({
  variant = "secondary",
  size = "md",
  block = false,
  className = "",
  type,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size !== "md" ? `btn--${size}` : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
