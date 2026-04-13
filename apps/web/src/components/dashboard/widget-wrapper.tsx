"use client";

import { type ReactNode } from "react";
import { Settings, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WidgetErrorBoundary, SkeletonLoader } from "@/components/shared";
import type { WidgetType, WidgetConfig } from "./types";
import { getWidget } from "./widget-registry";

interface WidgetWrapperProps {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
  title?: string;
  isEditMode?: boolean;
  isLoading?: boolean;
  timeRange?: string;
  selectedHost?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  children?: ReactNode;
}

export function WidgetWrapper({
  id,
  type,
  config,
  title,
  isEditMode = false,
  isLoading = false,
  timeRange,
  selectedHost,
  onEdit,
  onDelete,
  children,
}: WidgetWrapperProps) {
  const entry = getWidget(type);
  const WidgetComponent = entry?.component;

  const displayTitle =
    title ?? (config as { title?: string }).title ?? type;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="p-3 pb-0 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
          {displayTitle}
        </CardTitle>
        {isEditMode && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onEdit?.(id)}
              aria-label="Edit widget"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDelete?.(id)}
              aria-label="Delete widget"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className={cn("p-3 pt-2 flex-1 min-h-0")}>
        {isLoading ? (
          <SkeletonLoader variant="card" />
        ) : (
          <WidgetErrorBoundary widgetId={id}>
            {children ??
              (WidgetComponent ? (
                <WidgetComponent
                  id={id}
                  type={type}
                  config={config}
                  timeRange={timeRange}
                  selectedHost={selectedHost}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Unknown widget: {type}
                </div>
              ))}
          </WidgetErrorBoundary>
        )}
      </CardContent>
    </Card>
  );
}
