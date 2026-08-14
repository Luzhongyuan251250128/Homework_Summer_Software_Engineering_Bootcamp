import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DeveloperPage from "../src/pages/DeveloperPage";

vi.mock("echarts", () => ({ init: () => ({ setOption: vi.fn(), dispose: vi.fn() }) }));

describe("DeveloperPage", () => {
  it("lists developers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => [{ developer: "a@x.com", commits: 42, hours: 18.5, active_days: 6 }],
    }));
    render(<MemoryRouter><DeveloperPage /></MemoryRouter>);
    expect(await screen.findByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
