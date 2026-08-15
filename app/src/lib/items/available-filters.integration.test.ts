/// <reference types="vitest/globals" />
import { resetTestDatabase } from "@app/vitest.setup.db";

const USER_A = "550e8400-e29b-41d4-a716-4466554400c1";
const USER_B = "550e8400-e29b-41d4-a716-4466554400c2";

async function seedUser(id: string, email: string) {
  const { write } = await import("@/lib/db");
  await write.user.create({ data: { id, email } });
}

describe("getAvailableFilters integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await seedUser(USER_A, "a@example.com");
    await seedUser(USER_B, "b@example.com");
  });

  it("returns sorted, deduped tags (auto + user), kinds, and sources for the user", async () => {
    const { write } = await import("@/lib/db");
    const { getAvailableFilters } = await import(
      "@/lib/items/available-filters"
    );

    await write.item.create({
      data: {
        userId: USER_A,
        kind: "article",
        sourceType: "url",
        tags: ["design", "ai"],
        userTags: ["fav", "ai"],
      },
    });

    const filters = await getAvailableFilters(USER_A);

    expect(filters.tag).toEqual(["ai", "design", "fav"]);
    expect(filters.type).toEqual(["article"]);
    expect(filters.source).toEqual(["url"]);
    // No image/location data seeded
    expect(filters.object).toEqual([]);
    expect(filters.color).toEqual([]);
    expect(filters.location).toEqual([]);
  });

  it("returns only the requested type when one is given", async () => {
    const { write } = await import("@/lib/db");
    const { getAvailableFilters } = await import(
      "@/lib/items/available-filters"
    );

    await write.item.create({
      data: {
        userId: USER_A,
        kind: "image",
        sourceType: "upload",
        tags: ["x"],
      },
    });

    const filters = await getAvailableFilters(USER_A, "tag");
    expect(filters).toEqual({ tag: ["x"] });
  });

  it("is scoped to the owner", async () => {
    const { write } = await import("@/lib/db");
    const { getAvailableFilters } = await import(
      "@/lib/items/available-filters"
    );

    await write.item.create({
      data: { userId: USER_B, sourceType: "upload", tags: ["secret"] },
    });

    const filters = await getAvailableFilters(USER_A);
    expect(filters.tag).toEqual([]);
  });
});
