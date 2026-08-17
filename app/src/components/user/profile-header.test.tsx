import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileHeader } from "./profile-header";

const baseProps = {
  username: "fr",
  firstName: "Fred",
  lastName: "Rivett",
  website: "https://fredrivett.com",
  bio: null,
  avatarUrl: null,
  // Local mid-month date so the formatted month is timezone-independent
  createdAt: new Date(2025, 11, 15),
  memberNumber: 1,
  showInvitedBy: false,
  referredBy: null,
  showInvited: true,
  referralCount: 0,
};

describe("ProfileHeader", () => {
  it("renders member number and join date", () => {
    render(<ProfileHeader {...baseProps} />);
    expect(screen.getByText("Member #00001")).toBeInTheDocument();
    expect(screen.getByText("Joined December 2025")).toBeInTheDocument();
  });

  it("renders the website as a link to the given URL", () => {
    render(<ProfileHeader {...baseProps} />);
    const link = screen.getByRole("link", { name: /fredrivett\.com/ });
    expect(link).toHaveAttribute("href", "https://fredrivett.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("omits the website when none is set", () => {
    render(<ProfileHeader {...baseProps} website={null} />);
    expect(screen.queryByRole("link", { name: /\./ })).not.toBeInTheDocument();
  });

  it("renders the bio when set", () => {
    render(<ProfileHeader {...baseProps} bio="Building things on the web." />);
    expect(screen.getByText("Building things on the web.")).toBeInTheDocument();
  });

  it("omits the bio when none is set", () => {
    render(<ProfileHeader {...baseProps} bio={null} />);
    expect(
      screen.queryByText("Building things on the web."),
    ).not.toBeInTheDocument();
  });

  it("omits the member row when there is no member number", () => {
    render(<ProfileHeader {...baseProps} memberNumber={null} />);
    expect(screen.queryByText(/^Member #/)).not.toBeInTheDocument();
    expect(screen.getByText("Joined December 2025")).toBeInTheDocument();
  });

  it("shows 'Invited by' with the inviter when enabled", () => {
    render(
      <ProfileHeader
        {...baseProps}
        showInvitedBy={true}
        referredBy={{
          username: "jane",
          firstName: "Jane",
          lastName: "Doe",
          avatarUrl: null,
        }}
      />,
    );
    expect(screen.getByText("Invited by")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("hides 'Invited by' when the toggle is off", () => {
    render(
      <ProfileHeader
        {...baseProps}
        showInvitedBy={false}
        referredBy={{
          username: "jane",
          firstName: "Jane",
          lastName: "Doe",
          avatarUrl: null,
        }}
      />,
    );
    expect(screen.queryByText("Invited by")).not.toBeInTheDocument();
  });

  it("renders the inline invited count when profiles are hidden", () => {
    render(
      <ProfileHeader {...baseProps} showInvited={false} referralCount={2} />,
    );
    expect(screen.getByText("Invited 2 people")).toBeInTheDocument();
  });

  it("uses the singular noun for a single invitee", () => {
    render(
      <ProfileHeader {...baseProps} showInvited={false} referralCount={1} />,
    );
    expect(screen.getByText("Invited 1 person")).toBeInTheDocument();
  });

  it("does not render the inline count when profiles are shown", () => {
    render(
      <ProfileHeader {...baseProps} showInvited={true} referralCount={3} />,
    );
    expect(screen.queryByText(/^Invited \d/)).not.toBeInTheDocument();
  });

  it("does not render the inline count when there are no referrals", () => {
    render(
      <ProfileHeader {...baseProps} showInvited={false} referralCount={0} />,
    );
    expect(screen.queryByText(/^Invited \d/)).not.toBeInTheDocument();
  });
});
