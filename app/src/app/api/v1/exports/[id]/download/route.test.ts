import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  findFirst: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ storage: { from: m.from } }),
}));
vi.mock("@/lib/db", () => ({
  default: { dataExport: { findFirst: m.findFirst } },
}));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => ({ capture: m.capture }),
}));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { GET } from "./route";

const USER = "user-1";
const EXPORT_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const completed = {
  status: "completed",
  completedAt: new Date("2026-09-28T10:00:00.000Z"),
  expiresAt: new Date(Date.now() + 60_000),
  parts: [{ position: 1, fileKey: `${USER}/export-1/part-1.zip` }],
};

const call = (id = EXPORT_ID, query = "") =>
  GET(
    {
      nextUrl: new URL(
        `http://localhost/api/v1/exports/${id}/download${query}`,
      ),
    } as Parameters<typeof GET>[0],
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: USER } } });
  m.findFirst.mockResolvedValue(completed);
  m.from.mockReturnValue({ createSignedUrl: m.createSignedUrl });
  m.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://storage.example/signed" },
    error: null,
  });
});

describe("GET /api/v1/exports/[id]/download", () => {
  it("redirects the owner to a short-lived signed download URL", async () => {
    const res = await call();

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://storage.example/signed");
    expect(m.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: EXPORT_ID, userId: USER } }),
    );
    expect(m.from).toHaveBeenCalledWith("exports");
    expect(m.createSignedUrl).toHaveBeenCalledWith(
      `${USER}/export-1/part-1.zip`,
      60,
      { download: "abode-export-2026-09-28.zip" },
    );
    expect(m.capture).toHaveBeenCalledWith({
      distinctId: USER,
      event: "data_export_downloaded",
      properties: { part: 1, part_count: 1 },
    });
  });

  it("404s an id that isn't a UUID without querying", async () => {
    expect((await call("not-a-uuid")).status).toBe(404);
    expect(m.findFirst).not.toHaveBeenCalled();
  });

  it("serves the requested part of a split export, named part N of M", async () => {
    m.findFirst.mockResolvedValue({
      ...completed,
      parts: [
        { position: 1, fileKey: `${USER}/export-1/part-1.zip` },
        { position: 2, fileKey: `${USER}/export-1/part-2.zip` },
      ],
    });

    const res = await call(EXPORT_ID, "?part=2");

    expect(res.status).toBe(303);
    expect(m.createSignedUrl).toHaveBeenCalledWith(
      `${USER}/export-1/part-2.zip`,
      60,
      { download: "abode-export-2026-09-28-part-2-of-2.zip" },
    );
  });

  it("404s a part the export doesn't have", async () => {
    expect((await call(EXPORT_ID, "?part=3")).status).toBe(404);
    expect(m.createSignedUrl).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "two", ""])(
    "400s an invalid part number (%j)",
    async (part) => {
      expect((await call(EXPORT_ID, `?part=${part}`)).status).toBe(400);
    },
  );

  it("rejects a signed-out request", async () => {
    m.getUser.mockResolvedValue({ data: { user: null } });
    expect((await call()).status).toBe(401);
  });

  it("404s an export that isn't the user's (or doesn't exist)", async () => {
    m.findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(m.createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["still building", { ...completed, status: "exporting", parts: [] }],
    ["failed", { ...completed, status: "failed", parts: [] }],
    ["expired", { ...completed, status: "expired", parts: [] }],
    ["past its expiry", { ...completed, expiresAt: new Date(Date.now() - 1) }],
  ])("410s an export that's %s", async (_label, row) => {
    m.findFirst.mockResolvedValue(row);
    expect((await call()).status).toBe(410);
    expect(m.createSignedUrl).not.toHaveBeenCalled();
  });

  it("500s when storage can't sign the URL", async () => {
    m.createSignedUrl.mockResolvedValue({
      data: null,
      error: new Error("nope"),
    });
    expect((await call()).status).toBe(500);
  });
});
