import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/stores/user-store";
import { SignOutForm } from "./sign-out-form";

describe("SignOutForm", () => {
  afterEach(() => useUserStore.getState().clearUser());

  it("clears the signed-in user's client state and runs the sign-out action", async () => {
    useUserStore.getState().hydrateUser({ userId: "user-a", isAdmin: true });
    const action = vi.fn(async () => {});
    render(
      <SignOutForm action={action}>
        <button type="submit">Sign out</button>
      </SignOutForm>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(useUserStore.getState()).toMatchObject({
      userId: undefined,
      isAdmin: undefined,
    });
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
  });

  it("leaves client state alone when a caller cancels the submit", () => {
    useUserStore.getState().hydrateUser({ userId: "user-a", isAdmin: true });
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <SignOutForm onSubmit={onSubmit}>
        <button type="submit">Sign out</button>
      </SignOutForm>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(useUserStore.getState().userId).toBe("user-a");
  });
});
