"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { getSocket } from "@/lib/socket";

interface FetchState<T> { data: T | null; loading: boolean; error: string | null }
type FetchAction<T> = { type: "loading" } | { type: "success"; data: T } | { type: "error"; error: string } | { type: "reset" };
function fetchReducer<T>(state: FetchState<T>, action: FetchAction<T>): FetchState<T> {
  switch (action.type) {
    case "loading": return { ...state, loading: true, error: null };
    case "success": return { data: action.data, loading: false, error: null };
    case "error": return { data: null, loading: false, error: action.error };
    case "reset": return { data: null, loading: false, error: null };
  }
}

export function useApi<T>(path: string | null, params?: Record<string, string | number | undefined>) {
  const [state, dispatch] = useReducer(fetchReducer<T>, { data: null, loading: !!path, error: null });
  const queryKey = JSON.stringify(Object.entries(params ?? {}).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)));
  const controller = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const refetch = useCallback(async () => {
    const current = ++revision.current;
    controller.current?.abort();
    if (!path) { dispatch({ type: "reset" }); return; }
    const requestController = new AbortController();
    controller.current = requestController;
    dispatch({ type: "loading" });
    try {
      const data = await api<T>(path, { method: "GET", params: Object.fromEntries(JSON.parse(queryKey) as [string, string | number][]), signal: requestController.signal });
      if (current === revision.current) dispatch({ type: "success", data });
    } catch (err) {
      if (!requestController.signal.aborted && current === revision.current) {
        dispatch({ type: "error", error: err instanceof ApiError ? err.message : "Request failed" });
      }
    }
  }, [path, queryKey]);
  useEffect(() => {
    dispatch({ type: "reset" });
    void refetch();
    const revisionRef = revision;
    return () => { ++revisionRef.current; controller.current?.abort(); };
  }, [refetch]);
  useEffect(() => {
    if (!path) return;
    const socket = getSocket();
    const update = () => { void refetch(); };
    const events = ["connect", "device:updated", "metric:updated", "incident:updated", "incident:comment", "notification", "topology:updated"];
    events.forEach(event => socket.on(event, update));
    const interval = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      events.forEach(event => socket.off(event, update));
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, [path, refetch]);
  return { ...state, refetch };
}
