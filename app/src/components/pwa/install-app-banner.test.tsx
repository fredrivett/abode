import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InstallOption } from "@/hooks/use-install-option";
import { DISMISS_SNOOZE_MS, InstallAppBanner } from "./install-app-banner";

const { capture, promptInstall, option } = vi.hoisted(() => ({
  capture: vi.fn(),
  promptInstall: vi.fn(),
  option: { current: null as InstallOption },
}));
vi.mock("posthog-js", () => ({ default: { capture } }));
vi.mock("@/lib/pwa/install-prompt", () => ({ promptInstall }));
vi.mock("@/hooks/use-install-option", () => ({
  useInstallOption: () => option.current,
}));

const DISMISSED_AT_KEY = "abode:install-banner-dismissed-at";

describe("InstallAppBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    option.current = null;
  });

  it("renders nothing when there's no way to install", () => {
    render(<InstallAppBanner />);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("offers the native prompt and records the outcome", async () => {
    option.current = "prompt";
    promptInstall.mockResolvedValue("accepted");
    render(<InstallAppBanner />);
    expect(capture).toHaveBeenCalledWith("install_banner_shown", {
      option: "prompt",
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install" }));
    });
    expect(promptInstall).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith("install_prompt_result", {
      outcome: "accepted",
    });
  });

  it("snoozes when the native prompt is declined", async () => {
    option.current = "prompt";
    promptInstall.mockResolvedValue("dismissed");
    render(<InstallAppBanner />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install" }));
    });
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(localStorage.getItem(DISMISSED_AT_KEY)).not.toBeNull();
  });

  it("shows the Share steps on iOS, without an Install button", () => {
    option.current = "ios";
    render(<InstallAppBanner />);
    expect(screen.getByText("Add to Home Screen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });

  it("hides and snoozes on dismiss", () => {
    option.current = "ios";
    render(<InstallAppBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(localStorage.getItem(DISMISSED_AT_KEY)).not.toBeNull();
    expect(capture).toHaveBeenCalledWith("install_banner_dismissed", {
      option: "ios",
    });
  });

  it("stays hidden while snoozed", () => {
    option.current = "ios";
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    render(<InstallAppBanner />);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });

  it("comes back once the snooze runs out", () => {
    option.current = "ios";
    localStorage.setItem(
      DISMISSED_AT_KEY,
      String(Date.now() - DISMISS_SNOOZE_MS - 1),
    );
    render(<InstallAppBanner />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });
});
