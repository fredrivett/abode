"use client";

import { useApiQuery } from "@/lib/api-hooks";
import type { DocumentPagesResponse } from "@/lib/documents/document-pages";
import { DocumentPages } from "./document-pages";

/** Fetches a document's pages and shows them all in the item dialog */
export function DocumentDetailView({
  itemId,
  pageCount,
  coverUrl,
  title,
  ocrSkippedPages,
}: {
  itemId: string;
  pageCount: number;
  coverUrl: string | null;
  title: string;
  ocrSkippedPages?: number;
}) {
  const { data, isPending, isError } = useApiQuery<DocumentPagesResponse>(
    `/api/v1/items/${itemId}/pages`,
  );
  return (
    <DocumentPages
      pages={data?.pages ?? null}
      pageCount={pageCount}
      coverUrl={coverUrl}
      status={isError ? "error" : isPending ? "loading" : "ready"}
      title={title}
      ocrSkippedPages={ocrSkippedPages}
    />
  );
}
