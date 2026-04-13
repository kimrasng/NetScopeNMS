"use client";

import { useToastStore, type ToastVariant } from "@/hooks/use-toast";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border bg-card",
  success: "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/50",
  error: "border-red-500/30 bg-red-50 dark:bg-red-950/50",
  warning: "border-amber-500/30 bg-amber-50 dark:bg-amber-950/50",
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-muted-foreground" />,
  success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
};

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-2.5 rounded-lg border p-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in",
            variantStyles[t.variant]
          )}
        >
          {variantIcons[t.variant]}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{t.title}</div>
            {t.description && (
              <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
            )}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
