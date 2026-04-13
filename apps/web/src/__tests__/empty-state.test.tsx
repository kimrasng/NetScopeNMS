import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "@/components/shared/empty-state";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No devices found" />);
    expect(screen.getByText("No devices found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Try adding a device" />);
    expect(screen.getByText("Try adding a device")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">📦</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    render(<EmptyState title="Empty" action={{ label: "Add Device", onClick: vi.fn() }} />);
    expect(screen.getByText("Add Device")).toBeInTheDocument();
  });

  it("calls action onClick when button clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: "Add", onClick }} />);
    await user.click(screen.getByText("Add"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not render action button when not provided", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
