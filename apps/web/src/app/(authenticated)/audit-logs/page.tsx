"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/shared";
import { FilterBar, type FilterDef } from "@/components/shared";
import { Pagination } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { useAuditLogs, type AuditLogEntry } from "@/hooks/queries/use-audit-logs";

const ACTION_OPTIONS = [
  "create", "update", "delete", "login", "logout", "acknowledge", "resolve",
].map((a) => ({ label: a, value: a }));

const RESOURCE_OPTIONS = [
  "device", "incident", "alert_rule", "user", "notification_channel",
  "config_snapshot", "maintenance_window", "api_key", "report", "dashboard",
].map((r) => ({ label: r.replace("_", " "), value: r }));

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

function DetailsCell({ details }: { details: unknown }) {
  const [open, setOpen] = useState(false);
  if (!details) return <span className="text-muted-foreground">—</span>;

  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Hide" : "View"}
      </button>
      {open && (
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px] leading-relaxed">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}

const columns: ColumnDef<AuditLogEntry>[] = [
  {
    id: "createdAt",
    header: "Timestamp",
    sortable: true,
    className: "whitespace-nowrap",
    cell: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>,
  },
  {
    id: "userId",
    header: "User",
    cell: (row) => (
      <span className="text-xs font-mono">{row.userId ? row.userId.slice(0, 8) + "…" : "system"}</span>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: (row) => <Badge variant="outline" className="text-[11px]">{row.action}</Badge>,
  },
  {
    id: "resource",
    header: "Resource",
    cell: (row) => <span className="text-xs">{row.resource}</span>,
  },
  {
    id: "resourceId",
    header: "Resource ID",
    cell: (row) => (
      <span className="text-xs font-mono text-muted-foreground">
        {row.resourceId ? row.resourceId.slice(0, 8) + "…" : "—"}
      </span>
    ),
  },
  {
    id: "ipAddress",
    header: "IP Address",
    cell: (row) => <span className="text-xs font-mono text-muted-foreground">{row.ipAddress || "—"}</span>,
  },
  {
    id: "details",
    header: "Details",
    cell: (row) => <DetailsCell details={row.details} />,
  },
];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data, isLoading } = useAuditLogs({
    action: actionFilter || undefined,
    resource: resourceFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    page,
    limit: 50,
  });

  const filters: FilterDef[] = [
    { id: "action", label: "All Actions", options: ACTION_OPTIONS, value: actionFilter },
    { id: "resource", label: "All Resources", options: RESOURCE_OPTIONS, value: resourceFilter },
  ];

  const handleFilterChange = (id: string, value: string) => {
    setPage(1);
    if (id === "action") setActionFilter(value);
    if (id === "resource") setResourceFilter(value);
  };

  const clearFilters = () => {
    setPage(1);
    setActionFilter("");
    setResourceFilter("");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <FileText className="h-5 w-5" /> Audit Logs
        </h1>
        <p className="text-xs text-muted-foreground">
          {data?.pagination.total ?? 0} entries
        </p>
      </div>

      <div className="space-y-2">
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
        />
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      <div data-testid="audit-logs-table">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          rowKey={(row) => row.id}
          emptyMessage="No audit log entries found"
        />
      </div>

      <Pagination
        page={page}
        totalPages={data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        totalItems={data?.pagination.total}
        pageSize={50}
      />
    </div>
  );
}
