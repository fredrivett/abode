import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAccessToken } = vi.hoisted(() => ({
  mockGetAccessToken: vi.fn(),
}));

vi.mock("./auth", () => ({ getAccessToken: mockGetAccessToken }));
vi.mock("./config", () => ({ CONFIG: { abodeBaseUrl: "https://abode.test" } }));

import { saveNote, saveUrl } from "./api";

const okResponse = () =>
  ({ status: 200, ok: true, json: async () => ({ id: "item_1" }) }) as Response;

/** The JSON body a call POSTed, parsed. */
function postedBody(): Record<string, unknown> {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse((init as RequestInit).body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAccessToken.mockResolvedValue("token-abc");
  globalThis.fetch = vi.fn().mockResolvedValue(okResponse());
});

describe("saveUrl", () => {
  it("tags the save with source: extension", async () => {
    await saveUrl("https://example.com/x");
    expect(postedBody()).toMatchObject({
      url: "https://example.com/x",
      source: "extension",
    });
  });
});

describe("saveNote", () => {
  it("tags the note with source: extension so it isn't mislabeled web", async () => {
    await saveNote("highlighted text", "A title");
    expect(postedBody()).toMatchObject({
      content: "highlighted text",
      title: "A title",
      source: "extension",
    });
  });
});
