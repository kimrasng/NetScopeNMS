"use client";

import { type ReactNode } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorFn?: (row: T) => ReactNode;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  /** Show this column in mobile card view. First 3 columns shown by default if none specified. */
  mobileVisible?: boolean;
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  column: string;
  direction: SortDirection;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onSort?: (sort: SortState) => void;
  sort?: SortState;
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}

function SkeletonRows({ colCount, rowCount = 5 }: { colCount: number; rowCount?: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: colCount }).map((_, j) => (
            <TableCell key={j}>
              <div
                className="h-3 rounded bg-muted animate-pulse"
                style={{ width: `${50 + Math.random() * 40}%` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function MobileSkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-3">
          <div className="space-y-2">
            <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function renderCellValue<T>(col: ColumnDef<T>, row: T): ReactNode {
  if (col.cell) return col.cell(row);
  if (col.accessorFn) return col.accessorFn(row);
  return null;
}

function getMobileColumns<T>(columns: ColumnDef<T>[]): ColumnDef<T>[] {
  const explicit = columns.filter((c) => c.mobileVisible === true);
  if (explicit.length > 0) return explicit;
  // Default: first 3 non-action columns
  return columns.filter((c) => c.id !== "actions").slice(0, 3);
}

export function DataTable<T>({
  columns,
  data,
  onSort,
  sort,
  loading,
  emptyMessage = "No data found",
  rowKey,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const handleSort = (col: ColumnDef<T>) => {
    if (!col.sortable || !onSort) return;
    const direction: SortDirection =
      sort?.column === col.id && sort.direction === "asc" ? "desc" : "asc";
    onSort({ column: col.id, direction });
  };

  const renderSortIcon = (col: ColumnDef<T>) => {
    if (!col.sortable) return null;
    if (sort?.column !== col.id) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sort.direction === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const mobileColumns = getMobileColumns(columns);
  const actionCol = columns.find((c) => c.id === "actions");

  return (
    <>
      {/* ── Desktop table (md+) ── */}
      <Card className={cn("hidden md:block", className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.sortable && onSort && "cursor-pointer select-none",
                    col.className,
                  )}
                  onClick={() => handleSort(col)}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    {renderSortIcon(col)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows colCount={columns.length} />
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-6 text-xs text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  className={cn(
                    "hover:bg-accent/50 transition-colors",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} className={col.className}>
                      {renderCellValue(col, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Mobile card view (<md) ── */}
      <div className={cn("block md:hidden", className)}>
        {loading ? (
          <MobileSkeletonCards />
        ) : data.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </Card>
        ) : (
          <div className="space-y-2">
            {data.map((row) => (
              <Card
                key={rowKey(row)}
                className={cn(
                  "p-3 transition-colors",
                  onRowClick && "cursor-pointer active:bg-accent/50",
                )}
                onClick={() => onRowClick?.(row)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    {mobileColumns.map((col, idx) => (
                      <div key={col.id} className={idx === 0 ? "text-sm font-medium" : "text-xs text-muted-foreground"}>
                        {idx > 0 && (
                          <span className="text-muted-foreground/60 mr-1">{col.header}:</span>
                        )}
                        {renderCellValue(col, row)}
                      </div>
                    ))}
                  </div>
                  {actionCol && (
                    <div className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                      {renderCellValue(actionCol, row)}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
