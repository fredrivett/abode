import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PostedDateFooter } from "./posted-date-footer";

describe("PostedDateFooter", () => {
  it("renders the date and a view-on link when postedAt is set", () => {
    render(
      <PostedDateFooter
        postedAt="2024-03-01T12:00:00Z"
        viewOnHref="https://x.com/a/status/1"
        viewOnLabel="X"
      />,
    );

    expect(screen.getByRole("link", { name: /view on x/i })).toHaveAttribute(
      "href",
      "https://x.com/a/status/1",
    );
    // DateTime renders the past date as relative "… ago" text
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });

  it("omits the date but keeps the link when postedAt is absent", () => {
    render(
      <PostedDateFooter
        postedAt={null}
        viewOnHref="https://instagram.com/p/abc"
        viewOnLabel="Instagram"
      />,
    );

    expect(
      screen.getByRole("link", { name: /view on instagram/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ago/i)).toBeNull();
  });
});
