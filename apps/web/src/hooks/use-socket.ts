"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useNotificationStore } from "@/stores";
import { API_URL } from "@/lib/utils";

/**
 * Hook to manage Socket.IO connection for real-time notifications.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addNotification } = useNotificationStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(API_URL, {
      path: "/ws",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {});

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message);
    });

    socket.on("disconnect", (_reason) => {});

    // Listen for incident events
    socket.on("incident:created", (data) => {
      addNotification({
        id: crypto.randomUUID(),
        title: `New Incident: ${data.severity?.toUpperCase()}`,
        message: data.title || "New incident detected",
        severity: data.severity || "medium",
        read: false,
        createdAt: new Date().toISOString(),
        incidentId: data.id,
      });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    });

    socket.on("incident:updated", (data) => {
      addNotification({
        id: crypto.randomUUID(),
        title: `Incident ${data.status}`,
        message: data.title || "Incident updated",
        severity: data.severity || "medium",
        read: false,
        createdAt: new Date().toISOString(),
        incidentId: data.id,
      });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    });

    socket.on("incident:comment", (data) => {
      addNotification({
        id: crypto.randomUUID(),
        title: "New Comment",
        message: `Comment on incident`,
        severity: "low",
        read: false,
        createdAt: new Date().toISOString(),
        incidentId: data.incidentId,
      });
    });

    socket.on("device:status", (data) => {
      if (data.status === "down") {
        addNotification({
          id: crypto.randomUUID(),
          title: "Device Down",
          message: `${data.name} (${data.ip}) is unreachable`,
          severity: "critical",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    });

    return () => {
      socket.disconnect();
    };
  }, [addNotification, queryClient]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, emit };
}

/**
 * Hook for auto-refreshing data at intervals.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
