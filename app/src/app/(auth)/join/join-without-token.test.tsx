import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

import { JoinWithoutToken } from "./join-without-token";

const TOKEN = "test-invite_1";

function pasteLink(value: string) {
  fireEvent.change(screen.getByLabelText("invite link"), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "continue" }));
}

afterEach(() => push.mockReset());

describe("JoinWithoutToken", () => {
  it("explains invites arrive as an emailed link", () => {
    render(<JoinWithoutToken />);

    expect(
      screen.getByRole("heading", { level: 1, name: "join abode" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/invites arrive by email/)).toBeInTheDocument();
    expect(screen.queryByText(/invite code/)).not.toBeInTheDocument();
  });

  it("offers the waitlist inline for people without an invite", () => {
    render(<JoinWithoutToken />);

    expect(
      screen.getByRole("heading", { name: "no invite yet?" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("enter your email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "join waitlist" }),
    ).toBeInTheDocument();
  });

  it("keeps the login link", () => {
    render(<JoinWithoutToken />);

    expect(screen.getByRole("link", { name: "login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("disables continue until something is pasted", () => {
    render(<JoinWithoutToken />);

    expect(screen.getByRole("button", { name: "continue" })).toBeDisabled();
  });

  it("follows a pasted invite link", () => {
    render(<JoinWithoutToken />);

    pasteLink(`https://www.abode.fyi/join?token=${TOKEN}`);

    expect(push).toHaveBeenCalledWith(`/join?token=${TOKEN}`);
  });

  it("keeps the shared item from a share invite link", () => {
    render(<JoinWithoutToken />);

    pasteLink(`https://www.abode.fyi/join?token=${TOKEN}&save=item-123`);

    expect(push).toHaveBeenCalledWith(`/join?token=${TOKEN}&save=item-123`);
  });

  it("accepts a bare token", () => {
    render(<JoinWithoutToken />);

    pasteLink(` ${TOKEN} `);

    expect(push).toHaveBeenCalledWith(`/join?token=${TOKEN}`);
  });

  it("explains, without navigating, when the paste isn't an invite link", () => {
    render(<JoinWithoutToken />);

    pasteLink("someone@example.com");

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "that doesn't look like an invite link",
    );
    expect(screen.getByLabelText("invite link")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("clears the error once the paste is edited", () => {
    render(<JoinWithoutToken />);
    pasteLink("not a link");

    fireEvent.change(screen.getByLabelText("invite link"), {
      target: { value: TOKEN },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
