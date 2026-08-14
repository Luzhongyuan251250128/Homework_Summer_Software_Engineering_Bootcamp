import { useEffect, useState } from "react";
import { api } from "../api/client";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import FormField from "../components/FormField";
import NavLayout from "../components/Layout/NavLayout";
import PageHeader from "../components/PageHeader";
import Table, { type Column } from "../components/Table";

export interface Project { id: number; name: string; description: string; }
export interface Repository { id: number; platform: string; repo_path: string; token_last4: string; last_synced_at: string | null; }
export interface Iteration { id: number; name: string; start_date: string; end_date: string; }

interface SyncResponse {
  id: number;
  status: "success" | "failed";
  commits_fetched?: number | null;
  error_message?: string | null;
}

type SyncState =
  | { status: "loading" }
  | { status: "success"; commits: number | null }
  | { status: "failed"; error: string };

interface LlmStatus {
  configured: boolean;
  source: "env" | "db" | null;
}

function llmStatusText(status: LlmStatus | null): string {
  if (status === null) return "状态未知";
  if (!status.configured) return "未配置";
  return status.source === "env" ? "已配置（来源：环境变量）" : "已配置（来源：网页录入）";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const REPO_COLUMNS: Column<Repository>[] = [
  { key: "repo_path", header: "仓库", mono: true },
  {
    key: "token_last4",
    header: "Token",
    mono: true,
    render: (r) => <span className="muted">••••{r.token_last4}</span>,
  },
  {
    key: "last_synced_at",
    header: "最近同步",
    render: (r) => (
      <span className={r.last_synced_at ? "" : "muted"}>
        {r.last_synced_at ? formatDateTime(r.last_synced_at) : "从未同步"}
      </span>
    ),
  },
];

const ITERATION_COLUMNS: Column<Iteration>[] = [
  { key: "name", header: "名称", render: (it) => <a href={`/iterations/${it.id}`}>{it.name}</a> },
  { key: "start_date", header: "起", mono: true },
  { key: "end_date", header: "止", mono: true },
];

export default function ConfigPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<Record<number, Repository[]>>({});
  const [iterations, setIterations] = useState<Record<number, Iteration[]>>({});
  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [token, setToken] = useState("");
  const [iterationName, setIterationName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [syncStates, setSyncStates] = useState<Record<number, SyncState>>({});
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
  const [llmKey, setLlmKey] = useState("");
  const [llmError, setLlmError] = useState("");
  const [llmSaved, setLlmSaved] = useState(false);

  async function load() {
    const list = await api<Project[]>("/projects");
    setProjects(list);
    const r: Record<number, Repository[]> = {};
    const it: Record<number, Iteration[]> = {};
    for (const p of list) {
      r[p.id] = await api(`/projects/${p.id}/repositories`);
      it[p.id] = await api(`/projects/${p.id}/iterations`);
    }
    setRepos(r);
    setIterations(it);
    try {
      setLlmStatus(await api<LlmStatus>("/settings/llm"));
    } catch {
      setLlmStatus(null);
    }
  }

  useEffect(() => { load().catch((e) => setError(String(e))); }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/projects", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "创建失败"); }
  }

  async function addRepo(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null) return;
    setError("");
    try {
      await api(`/projects/${selected}/repositories`, {
        method: "POST",
        body: JSON.stringify({ platform: "github", repo_path: repoPath, token }),
      });
      setRepoPath(""); setToken("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "添加失败"); }
  }

  async function addIteration(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null) return;
    setError("");
    try {
      await api(`/projects/${selected}/iterations`, {
        method: "POST",
        body: JSON.stringify({ name: iterationName, start_date: startDate, end_date: endDate }),
      });
      setIterationName(""); setStartDate(""); setEndDate("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "创建失败"); }
  }

  async function deleteRepo(id: number) {
    await api(`/repositories/${id}`, { method: "DELETE" });
    await load();
  }

  async function syncRepo(repo: Repository) {
    setSyncStates((prev) => ({ ...prev, [repo.id]: { status: "loading" } }));
    try {
      const res = await api<SyncResponse>(`/repositories/${repo.id}/sync`, { method: "POST" });
      if (res.status === "success") {
        setSyncStates((prev) => ({
          ...prev,
          [repo.id]: { status: "success", commits: res.commits_fetched ?? null },
        }));
      } else {
        setSyncStates((prev) => ({
          ...prev,
          [repo.id]: { status: "failed", error: res.error_message || "同步失败" },
        }));
      }
    } catch (err) {
      setSyncStates((prev) => ({
        ...prev,
        [repo.id]: { status: "failed", error: err instanceof Error ? err.message : "同步失败" },
      }));
    }
  }

  async function saveLlmKey(e: React.FormEvent) {
    e.preventDefault();
    setLlmError("");
    setLlmSaved(false);
    try {
      await api("/settings/llm", { method: "PUT", body: JSON.stringify({ api_key: llmKey }) });
      setLlmKey("");
      setLlmSaved(true);
      await load();
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function clearLlmKey() {
    setLlmError("");
    setLlmSaved(false);
    try {
      await api("/settings/llm", { method: "DELETE" });
      await load();
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : "清除失败");
    }
  }

  return (
    <NavLayout>
      <PageHeader title="配置" description="管理项目、仓库与迭代定义" />

      {error && (
        <p role="alert" className="alert">
          <span>{error}</span>
        </p>
      )}

      {projects.length === 0 && !error ? (
        <>
          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">新建项目</h2>
              <span className="panel__meta">创建第一个项目以开始统计</span>
            </div>
            <div className="panel__body">
              <form onSubmit={createProject} className="form-row">
                <FormField label="项目名称" htmlFor="project-name-input">
                  <input
                    id="project-name-input"
                    aria-label="project-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：平台组"
                  />
                </FormField>
                <Button type="submit" variant="primary">创建项目</Button>
              </form>
            </div>
          </section>
          <div className="section">
            <EmptyState
              title="还没有项目，先创建一个吧"
              description="创建项目后可添加 Git 仓库与迭代，开始统计团队研发工时。"
            />
          </div>
        </>
      ) : (
        <>
          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">新建项目</h2>
              <span className="panel__meta">共 {projects.length} 个项目</span>
            </div>
            <div className="panel__body">
              <form onSubmit={createProject} className="form-row">
                <FormField label="项目名称" htmlFor="project-name-input">
                  <input
                    id="project-name-input"
                    aria-label="project-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：平台组"
                  />
                </FormField>
                <Button type="submit" variant="primary">创建项目</Button>
              </form>
            </div>
          </section>

          <section className="panel section">
            <div className="panel__header">
              <h2 className="panel__title">当前项目</h2>
            </div>
            <div className="panel__body" style={{ maxWidth: 480 }}>
              <FormField label="选择项目" htmlFor="project-select">
                <select
                  id="project-select"
                  className="select"
                  value={selected ?? ""}
                  onChange={(e) => setSelected(Number(e.target.value))}
                  aria-label="select-project"
                >
                  <option value="" disabled>选择项目</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
            </div>
          </section>

          {selected !== null && (
            <div className="grid-2 section">
              <section className="panel">
                <div className="panel__header">
                  <h2 className="panel__title">仓库</h2>
                  <span className="panel__meta">{repos[selected]?.length ?? 0} 个</span>
                </div>
                <div className="panel__body">
                  <form onSubmit={addRepo} className="form-row">
                    <FormField label="仓库路径" htmlFor="repo-path-input">
                      <input
                        id="repo-path-input"
                        aria-label="repo-path"
                        value={repoPath}
                        onChange={(e) => setRepoPath(e.target.value)}
                        placeholder="org/repo"
                      />
                    </FormField>
                    <FormField label="Git Token" htmlFor="repo-token-input">
                      <input
                        id="repo-token-input"
                        type="password"
                        aria-label="repo-token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="隐藏输入"
                      />
                    </FormField>
                    <Button type="submit" variant="primary">添加仓库</Button>
                  </form>
                  <div className="section">
                    {repos[selected]?.length ? (
                      <Table
                        columns={REPO_COLUMNS}
                        rows={repos[selected]}
                        rowKey={(r) => r.id}
                        renderRowAction={(r) => {
                          const state = syncStates[r.id];
                          const loading = state?.status === "loading";
                          return (
                            <div className="row-actions">
                              <div className="row-actions__btns">
                                <Button size="sm" disabled={loading} onClick={() => syncRepo(r)}>
                                  {loading ? "同步中…" : "同步"}
                                </Button>
                                <Button variant="danger" size="sm" onClick={() => deleteRepo(r.id)}>删除</Button>
                              </div>
                              {state?.status === "success" && (
                                <span className="muted">
                                  {state.commits != null ? `同步成功 · 拉取 ${state.commits} 条` : "同步成功"}
                                </span>
                              )}
                              {state?.status === "failed" && (
                                <span className="alert" role="alert">{state.error}</span>
                              )}
                            </div>
                          );
                        }}
                      />
                    ) : (
                      <EmptyState title="还没有仓库" description="添加仓库后即可同步提交数据。" />
                    )}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h2 className="panel__title">迭代</h2>
                  <span className="panel__meta">{iterations[selected]?.length ?? 0} 个</span>
                </div>
                <div className="panel__body">
                  <form onSubmit={addIteration} className="form-row">
                    <FormField label="迭代名称" htmlFor="iteration-name-input">
                      <input
                        id="iteration-name-input"
                        aria-label="iteration-name"
                        value={iterationName}
                        onChange={(e) => setIterationName(e.target.value)}
                        placeholder="例如：Sprint 24"
                      />
                    </FormField>
                    <FormField label="开始日期" htmlFor="start-date-input">
                      <input
                        id="start-date-input"
                        type="date"
                        aria-label="start-date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </FormField>
                    <FormField label="结束日期" htmlFor="end-date-input">
                      <input
                        id="end-date-input"
                        type="date"
                        aria-label="end-date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </FormField>
                    <Button type="submit" variant="primary">创建迭代</Button>
                  </form>
                  <div className="section">
                    {iterations[selected]?.length ? (
                      <Table
                        columns={ITERATION_COLUMNS}
                        rows={iterations[selected]}
                        rowKey={(it) => it.id}
                      />
                    ) : (
                      <EmptyState title="还没有迭代" description="创建迭代以生成进度与风险分析。" />
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      <section className="panel section">
        <div className="panel__header">
          <h2 className="panel__title">LLM 设置</h2>
          <span className="panel__meta">{llmStatusText(llmStatus)}</span>
        </div>
        <div className="panel__body" style={{ maxWidth: 480 }}>
          <form onSubmit={saveLlmKey} className="form-row">
            <FormField label="LLM API Key" htmlFor="llm-api-key-input">
              <input
                id="llm-api-key-input"
                type="password"
                aria-label="llm-api-key"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="隐藏输入"
              />
            </FormField>
            <Button type="submit" variant="primary">保存 Key</Button>
            <Button
              type="button"
              variant="danger"
              disabled={llmStatus?.source !== "db"}
              onClick={clearLlmKey}
            >
              清除
            </Button>
          </form>
          {llmSaved && <p className="muted">已保存</p>}
          {llmError && (
            <p role="alert" className="alert">
              <span>{llmError}</span>
            </p>
          )}
          {llmStatus?.source === "env" && (
            <p className="muted">由环境变量提供，请在服务器端配置</p>
          )}
        </div>
      </section>
    </NavLayout>
  );
}
