import { beforeEach, describe, expect, it, vi } from "vitest";

// P1 regression guard: changing a book's reading status must re-sync smart-room
// (incl. auto book shelf) membership. Reading-status writes weren't in
// `filterRelevantFieldsChanged`, so a finished book stayed in the Reading shelf.

const {
  mockGetUser,
  mockItemFind,
  mockItemUpdate,
  mockBookUpsert,
  mockArticleUpsert,
  mockArticleFind,
  mockTrigger,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFind: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockBookUpsert: vi.fn(),
  mockArticleUpsert: vi.fn(),
  mockArticleFind: vi.fn(),
  mockTrigger: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));

vi.mock("@/lib/db", () => ({
  default: {
    item: { findUnique: mockItemFind, update: mockItemUpdate },
    itemBookDetails: {
      upsert: mockBookUpsert,
      findUnique: vi.fn().mockResolvedValue(null),
    },
    itemArticleDetails: {
      upsert: mockArticleUpsert,
      findUnique: mockArticleFind,
    },
  },
}));

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mockTrigger } }));

const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
  }),
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/items/query", () => ({
  itemSelect: {},
  transformItem: (item: unknown) => item,
}));
vi.mock("@/lib/milestones", () => ({ markMilestoneComplete: vi.fn() }));
vi.mock("@/lib/milestones/conditions", () => ({
  shouldCompleteAddFirstTag: () => false,
  shouldCompleteSeeAiAnalysis: () => false,
}));
vi.mock("@/lib/twitter/cover", () => ({ resolveTweetCoverFileKey: vi.fn() }));
vi.mock("@/lib/items/delete-item", () => ({ deleteOwnedItem: vi.fn() }));

import {
  createUnlockToken,
  SENSITIVE_UNLOCK_COOKIE,
} from "@/lib/items/sensitive-unlock";
import { PATCH } from "./route";

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/v1/items/item-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "item-1" }) },
  );
}

const syncCalls = () =>
  mockTrigger.mock.calls.filter((c) => c[0] === "sync-item-to-rooms");

describe("PATCH /api/v1/items/:id — room sync on reading-status change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    mockItemUpdate.mockResolvedValue({ id: "item-1" });
    mockBookUpsert.mockResolvedValue({ itemId: "item-1", status: "read" });
  });

  it("re-syncs rooms when a book's reading status changes", async () => {
    mockItemFind.mockResolvedValue({
      id: "item-1",
      userId: "owner",
      kind: "book",
      sourceType: "url",
      privacy: "standard",
      tags: [],
      userTags: [],
      sharedAt: null,
    });

    const res = await patch({ bookReading: { status: "read" } });

    expect(res.status).toBe(200);
    expect(syncCalls()).toHaveLength(1);
    expect(syncCalls()[0][1]).toEqual({ itemId: "item-1", userId: "owner" });
  });

  it("does not re-sync rooms for a non-filter update (notes only)", async () => {
    mockItemFind.mockResolvedValue({
      id: "item-1",
      userId: "owner",
      kind: "book",
      sourceType: "url",
      privacy: "standard",
      tags: [],
      userTags: [],
      sharedAt: null,
    });

    const res = await patch({ notes: "just a note" });

    expect(res.status).toBe(200);
    expect(syncCalls()).toHaveLength(0);
  });
});

describe("PATCH /api/v1/items/:id — server-owned fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    mockItemUpdate.mockResolvedValue({ id: "item-1" });
    mockItemFind.mockResolvedValue({
      id: "item-1",
      userId: "owner",
      kind: "image",
      sourceType: "upload",
      privacy: "standard",
      tags: [],
      userTags: [],
      sharedAt: null,
    });
  });

  it("never writes storage keys, processing state, source or AI tags from the body", async () => {
    const res = await patch({
      title: "Renamed",
      fileKey: "victim/photo.jpg",
      coverFileKey: "victim/cover.jpg",
      processingStatus: "completed",
      sourceType: "url",
      sourceUrl: "https://example.com",
      meta: { size: 1 },
      tags: ["injected"],
    });

    expect(res.status).toBe(200);
    expect(mockItemUpdate).toHaveBeenCalledTimes(1);
    expect(mockItemUpdate.mock.calls[0][0].data).toEqual({
      title: "Renamed",
      titleEditedByUser: true,
    });
  });

  it("rejects an invalid title with 400 and writes nothing", async () => {
    const res = await patch({ title: "   " });

    expect(res.status).toBe(400);
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it.each(["unlisted", "sensitive"] as const)(
    "writes privacy %s and re-syncs rooms",
    async (privacy) => {
      const res = await patch({ privacy });

      expect(res.status).toBe(200);
      // Mirrored into the superseded column until the follow-up drops it
      expect(mockItemUpdate.mock.calls[0][0].data).toEqual({
        privacy,
        excludeFromPublicRooms: true,
      });
      expect(syncCalls()).toHaveLength(1);
    },
  );

  it("unlocks sensitive items when marking the open item sensitive", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    mockItemUpdate.mockResolvedValue({ id: "item-1", privacy: "sensitive" });

    const res = await patch({ privacy: "sensitive" });

    expect(res.status).toBe(200);
    expect(res.cookies.get(SENSITIVE_UNLOCK_COOKIE)?.maxAge).toBe(120);
  });

  it("redacts a locked owner's edit of a sensitive item", async () => {
    mockItemFind.mockResolvedValue({
      id: "item-1",
      userId: "owner",
      kind: "image",
      privacy: "sensitive",
      userTags: [],
    });
    mockItemUpdate.mockResolvedValue({
      id: "item-1",
      privacy: "sensitive",
      title: "Bank statement",
    });

    const res = await patch({ notes: "edited" });

    expect(res.status).toBe(200);
    // The edit applies; only the response is withheld
    expect(mockItemUpdate.mock.calls[0][0].data).toEqual({ notes: "edited" });
    expect(await res.json()).toMatchObject({ redacted: true, title: null });
    expect(res.cookies.get(SENSITIVE_UNLOCK_COOKIE)).toBeUndefined();
  });

  it("returns an unlocked owner's sensitive edit and restarts the window", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    cookieJar.set(
      SENSITIVE_UNLOCK_COOKIE,
      createUnlockToken({
        userId: "owner",
        expiresAt: Date.now() + 60_000,
        secret: "service-role",
      }),
    );
    mockItemFind.mockResolvedValue({
      id: "item-1",
      userId: "owner",
      kind: "image",
      privacy: "sensitive",
      userTags: [],
    });
    mockItemUpdate.mockResolvedValue({
      id: "item-1",
      privacy: "sensitive",
      title: "Bank statement",
    });

    const res = await patch({ notes: "edited" });

    expect(await res.json()).toMatchObject({ title: "Bank statement" });
    expect(res.cookies.get(SENSITIVE_UNLOCK_COOKIE)?.maxAge).toBe(120);
    cookieJar.clear();
  });

  it("does not re-sync rooms when privacy is unchanged", async () => {
    const res = await patch({ privacy: "standard" });

    expect(res.status).toBe(200);
    expect(syncCalls()).toHaveLength(0);
  });

  it("ignores the superseded excludeFromPublicRooms field", async () => {
    const res = await patch({ excludeFromPublicRooms: true });

    expect(res.status).toBe(200);
    expect(mockItemUpdate.mock.calls[0][0].data).toEqual({});
    expect(syncCalls()).toHaveLength(0);
  });
});
