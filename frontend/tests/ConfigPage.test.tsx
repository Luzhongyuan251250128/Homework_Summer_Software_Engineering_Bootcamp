import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ConfigPage from "../src/pages/ConfigPage";

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data };
}

describe("ConfigPage", () => {
  it("shows empty state when no projects", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/projects") return jsonResponse([]);
      if (url === "/api/settings/llm") return jsonResponse({ configured: false, source: null });
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><ConfigPage /></MemoryRouter>);
    expect(await screen.findByText(/还没有项目/)).toBeInTheDocument();
  });

  it("creates a project and lists it", async () => {
    let projects: { id: number; name: string; description: string }[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/projects" && method === "GET") return jsonResponse(projects);
      if (url === "/api/projects" && method === "POST") {
        projects = [{ id: 1, name: "平台组", description: "" }];
        return jsonResponse({ id: 1, name: "平台组", description: "" });
      }
      if (url === "/api/projects/1/repositories") return jsonResponse([]);
      if (url === "/api/projects/1/iterations") return jsonResponse([]);
      if (url === "/api/settings/llm") return jsonResponse({ configured: false, source: null });
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><ConfigPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("project-name"), "平台组");
    await userEvent.click(screen.getByRole("button", { name: "创建项目" }));
    expect(await screen.findByText("平台组")).toBeInTheDocument();
  });
});
