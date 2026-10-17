import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const validateInviteToken = vi.hoisted(() => vi.fn());
vi.mock("@/lib/invites", () => ({ validateInviteToken }));
vi.mock("@/lib/invites/share-invite", () => ({
  getSaveableSharedItem: vi.fn().mockResolvedValue(null),
}));
vi.mock("./join-without-token", () => ({
  JoinWithoutToken: () => <p>join without token</p>,
}));
vi.mock("./join-form", () => ({
  JoinForm: ({ token }: { token: string }) => <p>join form {token}</p>,
}));

import JoinPage from "./page";

async function renderPage(searchParams: { token?: string; save?: string }) {
  render(await JoinPage({ searchParams: Promise.resolve(searchParams) }));
}

afterEach(() => validateInviteToken.mockReset());

describe("JoinPage", () => {
  it("shows the invite link / waitlist view without a token", async () => {
    await renderPage({});

    expect(screen.getByText("join without token")).toBeInTheDocument();
    expect(validateInviteToken).not.toHaveBeenCalled();
  });

  it("shows the signup form for a valid token", async () => {
    validateInviteToken.mockResolvedValue({
      valid: true,
      invite: { email: "new@example.com", origin: "waitlist", inviter: null },
    });

    await renderPage({ token: "tok_1" });

    expect(screen.getByText("join form tok_1")).toBeInTheDocument();
    expect(screen.queryByText("join without token")).not.toBeInTheDocument();
  });

  it("points an unknown token back to a different invite link", async () => {
    validateInviteToken.mockResolvedValue({
      valid: false,
      code: "INVALID_TOKEN",
    });

    await renderPage({ token: "nope" });

    expect(
      screen.getByRole("link", { name: "use a different invite link" }),
    ).toHaveAttribute("href", "/join");
  });
});
