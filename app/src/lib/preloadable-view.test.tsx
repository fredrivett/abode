import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { preloadableView } from "./preloadable-view";

function Greeting({ name }: { name: string }) {
  return <p>hello {name}</p>;
}

const loading = () => <p>loading…</p>;

describe("preloadableView", () => {
  it("shows the fallback until a not-yet-loaded view arrives", async () => {
    const View = preloadableView(async () => Greeting, { loading });
    render(<View name="ada" />);
    expect(screen.getByText("loading…")).toBeInTheDocument();
    expect(await screen.findByText("hello ada")).toBeInTheDocument();
  });

  it("renders a preloaded view immediately, with no fallback", async () => {
    const View = preloadableView(async () => Greeting, { loading });
    await View.preload();
    render(<View name="ada" />);
    expect(screen.getByText("hello ada")).toBeInTheDocument();
    expect(screen.queryByText("loading…")).not.toBeInTheDocument();
  });

  it("calls the loader once however often it's preloaded or rendered", async () => {
    const loader = vi.fn(async () => Greeting);
    const View = preloadableView(loader, { loading });
    await Promise.all([View.preload(), View.preload()]);
    render(<View name="ada" />);
    render(<View name="bob" />);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed preload", async () => {
    const loader = vi
      .fn<() => Promise<typeof Greeting>>()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValue(Greeting);
    const View = preloadableView(loader, { loading });
    await expect(View.preload()).rejects.toThrow("chunk failed");
    await act(() => View.preload());
    render(<View name="ada" />);
    expect(screen.getByText("hello ada")).toBeInTheDocument();
  });
});
