import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("api() error normalization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows pydantic 422 validation msg instead of [object Object]", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(422, {
      detail: [
        {
          loc: ["body", "token"],
          msg: "String should have at least 8 characters",
          type: "string_too_short",
        },
      ],
    })));

    const err = await api<unknown>("/repos").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain("String should have at least 8 characters");
    expect(message).not.toContain("[object Object]");
  });

  it("keeps a plain string detail as-is", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(400, { detail: "仓库不存在" })));

    const err = await api<unknown>("/repos").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("仓库不存在");
  });

  it("falls back to request failed when the body has no detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(500, {})));

    const err = await api<unknown>("/repos").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("request failed");
  });
});
