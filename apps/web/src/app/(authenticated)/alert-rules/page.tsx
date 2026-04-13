"use client";

import { useState, useMemo } from "react";
import { Plus, Bell, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type ColumnDef } from "@/components/shared";
import { FilterBar, type FilterDef } from "@/components/shared";
import { Pagination } from "@/components/shared";
import { EmptyState } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useAlertRules,
  useCreateAlertRule,
  useUpdateAlertRule,
  useDeleteAlertRule,
  type AlertRule,
  type AlertRuleFormData,
} from "@/hooks/queries/use-alert-rules";

const OPERATORS = [">", ">=", "<", "<=", "==", "!="] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const PAGE_SIZE = 20;

const severityStyle: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  metricName: z.string().min(1, "Metric is required"),
  operator: z.enum(OPERATORS),
  threshold: z.number({ invalid_type_error: "Must be a number" }),
  severity: z.enum(SEVERITIES),
  deviceId: z.string().uuid().optional().or(z.literal("")),
  enabled: z.boolean(),
});

export default function AlertRulesPage() {
  const { data: rules = [], isLoading } = useAlertRules();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);

  const filtered = useMemo(() => {
    let result = rules;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.metricName.toLowerCase().includes(q),
      );
    }
    if (severityFilter) result = result.filter((r) => r.severity === severityFilter);
    if (enabledFilter) result = result.filter((r) => String(r.enabled) === enabledFilter);
    return result;
  }, [rules, search, severityFilter, enabledFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleToggleEnabled = async (rule: AlertRule) => {
    try {
      await updateRule.mutateAsync({ id: rule.id, enabled: !rule.enabled });
      toast.success(`Rule ${rule.enabled ? "disabled" : "enabled"}`);
    } catch (err: any) {
      toast.error("Failed to update rule", err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      toast.success("Alert rule deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error("Failed to delete rule", err.message);
    }
  };

  const filters: FilterDef[] = [
    {
      id: "severity",
      label: "All Severities",
      options: SEVERITIES.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
      value: severityFilter,
    },
    {
      id: "enabled",
      label: "All Status",
      options: [
        { label: "Enabled", value: "true" },
        { label: "Disabled", value: "false" },
      ],
      value: enabledFilter,
    },
  ];

  const columns: ColumnDef<AlertRule>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      cell: (row) => <span className="text-xs font-medium">{row.name}</span>,
    },
    {
      id: "metric",
      header: "Metric",
      cell: (row) => <span className="text-xs text-muted-foreground font-mono">{row.metricName}</span>,
    },
    {
      id: "operator",
      header: "Operator",
      cell: (row) => <span className="text-xs font-mono">{row.operator}</span>,
      className: "w-20",
    },
    {
      id: "threshold",
      header: "Threshold",
      cell: (row) => <span className="text-xs font-mono">{row.threshold}</span>,
      className: "w-24",
    },
    {
      id: "severity",
      header: "Severity",
      cell: (row) => (
        <Badge variant="outline" className={cn("text-[10px] capitalize", severityStyle[row.severity])}>
          {row.severity}
        </Badge>
      ),
      className: "w-24",
    },
    {
      id: "enabled",
      header: "Enabled",
      cell: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleEnabled(row);
          }}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            row.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600",
          )}
          aria-label={`Toggle rule ${row.name}`}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
              row.enabled ? "translate-x-4.5" : "translate-x-0.5",
            )}
          />
        </button>
      ),
      className: "w-20",
    },
    {
      id: "actions",
      header: "Actions",
      className: "w-20 text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditRule(row);
            }}
            className="p-1 rounded hover:bg-muted"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Alert Rules</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} rules</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Rule
        </Button>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search rules..."
        filters={filters}
        onFilterChange={(id, value) => {
          if (id === "severity") setSeverityFilter(value);
          if (id === "enabled") setEnabledFilter(value);
          setPage(1);
        }}
        onClearFilters={() => {
          setSeverityFilter("");
          setEnabledFilter("");
          setPage(1);
        }}
      />

      {!isLoading && filtered.length === 0 && !search && !severityFilter && !enabledFilter ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="No alert rules yet"
          description="Create your first alert rule to start monitoring."
          action={{ label: "Add Rule", onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div data-testid="alert-rules-table">
          <DataTable
            columns={columns}
            data={paged}
            loading={isLoading}
            rowKey={(r) => r.id}
            emptyMessage="No rules match your filters"
          />
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
      />

      {showCreate && (
        <AlertRuleModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => setShowCreate(false)}
        />
      )}
      {editRule && (
        <AlertRuleModal
          rule={editRule}
          onClose={() => setEditRule(null)}
          onSuccess={() => setEditRule(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          rule={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteRule.isPending}
        />
      )}
    </div>
  );
}

/* ─── Create / Edit Modal ─── */

function AlertRuleModal({
  rule,
  onClose,
  onSuccess,
}: {
  rule?: AlertRule;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!rule;
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const toast = useToast();

  const [form, setForm] = useState({
    name: rule?.name ?? "",
    metricName: rule?.metricName ?? "",
    operator: rule?.operator ?? ">",
    threshold: rule?.threshold?.toString() ?? "",
    severity: rule?.severity ?? ("medium" as const),
    deviceId: rule?.deviceId ?? "",
    enabled: rule?.enabled ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const result = formSchema.safeParse({
      ...form,
      threshold: form.threshold === "" ? undefined : Number(form.threshold),
      deviceId: form.deviceId || undefined,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        const key = e.path[0]?.toString();
        if (key) fieldErrors[key] = e.message;
      });
      setErrors(fieldErrors);
      return null;
    }
    setErrors({});
    return result.data;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validate();
    if (!validated) return;

    const payload: AlertRuleFormData = {
      name: validated.name,
      metricName: validated.metricName,
      operator: validated.operator,
      threshold: validated.threshold,
      severity: validated.severity,
      enabled: validated.enabled,
      ...(validated.deviceId ? { deviceId: validated.deviceId } : {}),
    };

    setServerError("");
    try {
      if (isEdit) {
        await updateRule.mutateAsync({ id: rule!.id, ...payload });
        toast.success("Alert rule updated");
      } else {
        await createRule.mutateAsync(payload);
        toast.success("Alert rule created");
      }
      onSuccess();
    } catch (err: any) {
      setServerError(err.message);
      toast.error(isEdit ? "Failed to update rule" : "Failed to create rule", err.message);
    }
  };

  const loading = createRule.isPending || updateRule.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-md shadow-2xl shadow-black/20 border-border/50" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3">{isEdit ? "Edit Alert Rule" : "Create Alert Rule"}</h2>
          {serverError && (
            <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              {serverError}
            </div>
          )}
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8 text-sm focus-visible:ring-primary/40"
              />
              {errors.name && <p className="text-[10px] text-destructive">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Metric *</Label>
                <Input
                  required
                  value={form.metricName}
                  onChange={(e) => setForm({ ...form, metricName: e.target.value })}
                  placeholder="cpu_usage"
                  className="h-8 text-sm font-mono focus-visible:ring-primary/40"
                />
                {errors.metricName && <p className="text-[10px] text-destructive">{errors.metricName}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Operator *</Label>
                <select
                  value={form.operator}
                  onChange={(e) => setForm({ ...form, operator: e.target.value })}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Threshold *</Label>
                <Input
                  required
                  type="number"
                  step="any"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                  className="h-8 text-sm font-mono focus-visible:ring-primary/40"
                />
                {errors.threshold && <p className="text-[10px] text-destructive">{errors.threshold}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Severity</Label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as AlertRuleFormData["severity"] })}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Device ID (optional)</Label>
              <Input
                value={form.deviceId}
                onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
                placeholder="UUID"
                className="h-8 text-sm font-mono focus-visible:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, enabled: !form.enabled })}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  form.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                    form.enabled ? "translate-x-4.5" : "translate-x-0.5",
                  )}
                />
              </button>
              <Label className="text-xs">{form.enabled ? "Enabled" : "Disabled"}</Label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Delete Confirm Dialog ─── */

function DeleteConfirmDialog({
  rule,
  onConfirm,
  onCancel,
  loading,
}: {
  rule: AlertRule;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onCancel}>
      <Card className="w-full max-w-sm shadow-2xl shadow-black/20 border-border/50" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-2">Delete Alert Rule</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Are you sure you want to delete <span className="font-medium text-foreground">{rule.name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={onConfirm} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
