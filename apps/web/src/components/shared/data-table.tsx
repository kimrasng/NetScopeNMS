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

  return (
    <Card className={className}>
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
                className="text-center py-10 text-xs text-muted-foreground"
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
                    {col.cell
                      ? col.cell(row)
                      : col.accessorFn
                        ? col.accessorFn(row)
                        : null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
