const BASE = "/api";

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
    throw new Error(body.detail ?? "request failed");
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
