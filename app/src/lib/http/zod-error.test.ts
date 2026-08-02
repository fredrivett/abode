import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodErrorResponse } from "./zod-error";

const schema = z.object({
  notes: z.string(),
  userTags: z.array(z.string().max(50)).max(100),
});

async function bodyOf(res: Response) {
  return (await res.json()) as {
    message: string;
    errors: { formErrors: string[]; fieldErrors: Record<string, string[]> };
  };
}

describe("zodErrorResponse", () => {
  it("returns a 400", () => {
    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(zodErrorResponse(parsed.error).status).toBe(400);
  });

  it("names the offending field in the message instead of a generic string", async () => {
    const parsed = schema.safeParse({ notes: 123, userTags: [] });
    if (parsed.success) throw new Error("expected failure");
    const body = await bodyOf(zodErrorResponse(parsed.error));
    expect(body.message).toContain("notes");
    expect(body.message).not.toBe("Invalid request body");
  });

  it("surfaces field-keyed detail in errors", async () => {
    const parsed = schema.safeParse({
      notes: "ok",
      userTags: ["a".repeat(51)],
    });
    if (parsed.success) throw new Error("expected failure");
    const body = await bodyOf(zodErrorResponse(parsed.error));
    // nested array issue is keyed under the field
    expect(Object.keys(body.errors.fieldErrors)).toContain("userTags");
  });
});
