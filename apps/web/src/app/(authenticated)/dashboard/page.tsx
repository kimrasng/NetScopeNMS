"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  Plus, Pencil, Eye, Trash2, Check, Loader2, ChevronDown,
  LayoutGrid, BarChart3, PieChart, Activity, AlertTriangle,
  Hexagon, Map, GitBranch, Monitor, Sparkles, X, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import type {
  WidgetType, DashboardWidget, GridPosition, WidgetConfig,
} from "@/components/dashboard/types";
import { WIDGET_TYPES } from "@/components/dashboard/types";
import { getWidgetDefaultSize } from "@/components/dashboard/widget-registry";
import {
  useDashboards, useDashboard, useCreateDashboard, useUpdateDashboard, useDeleteDashboard,
} from "@/hooks/queries/use-dashboard";
import { Switch } from "@/components/ui/switch";
import { overviewTemplateWidgets, OVERVIEW_TEMPLATE_META } from "@/components/dashboard/templates/overview-template";
import { networkTemplateWidgets, NETWORK_TEMPLATE_META } from "@/components/dashboard/templates/network-template";
import { alertsTemplateWidgets, ALERTS_TEMPLATE_META } from "@/components/dashboard/templates/alerts-template";

import type { Layout, Layouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const DASHBOARD_TEMPLATES = [
  { meta: OVERVIEW_TEMPLATE_META, widgets: overviewTemplateWidgets },
  { meta: NETWORK_TEMPLATE_META, widgets: networkTemplateWidgets },
  { meta: ALERTS_TEMPLATE_META, widgets: alertsTemplateWidgets },
] as const;

// WidthProvider returns a class component whose @types/react version conflicts with the project's.
// We cast through unknown to satisfy Next.js dynamic() while keeping runtime behavior correct.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResponsiveGridLayout = dynamic(
  () =>
    import("react-grid-layout").then(
      (mod) => mod.WidthProvider(mod.Responsive) as unknown as React.ComponentType<any>,
    ),
  { ssr: false },
);

const WIDGET_META: Record<WidgetType, { label: string; description: string; icon: typeof LayoutGrid }> = {
  "stat-card":   { label: "Stat Card",     description: "Single metric with threshold colors",  icon: LayoutGrid },
  "time-series": { label: "Time Series",   description: "Line/area chart over time",            icon: Activity },
  "pie-chart":   { label: "Pie Chart",     description: "Distribution donut chart",             icon: PieChart },
  "top-n-bar":   { label: "Top N Bar",     description: "Ranked bar chart by metric",           icon: BarChart3 },
  "alert-feed":  { label: "Alert Feed",    description: "Live incident/alert stream",           icon: AlertTriangle },
  "honeycomb":   { label: "Honeycomb",     description: "Hex grid device status map",           icon: Hexagon },
  "map":         { label: "Map",           description: "Geographic device placement",          icon: Map },
  "topology":    { label: "Topology",      description: "Network topology diagram",             icon: GitBranch },
  "system-info": { label: "System Info",   description: "System uptime and health",             icon: Monitor },
  "ai-summary":  { label: "AI Summary",    description: "AI-generated network overview",        icon: Sparkles },
};

function defaultConfigForType(type: WidgetType): WidgetConfig {
  const map: Record<WidgetType, WidgetConfig> = {
    "stat-card":   { metric: "device_up_count", title: "Devices Up" },
    "time-series": { metricName: "cpu", timeRange: "6h" },
    "pie-chart":   { dataSource: "device_status" },
    "top-n-bar":   { metric: "cpu", count: 5 },
    "alert-feed":  { maxItems: 10 },
    "honeycomb":   {},
    "map":         {},
    "topology":    {},
    "system-info": {},
    "ai-summary":  {},
  };
  return map[type];
}

function defaultSizeForType(type: WidgetType): GridPosition {
  const registered = getWidgetDefaultSize(type);
  if (registered) return registered;
  const sizes: Record<WidgetType, GridPosition> = {
    "stat-card":   { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    "time-series": { x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    "pie-chart":   { x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    "top-n-bar":   { x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    "alert-feed":  { x: 0, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
    "honeycomb":   { x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    "map":         { x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
    "topology":    { x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
    "system-info": { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    "ai-summary":  { x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
  };
  return sizes[type];
}

export default function DashboardPage() {
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgetPanelOpen, setWidgetPanelOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [createMode, setCreateMode] = useState<"blank" | "template">("blank");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: dashboards, isLoading: dashboardsLoading } = useDashboards();
  const { data: activeDashboard } = useDashboard(selectedDashboardId);
  const createMutation = useCreateDashboard();
  const updateMutation = useUpdateDashboard();
  const deleteMutation = useDeleteDashboard();

  useEffect(() => {
    if (dashboards?.length && !selectedDashboardId) {
      const def = dashboards.find((d) => d.isDefault) ?? dashboards[0];
      setSelectedDashboardId(def.id);
    }
  }, [dashboards, selectedDashboardId]);

  useEffect(() => {
    if (!activeDashboard) return;
    const widgets: DashboardWidget[] = (activeDashboard.widgets ?? []).map((w) => ({
      id: w.id,
      type: w.widgetType as WidgetType,
      config: w.config as unknown as WidgetConfig,
      gridPosition: w.gridPosition as unknown as GridPosition,
    }));
    setLocalWidgets(widgets);
  }, [activeDashboard]);

  const debouncedSave = useCallback(
    (widgets: DashboardWidget[]) => {
      if (!selectedDashboardId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setSaveStatus("saving");
      saveTimerRef.current = setTimeout(() => {
        updateMutation.mutate(
          {
            id: selectedDashboardId,
            widgets: widgets.map((w) => ({
              widgetType: w.type,
              config: w.config as Record<string, unknown>,
              gridPosition: w.gridPosition as unknown as Record<string, unknown>,
            })),
          },
          {
            onSuccess: () => {
              setSaveStatus("saved");
              savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
            },
            onError: () => setSaveStatus("idle"),
          },
        );
      }, 1000);
    },
    [selectedDashboardId, updateMutation],
  );

  const handleLayoutChange = useCallback(
    (layout: Layout[]) => {
      if (!isEditMode) return;
      setLocalWidgets((prev) => {
        const updated = prev.map((widget) => {
          const item = layout.find((l) => l.i === widget.id);
          if (!item) return widget;
          return {
            ...widget,
            gridPosition: {
              ...widget.gridPosition,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
            },
          };
        });
        debouncedSave(updated);
        return updated;
      });
    },
    [isEditMode, debouncedSave],
  );

  const addWidget = useCallback(
    (type: WidgetType) => {
      const id = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const size = defaultSizeForType(type);
      const maxY = localWidgets.reduce((max, w) => Math.max(max, w.gridPosition.y + w.gridPosition.h), 0);
      const newWidget: DashboardWidget = {
        id,
        type,
        config: defaultConfigForType(type),
        gridPosition: { ...size, x: 0, y: maxY },
      };
      const next = [...localWidgets, newWidget];
      setLocalWidgets(next);
      debouncedSave(next);
      setWidgetPanelOpen(false);
    },
    [localWidgets, debouncedSave],
  );

  const removeWidget = useCallback(
    (widgetId: string) => {
      const next = localWidgets.filter((w) => w.id !== widgetId);
      setLocalWidgets(next);
      debouncedSave(next);
    },
    [localWidgets, debouncedSave],
  );

  const handleCreateDashboard = useCallback(() => {
    if (!newDashboardName.trim()) return;
    const tpl = createMode === "template" && selectedTemplate
      ? DASHBOARD_TEMPLATES.find((t) => t.meta.id === selectedTemplate)
      : null;
    const widgetsPayload = tpl
      ? tpl.widgets.map((w) => ({
          widgetType: w.type,
          config: w.config as Record<string, unknown>,
          gridPosition: w.gridPosition as unknown as Record<string, unknown>,
        }))
      : undefined;
    createMutation.mutate(
      { name: newDashboardName.trim(), widgets: widgetsPayload },
      {
        onSuccess: (created) => {
          setSelectedDashboardId(created.id);
          setCreateDialogOpen(false);
          setNewDashboardName("");
          setCreateMode("blank");
          setSelectedTemplate(null);
        },
      },
    );
  }, [newDashboardName, createMode, selectedTemplate, createMutation]);

  const handleDeleteDashboard = useCallback(() => {
    if (!selectedDashboardId) return;
    deleteMutation.mutate(selectedDashboardId, {
      onSuccess: () => {
        setSelectedDashboardId(null);
        setDeleteDialogOpen(false);
        setIsEditMode(false);
      },
    });
  }, [selectedDashboardId, deleteMutation]);

  const gridLayouts: Layouts = useMemo(() => {
    const lg: Layout[] = localWidgets.map((w) => ({
      i: w.id,
      x: w.gridPosition.x,
      y: w.gridPosition.y,
      w: w.gridPosition.w,
      h: w.gridPosition.h,
      minW: w.gridPosition.minW ?? 2,
      minH: w.gridPosition.minH ?? 2,
      static: !isEditMode,
    }));
    return { lg, md: lg, sm: lg };
  }, [localWidgets, isEditMode]);

  const currentDashboardName = dashboards?.find((d) => d.id === selectedDashboardId)?.name ?? "Dashboard";

  if (dashboardsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="truncate max-w-[160px]">{currentDashboardName}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {dashboards?.map((d) => (
                <DropdownMenuItem
                  key={d.id}
                  onClick={() => {
                    setSelectedDashboardId(d.id);
                    setIsEditMode(false);
                  }}
                  className={cn(d.id === selectedDashboardId && "bg-accent")}
                >
                  {d.name}
                  {d.isDefault && (
                    <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1">
                      Default
                    </Badge>
                  )}
                  {d.isShared && (
                    <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1">
                      Shared
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            data-testid="create-dashboard-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New
          </Button>

          {selectedDashboardId && (
            <>
              <div className="flex items-center gap-1.5">
                <Switch
                  id="share-toggle"
                  checked={dashboards?.find((d) => d.id === selectedDashboardId)?.isShared ?? false}
                  onCheckedChange={(checked) => {
                    updateMutation.mutate({ id: selectedDashboardId, isShared: checked });
                  }}
                  aria-label="Share dashboard"
                />
                <Label htmlFor="share-toggle" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                  <Share2 className="h-3 w-3" />
                  Share
                </Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </div>
          )}
          {saveStatus === "saved" && (
            <div className="flex items-center gap-1 text-xs text-emerald-500">
              <Check className="h-3 w-3" />
              Saved
            </div>
          )}

          {isEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWidgetPanelOpen(true)}
              data-testid="add-widget-btn"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Widget
            </Button>
          )}

          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditMode((prev) => !prev)}
            data-testid="edit-mode-toggle"
            className="hidden min-[376px]:inline-flex"
          >
            {isEditMode ? (
              <>
                <Eye className="h-3.5 w-3.5 mr-1" />
                View Mode
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </>
            )}
          </Button>
        </div>
      </div>

      {localWidgets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutGrid className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium mb-1">No widgets yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Switch to edit mode and add widgets to build your dashboard.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditMode(true);
                setWidgetPanelOpen(true);
              }}
              className="hidden min-[376px]:inline-flex"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Widget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={gridLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 0 }}
          cols={{ lg: 12, md: 8, sm: 4 }}
          rowHeight={60}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".react-grid-drag-handle"
          compactType="vertical"
          margin={[12, 12]}
        >
          {localWidgets.map((widget) => (
            <div key={widget.id} className={cn(isEditMode && "react-grid-drag-handle")}>
              <WidgetWrapper
                id={widget.id}
                type={widget.type}
                config={widget.config}
                isEditMode={isEditMode}
                onDelete={removeWidget}
              >
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  <div className="text-center">
                    <div className="mb-1">{WIDGET_META[widget.type]?.icon && (() => {
                      const Icon = WIDGET_META[widget.type].icon;
                      return <Icon className="h-6 w-6 mx-auto text-muted-foreground/40" />;
                    })()}</div>
                    <span className="text-xs">{WIDGET_META[widget.type]?.label ?? widget.type}</span>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Widget coming soon</p>
                  </div>
                </div>
              </WidgetWrapper>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      <Sheet open={widgetPanelOpen} onOpenChange={setWidgetPanelOpen}>
        <SheetContent side="right" className="w-80 sm:w-96 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add Widget</SheetTitle>
            <SheetDescription>Choose a widget type to add to your dashboard.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 mt-4">
            {WIDGET_TYPES.map((type) => {
              const meta = WIDGET_META[type];
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  onClick={() => addWidget(type)}
                  className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="rounded-md bg-muted p-2 shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{meta.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) { setCreateMode("blank"); setSelectedTemplate(null); setNewDashboardName(""); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Dashboard</DialogTitle>
            <DialogDescription>Start from scratch or pick a template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-name">Name</Label>
              <Input
                id="dashboard-name"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="My Dashboard"
                onKeyDown={(e) => e.key === "Enter" && handleCreateDashboard()}
              />
            </div>
            <div className="space-y-2">
              <Label>Start from</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setCreateMode("blank"); setSelectedTemplate(null); }}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                    createMode === "blank" && "border-primary bg-accent",
                  )}
                >
                  <div className="text-sm font-medium">Blank Dashboard</div>
                  <div className="text-xs text-muted-foreground">Start empty</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("template")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                    createMode === "template" && "border-primary bg-accent",
                  )}
                >
                  <div className="text-sm font-medium">From Template</div>
                  <div className="text-xs text-muted-foreground">Pre-built layouts</div>
                </button>
              </div>
            </div>
            {createMode === "template" && (
              <div className="grid gap-2">
                {DASHBOARD_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.meta.id}
                    type="button"
                    data-testid={`template-${tpl.meta.id}`}
                    onClick={() => setSelectedTemplate(tpl.meta.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                      selectedTemplate === tpl.meta.id && "border-primary bg-accent",
                    )}
                  >
                    <div className="rounded-md bg-muted p-2 shrink-0">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{tpl.meta.name}</div>
                      <div className="text-xs text-muted-foreground">{tpl.meta.description}</div>
                      <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1">
                        {tpl.meta.widgetCount} widgets
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateDashboard}
              disabled={!newDashboardName.trim() || (createMode === "template" && !selectedTemplate) || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dashboard</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{currentDashboardName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDashboard}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
