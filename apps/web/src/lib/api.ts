import { reportListSchema, notificationHistorySchema, invitationResponseSchema, metricSeriesSchema, anomalyResponseSchema, predictionResponseSchema, aiQueryResponseSchema } from "@netpulse/shared/contracts";
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
  notifyOnError?: boolean;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error: string; message?: string },
  ) {
    super(body.message ?? body.error);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, params, notifyOnError = true, headers: extraHeaders, ...rest } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = new Headers(extraHeaders);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: { error: string; message?: string };
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { error: `HTTP ${response.status}` };
    }
    if (notifyOnError && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("netpulse:api-error", { detail: { path, status: response.status, message: errorBody.message ?? errorBody.error } }));
    throw new ApiError(response.status, errorBody);
  }

  const data: unknown = await response.json();
  const method = rest.method ?? "GET";
  const contract = method === "GET" ? ({ "/api/reports": reportListSchema, "/api/notifications/history": notificationHistorySchema, "/api/metrics": metricSeriesSchema, "/api/metrics/anomalies": anomalyResponseSchema, "/api/metrics/predict": predictionResponseSchema }[path]) : method === "POST" && path === "/api/setup/invite" ? invitationResponseSchema : method === "POST" && path === "/api/ai/query" ? aiQueryResponseSchema : undefined;
  if (contract && !contract.safeParse(data).success) throw new ApiError(502, { error: "The API returned an invalid response. Retry or contact your administrator." });
  return data as T;
}

// ─── Convenience Methods ──────────────────────────────

export const apiGet = <T>(path: string, params?: Record<string, string | number | undefined>) =>
  api<T>(path, { method: "GET", params });

export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body, notifyOnError: false });

export const apiPut = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body, notifyOnError: false });

export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: "DELETE", notifyOnError: false });
