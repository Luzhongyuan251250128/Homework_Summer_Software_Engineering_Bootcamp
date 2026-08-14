import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "../src/pages/DashboardPage";

vi.mock("echarts", () => ({
  init: () => ({ setOption: vi.fn(), dispose: vi.fn() }),
}));

function json(data: unknown) {
  return { ok: true, json: async () => data };
}

describe("DashboardPage", () => {
  it("renders overview stats", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ total_hours: 120.5, total_commits: 320, active_developers: 5, trend: [] }))
      .mockResolvedValueOnce(json([{ developer: "a@x.com", commits: 100, hours: 40.2, active_days: 10 }]));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText("120.5")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
  });

  it("shows empty state without data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ total_hours: 0, total_commits: 0, active_developers: 0, trend: [] })));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText(/还没有数据/)).toBeInTheDocument();
  });
});
