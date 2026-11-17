import { type NextRequest, NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import { systemDb } from "@/lib/db";
import type { DocumentPagesResponse } from "@/lib/documents/document-pages";
import { authedRoute } from "@/lib/http/authed-route";
import { itemViewableWhere } from "@/lib/items/access";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/v1/items/[id]/pages");

/**
 * GET /api/v1/items/[id]/pages
 *
 * A scanned document's pages in reading order, for the document viewer.
 * Viewable on the same terms as the item's images: the owner, a shared link,
 * or a public room.
 */
async function handleGET(
  _request: NextRequest,
  {
    params,
    principal,
  }: { params: Promise<{ id: string }> } & { principal: Principal | null },
) {
  try {
    const { id } = await params;
    const user = principal?.user ?? null;

    const item = await systemDb.item.findFirst({
      where: { id, kind: "document", ...itemViewableWhere(user?.id ?? null) },
      select: {
        documentPages: {
          orderBy: { position: "asc" },
          select: { position: true, fileKey: true, width: true, height: true },
        },
      },
    });
    if (!item) {
      return NextResponse.json(
        { message: "Document not found" },
        { status: 404 },
      );
    }

    const body: DocumentPagesResponse = { pages: item.documentPages };
    return NextResponse.json(body);
  } catch (error) {
    log.error({ error }, "Document pages fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/items/[id]/pages",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = authedRoute(
  { credentials: "session", allowAnonymous: true },
  handleGET,
);
