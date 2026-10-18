import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Desktop: render the dialog (jsdom has no matchMedia)
vi.mock("usehooks-ts", () => ({ useMediaQuery: () => true }));

import { ApiClientError } from "@/lib/api-client";
import { SensitiveUnlockDialog } from "./sensitive-unlock-dialog";

function renderDialog(unlock: (password: string) => Promise<unknown>) {
  const onUnlocked = vi.fn();
  const onCancel = vi.fn();
  render(
    <SensitiveUnlockDialog
      open
      unlock={unlock}
      onUnlocked={onUnlocked}
      onCancel={onCancel}
    />,
  );
  return { onUnlocked, onCancel };
}

function submit(password: string) {
  fireEvent.change(screen.getByPlaceholderText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
}

describe("SensitiveUnlockDialog", () => {
  it("can't submit an empty password", () => {
    renderDialog(vi.fn());
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
  });

  it("unlocks with the entered password", async () => {
    const unlock = vi.fn().mockResolvedValue({ unlocked: true });
    const { onUnlocked } = renderDialog(unlock);

    submit("hunter2");

    await waitFor(() => expect(onUnlocked).toHaveBeenCalledOnce());
    expect(unlock).toHaveBeenCalledWith("hunter2");
  });

  it.each([
    [
      "a wrong password",
      new ApiClientError({
        message: "Incorrect password",
        status: 403,
        code: "incorrect_password",
      }),
      "Incorrect password",
    ],
    [
      "too many attempts",
      new ApiClientError({
        message: "Too many attempts. Please wait a minute and try again.",
        status: 429,
      }),
      "Too many attempts",
    ],
    [
      "an unexpected failure",
      new Error("network"),
      "Couldn't check your password",
    ],
  ])("explains %s and stays open", async (_, error, message) => {
    const { onUnlocked } = renderDialog(vi.fn().mockRejectedValue(error));

    submit("guess");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it("never opens the item when cancelled mid-check", async () => {
    let finish: () => void = () => {};
    const unlock = vi.fn(
      () => new Promise<void>((resolve) => (finish = () => resolve())),
    );
    const { onUnlocked, onCancel } = renderDialog(unlock);

    submit("hunter2");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    finish();

    await waitFor(() => expect(unlock).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it("cancels", () => {
    const { onCancel } = renderDialog(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
