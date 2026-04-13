import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "@/components/shared/pagination";

describe("Pagination", () => {
  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders Prev and Next buttons", () => {
    render(<Pagination page={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByText("Prev")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("disables Prev on first page", () => {
    render(<Pagination page={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByText("Prev")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("disables Next on last page", () => {
    render(<Pagination page={5} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByText("Prev")).not.toBeDisabled();
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange with page-1 when Prev clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    await user.click(screen.getByText("Prev"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with page+1 when Next clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    await user.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("shows page info text without totalItems", () => {
    render(<Pagination page={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
  });

  it("shows item range when totalItems and pageSize provided", () => {
    render(
      <Pagination page={2} totalPages={5} onPageChange={vi.fn()} totalItems={50} pageSize={10} />
    );
    expect(screen.getByText("11–20 of 50")).toBeInTheDocument();
  });
});
