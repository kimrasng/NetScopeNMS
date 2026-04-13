"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export interface WidgetErrorBoundaryProps {
  children: ReactNode;
  widgetId?: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Widget:${this.props.widgetId ?? "unknown"}]`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center h-full min-h-[120px]">
          <AlertTriangle className="h-5 w-5 text-destructive/60" />
          <p className="text-xs font-medium text-destructive/80">Widget failed</p>
          <p className="text-[10px] text-muted-foreground max-w-[200px] truncate">
            {this.state.error?.message || "Unknown error"}
          </p>
          <button
            onClick={this.handleRetry}
            className="text-[10px] text-primary hover:underline mt-1"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
