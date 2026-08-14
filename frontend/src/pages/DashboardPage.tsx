import { useEffect, useState } from "react";
import { api } from "../api/client";
import EmptyState from "../components/EmptyState";
import StatCard from "../components/StatCard";
import TrendChart from "../components/TrendChart";

interface Overview { total_hours: number; total_commits: number; active_developers: number; trend: { date: string; commits: number }[]; }
interface Developer { developer: string; commits: number; hours: number; active_days: number; }

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Overview>("/stats/overview"), api<Developer[]>("/stats/developers")])
      .then(([o, d]) => { setOverview(o); setDevelopers(d); })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const empty = overview !== null && overview.total_commits === 0;

  return (
    <div className="layout">
      <div className="nav">
        <a href="/" className="active">总览</a>
        <a href="/developers">个人统计</a>
        <a href="/config">配置</a>
      </div>
      <main style={{ padding: 24 }}>
        <h1>团队总览</h1>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        {empty ? (
          <EmptyState title="还没有数据，请先在「配置」添加仓库并同步" />
        ) : overview && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <StatCard label="估算工时 (h)" value={overview.total_hours} />
              <StatCard label="提交数" value={overview.total_commits} />
              <StatCard label="活跃成员" value={overview.active_developers} />
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>提交趋势</h2>
              <TrendChart data={overview.trend} />
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>成员排行</h2>
              <table>
                <thead><tr><th>开发者</th><th>提交</th><th>工时 (h)</th><th>活跃天数</th></tr></thead>
                <tbody>
                  {developers.map((d) => (
                    <tr key={d.developer}>
                      <td>{d.developer}</td><td>{d.commits}</td><td>{d.hours}</td><td>{d.active_days}</td>
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
