import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

interface Version { version: number; content_md: string; source: string; created_at: string; }
interface ReportDetail {
  id: number; type: string; scope: string; status: string; content_md: string; llm_model: string | null;
  created_at: string; versions: Version[];
}

export default function ReportEditorPage() {
  const { id } = useParams();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const r = await api<ReportDetail>(`/reports/${id}`);
    setReport(r);
    setContent(r.content_md);
  }

  useEffect(() => { load().catch((e) => setError(String(e))); }, [id]);

  async function save(final = false) {
    await api(`/reports/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content_md: content, status: final ? "final" : undefined }),
    });
    await load();
  }

  async function restore(version: number) {
    await api(`/reports/${id}/restore`, { method: "POST", body: JSON.stringify({ version }) });
    await load();
  }

  function download() {
    window.open(`/api/reports/${id}/export`, "_blank");
  }

  if (!report) {
    return <div style={{ padding: 24 }}>{error ? <p role="alert">{error}</p> : "加载中…"}</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <a href="/">← 返回总览</a>
      <h1>{report.type === "weekly" ? "周报" : "风险分析"} · {report.status}</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setPreview(!preview)}>{preview ? "编辑" : "预览"}</button>
        <button className="primary" onClick={() => save(false)}>保存</button>
        <button onClick={() => save(true)}>保存并定稿</button>
        <button onClick={download}>导出 Markdown</button>
      </div>
      {preview ? (
        <pre className="card" data-testid="preview" style={{ whiteSpace: "pre-wrap" }}>{content}</pre>
      ) : (
        <textarea
          aria-label="report-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          style={{ fontFamily: "monospace" }}
        />
      )}
      <section className="card" style={{ marginTop: 16 }}>
        <h2>版本历史</h2>
        <table>
          <thead><tr><th>版本</th><th>来源</th><th>时间</th><th>操作</th></tr></thead>
          <tbody>
            {report.versions.map((v) => (
              <tr key={v.version}>
                <td>v{v.version}</td>
                <td>{v.source}</td>
                <td>{v.created_at}</td>
                <td><button onClick={() => restore(v.version)}>恢复此版本</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
