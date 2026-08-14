import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import IterationPage from "../src/pages/IterationPage";

vi.mock("echarts", () => ({ init: () => ({ setOption: vi.fn(), dispose: vi.fn() }) }));

describe("IterationPage", () => {
  it("renders risk signals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iteration: { id: 1, name: "I1", start_date: "2026-01-05", end_date: "2026-01-16" },
        total_commits: 3,
        night_ratio: 0,
        daily: [],
        developers: [],
        signals: [{ code: "RS-2", level: "high", description: "连续 3 个工作日无提交" }],
      }),
    }));
    render(
      <MemoryRouter initialEntries={["/iterations/1"]}>
        <Routes><Route path="/iterations/:id" element={<IterationPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("RS-2")).toBeInTheDocument();
    expect(screen.getByText(/连续 3 个工作日无提交/)).toBeInTheDocument();
  });
});
