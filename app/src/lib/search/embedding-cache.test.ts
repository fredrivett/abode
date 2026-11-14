// @vitest-environment node
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ default: {} }));

import {
  getQueryEmbedding,
  QUERY_EMBEDDING_TIMEOUT_MS,
} from "./embedding-cache";

// Fake OpenAI that sends 200 headers and then never finishes the body: the SDK's
// own `timeout` stops counting at the headers, so only a whole-request deadline
// ends this
let requests = 0;
let server: Server;

beforeAll(async () => {
  server = createServer((_req, res) => {
    requests += 1;
    res.writeHead(200, { "content-type": "application/json" });
    res.write("{");
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("OPENAI_BASE_URL", `http://127.0.0.1:${address.port}/v1`);
});

afterAll(() => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  server.close();
});

it("gives up on a hung OpenAI after the query deadline, without retrying", async () => {
  const started = Date.now();

  await expect(getQueryEmbedding("walnut bookshelf")).rejects.toThrow();

  const elapsed = Date.now() - started;
  expect(elapsed).toBeGreaterThanOrEqual(QUERY_EMBEDDING_TIMEOUT_MS - 100);
  expect(elapsed).toBeLessThan(QUERY_EMBEDDING_TIMEOUT_MS + 1_500);
  expect(requests).toBe(1);
}, 10_000);
