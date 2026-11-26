import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { releaseUserCaches } from "@/lib/pwa/session-caches";
import { useUserStore } from "@/stores/user-store";
import { AccountDeletedToast } from "./account-deleted-toast";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/lib/pwa/session-caches", () => ({
  releaseUserCaches: vi.fn(async () => {}),
}));

describe("AccountDeletedToast", () => {
  afterEach(() => {
    useUserStore.getState().clearUser();
    vi.mocked(releaseUserCaches).mockClear();
  });

  // The delete action redirects here itself, without the sign-out form
  it("forgets the deleted user, so their device data is cleared", () => {
    useUserStore.getState().hydrateUser({ userId: "deleted-user" });
    search = "account-deleted=true";
    render(<AccountDeletedToast />);
    expect(useUserStore.getState().userId).toBeUndefined();
    expect(releaseUserCaches).toHaveBeenCalledOnce();
  });

  // A full page load: nobody hydrated, so there's no sign-out to react to
  it("clears the device's data even when no user was hydrated", () => {
    search = "account-deleted=true";
    render(<AccountDeletedToast />);
    expect(releaseUserCaches).toHaveBeenCalledOnce();
  });

  it("leaves a signed-in user alone on a normal visit", () => {
    useUserStore.getState().hydrateUser({ userId: "user-a" });
    search = "";
    render(<AccountDeletedToast />);
    expect(useUserStore.getState().userId).toBe("user-a");
    expect(releaseUserCaches).not.toHaveBeenCalled();
  });
});
