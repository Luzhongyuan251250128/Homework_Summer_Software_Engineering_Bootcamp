import { useEffect, useState } from "react";
import { api } from "../api/client";
import EmptyState from "../components/EmptyState";
import NavLayout from "../components/Layout/NavLayout";
import PageHeader from "../components/PageHeader";
import Table, { type Column } from "../components/Table";

interface Developer { developer: string; commits: number; hours: number; active_days: number; }

const COLUMNS: Column<Developer>[] = [
  { key: "developer", header: "开发者", mono: true },
  { key: "commits", header: "提交数" },
  { key: "hours", header: "估算工时 (h)" },
  { key: "active_days", header: "活跃天数" },
];

export default function DeveloperPage() {
  const [rows, setRows] = useState<Developer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Developer[]>("/stats/developers")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  return (
    <NavLayout>
      <PageHeader
        title="个人统计"
        description="按开发者维度的提交与估算工时明细"
      />
      {error && (
        <p role="alert" className="alert">
          <span>{error}</span>
        </p>
      )}
      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">成员统计</h2>
          <span className="panel__meta">{rows.length} 名成员</span>
        </div>
        <div className="panel__body">
          <Table
            columns={COLUMNS}
            rows={rows}
            rowKey={(d) => d.developer}
            empty={
              <EmptyState
                title="还没有数据"
                description="完成仓库同步后，个人维度的提交与工时统计将显示在这里。"
              />
            }
          />
        </div>
      </section>
    </NavLayout>
  );
}
