import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ReportEditorPage from "../src/pages/ReportEditorPage";

function json(data: unknown) {
  return { ok: true, json: async () => data };
}

const reportDetail = {
  id: 1, type: "weekly", scope: "project", status: "draft", content_md: "## 摘要\n草稿内容", llm_model: null,
  created_at: "2026-08-14T00:00:00",
  versions: [
    { version: 1, content_md: "## 摘要\n草稿内容", source: "llm", created_at: "2026-08-14T00:00:00" },
  ],
};

describe("ReportEditorPage", () => {
  it("loads and edits report, saves new version", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(reportDetail))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ...reportDetail, content_md: "人工修订", status: "final",
        versions: [...reportDetail.versions, { version: 2, content_md: "人工修订", source: "human", created_at: "x" }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/reports/1"]}>
        <Routes><Route path="/reports/:id" element={<ReportEditorPage />} /></Routes>
      </MemoryRouter>,
    );
    const textarea = await screen.findByLabelText("report-content");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "人工修订");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("v2")).toBeInTheDocument();
  });
});
