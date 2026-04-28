"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { FlashbarProps } from "@cloudscape-design/components/flashbar";

type FlashItem = FlashbarProps.MessageDefinition;

interface NotificationState {
  items: FlashItem[];
  addNotification: (item: Omit<FlashItem, "id" | "dismissible" | "onDismiss">) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationState | null>(null);

let notificationId = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlashItem[]>([]);

  const addNotification = useCallback((item: Omit<FlashItem, "id" | "dismissible" | "onDismiss">) => {
    const id = String(++notificationId);
    const newItem: FlashItem = {
      ...item,
      id,
      dismissible: true,
      onDismiss: () => setItems((prev) => prev.filter((i) => i.id !== id)),
    };
    setItems((prev) => [newItem, ...prev]);

    if (item.type !== "error") {
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, 5000);
    }
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  return (
    <NotificationContext.Provider value={{ items, addNotification, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationState {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
