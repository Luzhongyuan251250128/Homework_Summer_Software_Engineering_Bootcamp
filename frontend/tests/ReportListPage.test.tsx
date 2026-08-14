import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import ReportListPage from "../src/pages/ReportListPage";

function ok(data: unknown) {
  return { ok: true, json: async () => data };
}

/** 报告编辑页桩：出现即代表生成成功后的跳转已发生，并暴露目标报告 id。 */
function EditorStub() {
  const { id } = useParams();
  return <div>报告编辑页 #{id}</div>;
}

const projects = [{ id: 1, name: "平台组", description: "" }];
const reports = [
  { id: 11, type: "weekly", scope: "project", status: "draft", created_at: "2026-08-14T00:00:00" },
  { id: 12, type: "risk", scope: "project", status: "final", created_at: "2026-08-15T00:00:00" },
];

describe("ReportListPage", () => {
  it("加载项目与报告列表：展示类型、状态、创建时间与编辑入口", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(projects))
      .mockResolvedValueOnce(ok(reports));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <Routes>
          <Route path="/reports" element={<ReportListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("周报")).toBeInTheDocument();
    expect(screen.getByText("风险分析")).toBeInTheDocument();
    expect(screen.getByText("草稿")).toBeInTheDocument();
    expect(screen.getByText("已定稿")).toBeInTheDocument();
    expect(screen.getByText("2026-08-14T00:00:00")).toBeInTheDocument();
    const editLinks = screen.getAllByRole("link", { name: /编辑/ });
    expect(editLinks).toHaveLength(2);
    expect(editLinks[0]).toHaveAttribute("href", "/reports/11");
    expect(editLinks[1]).toHaveAttribute("href", "/reports/12");
    // 加载顺序：先 GET /api/projects，再按第一个项目 GET /api/reports
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/reports?project_id=1");
  });

  it("没有项目时展示引导空态", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok([])));
    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <Routes>
          <Route path="/reports" element={<ReportListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/还没有项目/)).toBeInTheDocument();
  });

  it("点击生成周报：POST /api/reports/generate(type=weekly) 且成功后跳转编辑页", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(projects))
      .mockResolvedValueOnce(ok(reports))
      .mockResolvedValueOnce(ok({
        id: 99, type: "weekly", scope: "project", status: "draft", content_md: "", created_at: "x",
      }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <Routes>
          <Route path="/reports" element={<ReportListPage />} />
          <Route path="/reports/:id" element={<EditorStub />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /生成周报/ }));
    expect(await screen.findByText("报告编辑页 #99")).toBeInTheDocument();
    const generateCall = fetchMock.mock.calls.find((c) => c[0] === "/api/reports/generate");
    expect(generateCall).toBeTruthy();
    expect(generateCall![1].method).toBe("POST");
    expect(JSON.parse(generateCall![1].body)).toEqual({
      project_id: 1, type: "weekly", scope: "project",
    });
  });

  it("生成周报失败（LLM 未配置）时展示红色 alert 与后端错误信息", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(projects))
      .mockResolvedValueOnce(ok(reports))
      .mockResolvedValueOnce({
        ok: false, status: 400,
        json: async () => ({ detail: "LLM_API_KEY 未配置：请先在配置页设置 API Key" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <Routes>
          <Route path="/reports" element={<ReportListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /生成周报/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("LLM_API_KEY 未配置：请先在配置页设置 API Key");
    expect(alert.className).toContain("alert");
  });

  it("切换项目选择器后按新的 project_id 重新请求报告列表", async () => {
    const twoProjects = [
      { id: 1, name: "平台组", description: "" },
      { id: 2, name: "数据组", description: "" },
    ];
    const reportsP1 = [
      { id: 11, type: "weekly", scope: "project", status: "draft", created_at: "2026-08-14T00:00:00" },
    ];
    const reportsP2 = [
      { id: 21, type: "risk", scope: "project", status: "final", created_at: "2026-08-20T00:00:00" },
    ];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(twoProjects))
      .mockResolvedValueOnce(ok(reportsP1))
      .mockResolvedValueOnce(ok(reportsP2));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/reports"]}>
        <Routes>
          <Route path="/reports" element={<ReportListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    // 默认选中第一个项目
    expect(await screen.findByText("2026-08-14T00:00:00")).toBeInTheDocument();
    // 切换到第二个项目 → 重新请求 /api/reports?project_id=2
    await userEvent.selectOptions(await screen.findByLabelText("select-project-report"), "2");
    expect(await screen.findByText("2026-08-20T00:00:00")).toBeInTheDocument();
    expect(screen.queryByText("2026-08-14T00:00:00")).not.toBeInTheDocument();
    const switchCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/reports?project_id=2");
    expect(switchCall).toBeDefined();
  });
});
