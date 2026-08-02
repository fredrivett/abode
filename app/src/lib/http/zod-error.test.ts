import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodErrorResponse } from "./zod-error";

// A stand-in for a real request schema. Kept deliberately simple so the exact
// expected responses below document the contract precisely. These assertions
// pin zod's message wording on purpose — if a zod upgrade changes it, this test
// should fail so the API's error contract is reviewed, not silently altered.
const schema = z.object({
  notes: z.string(),
  userTags: z.array(z.string().max(50)).max(2),
});

async function bodyOf(res: Response) {
  return res.json();
}

describe("zodErrorResponse", () => {
  it("names a wrong-typed top-level field", async () => {
    const parsed = schema.safeParse({ notes: 123, userTags: [] });
    if (parsed.success) throw new Error("expected a validation failure");

    const res = zodErrorResponse(parsed.error);
    expect(res.status).toBe(400);
    expect(await bodyOf(res)).toEqual({
      message: "Invalid notes: Invalid input: expected string, received number",
      errors: {
        formErrors: [],
        fieldErrors: {
          notes: ["Invalid input: expected string, received number"],
        },
      },
    });
  });

  it("names a nested array-element failure by index", async () => {
    const parsed = schema.safeParse({
      notes: "ok",
      userTags: ["a".repeat(51)],
    });
    if (parsed.success) throw new Error("expected a validation failure");

    const res = zodErrorResponse(parsed.error);
    expect(res.status).toBe(400);
    expect(await bodyOf(res)).toEqual({
      message:
        "Invalid userTags.0: Too big: expected string to have <=50 characters",
      errors: {
        formErrors: [],
        fieldErrors: {
          userTags: ["Too big: expected string to have <=50 characters"],
        },
      },
    });
  });

  it("reports an array-length failure against the field itself", async () => {
    const parsed = schema.safeParse({ notes: "ok", userTags: ["a", "b", "c"] });
    if (parsed.success) throw new Error("expected a validation failure");

    const res = zodErrorResponse(parsed.error);
    expect(res.status).toBe(400);
    expect(await bodyOf(res)).toEqual({
      message: "Invalid userTags: Too big: expected array to have <=2 items",
      errors: {
        formErrors: [],
        fieldErrors: {
          userTags: ["Too big: expected array to have <=2 items"],
        },
      },
    });
  });

  it("uses the raw message (and formErrors) for a pathless, form-level issue", async () => {
    // A top-level (non-object) schema failure has an empty issue path, so there
    // is no field to name — the message is the bare zod message and the detail
    // lands in formErrors rather than fieldErrors.
    const parsed = z.string().safeParse(123);
    if (parsed.success) throw new Error("expected a validation failure");

    const res = zodErrorResponse(parsed.error);
    expect(res.status).toBe(400);
    expect(await bodyOf(res)).toEqual({
      message: "Invalid input: expected string, received number",
      errors: {
        formErrors: ["Invalid input: expected string, received number"],
        fieldErrors: {},
      },
    });
  });
});
