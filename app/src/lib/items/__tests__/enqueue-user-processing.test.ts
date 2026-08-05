import { describe, expect, test } from "vitest";
import {
  MAX_SAFE_PRIORITY,
  USER_ACTION_PRIORITY,
} from "@/lib/items/enqueue-user-processing";

describe("USER_ACTION_PRIORITY", () => {
  // A larger positive offset dequeues sooner, so it must be > 0 to jump ahead
  // of priority-0 background work. A *negative* value would delay the run into
  // the future and strand it in `queued`.
  test("is a positive offset", () => {
    expect(USER_ACTION_PRIORITY).toBeGreaterThan(0);
  });

  // Regression guard: a year-long offset (31_536_000) overflowed the server's
  // `priority × 1000` ms conversion, so Trigger.dev's API rejected every
  // user-initiated enqueue with a TriggerApiError. Stay well under the bound.
  test("stays within the API's safe range", () => {
    expect(USER_ACTION_PRIORITY).toBeLessThanOrEqual(MAX_SAFE_PRIORITY);
    // The bound itself must keep `priority × 1000` inside a signed 32-bit int.
    expect(MAX_SAFE_PRIORITY * 1000).toBeLessThanOrEqual(2_147_483_647);
  });
});
