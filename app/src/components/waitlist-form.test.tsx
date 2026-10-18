import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  __loaded: true,
  capture: vi.fn(),
  get_distinct_id: vi.fn(() => "anon-visitor-1"),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

import { WaitlistForm } from "./waitlist-form";

function submit(email = "someone@example.com") {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: email } });
  fireEvent.submit(
    screen.getByRole("textbox").closest("form") as HTMLFormElement,
  );
}

function stubFetch(response: { ok: boolean; body: unknown }) {
  const fetch = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: () => Promise.resolve(response.body),
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function sentBody(fetch: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetch.mock.calls[0][1].body);
}

afterEach(() => {
  vi.unstubAllGlobals();
  posthog.capture.mockReset();
  posthog.__loaded = true;
});

describe("WaitlistForm tracking", () => {
  it("sends the visitor's PostHog id and page so the server can record the join", async () => {
    const fetch = stubFetch({ ok: true, body: { position: 12 } });
    window.history.pushState({}, "", "/compare/mymind");
    render(<WaitlistForm />);

    submit();

    await screen.findByText("you're on the waitlist!");
    expect(sentBody(fetch)).toEqual({
      email: "someone@example.com",
      distinctId: "anon-visitor-1",
      sourcePath: "/compare/mymind",
    });
  });

  it("leaves the id out when PostHog isn't running (e.g. blocked)", async () => {
    posthog.__loaded = false;
    const fetch = stubFetch({ ok: true, body: { position: 12 } });
    render(<WaitlistForm />);

    submit();

    await screen.findByText("you're on the waitlist!");
    expect(sentBody(fetch)).not.toHaveProperty("distinctId");
  });

  it("doesn't capture the join in the browser (the server does)", async () => {
    stubFetch({ ok: true, body: { position: 12 } });
    render(<WaitlistForm />);

    submit();

    await screen.findByText("you're on the waitlist!");
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("shows the error when the request fails", async () => {
    stubFetch({ ok: false, body: { error: "Already on the waitlist" } });
    render(<WaitlistForm />);

    submit();

    await waitFor(() =>
      expect(screen.getByText("Already on the waitlist")).toBeInTheDocument(),
    );
  });
});
