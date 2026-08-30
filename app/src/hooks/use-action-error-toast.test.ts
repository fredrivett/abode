import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActionErrorToast } from "./use-action-error-toast";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("useActionErrorToast", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("toasts the error when state carries one", () => {
    renderHook(() => useActionErrorToast({ error: "Bad password" }));
    expect(toast.error).toHaveBeenCalledWith("Bad password");
  });

  it("does nothing when there is no error", () => {
    renderHook(() => useActionErrorToast({}));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("re-toasts when a new state object carries an error again", () => {
    const { rerender } = renderHook(({ state }) => useActionErrorToast(state), {
      initialProps: { state: { error: "Rate limited" } },
    });
    expect(toast.error).toHaveBeenCalledTimes(1);

    // A fresh state object (as useActionState returns per submission) re-fires
    rerender({ state: { error: "Rate limited" } });
    expect(toast.error).toHaveBeenCalledTimes(2);
  });
});
