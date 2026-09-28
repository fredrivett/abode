import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GITHUB_URL } from "@/lib/github";
import { X_URL } from "@/lib/social";
import { FooterClient } from "./client";

describe("FooterClient", () => {
  it("gives logged-out visitors links to compare, github and x", () => {
    render(<FooterClient isAuthenticated={false} />);

    expect(screen.getByRole("link", { name: "/compare" })).toHaveAttribute(
      "href",
      "/compare",
    );
    expect(screen.getByRole("link", { name: "github" })).toHaveAttribute(
      "href",
      GITHUB_URL,
    );
    expect(screen.getByRole("link", { name: "x" })).toHaveAttribute(
      "href",
      X_URL,
    );
  });

  it("keeps the footer to just the sign-off for signed-in users", () => {
    render(<FooterClient isAuthenticated />);

    expect(
      screen.queryByRole("navigation", { name: "more" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("abode")).toBeInTheDocument();
  });
});
