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
});
