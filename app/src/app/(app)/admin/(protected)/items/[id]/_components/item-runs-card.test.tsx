import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type ItemRunRow, ItemRunsCard } from "./item-runs-card";

const row = (over: Partial<ItemRunRow> = {}): ItemRunRow => ({
  id: "run_1",
  status: "COMPLETED",
  taskIdentifier: "analyze-image",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  startedAt: null,
  finishedAt: null,
  durationMs: 2000,
  costInCents: 1,
  parentRunId: null,
  indent: 0,
  href: "https://dash.example/runs/run_1",
  ...over,
});

describe("ItemRunsCard", () => {
  it("renders nothing when the integration isn't configured", () => {
    const { container } = render(
      <ItemRunsCard result={{ state: "not_configured" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an error message when loading failed", () => {
    render(<ItemRunsCard result={{ state: "error" }} />);
    expect(screen.getByText(/couldn't load runs/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no runs", () => {
    render(<ItemRunsCard result={{ state: "ok", runs: [] }} />);
    expect(screen.getByText(/no runs found/i)).toBeInTheDocument();
  });

  it("renders a row per run with a dashboard link", () => {
    render(<ItemRunsCard result={{ state: "ok", runs: [row()] }} />);
    expect(screen.getByText("analyze-image")).toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open run run_1 in trigger/i }),
    ).toHaveAttribute("href", "https://dash.example/runs/run_1");
  });

  it("omits the dashboard link when no href is available", () => {
    render(
      <ItemRunsCard result={{ state: "ok", runs: [row({ href: null })] }} />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("marks nested child runs and leaves roots unmarked", () => {
    render(
      <ItemRunsCard
        result={{
          state: "ok",
          runs: [
            row({ id: "root", taskIdentifier: "classify-url", indent: 0 }),
            row({ id: "child", taskIdentifier: "enrich-item", indent: 1 }),
          ],
        }}
      />,
    );
    // The child row carries the tree marker; the root row doesn't
    const rootCell = screen.getByText("classify-url").closest("span");
    const childCell = screen.getByText("enrich-item").closest("span");
    expect(rootCell?.textContent).not.toContain("└");
    expect(childCell?.textContent).toContain("└");
  });
});
