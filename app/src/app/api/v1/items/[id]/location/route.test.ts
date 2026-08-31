import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockItemFindUnique,
  mockUpsert,
  mockGuard,
  mockAccrue,
  mockReverseGeocode,
  mockIsMapboxConfigured,
  mockGetSmartRooms,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockGuard: vi.fn(),
  mockAccrue: vi.fn(),
  mockReverseGeocode: vi.fn(),
  mockIsMapboxConfigured: vi.fn(),
  mockGetSmartRooms: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
  getUserWithMfa: () => mockGetUser(),
}));

vi.mock("@/lib/usage-limits", () => ({
  guardDailyLimit: mockGuard,
  accrueUsageCost: mockAccrue,
}));

vi.mock("@/lib/reverse-geocode", () => ({
  reverseGeocode: mockReverseGeocode,
  isMapboxConfigured: mockIsMapboxConfigured,
  MAPBOX_GEOCODE_COST_USD: 0.00075,
}));

vi.mock("@/lib/rooms", () => ({
  getSmartRoomsWithLocationFilter: mockGetSmartRooms,
}));

vi.mock("@/lib/db", () => ({
  default: {
    item: { findUnique: mockItemFindUnique },
    itemLocation: { upsert: mockUpsert },
  },
}));

vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn() } }));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { POST } from "./route";

const ITEM_ID = "item_1";
const USER_ID = "user_1";

function call(body: unknown) {
  const request = {
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
  return POST(request, { params: Promise.resolve({ id: ITEM_ID }) });
}

const VALID_BODY = { latitude: 51.5, longitude: -0.12 };

describe("POST /api/v1/items/[id]/location — Mapbox cost accrual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
    mockGuard.mockResolvedValue({ ok: true, check: { retryAfterSeconds: 60 } });
    mockItemFindUnique.mockResolvedValue({ id: ITEM_ID, userId: USER_ID });
    mockUpsert.mockResolvedValue({ id: "loc_1", source: "manual" });
    mockReverseGeocode.mockResolvedValue({ city: "London" });
    mockGetSmartRooms.mockResolvedValue([]);
    mockAccrue.mockResolvedValue(undefined);
  });

  it("accrues the Mapbox geocode cost to the location bucket when configured", async () => {
    mockIsMapboxConfigured.mockReturnValue(true);

    const res = await call(VALID_BODY);

    expect(res.status).toBe(200);
    expect(mockAccrue).toHaveBeenCalledTimes(1);
    expect(mockAccrue).toHaveBeenCalledWith(USER_ID, "location", 0.00075);
  });

  it("does not accrue when Mapbox is not configured (no billable call)", async () => {
    mockIsMapboxConfigured.mockReturnValue(false);

    const res = await call(VALID_BODY);

    expect(res.status).toBe(200);
    expect(mockAccrue).not.toHaveBeenCalled();
  });

  it("blocks with 429 before geocoding when the daily guard trips", async () => {
    mockGuard.mockResolvedValue({
      ok: false,
      check: { retryAfterSeconds: 42 },
    });

    const res = await call(VALID_BODY);

    expect(res.status).toBe(429);
    expect(mockReverseGeocode).not.toHaveBeenCalled();
    expect(mockAccrue).not.toHaveBeenCalled();
  });

  it("does not accrue on invalid coordinates (no geocode attempted)", async () => {
    mockIsMapboxConfigured.mockReturnValue(true);

    const res = await call({ latitude: 999, longitude: 0 });

    expect(res.status).toBe(400);
    expect(mockReverseGeocode).not.toHaveBeenCalled();
    expect(mockAccrue).not.toHaveBeenCalled();
  });
});
