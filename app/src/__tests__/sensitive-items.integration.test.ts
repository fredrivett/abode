import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A sensitive item, end to end against Postgres: it's found by every list
 * (grid, search, room) but only ever as a redacted placeholder, and its
 * content comes back from the item endpoint only with a valid unlock cookie.
 */

const SECRET = "XSENSITIVESECRETX";

const h = vi.hoisted(() => {
  for (const key of [
    "OPENAI_API_KEY",
    "REPLICATE_API_TOKEN",
    "GOOGLE_CLOUD_CREDENTIALS",
    "JEV_API_KEY",
    "NEXT_PUBLIC_POSTHOG_KEY",
  ]) {
    delete process.env[key];
  }
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-test";
  return {
    ownerId: "",
    cookies: new Map<string, string>(),
  };
});

vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server")>()),
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: h.ownerId,
            email: "owner@example.com",
            user_metadata: {},
            app_metadata: {},
          },
        },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        }),
        listFactors: async () => ({ data: { totp: [], all: [] }, error: null }),
      },
    },
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      h.cookies.has(name) ? { name, value: h.cookies.get(name) } : undefined,
  }),
}));
vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: vi.fn(async () => ({ id: "run_test" })) },
}));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => null,
  captureServerException: vi.fn(),
}));

const ids = { sensitive: "", standard: "", room: "" };

beforeAll(async () => {
  const { write } = await import("@/lib/db");
  h.ownerId = crypto.randomUUID();
  await write.user.create({
    data: {
      id: h.ownerId,
      email: `owner-${h.ownerId}@example.com`,
      username: `owner_${h.ownerId.slice(0, 8)}`,
    },
  });

  const sensitive = await write.item.create({
    data: {
      userId: h.ownerId,
      kind: "document",
      processingStatus: "completed",
      sourceType: "upload",
      fileKey: `${h.ownerId}/${SECRET}-page.jpg`,
      title: `${SECRET} statement`,
      notes: `${SECRET} notes`,
      tags: [SECRET.toLowerCase()],
      privacy: "sensitive",
      meta: { width: 800, height: 1100, originalName: `${SECRET}.pdf` },
      imageDetails: {
        create: { ocrText: `Closing balance ${SECRET} account 0042` },
      },
    },
  });
  const standard = await write.item.create({
    data: {
      userId: h.ownerId,
      kind: "image",
      processingStatus: "completed",
      sourceType: "upload",
      fileKey: `${h.ownerId}/holiday.jpg`,
      title: "Holiday",
      tags: [SECRET.toLowerCase()],
    },
  });
  const room = await write.room.create({
    data: {
      userId: h.ownerId,
      name: "Everything",
      slug: "everything",
      type: "manual",
      visibility: "private",
    },
  });
  await write.roomItem.createMany({
    data: [
      { roomId: room.id, itemId: sensitive.id },
      { roomId: room.id, itemId: standard.id },
    ],
  });
  Object.assign(ids, {
    sensitive: sensitive.id,
    standard: standard.id,
    room: room.id,
  });
});

beforeEach(() => {
  h.cookies.clear();
});

async function getJson(
  route: string,
  {
    query = {},
    params = {},
  }: { query?: Record<string, string>; params?: Record<string, string> } = {},
) {
  const { join } = await import("node:path");
  const mod = await import(join(__dirname, "../app/api", route, "route.ts"));
  const url = new URL(`http://localhost/api/${route}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  const response: Response = await mod.GET(new NextRequest(url), {
    params: Promise.resolve(params),
  });
  return { status: response.status, response, text: await response.text() };
}

type ListedItem = { id: string; redacted?: boolean; title: string | null };

function listed(text: string, key = "items"): ListedItem[] {
  return JSON.parse(text)[key];
}

describe("sensitive items", () => {
  it("shows in the grid list as a redacted placeholder", async () => {
    const { status, text } = await getJson("v1/items");

    expect(status).toBe(200);
    expect(text).not.toContain(SECRET);
    const items = listed(text);
    expect(items.find((i) => i.id === ids.sensitive)).toMatchObject({
      redacted: true,
      title: null,
    });
    expect(items.find((i) => i.id === ids.standard)?.title).toBe("Holiday");
  });

  it("still matches a search, but comes back redacted", async () => {
    const { status, text } = await getJson("v1/search", {
      query: { q: `#${SECRET.toLowerCase()}` },
    });

    expect(status).toBe(200);
    const items = listed(text);
    expect(items.map((i) => i.id).sort()).toEqual(
      [ids.sensitive, ids.standard].sort(),
    );
    expect(items.find((i) => i.id === ids.sensitive)?.redacted).toBe(true);
    // The query echoes back in match reasons; the item's own content doesn't
    expect(text).not.toContain(`${SECRET} statement`);
    expect(text).not.toContain(`${SECRET} notes`);
    expect(text).not.toContain(`${SECRET}-page`);
  });

  it("never echoes a sensitive item's OCR text in search match reasons", async () => {
    const { status, text } = await getJson("v1/search", {
      query: { q: "closing balance" },
    });

    expect(status).toBe(200);
    expect(listed(text).map((i) => i.id)).toContain(ids.sensitive);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("0042");
  });

  it("shows in the owner's room as a redacted placeholder", async () => {
    const { status, text } = await getJson("v1/rooms/[id]/items", {
      params: { id: ids.room },
    });

    expect(status).toBe(200);
    expect(text).not.toContain(SECRET);
    expect(listed(text).find((i) => i.id === ids.sensitive)?.redacted).toBe(
      true,
    );
  });

  it("opens from the item endpoint only once unlocked", async () => {
    const {
      createUnlockToken,
      SENSITIVE_UNLOCK_COOKIE,
      SENSITIVE_UNLOCK_WINDOW_SECONDS,
    } = await import("@/lib/items/sensitive-unlock");

    const locked = await getJson("v1/items/[id]", {
      params: { id: ids.sensitive },
    });
    expect(locked.status).toBe(403);
    expect(locked.text).not.toContain(SECRET);

    h.cookies.set(
      SENSITIVE_UNLOCK_COOKIE,
      createUnlockToken({
        userId: h.ownerId,
        expiresAt: Date.now() + SENSITIVE_UNLOCK_WINDOW_SECONDS * 1000,
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      }),
    );
    const open = await getJson("v1/items/[id]", {
      params: { id: ids.sensitive },
    });
    expect(open.status).toBe(200);
    expect(JSON.parse(open.text).title).toBe(`${SECRET} statement`);
  });
});
