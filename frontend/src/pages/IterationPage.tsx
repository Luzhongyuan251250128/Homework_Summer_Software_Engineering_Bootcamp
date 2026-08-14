import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import TrendChart from "../components/TrendChart";

interface IterationStats {
  iteration: { id: number; name: string; start_date: string; end_date: string };
  total_commits: number;
  night_ratio: number;
  daily: { date: string; commits: number }[];
  developers: { developer: string; commits: number; estimated_hours: number; metrics: Record<string, unknown> }[];
  signals: { code: string; level: string; description: string }[];
}

export default function IterationPage() {
  const { id } = useParams();
  const [stats, setStats] = useState<IterationStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<IterationStats>(`/stats/iterations/${id}`)
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [id]);

  return (
    <div className="layout">
      <div className="nav">
        <a href="/">总览</a>
        <a href="/developers">个人统计</a>
        <a href="/config">配置</a>
      </div>
      <main style={{ padding: 24 }}>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        {stats && (
          <>
            <h1>迭代：{stats.iteration.name}</h1>
            <p style={{ color: "var(--text-secondary)" }}>
              {stats.iteration.start_date} ~ {stats.iteration.end_date} · 提交 {stats.total_commits} · 凌晨占比 {(stats.night_ratio * 100).toFixed(0)}%
            </p>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>风险信号</h2>
              {stats.signals.length === 0
                ? <p style={{ color: "var(--text-secondary)" }}>暂无风险信号</p>
                : <ul>{stats.signals.map((s) => (
                    <li key={s.code} style={{ color: s.level === "high" ? "var(--danger)" : "var(--warning)" }}>
                      <strong>{s.code}</strong> [{s.level}] {s.description}
                    </li>
                  ))}</ul>}
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>每日提交</h2>
              <TrendChart data={stats.daily} />
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>成员快照</h2>
              <table>
                <thead><tr><th>开发者</th><th>提交</th><th>估算工时 (h)</th></tr></thead>
                <tbody>
                  {stats.developers.map((d) => (
                    <tr key={d.developer}>
                      <td>{d.developer}</td><td>{d.commits}</td><td>{d.estimated_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
