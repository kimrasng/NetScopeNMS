"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { api, ApiError } from "@/lib/api";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

type FetchAction<T> =
  | { type: "loading" }
  | { type: "success"; data: T }
  | { type: "error"; error: string };

function fetchReducer<T>(state: FetchState<T>, action: FetchAction<T>): FetchState<T> {
  switch (action.type) {
    case "loading": return { ...state, loading: true, error: null };
    case "success": return { data: action.data, loading: false, error: null };
    case "error": return { ...state, loading: false, error: action.error };
  }
}

export function useApi<T>(
  path: string | null,
  params?: Record<string, string | number | undefined>,
) {
  const [state, dispatch] = useReducer(fetchReducer<T>, { data: null, loading: !!path, error: null });
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const refetch = useCallback(async () => {
    if (!path) return;
    dispatch({ type: "loading" });
    try {
      const data = await api<T>(path, { method: "GET", params: paramsRef.current });
      dispatch({ type: "success", data });
    } catch (err) {
      const message = err instanceof ApiError ? err.body.error : "Request failed";
      dispatch({ type: "error", error: message });
    }
  }, [path]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
