import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Icon from "../components/Icon";
import NavLayout from "../components/Layout/NavLayout";
import PageHeader from "../components/PageHeader";
import Table, { type Column } from "../components/Table";

interface Version { version: number; content_md: string; source: string; created_at: string; }
interface ReportDetail {
  id: number; type: string; scope: string; status: string; content_md: string; llm_model: string | null;
  created_at: string; versions: Version[];
}

const VERSION_COLUMNS: Column<Version>[] = [
  { key: "version", header: "版本", mono: true, render: (v) => `v${v.version}` },
  { key: "source", header: "来源" },
  { key: "created_at", header: "时间", mono: true },
];

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

  return (
    <NavLayout>
      {!report ? (
        <div style={{ padding: "var(--space-8) 0", color: "var(--text-tertiary)" }}>
          {error ? <p role="alert">{error}</p> : "加载中…"}
        </div>
      ) : (
        <>
          <PageHeader
            title={report.type === "weekly" ? "周报" : "风险分析"}
            description={`报告 #${report.id} · 生成于 ${report.created_at}`}
            actions={
              report.status === "final"
                ? <Badge tone="success" dot>已定稿</Badge>
                : <Badge tone="neutral" dot>草稿</Badge>
            }
          />

          <div className="panel__header" style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-xs)",
            marginBottom: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
          }}>
            <Button variant={preview ? "secondary" : "primary"} size="sm" onClick={() => setPreview(!preview)}>
              <Icon name={preview ? "edit" : "eye"} size={14} />
              {preview ? "编辑" : "预览"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => save(false)}>
              保存
            </Button>
            <Button variant="secondary" size="sm" onClick={() => save(true)}>
              保存并定稿
            </Button>
            <Button variant="ghost" size="sm" onClick={download}>
              <Icon name="download" size={14} />
              导出 Markdown
            </Button>
          </div>

          {preview ? (
            <pre
              className="panel"
              data-testid="preview"
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-sm)",
                lineHeight: "1.7",
                padding: "var(--space-5)",
                margin: 0,
              }}
            >
              {content}
            </pre>
          ) : (
            <textarea
              aria-label="report-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="input"
              style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)" }}
            />
          )}

          <section className="panel section">
            <div className="panel__header">
              <h2 className="panel__title">版本历史</h2>
              <span className="panel__meta">{report.versions.length} 个版本</span>
            </div>
            <div className="panel__body">
              <Table
                columns={VERSION_COLUMNS}
                rows={report.versions}
                rowKey={(v) => v.version}
                renderRowAction={(v) => (
                  <Button variant="ghost" size="sm" onClick={() => restore(v.version)}>
                    <Icon name="history" size={14} />
                    恢复此版本
                  </Button>
                )}
              />
            </div>
          </section>
        </>
      )}
    </NavLayout>
  );
}
