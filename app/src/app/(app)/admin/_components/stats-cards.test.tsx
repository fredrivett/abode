import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatUsd } from "@/lib/utils";
import { StatsCards } from "./stats-cards";

const totals = { users: 1, items: 2, rooms: 3, storageBytes: "0" };

function renderCards(
  usage: NonNullable<Parameters<typeof StatsCards>[0]["usage"]>,
) {
  return render(<StatsCards totals={totals} usage={usage} />);
}

const baseUsage = {
  totalCostUsd: 1,
  totalMonthCostUsd: 4,
  usersOverCap: 0,
  systemDailyLimitUsd: 10,
  enforced: false,
};

describe("StatsCards — cost cards", () => {
  it("shows system spend against the daily cap with % headroom", () => {
    renderCards(baseUsage);
    // "$1 of $10" today → 10% of the breaker.
    expect(
      screen.getByText(/10% of the system daily breaker/),
    ).toBeInTheDocument();
    expect(screen.getByText("AI Spend Today")).toBeInTheDocument();
  });

  it("flags the tripped state at/over the cap", () => {
    renderCards({ ...baseUsage, totalCostUsd: 10 });
    expect(
      screen.getByText(/system daily breaker tripped/),
    ).toBeInTheDocument();
  });

  it("renders month-to-date spend", () => {
    renderCards({ ...baseUsage, totalMonthCostUsd: 4.25 });
    expect(screen.getByText("AI Spend This Month")).toBeInTheDocument();
    expect(screen.getByText(formatUsd(4.25))).toBeInTheDocument();
  });

  it("shows enforcement state — Shadow when not enforced", () => {
    renderCards({ ...baseUsage, enforced: false });
    expect(screen.getByText("Shadow")).toBeInTheDocument();
    expect(
      screen.getByText(/counted \+ logged, not blocked/),
    ).toBeInTheDocument();
  });

  it("shows enforcement state — Enforced when enforced", () => {
    renderCards({ ...baseUsage, enforced: true });
    expect(screen.getByText("Enforced")).toBeInTheDocument();
    expect(
      screen.getByText(/over-cap actions are blocked/),
    ).toBeInTheDocument();
  });

  it("highlights users over cap", () => {
    // 7 avoids colliding with the totals cards (users/items/rooms = 1/2/3).
    renderCards({ ...baseUsage, usersOverCap: 7 });
    expect(screen.getByText("Users Over Cap")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
