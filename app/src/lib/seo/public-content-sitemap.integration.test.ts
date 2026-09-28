/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { getIndexablePublicContentPaths } from "./public-content-sitemap";

describe("getIndexablePublicContentPaths", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async ({
    username,
    allowSearchIndexing,
  }: {
    username: string | null;
    allowSearchIndexing: boolean;
  }) => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@example.com`,
        username,
        allowSearchIndexing,
      },
    });
  };

  const createRoom = async ({
    userId,
    slug,
    visibility,
  }: {
    userId: string;
    slug: string | null;
    visibility: "private" | "public";
  }) => {
    const { write } = await import("@/lib/db");
    return write.room.create({
      data: {
        userId,
        name: slug ?? "untitled",
        type: "manual",
        slug,
        visibility,
      },
    });
  };

  it("lists opted-in users' profiles and public rooms only", async () => {
    const optedIn = await createUser({
      username: "fred",
      allowSearchIndexing: true,
    });
    await createRoom({
      userId: optedIn.id,
      slug: "books",
      visibility: "public",
    });
    await createRoom({
      userId: optedIn.id,
      slug: "diary",
      visibility: "private",
    });
    await createRoom({ userId: optedIn.id, slug: null, visibility: "public" });

    const optedOut = await createUser({
      username: "sam",
      allowSearchIndexing: false,
    });
    await createRoom({
      userId: optedOut.id,
      slug: "films",
      visibility: "public",
    });

    // Opted in but can't have a public URL yet
    await createUser({ username: null, allowSearchIndexing: true });

    const paths = await getIndexablePublicContentPaths({ limit: 100 });

    expect(paths.map(({ path }) => path)).toEqual(["/@fred", "/@fred/books"]);
    expect(
      paths.every(({ lastModified }) => lastModified instanceof Date),
    ).toBe(true);
  });

  it("caps rooms by what's left after profiles", async () => {
    const fred = await createUser({
      username: "fred",
      allowSearchIndexing: true,
    });
    const sam = await createUser({
      username: "sam",
      allowSearchIndexing: true,
    });
    await createRoom({ userId: fred.id, slug: "books", visibility: "public" });
    await createRoom({ userId: sam.id, slug: "films", visibility: "public" });

    const paths = await getIndexablePublicContentPaths({ limit: 3 });

    expect(paths.map(({ path }) => path)).toEqual([
      "/@fred",
      "/@sam",
      "/@fred/books",
    ]);
  });

  it("caps the number of paths", async () => {
    const user = await createUser({
      username: "fred",
      allowSearchIndexing: true,
    });
    await createRoom({ userId: user.id, slug: "books", visibility: "public" });

    const paths = await getIndexablePublicContentPaths({ limit: 1 });

    expect(paths.map(({ path }) => path)).toEqual(["/@fred"]);
  });
});
