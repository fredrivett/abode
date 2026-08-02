import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * Uniform 400 response for a failed zod `safeParse`. Surfaces the first issue
 * as a human-readable `message` (e.g. `Invalid userTags: Too big: ...`) plus the
 * full field-keyed detail as `errors`, so clients (the extension, future public
 * API, us in the network tab) get an actionable response instead of a bare
 * "Invalid request body".
 */
export function zodErrorResponse(error: ZodError): NextResponse {
  const [first] = error.issues;
  const field = first?.path.join(".");
  const message = first
    ? field
      ? `Invalid ${field}: ${first.message}`
      : first.message
    : "Invalid request body";

  return NextResponse.json(
    { message, errors: error.flatten() },
    { status: 400 },
  );
}
