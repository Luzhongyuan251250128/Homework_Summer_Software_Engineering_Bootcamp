import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * 表单字段组：标签在输入框上方（标签不依赖 placeholder），
 * 提示在下、错误在更下方。输入控件自身的 aria-label 由调用方保留
 * （测试契约依赖 aria-label，如 project-name / repo-path 等）。
 */
export default function FormField({ label, htmlFor, hint, error, children, className = "" }: FormFieldProps) {
  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
