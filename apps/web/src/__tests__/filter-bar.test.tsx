import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterBar, type FilterDef } from "@/components/shared/filter-bar";

describe("FilterBar", () => {
  it("renders search input with placeholder", () => {
    render(<FilterBar searchValue="" onSearchChange={vi.fn()} searchPlaceholder="Search devices..." />);
    expect(screen.getByPlaceholderText("Search devices...")).toBeInTheDocument();
  });

  it("calls onSearchChange when typing", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<FilterBar searchValue="" onSearchChange={onSearchChange} />);
    await user.type(screen.getByPlaceholderText("Search..."), "router");
    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange).toHaveBeenCalledTimes(6);
  });

  it("renders filter dropdowns", () => {
    const filters: FilterDef[] = [
      { id: "status", label: "Status", value: "", options: [{ label: "Up", value: "up" }, { label: "Down", value: "down" }] },
    ];
    render(<FilterBar filters={filters} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Up")).toBeInTheDocument();
    expect(screen.getByText("Down")).toBeInTheDocument();
  });

  it("calls onFilterChange when filter selection changes", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const filters: FilterDef[] = [
      { id: "status", label: "Status", value: "", options: [{ label: "Up", value: "up" }] },
    ];
    render(<FilterBar filters={filters} onFilterChange={onFilterChange} />);
    await user.selectOptions(screen.getByRole("combobox"), "up");
    expect(onFilterChange).toHaveBeenCalledWith("status", "up");
  });

  it("shows Clear filters button when a filter is active", () => {
    const filters: FilterDef[] = [
      { id: "status", label: "Status", value: "up", options: [{ label: "Up", value: "up" }] },
    ];
    render(<FilterBar filters={filters} onClearFilters={vi.fn()} />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("calls onClearFilters when Clear filters clicked", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    const filters: FilterDef[] = [
      { id: "status", label: "Status", value: "up", options: [{ label: "Up", value: "up" }] },
    ];
    render(<FilterBar filters={filters} onClearFilters={onClearFilters} />);
    await user.click(screen.getByText("Clear filters"));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("does not render search input when onSearchChange is not provided", () => {
    render(<FilterBar />);
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });
});
