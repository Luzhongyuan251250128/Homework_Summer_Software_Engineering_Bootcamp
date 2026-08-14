import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { RiskBadge } from "../components/Badge";
import EmptyState from "../components/EmptyState";
import NavLayout from "../components/Layout/NavLayout";
import PageHeader from "../components/PageHeader";
import Table, { type Column } from "../components/Table";
import TrendChart from "../components/TrendChart";

interface IterationStats {
  iteration: { id: number; name: string; start_date: string; end_date: string };
  total_commits: number;
  night_ratio: number;
  daily: { date: string; commits: number }[];
  developers: { developer: string; commits: number; estimated_hours: number; metrics: Record<string, unknown> }[];
  signals: { code: string; level: string; description: string }[];
}

const DEVELOPER_COLUMNS: Column<IterationStats["developers"][number]>[] = [
  { key: "developer", header: "开发者", mono: true },
  { key: "commits", header: "提交" },
  { key: "estimated_hours", header: "估算工时 (h)" },
];

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
    <NavLayout>
      {error && (
        <p role="alert" className="alert">
          <span>{error}</span>
        </p>
      )}
      {stats && (
        <>
          <PageHeader
            title={`迭代：${stats.iteration.name}`}
            description={
              <>
                <span className="mono">{stats.iteration.start_date}</span> ~{" "}
                <span className="mono">{stats.iteration.end_date}</span>
                {" · "}提交 {stats.total_commits}
                {" · "}凌晨占比 {(stats.night_ratio * 100).toFixed(0)}%
              </>
            }
          />

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">风险信号</h2>
              <span className="panel__meta">{stats.signals.length} 条</span>
            </div>
            <div className="panel__body">
              {stats.signals.length === 0 ? (
                <EmptyState
                  title="暂无风险信号"
                  description="本迭代未发现确定性规则引擎标记的风险。"
                />
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {stats.signals.map((s) => (
                    <li
                      key={s.code}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "10px 12px",
                        background: "var(--surface-muted)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <RiskBadge level={s.level} />
                      <code
                        className="mono"
                        style={{ color: "var(--text-secondary)", flex: "none", fontSize: 12 }}
                      >
                        {s.code}
                      </code>
                      <span style={{ color: "var(--text)", fontSize: "var(--fs-sm)" }}>{s.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="panel section">
            <div className="panel__header">
              <h2 className="panel__title">每日提交</h2>
              <span className="panel__meta">迭代期内按日期</span>
            </div>
            <div className="panel__body">
              <TrendChart data={stats.daily} />
            </div>
          </section>

          <section className="panel section">
            <div className="panel__header">
              <h2 className="panel__title">成员快照</h2>
              <span className="panel__meta">{stats.developers.length} 名成员</span>
            </div>
            <div className="panel__body">
              <Table
                columns={DEVELOPER_COLUMNS}
                rows={stats.developers}
                rowKey={(d) => d.developer}
                empty={<EmptyState title="还没有数据" description="迭代内暂无成员提交记录。" />}
              />
            </div>
          </section>
        </>
      )}
    </NavLayout>
  );
}
