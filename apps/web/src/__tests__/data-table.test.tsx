import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";

interface Row {
  id: string;
  name: string;
  status: string;
}

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name", accessorFn: (r) => r.name, sortable: true },
  { id: "status", header: "Status", cell: (r) => <span data-testid="status">{r.status}</span> },
];

const sampleData: Row[] = [
  { id: "1", name: "Router-A", status: "up" },
  { id: "2", name: "Switch-B", status: "down" },
  { id: "3", name: "Server-C", status: "up" },
];

describe("DataTable", () => {
  it("renders column headers", () => {
    render(<DataTable columns={columns} data={sampleData} rowKey={(r) => r.id} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders all data rows", () => {
    render(<DataTable columns={columns} data={sampleData} rowKey={(r) => r.id} />);
    expect(screen.getAllByText("Router-A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Switch-B").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Server-C").length).toBeGreaterThanOrEqual(1);
  });

  it("renders cell via cell function", () => {
    render(<DataTable columns={columns} data={sampleData} rowKey={(r) => r.id} />);
    const statuses = screen.getAllByTestId("status");
    expect(statuses.length).toBeGreaterThanOrEqual(3);
    expect(statuses[0]).toHaveTextContent("up");
    expect(statuses[1]).toHaveTextContent("down");
  });

  it("shows empty message when data is empty", () => {
    render(<DataTable columns={columns} data={[]} rowKey={(r) => r.id} />);
    expect(screen.getAllByText("No data found").length).toBeGreaterThanOrEqual(1);
  });

  it("shows custom empty message", () => {
    render(
      <DataTable columns={columns} data={[]} rowKey={(r) => r.id} emptyMessage="Nothing here" />
    );
    expect(screen.getAllByText("Nothing here").length).toBeGreaterThanOrEqual(1);
  });

  it("renders skeleton rows when loading", () => {
    const { container } = render(
      <DataTable columns={columns} data={[]} rowKey={(r) => r.id} loading />
    );
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThanOrEqual(5);
  });

  it("calls onSort when sortable header is clicked", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <DataTable columns={columns} data={sampleData} rowKey={(r) => r.id} onSort={onSort} />
    );
    await user.click(screen.getByText("Name"));
    expect(onSort).toHaveBeenCalledWith({ column: "name", direction: "asc" });
  });

  it("toggles sort direction on second click", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={sampleData}
        rowKey={(r) => r.id}
        onSort={onSort}
        sort={{ column: "name", direction: "asc" }}
      />
    );
    await user.click(screen.getByText("Name"));
    expect(onSort).toHaveBeenCalledWith({ column: "name", direction: "desc" });
  });

  it("does not call onSort for non-sortable column", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <DataTable columns={columns} data={sampleData} rowKey={(r) => r.id} onSort={onSort} />
    );
    await user.click(screen.getByText("Status"));
    expect(onSort).not.toHaveBeenCalled();
  });

  it("calls onRowClick when a row is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={sampleData}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />
    );
    await user.click(screen.getAllByText("Router-A")[0]);
    expect(onRowClick).toHaveBeenCalledWith(sampleData[0]);
  });
});
