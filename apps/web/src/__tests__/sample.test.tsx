import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

function SampleComponent() {
  return <h1>NetPulse</h1>;
}

describe("SampleComponent", () => {
  it("renders heading", () => {
    render(<SampleComponent />);
    expect(screen.getByRole("heading", { name: "NetPulse" })).toBeInTheDocument();
  });
});
