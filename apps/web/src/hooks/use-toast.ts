"use client";
import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "warning";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const { addToast } = useToastStore();
  return {
    toast: addToast,
    success: (title: string, description?: string) => addToast({ title, description, variant: "success" }),
    error: (title: string, description?: string) => addToast({ title, description, variant: "error" }),
    warning: (title: string, description?: string) => addToast({ title, description, variant: "warning" }),
  };
}
