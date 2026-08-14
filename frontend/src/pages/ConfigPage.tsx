import { useEffect, useState } from "react";
import { api } from "../api/client";
import EmptyState from "../components/EmptyState";

export interface Project { id: number; name: string; description: string; }
export interface Repository { id: number; platform: string; repo_path: string; token_last4: string; last_synced_at: string | null; }
export interface Iteration { id: number; name: string; start_date: string; end_date: string; }

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

  if (projects.length === 0 && !error) {
    return (
      <div className="layout">
        <div className="nav"><a href="/">← 返回总览</a></div>
        <main style={{ padding: 24 }}>
          <h1>配置</h1>
          <form onSubmit={createProject} className="card" style={{ marginBottom: 16 }}>
            <input aria-label="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="项目名称" />
            <button type="submit" className="primary">创建项目</button>
          </form>
          <EmptyState title="还没有项目，先创建一个吧" />
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      <div className="nav">
        <a href="/">总览</a>
        <a href="/developers">个人统计</a>
        <a href="/config" className="active">配置</a>
      </div>
      <main style={{ padding: 24 }}>
        <h1>配置</h1>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <form onSubmit={createProject} className="card" style={{ marginBottom: 16 }}>
          <input aria-label="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="项目名称" />
          <button type="submit" className="primary">创建项目</button>
        </form>
        <select value={selected ?? ""} onChange={(e) => setSelected(Number(e.target.value))} aria-label="select-project">
          <option value="" disabled>选择项目</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selected !== null && (
          <>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>仓库</h2>
              <form onSubmit={addRepo} style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="仓库路径 org/repo" aria-label="repo-path" />
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Git Token（隐藏输入）" aria-label="repo-token" />
                <button type="submit" className="primary">添加仓库</button>
              </form>
              {repos[selected]?.length ? (
                <table>
                  <thead><tr><th>仓库</th><th>Token</th><th>操作</th></tr></thead>
                  <tbody>
                    {repos[selected].map((r) => (
                      <tr key={r.id}>
                        <td>{r.repo_path}</td>
                        <td>••••{r.token_last4}</td>
                        <td><button onClick={() => deleteRepo(r.id)}>删除</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState title="还没有仓库" />}
            </section>
            <section className="card" style={{ marginTop: 16 }}>
              <h2>迭代</h2>
              <form onSubmit={addIteration} style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                <input value={iterationName} onChange={(e) => setIterationName(e.target.value)} placeholder="迭代名称" aria-label="iteration-name" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="start-date" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="end-date" />
                <button type="submit" className="primary">创建迭代</button>
              </form>
              {iterations[selected]?.length ? (
                <table>
                  <thead><tr><th>名称</th><th>起</th><th>止</th></tr></thead>
                  <tbody>
                    {iterations[selected].map((it) => (
                      <tr key={it.id}><td><a href={`/iterations/${it.id}`}>{it.name}</a></td><td>{it.start_date}</td><td>{it.end_date}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState title="还没有迭代" />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
