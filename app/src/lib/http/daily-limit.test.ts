import { describe, expect, it } from "vitest";
import {
  DAILY_LIMIT_REACHED_CODE,
  DAILY_LIMIT_REACHED_MESSAGE,
} from "@/lib/usage-limits.shared";
import { dailyLimitResponse } from "./daily-limit";

describe("dailyLimitResponse", () => {
  it("returns a 429 carrying the daily-limit code and canonical message", async () => {
    const res = dailyLimitResponse(3600);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      message: DAILY_LIMIT_REACHED_MESSAGE,
      code: DAILY_LIMIT_REACHED_CODE,
    });
  });

  it("sets Retry-After to the passed seconds-to-reset", () => {
    expect(dailyLimitResponse(3600).headers.get("Retry-After")).toBe("3600");
    expect(dailyLimitResponse(1).headers.get("Retry-After")).toBe("1");
  });
});
