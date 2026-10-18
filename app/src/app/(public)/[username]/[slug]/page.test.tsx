import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUser, mockFindRoom, mockGetAuthenticatedUser } = vi.hoisted(
  () => ({
    mockFindUser: vi.fn(),
    mockFindRoom: vi.fn(),
    mockGetAuthenticatedUser: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  default: {
    user: { findFirst: mockFindUser },
    room: { findFirst: mockFindRoom },
  },
}));
vi.mock("@/lib/user", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));
vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("./_components/room-page-client", () => ({
  RoomPageClient: () => null,
}));

import { generateMetadata } from "./page";

const OWNER = "owner-id";

function metadataFor(viewerId: string | null) {
  mockGetAuthenticatedUser.mockResolvedValue(
    viewerId ? { id: viewerId } : null,
  );
  return generateMetadata({
    params: Promise.resolve({ username: "@fred", slug: "diary" }),
  });
}

describe("room page metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUser.mockResolvedValue({
      id: OWNER,
      username: "fred",
      allowSearchIndexing: false,
    });
  });

  const room = (visibility: "public" | "private") => ({
    id: "room-id",
    userId: OWNER,
    name: "Therapy notes",
    slug: "diary",
    visibility,
  });

  it("never puts a private room's name in a visitor's title", async () => {
    mockFindRoom.mockResolvedValue(room("private"));

    for (const viewer of [null, "someone-else"]) {
      const metadata = await metadataFor(viewer);
      expect(metadata.title).toBe("Room not found");
      expect(JSON.stringify(metadata)).not.toContain("Therapy notes");
    }
  });

  it("titles a private room for its owner", async () => {
    mockFindRoom.mockResolvedValue(room("private"));

    expect((await metadataFor(OWNER)).title).toBe(
      "Therapy notes | @fred | abode",
    );
  });

  it("titles a public room for anyone", async () => {
    mockFindRoom.mockResolvedValue(room("public"));

    expect((await metadataFor(null)).title).toBe(
      "Therapy notes | @fred | abode",
    );
  });

  it("says not found for an unknown room", async () => {
    mockFindRoom.mockResolvedValue(null);

    expect((await metadataFor(null)).title).toBe("Room not found");
  });
});
