import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Developer { developer: string; commits: number; hours: number; active_days: number; }

export default function DeveloperPage() {
  const [rows, setRows] = useState<Developer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Developer[]>("/stats/developers")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  return (
    <div className="layout">
      <div className="nav">
        <a href="/">总览</a>
        <a href="/developers" className="active">个人统计</a>
        <a href="/config">配置</a>
      </div>
      <main style={{ padding: 24 }}>
        <h1>个人统计</h1>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="card">
          <table>
            <thead><tr><th>开发者</th><th>提交数</th><th>估算工时 (h)</th><th>活跃天数</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.developer}>
                  <td>{d.developer}</td><td>{d.commits}</td><td>{d.hours}</td><td>{d.active_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
