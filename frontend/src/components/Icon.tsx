import type { ReactNode, SVGProps } from "react";

/**
 * 内部轻量图标集（stroke 风格，统一 strokeWidth=1.6）。
 * 说明：本项目离线/镜像受限、不引入第三方 UI 与图标依赖，故以统一规格的内联
 * stroke 图标作为设计系统组成部分；如后续允许网络安装，可整体替换为
 * @tabler/icons-react（同 stroke 风格）而无须改动调用方。
 */
export type IconName =
  | "grid"
  | "users"
  | "settings"
  | "key"
  | "alert"
  | "file"
  | "download"
  | "history"
  | "calendar"
  | "clock"
  | "branch"
  | "target"
  | "inbox"
  | "edit"
  | "eye"
  | "chevron-left"
  | "plus";

const PATHS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.4 2.9-6 6.5-6s6.5 2.6 6.5 6" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M17.5 14.4c2.2.8 4 2.7 4 5.6" />
    </>
  ),
  settings: (
    <>
      <path d="M3 6h7M14 6h7" />
      <circle cx="12" cy="6" r="2.2" />
      <path d="M3 12h3M10 12h11" />
      <circle cx="8" cy="12" r="2.2" />
      <path d="M3 18h11M18 18h3" />
      <circle cx="16" cy="18" r="2.2" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.2" />
      <path d="M10.6 12.4 20 3" />
      <path d="m15.5 7.5 2.5 2.5" />
      <path d="m18 5 2 2" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  branch: (
    <>
      <path d="M6 3v12" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </>
  ),
  edit: (
    <>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export default function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** 品牌标识：青瓷圆角方块 + 白色统计柱（图表语义）。 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0f766e" />
      <rect x="8" y="15" width="3.4" height="9" rx="1.2" fill="#ffffff" />
      <rect x="14.3" y="10" width="3.4" height="14" rx="1.2" fill="#ffffff" opacity="0.92" />
      <rect x="20.6" y="6.5" width="3.4" height="17.5" rx="1.2" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}
