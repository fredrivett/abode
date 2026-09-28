import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => vi.fn());
vi.mock("posthog-js", () => ({ default: { capture } }));

import { WaitlistForm } from "./waitlist-form";

function submit(email = "someone@example.com") {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: email } });
  fireEvent.submit(
    screen.getByRole("textbox").closest("form") as HTMLFormElement,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  capture.mockReset();
});

describe("WaitlistForm tracking", () => {
  it("records waitlist_joined with the page it was submitted from", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ position: 12 }),
      }),
    );
    window.history.pushState({}, "", "/compare/mymind");
    render(<WaitlistForm />);

    submit();

    await screen.findByText("you're on the waitlist!");
    expect(capture).toHaveBeenCalledWith("waitlist_joined", {
      source_path: "/compare/mymind",
    });
  });

  it("doesn't record a join when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Already on the waitlist" }),
      }),
    );
    render(<WaitlistForm />);

    submit();

    await waitFor(() =>
      expect(screen.getByText("Already on the waitlist")).toBeInTheDocument(),
    );
    expect(capture).not.toHaveBeenCalled();
  });
});
