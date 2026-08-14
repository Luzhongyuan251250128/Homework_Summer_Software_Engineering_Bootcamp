import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import NavLayout from "../components/Layout/NavLayout";
import PageHeader from "../components/PageHeader";
import Table, { type Column } from "../components/Table";

export interface Project { id: number; name: string; description: string; }
export interface Iteration { id: number; project_id: number; name: string; start_date: string; end_date: string; }

const ITERATION_COLUMNS: Column<Iteration>[] = [
  { key: "name", header: "名称", render: (it) => <Link to={`/iterations/${it.id}`}>{it.name}</Link> },
  {
    key: "dates",
    header: "起止日期",
    mono: true,
    render: (it) => `${it.start_date} ~ ${it.end_date}`,
  },
];

/**
 * 迭代列表页：加载项目，取第一个项目展示其迭代；
 * 每行可一键为该迭代生成风险分析，成功后直接进入编辑页。
 * （多个项目时仅取第一个：与报告页保持一致，报告里已说明。）
 */
export default function IterationListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [iterations, setIterations] = useState<Iteration[] | null>(null);
  const [error, setError] = useState("");
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  useEffect(() => {
    api<Project[]>("/projects")
      .then((list) => {
        setProjects(list);
        if (list.length === 0) {
          setIterations([]);
          return;
        }
        return api<Iteration[]>(`/projects/${list[0].id}/iterations`).then(setIterations);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  async function generateRisk(it: Iteration) {
    const project = projects[0];
    if (!project || generatingId === it.id) return;
    setGeneratingId(it.id);
    setError("");
    try {
      const r = await api<{ id: number }>("/reports/generate", {
        method: "POST",
        body: JSON.stringify({
          project_id: project.id,
          type: "risk",
          scope: "project",
          iteration_id: it.id,
        }),
      });
      navigate(`/reports/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      setGeneratingId(null);
    }
  }

  return (
    <NavLayout>
      <PageHeader
        title="迭代"
        description={projects.length > 0 ? `项目：${projects[0].name}` : "按项目管理的迭代计划"}
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
            description="先去配置页创建项目并添加迭代，再回来为每个迭代生成风险分析。"
            action={<Link className="btn btn--primary" to="/config">去配置</Link>}
          />
        </div>
      ) : iterations === null ? (
        <div style={{ padding: "var(--space-8) 0", color: "var(--text-tertiary)" }}>加载中…</div>
      ) : iterations.length === 0 ? (
        <div className="section">
          <EmptyState
            title="还没有迭代"
            description="在配置页为项目添加迭代后，即可为每个迭代生成风险分析。"
          />
        </div>
      ) : (
        <section className="panel">
          <div className="panel__header">
            <h2 className="panel__title">迭代列表</h2>
            <span className="panel__meta">{iterations.length} 个</span>
          </div>
          <div className="panel__body">
            <Table
              columns={ITERATION_COLUMNS}
              rows={iterations}
              rowKey={(it) => it.id}
              renderRowAction={(it) => (
                <Button
                  size="sm"
                  disabled={generatingId === it.id}
                  onClick={() => generateRisk(it)}
                >
                  <Icon name="target" size={14} />
                  {generatingId === it.id ? "生成中…" : "生成风险分析"}
                </Button>
              )}
            />
          </div>
        </section>
      )}
    </NavLayout>
  );
}
