import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateTime } from "./date-time";

describe("DateTime", () => {
  it("renders the relative time in the trigger", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    render(<DateTime date={fiveMinutesAgo} />);
    expect(screen.getByText(/minutes ago/)).toBeInTheDocument();
  });

  it("accepts a string date", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    render(<DateTime date={oneHourAgo} />);
    expect(screen.getByText(/about 1 hour ago/)).toBeInTheDocument();
  });
});
