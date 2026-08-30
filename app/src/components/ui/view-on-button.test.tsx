import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ViewOnButton } from "./view-on-button";

describe("ViewOnButton", () => {
  it("renders a new-tab link to the source with the labelled text", () => {
    render(<ViewOnButton href="https://x.com/a/status/1" label="X" />);

    const link = screen.getByRole("link", { name: /view on x/i });
    expect(link).toHaveAttribute("href", "https://x.com/a/status/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
