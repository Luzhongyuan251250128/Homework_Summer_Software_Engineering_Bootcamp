import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/client";

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
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form onSubmit={submit} className="card" style={{ width: 320 }}>
        <h1 style={{ fontSize: 18 }}>研发工时统计平台</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>请输入管理口令</p>
        <input
          type="password"
          aria-label="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="管理口令"
        />
        <div style={{ marginTop: 12 }}>
          <button type="submit" className="primary">登录</button>
        </div>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      </form>
    </div>
  );
}
