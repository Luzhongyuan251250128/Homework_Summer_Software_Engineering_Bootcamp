import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import IterationListPage from "../src/pages/IterationListPage";

function ok(data: unknown) {
  return { ok: true, json: async () => data };
}

/** 报告编辑页桩：出现即代表生成成功后的跳转已发生，并暴露目标报告 id。 */
function EditorStub() {
  const { id } = useParams();
  return <div>报告编辑页 #{id}</div>;
}

const projects = [{ id: 1, name: "平台组", description: "" }];
const iterations = [
  { id: 21, project_id: 1, name: "Sprint 1", start_date: "2026-01-05", end_date: "2026-01-16" },
  { id: 22, project_id: 1, name: "Sprint 2", start_date: "2026-01-19", end_date: "2026-01-30" },
];

describe("IterationListPage", () => {
  it("加载迭代列表：名称链接到 /iterations/:id，展示起止日期与操作按钮", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(projects))
      .mockResolvedValueOnce(ok(iterations));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/iterations"]}>
        <Routes>
          <Route path="/iterations" element={<IterationListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sprint 2" })).toHaveAttribute("href", "/iterations/22");
    expect(screen.getByText("2026-01-05 ~ 2026-01-16")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /生成风险分析/ })).toHaveLength(2);
    // 加载顺序：先 GET /api/projects，再按第一个项目 GET /api/projects/1/iterations
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/projects/1/iterations");
  });

  it("没有项目时展示引导空态", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok([])));
    render(
      <MemoryRouter initialEntries={["/iterations"]}>
        <Routes>
          <Route path="/iterations" element={<IterationListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/还没有项目/)).toBeInTheDocument();
  });

  it("没有迭代时展示空态", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(ok(projects))
      .mockResolvedValueOnce(ok([])));
    render(
      <MemoryRouter initialEntries={["/iterations"]}>
        <Routes>
          <Route path="/iterations" element={<IterationListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/还没有迭代/)).toBeInTheDocument();
  });

  it("点击生成风险分析：POST /api/reports/generate(type=risk, iteration_id) 且成功后跳转编辑页", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(projects))
      .mockResolvedValueOnce(ok(iterations))
      .mockResolvedValueOnce(ok({
        id: 88, type: "risk", scope: "project", status: "draft", content_md: "", created_at: "x",
      }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/iterations"]}>
        <Routes>
          <Route path="/iterations" element={<IterationListPage />} />
          <Route path="/reports/:id" element={<EditorStub />} />
        </Routes>
      </MemoryRouter>,
    );
    const buttons = await screen.findAllByRole("button", { name: /生成风险分析/ });
    await userEvent.click(buttons[0]); // Sprint 1 → iteration_id=21
    expect(await screen.findByText("报告编辑页 #88")).toBeInTheDocument();
    const generateCall = fetchMock.mock.calls.find((c) => c[0] === "/api/reports/generate");
    expect(generateCall).toBeTruthy();
    expect(generateCall![1].method).toBe("POST");
    expect(JSON.parse(generateCall![1].body)).toEqual({
      project_id: 1, type: "risk", scope: "project", iteration_id: 21,
    });
  });

  it("生成风险分析失败（LLM 未配置）时展示红色 alert 与后端错误信息", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(projects))
      .mockResolvedValueOnce(ok(iterations))
      .mockResolvedValueOnce({
        ok: false, status: 400,
        json: async () => ({ detail: "LLM_API_KEY 未配置：请先在配置页设置 API Key" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/iterations"]}>
        <Routes>
          <Route path="/iterations" element={<IterationListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const buttons = await screen.findAllByRole("button", { name: /生成风险分析/ });
    await userEvent.click(buttons[0]);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("LLM_API_KEY 未配置：请先在配置页设置 API Key");
    expect(alert.className).toContain("alert");
  });

  it("切换项目选择器后按新的 project_id 重新请求迭代列表", async () => {
    const twoProjects = [
      { id: 1, name: "平台组", description: "" },
      { id: 2, name: "数据组", description: "" },
    ];
    const iterationsP1 = [
      { id: 21, project_id: 1, name: "Sprint 1", start_date: "2026-01-05", end_date: "2026-01-16" },
    ];
    const iterationsP2 = [
      { id: 31, project_id: 2, name: "Sprint A", start_date: "2026-02-02", end_date: "2026-02-13" },
    ];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(twoProjects))
      .mockResolvedValueOnce(ok(iterationsP1))
      .mockResolvedValueOnce(ok(iterationsP2));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/iterations"]}>
        <Routes>
          <Route path="/iterations" element={<IterationListPage />} />
        </Routes>
      </MemoryRouter>,
    );
    // 默认选中第一个项目
    expect(await screen.findByText("Sprint 1")).toBeInTheDocument();
    // 切换到第二个项目 → 重新请求 /api/projects/2/iterations
    await userEvent.selectOptions(await screen.findByLabelText("select-project-iteration"), "2");
    expect(await screen.findByText("Sprint A")).toBeInTheDocument();
    expect(screen.queryByText("Sprint 1")).not.toBeInTheDocument();
    const switchCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/projects/2/iterations");
    expect(switchCall).toBeDefined();
  });
});
