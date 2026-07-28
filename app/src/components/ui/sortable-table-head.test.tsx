import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "./sortable-table-head";

const nav = vi.hoisted(() => ({
  pathname: "/admin/users",
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.params,
}));

function renderHead(column = "items") {
  return render(
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead column={column}>Items</SortableTableHead>
        </TableRow>
      </TableHeader>
    </Table>,
  );
}

function link() {
  return screen.getByRole("link", { name: /items/i });
}

describe("SortableTableHead", () => {
  beforeEach(() => {
    nav.pathname = "/admin/users";
    nav.params = new URLSearchParams();
  });

  it("links a fresh column to ascending sort", () => {
    renderHead();
    expect(link()).toHaveAttribute("href", "/admin/users?sort=items&dir=asc");
  });

  it("marks the header unsorted when it is not the active column", () => {
    nav.params = new URLSearchParams("sort=user&dir=asc");
    renderHead();
    expect(screen.getByRole("columnheader")).toHaveAttribute(
      "aria-sort",
      "none",
    );
  });

  it("cycles asc → desc when active ascending", () => {
    nav.params = new URLSearchParams("sort=items&dir=asc");
    renderHead();
    expect(screen.getByRole("columnheader")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(link()).toHaveAttribute("href", "/admin/users?sort=items&dir=desc");
  });

  it("cycles desc → unset when active descending", () => {
    nav.params = new URLSearchParams("sort=items&dir=desc");
    renderHead();
    expect(screen.getByRole("columnheader")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    // Unset removes sort/dir entirely
    const href = link().getAttribute("href");
    expect(href).not.toContain("sort=");
    expect(href).not.toContain("dir=");
  });

  it("preserves other params and resets the page", () => {
    nav.params = new URLSearchParams("search=ada&page=4&sort=user&dir=asc");
    renderHead();
    const href = link().getAttribute("href") ?? "";
    expect(href).toContain("search=ada");
    expect(href).toContain("sort=items");
    expect(href).not.toContain("page=");
  });

  it("renders the label inside the header", () => {
    renderHead();
    expect(
      within(screen.getByRole("columnheader")).getByText("Items"),
    ).toBeInTheDocument();
  });
});
