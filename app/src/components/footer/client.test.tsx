import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FooterClient } from "./client";

describe("FooterClient", () => {
  it("links logged-out visitors to the comparison pages", () => {
    render(<FooterClient isAuthenticated={false} />);
    expect(screen.getByRole("link", { name: "compare abode" })).toHaveAttribute(
      "href",
      "/vs",
    );
  });

  it("keeps the footer minimal for signed-in users", () => {
    render(<FooterClient isAuthenticated />);
    expect(
      screen.queryByRole("link", { name: "compare abode" }),
    ).not.toBeInTheDocument();
  });
});
