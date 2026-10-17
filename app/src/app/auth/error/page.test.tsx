import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthErrorPage from "./page";

async function renderPage(reason?: string) {
  render(await AuthErrorPage({ searchParams: Promise.resolve({ reason }) }));
}

const inviteLink = () =>
  screen.queryByRole("link", { name: "use a different invite link" });

describe("AuthErrorPage", () => {
  it.each(["INVALID_TOKEN", "INVITE_USED"])(
    "offers login and another invite link for %s",
    async (reason) => {
      await renderPage(reason);

      expect(screen.getByRole("link", { name: "go to login" })).toBeVisible();
      expect(inviteLink()).toHaveAttribute("href", "/join");
    },
  );

  it("offers the waitlist and another invite link for an expired invite", async () => {
    await renderPage("INVITE_EXPIRED");

    expect(
      screen.getByRole("link", { name: "join the waitlist" }),
    ).toBeVisible();
    expect(inviteLink()).toHaveAttribute("href", "/join");
  });

  it.each(["missing_params", "verification_failed", "no_user", undefined])(
    "doesn't mention invites for email-verification failure %s",
    async (reason) => {
      await renderPage(reason);

      expect(screen.getByRole("link", { name: "go to login" })).toBeVisible();
      expect(inviteLink()).not.toBeInTheDocument();
    },
  );
});
