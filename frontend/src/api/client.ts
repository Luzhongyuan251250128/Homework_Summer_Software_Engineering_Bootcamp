const BASE = "/api";

function errorDetailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "object" && item !== null && typeof (item as { msg?: unknown }).msg === "string") {
          return (item as { msg: string }).msg;
        }
        return typeof item === "string" ? item : JSON.stringify(item);
      })
      .filter((part): part is string => typeof part === "string" && part.length > 0);
    return parts.length > 0 ? parts.join("；") : "request failed";
  }
  if (typeof detail === "object" && detail !== null) return JSON.stringify(detail);
  return "request failed";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (resp.status === 401 && !path.startsWith("/auth/")) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(errorDetailMessage(body.detail));
  }
  return resp.json() as Promise<T>;
}

export const authApi = {
  login: (password: string) => api<{ ok: boolean }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  }),
  logout: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};
