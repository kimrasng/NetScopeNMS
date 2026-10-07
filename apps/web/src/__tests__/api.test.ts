import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiDelete, apiPost, ApiError } from "../lib/api";
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { localStorage.clear(); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => vi.unstubAllGlobals());
describe("Web request and response contract", () => {
  it.each(["POST", "DELETE"])("does not send JSON headers or a body for bodyless %s", async method => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    await api("/api/dashboards/example/duplicate", { method });
    const [, options] = fetchMock.mock.calls[0];
    expect(options?.body).toBeUndefined();
    expect(new Headers(options?.headers).has("Content-Type")).toBe(false);
  });
  it("preserves intentional JSON bodies, auth and query values", async () => {
    localStorage.setItem("netpulse_token", "local-test-token");
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await api("/api/devices", { method: "POST", params: { page: 2, search: "a b", omitted: undefined }, body: { name: "QA" } });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("?page=2&search=a+b");
    expect(options?.body).toBe('{"name":"QA"}');
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer local-test-token");
    expect(new Headers(options?.headers).get("Content-Type")).toBe("application/json");
  });
  it("reports a downstream failure through the shared error event", async () => {
    const listener = vi.fn(); window.addEventListener("netpulse:api-error", listener);
    fetchMock.mockResolvedValue(new Response('{"error":"Delivery failed","message":"Receiver rejected the request"}', { status: 502 }));
    await expect(api("/api/notifications/test/example", { method: "POST" })).rejects.toThrow("Receiver rejected the request");
    expect(listener).toHaveBeenCalledOnce(); window.removeEventListener("netpulse:api-error", listener);
  });
  it("leaves handled mutation failures to the form instead of duplicating global feedback", async () => {
    const listener = vi.fn(); window.addEventListener("netpulse:api-error", listener);
    fetchMock.mockResolvedValue(new Response('{"error":"Invalid channel"}', { status: 400 }));
    await expect(apiPost("/api/notifications/channels", {})).rejects.toThrow("Invalid channel");
    expect(listener).not.toHaveBeenCalled(); window.removeEventListener("netpulse:api-error", listener);
  });
  it("rejects the old bare-array report response", async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));
    await expect(api("/api/reports")).rejects.toBeInstanceOf(ApiError);
  });
  it("accepts a paginated empty report list", async () => {
    const payload = { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    await expect(api("/api/reports")).resolves.toEqual(payload);
  });
  it("allows the key deletion helper to use a bodyless request", async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"Deleted"}', { status: 200 }));
    await apiDelete("/api/api-keys/example");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });
});
