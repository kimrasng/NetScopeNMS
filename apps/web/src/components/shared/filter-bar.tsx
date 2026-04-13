"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDef {
  id: string;
  label: string;
  options: FilterOption[];
  value: string;
}

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  onFilterChange?: (filterId: string, value: string) => void;
  onClearFilters?: () => void;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  onFilterChange,
  onClearFilters,
}: FilterBarProps) {
  const hasActiveFilters = filters?.some((f) => f.value !== "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearchChange != null && (
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm focus-visible:ring-primary/40 focus-visible:ring-2"
          />
        </div>
      )}
      {filters?.map((filter) => (
        <select
          key={filter.id}
          value={filter.value}
          onChange={(e) => onFilterChange?.(filter.id, e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 cursor-pointer"
        >
          <option value="">{filter.label}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {hasActiveFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
