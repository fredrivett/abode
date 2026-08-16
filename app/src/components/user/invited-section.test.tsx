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
  it("renders the individual invited profiles", () => {
    render(<InvitedSection referrals={referrals} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Invited" }),
    ).toBeInTheDocument();
  });

  it("renders nothing when there are no referrals", () => {
    const { container } = render(<InvitedSection referrals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
