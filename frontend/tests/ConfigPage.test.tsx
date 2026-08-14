import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ConfigPage from "../src/pages/ConfigPage";

function mockFetchOnce(data: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => data });
}

describe("ConfigPage", () => {
  it("shows empty state when no projects", async () => {
    vi.stubGlobal("fetch", mockFetchOnce([]));
    render(<MemoryRouter><ConfigPage /></MemoryRouter>);
    expect(await screen.findByText(/还没有项目/)).toBeInTheDocument();
  });

  it("creates a project and lists it", async () => {
    // fetch 序列（与 ConfigPage.load/createProject 一一对应）：
    // 1) 初始 GET /projects → 空；2) POST 创建 → 新项目；3) 创建后 GET /projects → 列表；
    // 4) GET /projects/1/repositories → 空；5) GET /projects/1/iterations → 空
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, name: "平台组", description: "" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, name: "平台组", description: "" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><ConfigPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("project-name"), "平台组");
    await userEvent.click(screen.getByRole("button", { name: "创建项目" }));
    expect(await screen.findByText("平台组")).toBeInTheDocument();
  });

  it("删除项目：确认后以 DELETE /projects/:id?confirm=true 调用并重置选择器", async () => {
    // fetch 序列：1) GET /projects；2) GET /projects/1/repositories；3) GET /projects/1/iterations；
    // 4) DELETE /projects/1?confirm=true；5) 删除后 load() 的 GET /projects → 空列表（无子级请求）
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, name: "平台组", description: "" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><ConfigPage /></MemoryRouter>);

    await userEvent.selectOptions(await screen.findByLabelText("select-project"), "1");
    await userEvent.click(screen.getByRole("button", { name: "删除项目" }));
    // 二次确认文案说明级联删除范围
    expect(screen.getByText(/所有仓库、迭代与报告/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));

    const deleteCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === "/api/projects/1?confirm=true",
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![1]?.method).toBe("DELETE");
    // 删除后重新 load()，项目为空 → 回到引导空态
    expect(await screen.findByText(/还没有项目/)).toBeInTheDocument();
  });

  it("删除项目：取消确认时不发送 DELETE 请求", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, name: "平台组", description: "" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><ConfigPage /></MemoryRouter>);

    await userEvent.selectOptions(await screen.findByLabelText("select-project"), "1");
    await userEvent.click(screen.getByRole("button", { name: "删除项目" }));
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    const deleteCalls = fetchMock.mock.calls.filter(
      ([input, init]) => String(input).startsWith("/api/projects/1?confirm=true") && init?.method === "DELETE",
    );
    expect(deleteCalls).toHaveLength(0);
  });
});
