// ─── API Client ───────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("netpulse_token");
}

export function setToken(token: string) {
  localStorage.setItem("netpulse_token", token);
}

export function clearToken() {
  localStorage.removeItem("netpulse_token");
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error: string; message?: string },
  ) {
    super(body.error);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, params, headers: extraHeaders, ...rest } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders as Record<string, string>,
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: { error: string; message?: string };
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { error: `HTTP ${response.status}` };
    }
    throw new ApiError(response.status, errorBody);
  }

  return response.json() as Promise<T>;
}

// ─── Convenience Methods ──────────────────────────────

export const apiGet = <T>(path: string, params?: Record<string, string | number | undefined>) =>
  api<T>(path, { method: "GET", params });

export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body });

export const apiPut = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body });

export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: "DELETE" });
