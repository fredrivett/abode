import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TopSpender } from "@/lib/admin/usage-stats";
import { TopSpendersTable } from "./top-spenders-table";

const spender = (over: Partial<TopSpender> = {}): TopSpender => ({
  userId: "u1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  username: "ada",
  monthCostUsd: 2.5,
  ...over,
});

describe("TopSpendersTable", () => {
  it("shows an empty state when there's no spend", () => {
    render(<TopSpendersTable spenders={[]} />);
    expect(screen.getByText("No spend yet this month")).toBeInTheDocument();
  });

  it("renders a ranked row linking to the user detail page", () => {
    render(<TopSpendersTable spenders={[spender()]} />);
    const link = screen.getByRole("link", { name: "Ada Lovelace" });
    expect(link).toHaveAttribute("href", "/admin/users/u1");
    expect(screen.getByText(/\$2\.50/)).toBeInTheDocument();
  });

  it("falls back to username, then email, when no name is set", () => {
    const { rerender } = render(
      <TopSpendersTable
        spenders={[spender({ firstName: null, lastName: null })]}
      />,
    );
    expect(screen.getByRole("link", { name: "ada" })).toBeInTheDocument();

    rerender(
      <TopSpendersTable
        spenders={[
          spender({ firstName: null, lastName: null, username: null }),
        ]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "ada@example.com" }),
    ).toBeInTheDocument();
  });

  it("numbers rows by rank order", () => {
    render(
      <TopSpendersTable
        spenders={[
          spender({ userId: "a", monthCostUsd: 5 }),
          spender({ userId: "b", monthCostUsd: 3 }),
        ]}
      />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
