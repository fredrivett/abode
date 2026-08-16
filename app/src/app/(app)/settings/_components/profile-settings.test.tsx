import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileSettings } from "./profile-settings";

const toastError = vi.fn();
const captureException = vi.fn();
const capture = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
  },
}));
vi.mock("posthog-js", () => ({
  default: {
    capture: (...args: unknown[]) => capture(...args),
    captureException: (...args: unknown[]) => captureException(...args),
  },
}));
vi.mock("../actions", () => ({
  requestEmailChange: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/components/avatar/user-avatar-setting", () => ({
  UserAvatarSetting: () => null,
}));

const setFirstName = vi.fn();
const setLastName = vi.fn();
vi.mock("@/stores/user-store", () => ({
  useUserStore: Object.assign(() => ({ setFirstName, setLastName }), {
    getState: () => ({ avatarUrl: null }),
  }),
}));
vi.mock("@/stores/milestone-store", () => ({
  useMilestoneStore: { getState: () => ({ markComplete: vi.fn() }) },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ProfileSettings visibility toggles", () => {
  it("reflects the initial toggle state from props", () => {
    render(<ProfileSettings showInvitedBy={false} showInvited={true} />);
    expect(
      screen.getByRole("switch", { name: "Show who invited you" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Show who you invited" }),
    ).toBeChecked();
  });

  it("defaults both toggles on when props are omitted", () => {
    render(<ProfileSettings />);
    expect(
      screen.getByRole("switch", { name: "Show who invited you" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Show who you invited" }),
    ).toBeChecked();
  });

  it("PATCHes the single field when a toggle is flipped off", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileSettings showInvitedBy={true} showInvited={true} />);

    fireEvent.click(
      screen.getByRole("switch", { name: "Show who invited you" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showInvitedBy: false }),
      }),
    );
    // Optimistic update sticks on success
    expect(
      screen.getByRole("switch", { name: "Show who invited you" }),
    ).not.toBeChecked();
    // The other toggle is untouched
    expect(
      screen.getByRole("switch", { name: "Show who you invited" }),
    ).toBeChecked();
  });

  it("reverts the toggle and surfaces an error when the request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileSettings showInvitedBy={true} showInvited={true} />);

    fireEvent.click(
      screen.getByRole("switch", { name: "Show who you invited" }),
    );

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // Reverted back to the original state
    expect(
      screen.getByRole("switch", { name: "Show who you invited" }),
    ).toBeChecked();
  });

  it("keeps each toggle's pending state independent while both are in flight", async () => {
    // Two deferred responses so we can resolve the toggles independently
    const deferreds: Array<(v: { ok: boolean }) => void> = [];
    const fetchMock = vi.fn(
      () => new Promise((resolve) => deferreds.push(resolve)),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileSettings showInvitedBy={true} showInvited={true} />);

    const invitedBy = screen.getByRole("switch", {
      name: "Show who invited you",
    });
    const invited = screen.getByRole("switch", {
      name: "Show who you invited",
    });

    fireEvent.click(invitedBy);
    fireEvent.click(invited);

    // Both requests in flight → both switches disabled
    await waitFor(() => expect(invitedBy).toBeDisabled());
    expect(invited).toBeDisabled();

    // Resolve only the first request
    deferreds[0]({ ok: true });

    // First re-enables; the second stays disabled because its PATCH is pending
    await waitFor(() => expect(invitedBy).toBeEnabled());
    expect(invited).toBeDisabled();

    deferreds[1]({ ok: true });
    await waitFor(() => expect(invited).toBeEnabled());
  });
});
