import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, api: { post } };
});
const { capture, posthog } = vi.hoisted(() => {
  const capture = vi.fn();
  return {
    capture,
    posthog: {
      __loaded: false,
      capture,
      get_distinct_id: () => "anon-reader-1",
    },
  };
});
vi.mock("posthog-js", () => ({ default: posthog }));

import { ApiClientError } from "@/lib/api-client";
import { SaveToAbodeCta } from "./save-to-abode-cta";

const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE = "https://example.com/good-design";

function renderSignedOut(
  props: Partial<Parameters<typeof SaveToAbodeCta>[0]> = {},
) {
  return render(
    <SaveToAbodeCta
      itemId={ITEM_ID}
      sourceUrl={SOURCE}
      ownerUsername="fred"
      isSignedIn={false}
      invitesOpen
      {...props}
    />,
  );
}

function submit(email = "reader@example.com") {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: /Use invite/ }));
}

const assign = vi.fn();

beforeEach(() => {
  posthog.__loaded = false;
  post.mockReset();
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => vi.unstubAllGlobals());

describe("SaveToAbodeCta", () => {
  it("links signed-in readers straight to saving the article", () => {
    render(
      <SaveToAbodeCta
        itemId={ITEM_ID}
        sourceUrl={SOURCE}
        ownerUsername="fred"
        isSignedIn
        invitesOpen={false}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Save to your abode/ }),
    ).toHaveAttribute("href", `/save?url=${encodeURIComponent(SOURCE)}`);
  });

  it("renders nothing for signed-in readers when there's no link to save", () => {
    const { container } = render(
      <SaveToAbodeCta
        itemId={ITEM_ID}
        sourceUrl={null}
        ownerUsername="fred"
        isSignedIn
        invitesOpen={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers signed-out readers the sharer's invite", () => {
    renderSignedOut();
    expect(screen.getByText("Admit one")).toBeInTheDocument();
    expect(screen.getByText(/invite from/)).toBeInTheDocument();
    // The sharer links to their profile
    expect(screen.getByRole("link", { name: "@fred" })).toHaveAttribute(
      "href",
      "/@fred",
    );
    expect(
      screen.getByRole("button", { name: /Use invite/ }),
    ).toBeInTheDocument();
  });

  it("offers the waitlist when the sharer's invites aren't open", () => {
    renderSignedOut({ invitesOpen: false });
    expect(
      screen.getByRole("button", { name: /Join the waitlist/ }),
    ).toBeInTheDocument();
    // Never presented as an invite when there isn't one to give
    expect(screen.queryByText("Admit one")).not.toBeInTheDocument();
    expect(screen.queryByText(/invite from/)).not.toBeInTheDocument();
  });

  it("sends invited readers on to the join page", async () => {
    post.mockResolvedValue({
      status: "invited",
      joinPath: `/join?token=t&save=${ITEM_ID}`,
    });
    renderSignedOut();
    submit();

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(`/join?token=t&save=${ITEM_ID}`),
    );
    expect(post).toHaveBeenCalledWith("/api/v1/share-invites", {
      itemId: ITEM_ID,
      email: "reader@example.com",
    });
  });

  it("sends the reader's PostHog id so a waitlist fallback joins their visit", async () => {
    posthog.__loaded = true;
    post.mockResolvedValue({ status: "waitlisted" });
    renderSignedOut();
    submit();

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/v1/share-invites", {
        itemId: ITEM_ID,
        email: "reader@example.com",
        distinctId: "anon-reader-1",
      }),
    );
  });

  it("records which placement the reader used", async () => {
    post.mockResolvedValue({ status: "waitlisted" });
    renderSignedOut({ placement: "bottom" });
    submit();

    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith("share_cta_submitted", {
        item_id: ITEM_ID,
        placement: "bottom",
        outcome: "waitlisted",
      }),
    );
  });

  it("confirms a waitlist signup", async () => {
    post.mockResolvedValue({ status: "waitlisted" });
    renderSignedOut();
    submit();

    expect(
      await screen.findByText(/You're on the waitlist/),
    ).toBeInTheDocument();
  });

  it("sends existing users to log in and save", async () => {
    post.mockResolvedValue({ status: "has_account" });
    renderSignedOut();
    submit();

    const link = await screen.findByRole("link", { name: /Log in to save it/ });
    expect(link).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(`/save?url=${encodeURIComponent(SOURCE)}`)}`,
    );
  });

  it("shows the server's reason when the request fails", async () => {
    post.mockRejectedValue(
      new ApiClientError({
        message: "Please use a permanent email address",
        status: 400,
      }),
    );
    renderSignedOut();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please use a permanent email address",
    );
  });
});
