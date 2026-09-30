import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountStats } from "./account-stats";

describe("AccountStats", () => {
  it("shows items, files and storage used", () => {
    render(
      <AccountStats
        itemCount={664}
        fileCount={823}
        storageUsedBytes={BigInt(817 * 1024 * 1024)}
      />,
    );

    expect(screen.getByText("664")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("823")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Storage used")).toBeInTheDocument();
  });

  it("uses the singular for one item and one file", () => {
    render(
      <AccountStats
        itemCount={1}
        fileCount={1}
        storageUsedBytes={BigInt(10)}
      />,
    );

    expect(screen.getByText("Item")).toBeInTheDocument();
    expect(screen.getByText("File")).toBeInTheDocument();
  });

  it("leaves the file count out when it couldn't be read", () => {
    render(
      <AccountStats
        itemCount={3}
        fileCount={null}
        storageUsedBytes={BigInt(10)}
      />,
    );

    expect(screen.queryByText(/^Files?$/)).toBeNull();
    expect(screen.getByText("Items")).toBeInTheDocument();
  });
});
