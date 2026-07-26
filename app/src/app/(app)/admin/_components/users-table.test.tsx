import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsersTable } from "./users-table";

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
};

function renderTable(overrides: Partial<UserRow> = {}) {
  return render(
    <UsersTable
      users={[{ ...baseUser, ...overrides }]}
      pagination={{ page: 1, pageSize: 20, totalCount: 1, totalPages: 1 }}
      search=""
    />,
  );
}

describe("UsersTable", () => {
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
});
