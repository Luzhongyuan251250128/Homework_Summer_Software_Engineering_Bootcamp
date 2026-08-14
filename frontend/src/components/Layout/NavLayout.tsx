import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import Icon, { LogoMark } from "../Icon";

const NAV_ITEMS = [
  { to: "/", label: "总览", icon: "grid" as const },
  { to: "/developers", label: "个人统计", icon: "users" as const },
  { to: "/reports", label: "报告", icon: "file" as const },
  { to: "/iterations", label: "迭代", icon: "calendar" as const },
  { to: "/config", label: "配置", icon: "settings" as const },
];

/**
 * 应用外壳：深色石墨侧边导航（品牌 + 当前页高亮）+ 内容区。
 * 所有业务页面统一套用，保证导航一致；登录页除外（居中卡片，无导航）。
 */
export default function NavLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="app-nav">
        <div className="app-nav__brand">
          <LogoMark size={28} />
          <div>
            <div className="app-nav__brand-name">研发工时统计</div>
            <div className="app-nav__brand-sub">Dev Hours</div>
          </div>
        </div>
        <nav className="app-nav__links" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
            >
              <Icon name={item.icon} size={17} />
              <span className="app-nav__link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-nav__footer">v0.1.0</div>
      </aside>
      <div className="app-content">
        <div className="app-content__inner">{children}</div>
      </div>
    </div>
  );
}
