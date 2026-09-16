import type { importLiteralBooksTask } from "@app/trigger/import-literal-books";
import { tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth/authenticate-request";
import db from "@/lib/db";
import { fetchLiteralBooks } from "@/lib/imports/literal/adapter";
import { LiteralApiError } from "@/lib/imports/literal/client";
import { serializeBook } from "@/lib/imports/payload";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { isTriggerConfigured } from "@/lib/trigger/item-runs";

const log = createLogger("api/imports/literal");

// One book row per background chunk; chunks are batch-triggered together. Keeps
// each Trigger payload small (book metadata only, no blobs) regardless of library size.
const CHUNK_SIZE = 100;

// Either an existing Literal access token, or email + password we exchange for one.
const bodySchema = z.union([
  z.object({ token: z.string().min(1) }),
  z.object({ email: z.string().email(), password: z.string().min(1) }),
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userId = auth.user.id;

    // Import needs the background queue; degrade cleanly where it isn't set up.
    if (!isTriggerConfigured()) {
      return NextResponse.json(
        { message: "Importing is not available on this deployment" },
        { status: 503 },
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Provide a Literal token, or email and password" },
        { status: 400 },
      );
    }

    // One active import per user — cheap guard against concurrent/duplicate runs.
    const active = await db.itemImport.findFirst({
      where: { userId, status: { in: ["pending", "importing"] } },
      select: { id: true },
    });
    if (active) {
      return NextResponse.json(
        { message: "An import is already in progress", importId: active.id },
        { status: 409 },
      );
    }

    // Fetch + normalize the whole library here (the token stays in this request
    // and never enters a Trigger payload). ~2 GraphQL calls.
    let books: Awaited<ReturnType<typeof fetchLiteralBooks>>;
    try {
      books = await fetchLiteralBooks(parsed.data);
    } catch (error) {
      if (error instanceof LiteralApiError) {
        log.warn({ error: error.message }, "Literal fetch failed");
        return NextResponse.json(
          {
            message:
              "Couldn't fetch your Literal library. Check your login details and try again.",
          },
          { status: 502 },
        );
      }
      throw error;
    }

    if (books.length === 0) {
      const empty = await db.itemImport.create({
        data: {
          userId,
          source: "literal",
          status: "completed",
          totalCount: 0,
          completedAt: new Date(),
        },
        select: { id: true },
      });
      // Keep the empty import in the funnel: it starts and immediately completes.
      const posthog = getPostHogClient();
      posthog?.capture({
        distinctId: userId,
        event: "book_import_started",
        properties: { source: "literal", total: 0 },
      });
      posthog?.capture({
        distinctId: userId,
        event: "book_import_completed",
        properties: {
          source: "literal",
          total: 0,
          imported: 0,
          skipped: 0,
          failed: 0,
        },
      });
      return NextResponse.json(
        { importId: empty.id, total: 0 },
        { status: 200 },
      );
    }

    const itemImport = await db.itemImport.create({
      data: {
        userId,
        source: "literal",
        status: "importing",
        totalCount: books.length,
      },
      select: { id: true },
    });

    const runs = [];
    for (let i = 0; i < books.length; i += CHUNK_SIZE) {
      runs.push({
        payload: {
          userId,
          importId: itemImport.id,
          books: books.slice(i, i + CHUNK_SIZE).map(serializeBook),
        },
      });
    }
    try {
      await tasks.batchTrigger<typeof importLiteralBooksTask>(
        "import-literal-books",
        runs,
      );
    } catch (error) {
      // Enqueue failed — don't leave the row stuck `importing` (it would 409
      // every future attempt). Mark it failed so the user can retry.
      await db.itemImport
        .update({
          where: { id: itemImport.id },
          data: { status: "failed", error: "Couldn't start the import" },
        })
        .catch(() => {});
      throw error;
    }

    getPostHogClient()?.capture({
      distinctId: userId,
      event: "book_import_started",
      properties: { source: "literal", total: books.length },
    });

    return NextResponse.json(
      { importId: itemImport.id, total: books.length },
      { status: 202 },
    );
  } catch (error) {
    log.error({ error }, "Literal import failed");
    captureServerException(error, undefined, {
      route: "POST /api/v1/imports/literal",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
