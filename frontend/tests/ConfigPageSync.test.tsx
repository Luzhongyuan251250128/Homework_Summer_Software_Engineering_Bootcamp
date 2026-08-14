import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ConfigPage from "../src/pages/ConfigPage";

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data };
}

function makeFetchMock(syncResult: unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/projects" && method === "GET") {
      return jsonResponse([{ id: 1, name: "平台组", description: "" }]);
    }
    if (url === "/api/projects/1/repositories" && method === "GET") {
      return jsonResponse([
        { id: 1, platform: "github", repo_path: "org/repo", token_last4: "1234", last_synced_at: null },
      ]);
    }
    if (url === "/api/projects/1/iterations" && method === "GET") {
      return jsonResponse([]);
    }
    if (url === "/api/repositories/1/sync" && method === "POST") {
      return jsonResponse(syncResult);
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  });
}

describe("ConfigPage sync", () => {
  it("syncs a repo via POST /repositories/:id/sync and shows the fetched commit count", async () => {
    const fetchMock = makeFetchMock({ id: 1, status: "success", commits_fetched: 42 });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    );

    // 选中项目后仓库表格才会渲染
    await userEvent.selectOptions(await screen.findByLabelText("select-project"), "1");
    expect(await screen.findByText("org/repo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "同步" }));

    const syncCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === "/api/repositories/1/sync"
    );
    expect(syncCall).toBeDefined();
    expect(syncCall![1]?.method).toBe("POST");

    expect(await screen.findByText(/同步成功/)).toBeInTheDocument();
    expect(screen.getByText(/拉取 42 条/)).toBeInTheDocument();
  });

  it("shows the backend error message in red when sync fails", async () => {
    const fetchMock = makeFetchMock({
      id: 1,
      status: "failed",
      commits_fetched: 0,
      error_message: "Token 无效或已过期",
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    );

    await userEvent.selectOptions(await screen.findByLabelText("select-project"), "1");
    expect(await screen.findByText("org/repo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "同步" }));

    const error = await screen.findByText(/Token 无效或已过期/);
    expect(error).toBeInTheDocument();
    expect(error.closest(".alert")).not.toBeNull();
  });
});
