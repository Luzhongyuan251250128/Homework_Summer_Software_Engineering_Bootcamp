import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import FormField from "../components/FormField";
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
 * 迭代列表页：加载项目后默认选中第一个项目，展示其迭代；
 * 可通过项目选择器切换项目重新拉取对应迭代；每行可一键为该迭代生成风险分析，成功后直接进入编辑页。
 */
export default function IterationListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [iterations, setIterations] = useState<Iteration[] | null>(null);
  const [error, setError] = useState("");
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const currentProject = projects.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    api<Project[]>("/projects")
      .then((list) => {
        setProjects(list);
        if (list.length === 0) {
          setIterations([]);
          return;
        }
        setSelectedId((prev) => prev ?? list[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    setIterations(null);
    api<Iteration[]>(`/projects/${selectedId}/iterations`)
      .then((list) => { if (!cancelled) setIterations(list); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "加载失败"); });
    return () => { cancelled = true; };
  }, [selectedId]);

  async function generateRisk(it: Iteration) {
    if (!currentProject || generatingId === it.id) return;
    setGeneratingId(it.id);
    setError("");
    try {
      const r = await api<{ id: number }>("/reports/generate", {
        method: "POST",
        body: JSON.stringify({
          project_id: currentProject.id,
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
        description={currentProject ? `项目：${currentProject.name}` : "按项目管理的迭代计划"}
      />

      {error && (
        <p role="alert" className="alert">
          <span>{error}</span>
        </p>
      )}

      {projects.length > 0 && (
        <section className="panel section">
          <div className="panel__body" style={{ maxWidth: 360 }}>
            <FormField label="选择项目" htmlFor="iteration-project-select">
              <select
                id="iteration-project-select"
                className="select"
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                aria-label="select-project-iteration"
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
        </section>
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
