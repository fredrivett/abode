import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersTable } from "./users-table";

// UsersTable reads the URL via next/navigation (SortableTableHead + pagination)
const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useSearchParams: () => nav.params,
}));

type UserRow = Parameters<typeof UsersTable>[0]["users"][number];

const baseUser: UserRow = {
  id: "user-1",
  email: "george@example.com",
  username: "george",
  firstName: "George",
  lastName: "Hatzis",
  avatarUrl: null,
  isAdmin: false,
  storageUsedBytes: "0",
  itemCount: 2,
  roomCount: 1,
  createdAt: "2026-02-12T00:00:00.000Z",
  lastActiveAt: "2026-07-20T00:00:00.000Z",
  lastItemAddedAt: "2026-07-18T00:00:00.000Z",
  usageToday: {
    actionCount: 5,
    costUsd: 0.12,
    monthCostUsd: 0.5,
    overDailyCap: false,
    overMonthlyCap: false,
  },
};

function renderTable(
  overrides: Partial<UserRow> = {},
  pagination = { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 },
) {
  return render(
    <UsersTable
      users={[{ ...baseUser, ...overrides }]}
      pagination={pagination}
    />,
  );
}

describe("UsersTable", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams();
  });

  it("links the username to the public profile", () => {
    renderTable();
    const link = screen.getByRole("link", { name: "@george" });
    expect(link).toHaveAttribute("href", "/@george");
  });

  it("renders a dash instead of a username link when username is null", () => {
    renderTable({ username: null });
    const profileLinks = screen
      .queryAllByRole("link")
      .filter((el) => el.getAttribute("href")?.startsWith("/@"));
    expect(profileLinks).toHaveLength(0);
  });

  it("renders populated date columns via DateTime, not a dash", () => {
    // Fully-populated row: username, storage, and all three dates are present,
    // so no cell should fall back to a dash. (Relative-time text itself is
    // DateTime's concern and is asserted in its own tests — checking it here
    // would depend on the current time and be flaky.)
    renderTable();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
  });

  it("falls back to a dash when last active / last item added are null", () => {
    renderTable({ lastActiveAt: null, lastItemAddedAt: null });
    // The two activity columns show "-" when there's no activity / no items
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves the active sort and search when paginating", () => {
    nav.params = new URLSearchParams("search=ada&sort=items&dir=desc");
    renderTable({}, { page: 1, pageSize: 20, totalCount: 40, totalPages: 2 });
    const next = screen.getByRole("link", { name: /next/i });
    const href = next.getAttribute("href") ?? "";
    expect(href).toContain("sort=items");
    expect(href).toContain("dir=desc");
    expect(href).toContain("search=ada");
    expect(href).toContain("page=2");
  });

  it("shows today's usage spend", () => {
    renderTable({
      usageToday: {
        actionCount: 7,
        costUsd: 1.5,
        monthCostUsd: 4.25,
        overDailyCap: false,
        overMonthlyCap: false,
      },
    });
    expect(screen.getByText(/\$1\.50/)).toBeInTheDocument();
  });

  it("shows month-to-date spend", () => {
    renderTable({
      usageToday: {
        actionCount: 7,
        costUsd: 1.5,
        monthCostUsd: 4.25,
        overDailyCap: false,
        overMonthlyCap: false,
      },
    });
    expect(screen.getByText(/\$4\.25/)).toBeInTheDocument();
  });

  it("renders a dash for month spend when there's none", () => {
    renderTable({
      usageToday: {
        actionCount: 0,
        costUsd: 0,
        monthCostUsd: 0,
        overDailyCap: false,
        overMonthlyCap: false,
      },
    });
    // Both the usage-today and month cells fall back to a dash.
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("reddens only the today cell for a daily over-cap", () => {
    renderTable({
      usageToday: {
        actionCount: 40,
        costUsd: 3,
        monthCostUsd: 3, // under the monthly cap
        overDailyCap: true,
        overMonthlyCap: false,
      },
    });
    expect(screen.getByTitle("Over daily cap")).toHaveClass("text-destructive");
    expect(screen.queryByTitle("Over monthly cap")).not.toBeInTheDocument();
  });

  it("reddens only the month cell for a month-only over-cap", () => {
    renderTable({
      usageToday: {
        actionCount: 1,
        costUsd: 0.05, // today is fine
        monthCostUsd: 6,
        overDailyCap: false,
        overMonthlyCap: true,
      },
    });
    expect(screen.getByTitle("Over monthly cap")).toHaveClass(
      "text-destructive",
    );
    // The "usage today" cell must NOT be reddened when only the month is over.
    expect(screen.queryByTitle("Over daily cap")).not.toBeInTheDocument();
  });
});
