// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockItemFind, cookieJar } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFind: vi.fn(),
  cookieJar: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));
vi.mock("@/lib/db", () => ({
  default: { item: { findUnique: mockItemFind } },
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn() } }));
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
import { GET } from "./route";

const OWNER = "owner";

function get() {
  return GET(new Request("http://localhost/api/v1/items/item-1") as never, {
    params: Promise.resolve({ id: "item-1" }),
  });
}

function unlock() {
  cookieJar.set(
    SENSITIVE_UNLOCK_COOKIE,
    createUnlockToken({
      userId: OWNER,
      expiresAt: Date.now() + 60_000,
      secret: "service-role",
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/items/:id — sensitive items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    mockGetUser.mockResolvedValue({ data: { user: { id: OWNER } } });
  });

  it("serves a standard item without an unlock", async () => {
    mockItemFind.mockResolvedValue({ id: "item-1", privacy: "standard" });

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.cookies.get(SENSITIVE_UNLOCK_COOKIE)).toBeUndefined();
  });

  it("locks a sensitive item until the owner unlocks", async () => {
    mockItemFind.mockResolvedValue({
      id: "item-1",
      privacy: "sensitive",
      title: "Bank statement",
    });

    const res = await get();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ code: "sensitive_locked" });
    expect(JSON.stringify(body)).not.toContain("Bank statement");
  });

  it("serves an unlocked sensitive item uncached and restarts the window", async () => {
    unlock();
    mockItemFind.mockResolvedValue({
      id: "item-1",
      privacy: "sensitive",
      title: "Bank statement",
    });

    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: "Bank statement" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.cookies.get(SENSITIVE_UNLOCK_COOKIE)?.maxAge).toBe(120);
  });
});
