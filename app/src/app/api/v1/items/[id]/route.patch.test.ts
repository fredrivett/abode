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
      excludeFromPublicRooms: false,
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
      excludeFromPublicRooms: false,
      tags: [],
      userTags: [],
      sharedAt: null,
    });

    const res = await patch({ notes: "just a note" });

    expect(res.status).toBe(200);
    expect(syncCalls()).toHaveLength(0);
  });
});
