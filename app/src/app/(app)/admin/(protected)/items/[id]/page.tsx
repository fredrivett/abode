import { ArrowLeft, Check, Minus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getItemInspection,
  getSimilarImagesForInspector,
  type InspectorSimilarImage,
  type ItemInspection,
  reconcileTweetMedia,
  SIMILAR_INSPECTOR_META,
} from "@/lib/admin/item-inspector";
import type { ImageColor, TwitterMedia } from "@/lib/types/item";
import { isValidUrl } from "@/lib/url-utils";
import { cn } from "@/lib/utils";

type PageParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: PageParams }) {
  const { id } = await params;
  return { title: `${id.slice(0, 8)} | Item inspector | Admin | abode` };
}

// ── presentational helpers ────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right">{children}</span>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs">{children}</span>;
}

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

function Bool({
  value,
  warnWhenFalse,
}: {
  value: boolean;
  warnWhenFalse?: boolean;
}) {
  if (value) return <Check className="inline size-4 text-emerald-500" />;
  if (warnWhenFalse)
    return <TriangleAlert className="inline size-4 text-amber-500" />;
  return <Minus className="inline size-4 text-muted-foreground" />;
}

function Pills({ items }: { items: string[] }) {
  if (items.length === 0) return <Empty />;
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {items.map((t) => (
        <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {t}
        </span>
      ))}
    </span>
  );
}

function isImageColorArray(value: unknown): value is ImageColor[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) => typeof c === "object" && c !== null && "hex" in c && "name" in c,
    )
  );
}

function Swatches({ colors }: { colors: unknown }) {
  if (!isImageColorArray(colors) || colors.length === 0) return <Empty />;
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {colors.map((c) => (
        <span
          key={c.hex}
          className="inline-block size-4 rounded-sm border border-border"
          style={{ backgroundColor: c.hex }}
          title={`${c.name} ${c.hex}`}
        />
      ))}
    </span>
  );
}

/** Item count for the raw-section hint: array length, or object key count. */
function itemCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object")
    return Object.keys(value).length;
  return null;
}

function JsonDetails({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  const count = itemCount(value);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        {label}
        {count !== null && (
          <span className="ml-1 text-xs opacity-70">[{count}]</span>
        )}
      </summary>
      <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function fmt(date: Date | null | undefined) {
  return date ? new Date(date).toLocaleString() : null;
}

// ── sections ──────────────────────────────────────────────────────────────

function MediaTable({ item }: { item: ItemInspection }) {
  const td = item.twitterDetails;
  if (!td) return null;
  const media = (td.media as TwitterMedia[] | null) ?? [];
  const rows = reconcileTweetMedia(
    media,
    td.coverMediaIndex,
    item.coverFileKey,
    item.mediaAnalyses,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Tweet media ({rows.length}) · cover index{" "}
          {td.coverMediaIndex ?? "0 (default)"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No media on this tweet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b text-left text-muted-foreground text-xs">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium" />
                  <th className="py-2 pr-2 font-medium">type</th>
                  <th className="py-2 pr-2 font-medium">re-hosted key</th>
                  <th className="py-2 pr-2 text-center font-medium">
                    analysed
                  </th>
                  <th className="py-2 pr-2 text-center font-medium">emb</th>
                  <th className="py-2 pr-2 text-center font-medium">cover</th>
                  <th className="py-2 pr-2 text-center font-medium">
                    mirrored
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.index} className="border-border/50 border-b">
                    <td className="py-2 pr-2 align-middle">{r.index}</td>
                    <td className="py-2 pr-2 align-middle">
                      {isValidUrl(r.url) ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open image"
                          className="inline-block transition-opacity hover:opacity-80"
                        >
                          {/* biome-ignore lint/performance/noImgElement: admin-only debug thumbnail, hotlinks public twimg */}
                          <img
                            src={r.url}
                            alt=""
                            className="size-10 rounded object-cover"
                          />
                        </a>
                      ) : (
                        // biome-ignore lint/performance/noImgElement: admin-only debug thumbnail, hotlinks public twimg
                        <img
                          src={r.url}
                          alt=""
                          className="size-10 rounded object-cover"
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2 align-middle">{r.type}</td>
                    <td className="py-2 pr-2 align-middle">
                      {r.fileKey ? (
                        <Mono>{r.fileKey}</Mono>
                      ) : (
                        <span className="text-amber-500 text-xs">
                          not re-hosted
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-center align-middle">
                      <Bool value={r.analysed} warnWhenFalse={r.rehosted} />
                    </td>
                    <td className="py-2 pr-2 text-center align-middle">
                      <Bool value={r.hasEmbedding} />
                    </td>
                    <td className="py-2 pr-2 text-center align-middle">
                      <Bool value={r.isCover} />
                    </td>
                    <td className="py-2 pr-2 text-center align-middle">
                      <Bool value={r.isMirrored} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-muted-foreground text-xs">
              <strong>cover</strong> = the image the tweet displays
              (coverMediaIndex). <strong>mirrored</strong> = whose analysis is
              in item_image_details / item_visual_vectors (matches
              coverFileKey). These should be the same row.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CoverAnalysisCard({ item }: { item: ItemInspection }) {
  const d = item.imageDetails;
  if (!d) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Cover analysis (item_image_details)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row label="objects">
          <Pills items={d.objects} />
        </Row>
        <Row label="colors">
          <Swatches colors={d.colors} />
        </Row>
        <Row label="ocrText">
          {d.ocrText ? (
            <span className="whitespace-pre-wrap">{d.ocrText}</span>
          ) : (
            <Empty />
          )}
        </Row>
        <Row label="captureDate">{fmt(d.captureDate) ?? <Empty />}</Row>
        <JsonDetails label="visionData" value={d.visionData} />
      </CardContent>
    </Card>
  );
}

function MediaAnalysesCard({ item }: { item: ItemInspection }) {
  if (item.mediaAnalyses.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Per-media analysis ({item.mediaAnalyses.length} rows ·
          item_media_analysis)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {item.mediaAnalyses.map((m) => (
          <div
            key={m.fileKey}
            className="space-y-2 border-border/50 border-b pb-3 last:border-0 last:pb-0"
          >
            <Row label="fileKey">
              <Mono>{m.fileKey}</Mono>
            </Row>
            <Row label="objects">
              <Pills items={m.objects} />
            </Row>
            <Row label="tags">
              <Pills items={m.tags} />
            </Row>
            <Row label="colors">
              <Swatches colors={m.colors} />
            </Row>
            <Row label="ocrText">
              {m.ocrText ? (
                <span className="whitespace-pre-wrap">{m.ocrText}</span>
              ) : (
                <Empty />
              )}
            </Row>
            <Row label="embedding">
              {m.embeddingModel ? (
                <span className="text-emerald-500 text-xs">
                  {m.embeddingModel}
                </span>
              ) : (
                <span className="text-amber-500 text-xs">none</span>
              )}
            </Row>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SimilarImageCell({ row }: { row: InspectorSimilarImage }) {
  return (
    <Link
      href={`/admin/items/${row.id}`}
      className="group block space-y-1"
      title={row.title ?? row.id}
    >
      <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
        {row.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: admin-only signed thumbnail
          <img
            src={row.imageUrl}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
            no image
          </div>
        )}
        <span className="absolute top-1 left-1 rounded bg-black/70 px-1 py-0.5 font-mono text-[10px] text-white tabular-nums">
          {row.similarity.toFixed(3)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1">
        {row.shownToUser ? (
          <span
            title="Shown to the user: clears the threshold and is within the display cap."
            className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] text-emerald-600"
          >
            shown
          </span>
        ) : row.meetsThreshold ? (
          <span
            title={`Similar enough (clears the threshold) but ranks beyond the top ${SIMILAR_INSPECTOR_META.shownLimit} shown, so the user never sees it.`}
            className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
          >
            capped
          </span>
        ) : (
          <span
            title="Below the similarity threshold — hidden from the user."
            className="rounded bg-amber-500/10 px-1 py-0.5 text-[10px] text-amber-600"
          >
            below
          </span>
        )}
        <span className="truncate text-[10px] text-muted-foreground">
          {row.kind ?? "—"}
        </span>
      </div>
    </Link>
  );
}

function SimilarImagesCard({
  rows,
  hasVisualVector,
}: {
  rows: InspectorSimilarImage[];
  hasVisualVector: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Similar images (top {rows.length}) · threshold ≥{" "}
          {SIMILAR_INSPECTOR_META.threshold.toFixed(2)} · live shows up to{" "}
          {SIMILAR_INSPECTOR_META.shownLimit}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasVisualVector ? (
          <p className="text-muted-foreground text-sm">
            No visual embedding on this item — similar-images doesn't run.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No other images with embeddings in this owner's library.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {rows.map((row) => (
                <SimilarImageCell key={row.id} row={row} />
              ))}
            </div>
            <p className="mt-3 text-muted-foreground text-xs">
              Score is inner-product similarity (≈ cosine, −1…1); badges show
              whether it reaches the user — hover for details.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── page ──────────────────────────────────────────────────────────────────

export default async function AdminItemInspectorPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;
  const item = await getItemInspection(id);
  if (!item) notFound();

  const visualVector = item.visualVectors[0] ?? null;
  const textVector = item.textVectors[0] ?? null;
  const similarImages = visualVector
    ? await getSimilarImagesForInspector({
        itemId: item.id,
        userId: item.userId,
      })
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <header className="-mx-4 sticky top-16 z-40 flex items-center gap-4 border-border/60 border-b bg-background px-4 py-4">
          <Link
            href="/admin"
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Back to admin"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
              <span className="font-mono text-lg">{item.id}</span>
              <span className="rounded bg-primary/10 px-2 py-1 font-medium text-primary text-sm">
                {item.kind ?? "unclassified"}
              </span>
              <span
                className={cn(
                  "rounded px-2 py-1 font-medium text-sm",
                  item.processingStatus === "completed" &&
                    "bg-emerald-500/10 text-emerald-600",
                  item.processingStatus === "failed" &&
                    "bg-destructive/10 text-destructive",
                  (item.processingStatus === "processing" ||
                    item.processingStatus === "pending") &&
                    "bg-amber-500/10 text-amber-600",
                )}
              >
                {item.processingStatus}
              </span>
            </h2>
            <p className="text-muted-foreground text-sm">
              owner{" "}
              <Link
                href={`/admin/users/${item.userId}`}
                className="hover:underline"
              >
                {item.user.email}
              </Link>
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="processingError">
                {item.processingError ?? <Empty />}
              </Row>
              <Row label="sourceType">{item.sourceType ?? <Empty />}</Row>
              <Row label="sourceUrl">
                {!item.sourceUrl ? (
                  <Empty />
                ) : isValidUrl(item.sourceUrl) ? (
                  <a
                    href={item.sourceUrl}
                    className="hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.sourceUrl}
                  </a>
                ) : (
                  // Never render an item-controlled non-http(s) URL as a live
                  // link — a javascript:/data: href would run in the admin's
                  // session on click. Show it as text.
                  <span className="break-all">{item.sourceUrl}</span>
                )}
              </Row>
              <Row label="created">{fmt(item.createdAt)}</Row>
              <Row label="updated">{fmt(item.updatedAt)}</Row>
              <Row label="lastReassignedAt">
                {fmt(item.lastReassignedAt) ?? <Empty />}
              </Row>
              <Row label="sharedAt">{fmt(item.sharedAt) ?? <Empty />}</Row>
              <Row label="excludeFromPublicRooms">
                <Bool value={item.excludeFromPublicRooms} />
              </Row>
              <Row label="rooms">
                {item.roomItems.length === 0 ? (
                  <Empty />
                ) : (
                  <Pills items={item.roomItems.map((r) => r.room.name)} />
                )}
              </Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="title">{item.title ?? <Empty />}</Row>
              <Row label="titleEditedByUser">
                <Bool value={item.titleEditedByUser} />
              </Row>
              <Row label="description">{item.description ?? <Empty />}</Row>
              <Row label="tags (auto)">
                <Pills items={item.tags} />
              </Row>
              <Row label="userTags">
                <Pills items={item.userTags} />
              </Row>
              <Row label="notes">{item.notes ?? <Empty />}</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vectors & files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="visual vector">
                {visualVector ? (
                  <span className="text-emerald-500 text-xs">
                    {visualVector.model}
                  </span>
                ) : (
                  <span className="text-amber-500 text-xs">none</span>
                )}
              </Row>
              <Row label="text vector">
                {textVector ? (
                  <span className="text-emerald-500 text-xs">
                    {textVector.model}
                  </span>
                ) : (
                  <span className="text-amber-500 text-xs">none</span>
                )}
              </Row>
              <Row label="fileKey">
                {item.fileKey ? <Mono>{item.fileKey}</Mono> : <Empty />}
              </Row>
              <Row label="coverFileKey">
                {item.coverFileKey ? (
                  <Mono>{item.coverFileKey}</Mono>
                ) : (
                  <Empty />
                )}
              </Row>
            </CardContent>
          </Card>

          {item.twitterDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tweet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Row label="author">@{item.twitterDetails.authorUsername}</Row>
                <Row label="tweetId">
                  <Mono>{item.twitterDetails.tweetId}</Mono>
                </Row>
                <Row label="postedAt">
                  {fmt(item.twitterDetails.postedAt) ?? <Empty />}
                </Row>
                <Row label="text">
                  {item.twitterDetails.text ? (
                    <span className="whitespace-pre-wrap">
                      {item.twitterDetails.text}
                    </span>
                  ) : (
                    <Empty />
                  )}
                </Row>
                <JsonDetails label="card" value={item.twitterDetails.card} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-6 space-y-6">
          <MediaTable item={item} />
          <CoverAnalysisCard item={item} />
          <MediaAnalysesCard item={item} />
          <SimilarImagesCard
            rows={similarImages}
            hasVisualVector={visualVector !== null}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <JsonDetails label="meta" value={item.meta} />
              <JsonDetails label="externalLinks" value={item.externalLinks} />
              <JsonDetails
                label="twitterDetails.media"
                value={item.twitterDetails?.media}
              />
              <JsonDetails label="productDetails" value={item.productDetails} />
              <JsonDetails label="articleDetails" value={item.articleDetails} />
              <JsonDetails label="videoDetails" value={item.videoDetails} />
              <JsonDetails label="bookDetails" value={item.bookDetails} />
              <JsonDetails label="noteDetails" value={item.noteDetails} />
              <JsonDetails label="locations" value={item.locations} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
