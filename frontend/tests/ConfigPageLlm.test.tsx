import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ConfigPage from "../src/pages/ConfigPage";

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data };
}

function makeFetchMock(llmStatus: unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/projects" && method === "GET") {
      return jsonResponse([{ id: 1, name: "平台组", description: "" }]);
    }
    if (url === "/api/projects/1/repositories" && method === "GET") {
      return jsonResponse([]);
    }
    if (url === "/api/projects/1/iterations" && method === "GET") {
      return jsonResponse([]);
    }
    if (url === "/api/settings/llm" && method === "GET") {
      return jsonResponse(llmStatus);
    }
    if (url === "/api/settings/llm" && (method === "PUT" || method === "DELETE")) {
      return jsonResponse({ ok: true });
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  });
}

describe("ConfigPage LLM settings", () => {
  it("saves the LLM API key via PUT /api/settings/llm", async () => {
    const fetchMock = makeFetchMock({ configured: false, source: null });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    );

    await userEvent.type(await screen.findByLabelText("llm-api-key"), "sk-test-123456");
    await userEvent.click(screen.getByRole("button", { name: "保存 Key" }));

    const putCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === "/api/settings/llm" && init?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    expect(JSON.parse(String(putCall![1]?.body))).toEqual({ api_key: "sk-test-123456" });
    expect(await screen.findByText("已保存")).toBeInTheDocument();
  });

  it("clears the LLM key via DELETE /api/settings/llm when source is db", async () => {
    const fetchMock = makeFetchMock({ configured: true, source: "db" });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/已配置/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "清除" }));

    const deleteCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === "/api/settings/llm" && init?.method === "DELETE"
    );
    expect(deleteCall).toBeDefined();
  });

  it("shows env hint and disables clear when key comes from env", async () => {
    const fetchMock = makeFetchMock({ configured: true, source: "env" });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/由环境变量提供/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清除" })).toBeDisabled();
  });
});
