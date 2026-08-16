import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getMonogram,
  getMonogramColor,
  WebpageLinkCard,
} from "./webpage-link-card";

describe("getMonogram", () => {
  it("uses the first alphanumeric character, uppercased", () => {
    expect(getMonogram("fredrivett.com")).toBe("F");
    expect(getMonogram("news.ycombinator.com")).toBe("N");
    expect(getMonogram("3blue1brown.com")).toBe("3");
  });

  it("skips leading non-alphanumeric characters", () => {
    expect(getMonogram("-example.com")).toBe("E");
  });

  it("falls back to '?' when there is no alphanumeric", () => {
    expect(getMonogram("")).toBe("?");
    expect(getMonogram("---")).toBe("?");
  });
});

describe("getMonogramColor", () => {
  it("is deterministic for a given domain", () => {
    expect(getMonogramColor("stripe.com")).toBe(getMonogramColor("stripe.com"));
  });

  it("returns an hsl() string", () => {
    expect(getMonogramColor("stripe.com")).toMatch(/^hsl\(\d+ 55% 42%\)$/);
  });
});

describe("WebpageLinkCard", () => {
  it("shows the www-stripped domain and links to the source in a new tab", () => {
    render(<WebpageLinkCard url="https://www.fredrivett.com/about" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://www.fredrivett.com/about");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("fredrivett.com");
  });

  it("renders the domain monogram", () => {
    render(<WebpageLinkCard url="https://stripe.com" />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("renders the title and description when provided", () => {
    render(
      <WebpageLinkCard
        url="https://example.com"
        title="My page"
        description="A short summary"
      />,
    );
    expect(screen.getByText("My page")).toBeInTheDocument();
    expect(screen.getByText("A short summary")).toBeInTheDocument();
  });

  it("does not render a navigable link for a non-http(s) url", () => {
    // sourceUrl is untrusted — a javascript: scheme must never become an anchor
    render(<WebpageLinkCard url="javascript:alert(1)" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("omits the title and description when absent", () => {
    const { container } = render(<WebpageLinkCard url="https://example.com" />);
    // Only the monogram glyph and the domain link carry text
    expect(container).toHaveTextContent("E");
    expect(container).toHaveTextContent("example.com");
    expect(screen.queryByText("My page")).not.toBeInTheDocument();
  });
});
