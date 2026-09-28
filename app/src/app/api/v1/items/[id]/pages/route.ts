import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import type { DocumentPagesResponse } from "@/lib/documents/document-pages";
import { itemViewableWhere } from "@/lib/items/access";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/items/[id]/pages");

/**
 * GET /api/v1/items/[id]/pages
 *
 * A scanned document's pages in reading order, for the document viewer.
 * Viewable on the same terms as the item's images: the owner, a shared link,
 * or a public room.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserWithMfa(supabase);

    const item = await db.item.findFirst({
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
