import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import EmptyState from "../components/EmptyState";
import NavLayout from "../components/Layout/NavLayout";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Table, { type Column } from "../components/Table";
import TrendChart from "../components/TrendChart";

interface Overview {
  total_hours: number;
  total_commits: number;
  active_developers: number;
  trend: { date: string; commits: number }[];
}
interface Developer { developer: string; commits: number; hours: number; active_days: number; }

const DEVELOPER_COLUMNS: Column<Developer>[] = [
  { key: "developer", header: "开发者", mono: true },
  { key: "commits", header: "提交" },
  { key: "hours", header: "工时 (h)" },
  { key: "active_days", header: "活跃天数" },
];

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
    <NavLayout>
      <PageHeader
        title="团队总览"
        description="跨项目提交与估算工时的汇总视图"
      />
      {error && (
        <p role="alert" className="alert">
          <span>{error}</span>
        </p>
      )}
      {empty ? (
        <EmptyState
          title="还没有数据，请先在「配置」添加仓库并同步"
          description="添加项目与仓库并完成同步后，这里将展示团队工时、提交趋势与成员排行。"
          action={<Link to="/config" className="btn btn--secondary btn--sm">前往配置</Link>}
        />
      ) : overview && (
        <>
          <section className="stat-grid">
            <StatCard label="估算工时 (h)" value={overview.total_hours} hint="基于提交历史的口径估算" />
            <StatCard label="提交数" value={overview.total_commits} hint="统计周期内全部提交" />
            <StatCard label="活跃成员" value={overview.active_developers} hint="有提交记录的开发者" />
          </section>

          <section className="panel section">
            <div className="panel__header">
              <h2 className="panel__title">提交趋势</h2>
              <span className="panel__meta">按日期统计</span>
            </div>
            <div className="panel__body">
              <TrendChart data={overview.trend} />
            </div>
          </section>

          <section className="panel section">
            <div className="panel__header">
              <h2 className="panel__title">成员排行</h2>
              <span className="panel__meta">{developers.length} 名成员</span>
            </div>
            <div className="panel__body">
              <Table
                columns={DEVELOPER_COLUMNS}
                rows={developers}
                rowKey={(d) => d.developer}
                empty={<EmptyState title="还没有数据" description="完成仓库同步后成员统计将显示在这里。" />}
              />
            </div>
          </section>
        </>
      )}
    </NavLayout>
  );
}
