import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/client";
import Button from "../components/Button";
import FormField from "../components/FormField";
import Icon, { LogoMark } from "../components/Icon";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await authApi.login(password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  }

  return (
    <div className="login-page">
      <form onSubmit={submit} className="login-card">
        <div className="login-card__brand">
          <LogoMark size={36} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--fs-body)", color: "var(--text)" }}>研发工时统计</div>
            <div style={{ fontSize: "var(--fs-2xs)", letterSpacing: "0.08em", color: "var(--text-tertiary)" }}>
              DEV HOURS ANALYTICS
            </div>
          </div>
        </div>
        <h1 className="login-card__title">登录</h1>
        <p className="login-card__sub">请输入管理口令以访问团队统计面板</p>
        <FormField label="管理口令" htmlFor="login-password">
          <input
            id="login-password"
            type="password"
            aria-label="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="管理口令"
            autoComplete="current-password"
          />
        </FormField>
        <div style={{ marginTop: "var(--space-5)" }}>
          <Button type="submit" variant="primary" block>登录</Button>
        </div>
        {error && (
          <p role="alert" className="alert" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
            <Icon name="alert" size={16} style={{ flex: "none", marginTop: 1 }} />
            <span>{error}</span>
          </p>
        )}
      </form>
    </div>
  );
}
