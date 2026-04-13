import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** API base URL */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Typed fetch wrapper for API calls */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      // Don't redirect if already on auth pages
      if (!window.location.pathname.startsWith("/auth") && !window.location.pathname.startsWith("/setup")) {
        window.location.href = "/auth/login";
        throw new Error("Session expired");
      }
    }
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.error || `API Error: ${res.status}`);
  }
  return res.json();
}

/** Format bytes to human readable */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Format bps to human readable */
export function formatBps(bps: number): string {
  if (bps === 0) return "0 bps";
  const k = 1000;
  const sizes = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return `${parseFloat((bps / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Severity color mapping */
export const severityColor: Record<string, string> = {
  critical: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
  high: "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
  low: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
};

/** Device status color mapping */
export const statusColor: Record<string, string> = {
  up: "text-green-600 bg-green-50 dark:bg-green-950",
  down: "text-red-600 bg-red-50 dark:bg-red-950",
  warning: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950",
  unknown: "text-gray-500 bg-gray-50 dark:bg-gray-800",
  maintenance: "text-purple-600 bg-purple-50 dark:bg-purple-950",
};
