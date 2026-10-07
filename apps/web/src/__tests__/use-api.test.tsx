import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ api: vi.fn(), listeners: new Map<string, () => void>(), on: vi.fn(), off: vi.fn() }));
vi.mock("@/lib/api", async importOriginal => ({ ...await importOriginal<typeof import("../lib/api")>(), api: mocks.api }));
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ on: mocks.on, off: mocks.off }) }));
import { useApi } from "../hooks/use-api";
beforeEach(() => {
  mocks.api.mockReset(); mocks.listeners.clear();
  mocks.on.mockImplementation((event: string, callback: () => void) => mocks.listeners.set(event, callback));
  mocks.off.mockImplementation((event: string) => mocks.listeners.delete(event));
});
afterEach(() => cleanup());
describe("Monitoring fetch lifecycle", () => {
  it("fetches when filters or pagination change", async () => {
    mocks.api.mockResolvedValue({ page: 1 });
    const { result, rerender } = renderHook(({ page }) => useApi<{page:number}>("/api/devices", { page }), { initialProps: { page: 1 } });
    await waitFor(() => expect(result.current.data?.page).toBe(1));
    mocks.api.mockResolvedValue({ page: 2 }); rerender({ page: 2 });
    await waitFor(() => expect(result.current.data?.page).toBe(2));
    expect(mocks.api.mock.calls[1][1].params).toEqual({ page: 2 });
  });
  it("does not refetch for equivalent parameter object order", async () => {
    mocks.api.mockResolvedValue({ ok: true });
    const { rerender } = renderHook(({ reverse }) => useApi("/api/devices", reverse ? { page: 1, limit: 20 } : { limit: 20, page: 1 }), { initialProps: { reverse: false } });
    await waitFor(() => expect(mocks.api).toHaveBeenCalledOnce()); rerender({ reverse: true });
    expect(mocks.api).toHaveBeenCalledOnce();
  });
  it("ignores a late result from an obsolete request", async () => {
    let resolveFirst: (value: { page: number }) => void = () => {};
    mocks.api.mockImplementationOnce(() => new Promise<{page:number}>(resolve => { resolveFirst = resolve; })).mockResolvedValue({ page: 2 });
    const { result, rerender } = renderHook(({ page }) => useApi<{page:number}>("/api/devices", { page }), { initialProps: { page: 1 } });
    rerender({ page: 2 }); await waitFor(() => expect(result.current.data?.page).toBe(2));
    await act(async () => { resolveFirst({ page: 1 }); });
    expect(result.current.data?.page).toBe(2);
    expect(mocks.api.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("updates visible data after monitoring socket events", async () => {
    mocks.api.mockResolvedValue({ status: "up" });
    const { result, unmount } = renderHook(() => useApi<{status:string}>("/api/devices"));
    await waitFor(() => expect(result.current.data?.status).toBe("up"));
    mocks.api.mockResolvedValue({ status: "warning" });
    await act(async () => { mocks.listeners.get("device:updated")?.(); });
    await waitFor(() => expect(result.current.data?.status).toBe("warning"));
    unmount(); expect(mocks.listeners.size).toBe(0);
  });
  it("clears stale results after a failed fetch and supports retry", async () => {
    mocks.api.mockResolvedValueOnce({ count: 3 }).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({ count: 4 });
    const { result } = renderHook(() => useApi<{count:number}>("/api/devices"));
    await waitFor(() => expect(result.current.data?.count).toBe(3));
    await act(async () => { await result.current.refetch(); });
    expect(result.current.data).toBeNull(); expect(result.current.error).toBe("Request failed");
    await act(async () => { await result.current.refetch(); });
    expect(result.current.data?.count).toBe(4); expect(result.current.error).toBeNull();
  });
});
