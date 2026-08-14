import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Badge from "../components/Badge";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import NavLayout from "../components/Layout/NavLayout";
import PageHeader from "../components/PageHeader";
import Table, { type Column } from "../components/Table";

export interface Project { id: number; name: string; description: string; }
export interface ReportItem { id: number; type: string; scope: string; status: string; created_at: string; }

const REPORT_COLUMNS: Column<ReportItem>[] = [
  {
    key: "type",
    header: "类型",
    render: (r) => (r.type === "weekly" ? "周报" : "风险分析"),
  },
  {
    key: "status",
    header: "状态",
    render: (r) =>
      r.status === "final"
        ? <Badge tone="success" dot>已定稿</Badge>
        : <Badge tone="neutral" dot>草稿</Badge>,
  },
  { key: "created_at", header: "创建时间", mono: true },
];

/**
 * 报告列表页：加载项目，取第一个项目展示其报告列表；
 * 右上角可一键生成周报，成功后直接进入编辑页。
 * （多个项目时仅取第一个：与迭代页保持一致，报告里已说明。）
 */
export default function ReportListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api<Project[]>("/projects")
      .then((list) => {
        setProjects(list);
        if (list.length === 0) {
          setReports([]);
          return;
        }
        return api<ReportItem[]>(`/reports?project_id=${list[0].id}`).then(setReports);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  async function generateWeekly() {
    const project = projects[0];
    if (!project || generating) return;
    setGenerating(true);
    setError("");
    try {
      const r = await api<{ id: number }>("/reports/generate", {
        method: "POST",
        body: JSON.stringify({ project_id: project.id, type: "weekly", scope: "project" }),
      });
      navigate(`/reports/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      setGenerating(false);
    }
  }

  return (
    <NavLayout>
      <PageHeader
        title="报告"
        description={projects.length > 0 ? `项目：${projects[0].name}` : "按项目生成的周报与风险分析"}
        actions={
          projects.length > 0 && (
            <Button variant="primary" disabled={generating} onClick={generateWeekly}>
              <Icon name="plus" size={14} />
              {generating ? "生成中…" : "生成周报"}
            </Button>
          )
        }
      />

      {error && (
        <p role="alert" className="alert">
          <span>{error}</span>
        </p>
      )}

      {projects.length === 0 ? (
        <div className="section">
          <EmptyState
            title="还没有项目"
            description="先去配置页创建项目并添加仓库，再回来生成周报与风险分析。"
            action={<Link className="btn btn--primary" to="/config">去配置</Link>}
          />
        </div>
      ) : reports === null ? (
        <div style={{ padding: "var(--space-8) 0", color: "var(--text-tertiary)" }}>加载中…</div>
      ) : reports.length === 0 ? (
        <div className="section">
          <EmptyState
            title="还没有报告"
            description="点击右上角「生成周报」，或到迭代页为某个迭代生成风险分析。"
          />
        </div>
      ) : (
        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">报告列表</h2>
            <span className="panel__meta">{reports.length} 份</span>
          </div>
          <div className="panel__body">
            <Table
              columns={REPORT_COLUMNS}
              rows={reports}
              rowKey={(r) => r.id}
              renderRowAction={(r) => (
                <Link className="btn btn--ghost btn--sm" to={`/reports/${r.id}`}>
                  <Icon name="edit" size={14} />
                  编辑
                </Link>
              )}
            />
          </div>
        </section>
      )}
    </NavLayout>
  );
}
