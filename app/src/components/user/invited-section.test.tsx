import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvitedSection } from "./invited-section";

const referrals = [
  {
    id: "1",
    username: "jane",
    firstName: "Jane",
    lastName: "Doe",
    avatarUrl: null,
  },
  {
    id: "2",
    username: "sam",
    firstName: "Sam",
    lastName: null,
    avatarUrl: null,
  },
];

describe("InvitedSection", () => {
  it("renders individual profiles when showProfiles is true", () => {
    render(<InvitedSection referrals={referrals} showProfiles={true} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    // No count text
    expect(screen.queryByText(/people$/)).not.toBeInTheDocument();
  });

  it("renders a pluralized count instead of profiles when showProfiles is false", () => {
    render(<InvitedSection referrals={referrals} showProfiles={false} />);
    expect(screen.getByText("2 people")).toBeInTheDocument();
    // Individual profiles are not surfaced
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });

  it("uses the singular form for a single invitee count", () => {
    render(
      <InvitedSection referrals={referrals.slice(0, 1)} showProfiles={false} />,
    );
    expect(screen.getByText("1 person")).toBeInTheDocument();
  });

  it("renders nothing when there are no referrals", () => {
    const { container } = render(
      <InvitedSection referrals={[]} showProfiles={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
