import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockHandlers = new Map<string, Function>();
const mockSocket = {
  on: vi.fn((event: string, handler: Function) => {
    mockHandlers.set(event, handler);
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
  id: "mock-socket-id",
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/stores", () => ({
  useNotificationStore: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock("@/lib/utils", () => ({
  API_URL: "http://localhost:4000",
}));

describe("useSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlers.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => (key === "token" ? "mock-jwt" : null)),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates socket connection with token", async () => {
    const { io } = await import("socket.io-client");
    const { useSocket } = await import("@/hooks/use-socket");

    renderHook(() => useSocket());

    expect(io).toHaveBeenCalledWith("http://localhost:4000", expect.objectContaining({
      path: "/ws",
      auth: { token: "mock-jwt" },
    }));
  });

  it("registers connect event listener", async () => {
    const { useSocket } = await import("@/hooks/use-socket");
    renderHook(() => useSocket());
    expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
  });

  it("registers disconnect event listener", async () => {
    const { useSocket } = await import("@/hooks/use-socket");
    renderHook(() => useSocket());
    expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });

  it("registers incident:created listener", async () => {
    const { useSocket } = await import("@/hooks/use-socket");
    renderHook(() => useSocket());
    expect(mockSocket.on).toHaveBeenCalledWith("incident:created", expect.any(Function));
  });

  it("registers incident:updated listener", async () => {
    const { useSocket } = await import("@/hooks/use-socket");
    renderHook(() => useSocket());
    expect(mockSocket.on).toHaveBeenCalledWith("incident:updated", expect.any(Function));
  });

  it("registers device:status listener", async () => {
    const { useSocket } = await import("@/hooks/use-socket");
    renderHook(() => useSocket());
    expect(mockSocket.on).toHaveBeenCalledWith("device:status", expect.any(Function));
  });

  it("disconnects socket on unmount", async () => {
    const { useSocket } = await import("@/hooks/use-socket");
    const { unmount } = renderHook(() => useSocket());
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
