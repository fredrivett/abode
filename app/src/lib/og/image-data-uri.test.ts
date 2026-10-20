import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/og", () => ({ ImageResponse: vi.fn() }));

import { imageDataUri } from "./render";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response | Error) {
  const fetch = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("imageDataUri", () => {
  it("inlines an image as a data URI", async () => {
    stubFetch(
      new Response("png", { headers: { "content-type": "image/png" } }),
    );
    expect(await imageDataUri("https://abode.test/a.png")).toBe(
      "data:image/png;base64,cG5n",
    );
  });

  it("is null without a URL, and doesn't fetch", async () => {
    const fetch = stubFetch(new Response(""));
    expect(await imageDataUri(null)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("is null for a failed or non-image response", async () => {
    stubFetch(
      new Response("nope", {
        status: 404,
        headers: { "content-type": "image/png" },
      }),
    );
    expect(await imageDataUri("https://abode.test/a.png")).toBeNull();
    stubFetch(
      new Response("<html>", { headers: { "content-type": "text/html" } }),
    );
    expect(await imageDataUri("https://abode.test/a.png")).toBeNull();
  });

  it("releases a rejected response's body", async () => {
    const response = new Response("<html>", {
      headers: { "content-type": "text/html" },
    });
    stubFetch(response);
    await imageDataUri("https://abode.test/a.png");
    // A cancelled body can't be read; an unread one still could
    await expect(response.text()).rejects.toThrow();
  });

  it("is null when the fetch throws", async () => {
    stubFetch(new Error("offline"));
    expect(await imageDataUri("https://abode.test/a.png")).toBeNull();
  });
});
