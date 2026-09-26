import { afterEach, describe, expect, it } from "vitest";
import { currentUserValue, useUserStore } from "./user-store";

const admin = {
  userId: "user-a",
  firstName: "Ada",
  lastName: null,
  username: "ada",
  email: "a@example.com",
  avatarUrl: null,
  availableInvites: 3,
  isAdmin: true,
};

describe("useUserStore", () => {
  afterEach(() => useUserStore.getState().clearUser());

  it("hydrates an empty store", () => {
    useUserStore.getState().hydrateUser(admin);
    expect(useUserStore.getState()).toMatchObject(admin);
  });

  it("keeps client-side edits when the same user re-hydrates", () => {
    useUserStore.getState().hydrateUser(admin);
    useUserStore.getState().setFirstName("Augusta");
    useUserStore.getState().hydrateUser(admin);
    expect(useUserStore.getState().firstName).toBe("Augusta");
  });

  it("replaces the whole profile when a different user hydrates", () => {
    useUserStore.getState().hydrateUser(admin);
    useUserStore.getState().hydrateUser({
      userId: "user-b",
      username: "bob",
      availableInvites: 0,
      // Room pages don't pass isAdmin — it must not inherit the last user's
    });
    const state = useUserStore.getState();
    expect(state).toMatchObject({
      userId: "user-b",
      username: "bob",
      availableInvites: 0,
      isAdmin: undefined,
      firstName: undefined,
      email: undefined,
    });
  });

  it("clears everything on sign-out", () => {
    useUserStore.getState().hydrateUser(admin);
    useUserStore.getState().clearUser();
    expect(useUserStore.getState()).toMatchObject({
      userId: undefined,
      firstName: undefined,
      lastName: undefined,
      username: undefined,
      email: undefined,
      avatarUrl: undefined,
      availableInvites: undefined,
      isAdmin: undefined,
    });
  });
});

describe("currentUserValue", () => {
  afterEach(() => useUserStore.getState().clearUser());

  it("returns the store's value for the signed-in user, including null", () => {
    useUserStore.getState().hydrateUser({ ...admin, lastName: null });
    const state = useUserStore.getState();
    expect(
      currentUserValue({ state, userId: "user-a", key: "firstName" }),
    ).toBe("Ada");
    expect(
      currentUserValue({ state, userId: "user-a", key: "lastName" }),
    ).toBeNull();
  });

  it("ignores another user's leftover profile", () => {
    useUserStore.getState().hydrateUser(admin);
    const state = useUserStore.getState();
    expect(
      currentUserValue({ state, userId: "user-b", key: "firstName" }),
    ).toBeUndefined();
    expect(
      currentUserValue({ state, userId: undefined, key: "isAdmin" }),
    ).toBeUndefined();
  });
});
