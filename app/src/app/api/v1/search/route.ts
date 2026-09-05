import type {
  CaptureSource,
  ItemKind,
  ProcessingStatus,
  SourceType,
} from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { EMPTY_ARTICLE_READ_STATE } from "@/lib/items/query";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import { isCanonicalUuid } from "@/lib/pagination";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import {
  buildColorRelevanceCte,
  buildFilterConditions,
  hasFilters,
  type InvalidFilterValue,
  normalizeColorFilterValue,
  type ParsedFilters,
  parseFiltersFromParams,
  validateSourceFilters,
  validateStatusFilters,
  validateTypeFilters,
} from "@/lib/search/query-builder";
import { rankedSearch } from "@/lib/search/ranked-search";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import type {
  BookDetails,
  ImageColor,
  InstagramDetails,
  InstagramMedia,
  MatchReason,
  ProductDetails,
  ProductImage,
  SearchItem,
  TwitterDetails,
  TwitterMedia,
  VideoDetails,
} from "@/lib/types/item";

const log = createLogger("api/v1/search");

const PAGE_SIZE = 20;

type SearchWarning =
  | "vector_search_unavailable"
  | "rate_limited"
  | "partial_results"
  | "slow_query";

type CursorData = {
  captureDate: string | null;
  createdAt: string;
  id: string;
};

type SearchResponse = {
  items: SearchItem[];
  total: number;
  cursor?: string;
  warnings?: SearchWarning[];
  invalidFilters?: InvalidFilterValue[];
};

/**
 * Raw item row from SQL query.
 *
 * Raw SQL returns strings for enum columns (kind, processing_status, source_type).
 * These are guaranteed to be valid enum values from the database schema.
 */
type RawItemRow = {
  id: string;
  kind: string | null;
  processing_status: string;
  file_key: string | null;
  cover_file_key: string | null;
  favicon_file_key: string | null;
  meta: unknown;
  source_type: string | null;
  source_url: string | null;
  capture_source: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  user_tags: string[];
  notes: string | null;
  created_at: Date;
  objects: string[] | null;
  colors: unknown;
  ocr_text: string | null;
  capture_date: Date | null;
  blur_data_url: string | null;
  article_author: string | null;
  article_domain: string | null;
  article_published_at: Date | null;
  article_reading_time: number | null;
  article_content: string | null;
  twitter_tweet_id: string | null;
  twitter_author_name: string | null;
  twitter_author_username: string | null;
  twitter_author_avatar_url: string | null;
  twitter_text: string | null;
  twitter_posted_at: Date | null;
  twitter_media: unknown;
  twitter_quoted_tweet_id: string | null;
  twitter_card: unknown;
  twitter_cover_media_index: number | null;
  instagram_post_id: string | null;
  instagram_media_type: string | null;
  instagram_author_name: string | null;
  instagram_author_username: string | null;
  instagram_caption: string | null;
  instagram_posted_at: Date | null;
  instagram_media: unknown;
  instagram_like_count: number | null;
  instagram_comment_count: number | null;
  instagram_cover_media_index: number | null;
  video_platform: string | null;
  video_video_id: string | null;
  video_channel_name: string | null;
  video_channel_url: string | null;
  video_duration: number | null;
  video_embed_url: string | null;
  video_thumbnail_url: string | null;
  product_domain: string | null;
  product_brand: string | null;
  product_price: string | null;
  product_currency: string | null;
  product_availability: string | null;
  product_images: unknown;
  product_cover_image_index: number | null;
  book_authors: string[] | null;
  book_publisher: string | null;
  book_published_at: Date | null;
  book_isbn: string | null;
  book_page_count: number | null;
  book_domain: string | null;
  book_status: string | null;
  book_started_at: Date | null;
  book_started_at_precision: string | null;
  book_finished_at: Date | null;
  book_finished_at_precision: string | null;
  book_progress_value: number | null;
  book_progress_unit: string | null;
  book_progress_updated_at: Date | null;
  book_rating: number | null;
  book_review: string | null;
  note_content: string | null;
};

type RawLocationRow = {
  id: string;
  item_id: string;
  source: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  formatted: string | null;
};

/**
 * Transform a raw SQL row into an Item.
 *
 * Raw SQL returns strings for Prisma enum columns. Since these values come
 * directly from the database (which enforces the enum constraints), they are
 * guaranteed to be valid enum values. We cast them to the Prisma enum types
 * for type safety in the rest of the application.
 */
function transformRawItemToItem(
  row: RawItemRow,
  locations: RawLocationRow[],
): Omit<SearchItem, "match"> {
  return {
    id: row.id,
    kind: row.kind as ItemKind | null,
    processingStatus: row.processing_status as ProcessingStatus,
    fileKey: row.file_key,
    coverFileKey: row.cover_file_key,
    faviconFileKey: row.favicon_file_key,
    meta: (row.meta as Record<string, unknown>) || null,
    sourceType: row.source_type as SourceType | null,
    sourceUrl: row.source_url,
    captureSource: row.capture_source as CaptureSource | null,
    title: row.title,
    description: row.description,
    tags: row.tags || [],
    userTags: row.user_tags || [],
    notes: row.notes,
    objects: row.objects || [],
    colors: parseColors(row.colors) ?? [],
    ocrText: row.ocr_text,
    captureDate: row.capture_date?.toISOString() ?? null,
    blurDataUrl: row.blur_data_url,
    locations: locations.map((loc) => ({
      id: loc.id,
      source: loc.source,
      latitude: loc.latitude,
      longitude: loc.longitude,
      neighborhood: loc.neighborhood,
      city: loc.city,
      region: loc.region,
      country: loc.country,
      countryCode: loc.country_code,
      formatted: loc.formatted,
    })),
    articleDetails:
      row.article_author ||
      row.article_domain ||
      row.article_published_at ||
      row.article_content
        ? {
            author: row.article_author,
            domain: row.article_domain,
            publishedAt: row.article_published_at?.toISOString() ?? null,
            readingTime: row.article_reading_time,
            content: row.article_content,
            // Read state isn't projected in search rows or shown on cards.
            ...EMPTY_ARTICLE_READ_STATE,
          }
        : null,
    twitterDetails:
      row.twitter_tweet_id && row.twitter_author_username
        ? ({
            tweetId: row.twitter_tweet_id,
            authorName: row.twitter_author_name,
            authorUsername: row.twitter_author_username,
            authorAvatarUrl: row.twitter_author_avatar_url,
            text: row.twitter_text,
            postedAt: row.twitter_posted_at?.toISOString() ?? null,
            media: row.twitter_media as TwitterMedia[] | null,
            quotedTweetId: row.twitter_quoted_tweet_id,
            card: row.twitter_card as TwitterDetails["card"],
            coverMediaIndex: row.twitter_cover_media_index,
          } satisfies TwitterDetails)
        : null,
    instagramDetails:
      row.instagram_post_id && row.instagram_author_username
        ? ({
            postId: row.instagram_post_id,
            mediaType:
              row.instagram_media_type as InstagramDetails["mediaType"],
            authorName: row.instagram_author_name,
            authorUsername: row.instagram_author_username,
            caption: row.instagram_caption,
            postedAt: row.instagram_posted_at?.toISOString() ?? null,
            media: row.instagram_media as InstagramMedia[] | null,
            likeCount: row.instagram_like_count,
            commentCount: row.instagram_comment_count,
            coverMediaIndex: row.instagram_cover_media_index,
          } satisfies InstagramDetails)
        : null,
    videoDetails:
      row.video_platform && row.video_video_id
        ? ({
            platform: row.video_platform as VideoDetails["platform"],
            videoId: row.video_video_id,
            channelName: row.video_channel_name,
            channelUrl: row.video_channel_url,
            duration: row.video_duration,
            embedUrl: row.video_embed_url,
            thumbnailUrl: row.video_thumbnail_url,
          } satisfies VideoDetails)
        : null,
    productDetails:
      row.product_domain || row.product_brand || row.product_price
        ? ({
            domain: row.product_domain,
            brand: row.product_brand,
            price: row.product_price,
            currency: row.product_currency,
            availability: row.product_availability,
            images: row.product_images as ProductImage[] | null,
            coverImageIndex: row.product_cover_image_index,
          } satisfies ProductDetails)
        : null,
    bookDetails:
      row.book_authors !== null ||
      row.book_isbn !== null ||
      row.book_domain !== null ||
      row.book_status !== null
        ? ({
            authors: row.book_authors ?? [],
            publisher: row.book_publisher,
            publishedAt: row.book_published_at?.toISOString() ?? null,
            isbn: row.book_isbn,
            pageCount: row.book_page_count,
            domain: row.book_domain,
            status: row.book_status as BookDetails["status"],
            startedAt: row.book_started_at?.toISOString() ?? null,
            startedAtPrecision:
              row.book_started_at_precision as BookDetails["startedAtPrecision"],
            finishedAt: row.book_finished_at?.toISOString() ?? null,
            finishedAtPrecision:
              row.book_finished_at_precision as BookDetails["finishedAtPrecision"],
            progressValue: row.book_progress_value,
            progressUnit: (row.book_progress_unit ??
              "page") as BookDetails["progressUnit"],
            progressUpdatedAt:
              row.book_progress_updated_at?.toISOString() ?? null,
            rating: row.book_rating,
            review: row.book_review,
          } satisfies BookDetails)
        : null,
    noteDetails:
      row.note_content !== null ? { content: row.note_content } : null,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Parse colors from database (could be string or object).
 */
function parseColors(colors: unknown): ImageColor[] | null {
  if (!colors) return null;
  if (Array.isArray(colors)) {
    return colors as ImageColor[];
  }
  if (typeof colors === "string") {
    try {
      return JSON.parse(colors);
    } catch {
      return null;
    }
  }
  return null;
}

function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function isValidCursorData(value: unknown): value is CursorData {
  if (typeof value !== "object" || value === null) return false;
  const { captureDate, createdAt, id } = value as Record<string, unknown>;
  if (typeof createdAt !== "string" || typeof id !== "string") return false;
  // id is compared against a uuid column ($n::uuid), createdAt/captureDate
  // against timestamp columns — reject anything Postgres would 500 on.
  if (!isCanonicalUuid(id)) return false;
  if (Number.isNaN(new Date(createdAt).getTime())) return false;
  if (captureDate !== null) {
    if (typeof captureDate !== "string") return false;
    if (Number.isNaN(new Date(captureDate).getTime())) return false;
  }
  return true;
}

// Not deduped with @/lib/pagination's decodeCursor: this CursorData carries an
// extra `captureDate` field, so shape validation differs. Hardening mirrors the
// shared helper — reject malformed/wrong-shape cursors instead of 500ing.
function decodeCursor(cursor: string): CursorData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  return isValidCursorData(parsed) ? parsed : null;
}

/**
 * GET /api/v1/search
 *
 * Main search endpoint with two modes:
 * 1. Filters only (no `q` param): Standard DB query with cursor pagination
 * 2. Free text search (has `q` param): Full-text + vector search with RRF ranking
 *
 * Requires at least one filter or query parameter.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const warnings: SearchWarning[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(user.id, "search");
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult, "search"),
        },
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const cursor = searchParams.get("cursor");
    const filters = parseFiltersFromParams(searchParams);

    // Validate enum-based filters upfront and collect invalid values
    const invalidFilters: InvalidFilterValue[] = [];
    if (filters.type && filters.type.length > 0) {
      const { valid, invalid } = validateTypeFilters(filters.type);
      filters.type = valid.length > 0 ? valid : undefined;
      invalidFilters.push(...invalid);
    }
    if (filters.source && filters.source.length > 0) {
      const { valid, invalid } = validateSourceFilters(filters.source);
      filters.source = valid.length > 0 ? valid : undefined;
      invalidFilters.push(...invalid);
    }
    if (filters.status && filters.status.length > 0) {
      const { valid, invalid } = validateStatusFilters(filters.status);
      filters.status = valid.length > 0 ? valid : undefined;
      invalidFilters.push(...invalid);
    }

    // Require at least one filter or query
    if (!query && !hasFilters(filters)) {
      // If we have invalid filters but no valid filters, return helpful error
      if (invalidFilters.length > 0) {
        return NextResponse.json(
          {
            message: "No valid filters provided",
            invalidFilters,
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: "At least one filter or query parameter is required" },
        { status: 400 },
      );
    }

    let results: {
      items: SearchItem[];
      total: number;
      cursor?: string;
    };

    if (query) {
      // Text search mode: Full-text search (vector search will be added in Chunk 5-6)
      results = await executeRankedSearch(user.id, filters, query, warnings);
    } else {
      // Filters-only mode with cursor pagination
      results = await executeFiltersOnlySearch(user.id, filters, cursor);
    }

    // Check for slow query
    if (Date.now() - startTime > 3000) {
      warnings.push("slow_query");
    }

    // Track search usage (only on first page, not cursor pagination)
    if (!cursor) {
      const posthog = getPostHogClient();
      posthog?.capture({
        distinctId: user.id,
        event: "search_performed",
        properties: {
          has_query: !!query,
          query_length: query?.length ?? 0,
          filter_count: Object.values(filters).filter(Boolean).length,
          filter_types: Object.keys(filters).filter(
            (key) => filters[key as keyof typeof filters],
          ),
          result_count: results.total,
          duration_ms: Date.now() - startTime,
        },
      });

      // Mark milestone for searching items
      void markMilestoneComplete(user.id, "search_items");
    }

    const response: SearchResponse = {
      items: results.items,
      total: results.total,
      ...(results.cursor && { cursor: results.cursor }),
      ...(warnings.length > 0 && { warnings }),
      ...(invalidFilters.length > 0 && { invalidFilters }),
    };

    return NextResponse.json(response, {
      headers: getRateLimitHeaders(rateLimitResult, "search"),
    });
  } catch (error) {
    log.error({ error }, "Search error");
    captureServerException(error, undefined, { route: "GET /api/v1/search" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

async function executeFiltersOnlySearch(
  userId: string,
  filters: ParsedFilters,
  cursor: string | null,
): Promise<{ items: SearchItem[]; total: number; cursor?: string }> {
  // Build WHERE conditions (shared with the ranked search paths). This query
  // selects `FROM items` unaliased, so qualify the fragments onto `items`.
  const { conditions, params, nextParamIndex } = buildFilterConditions(
    userId,
    filters,
    { alias: "items" },
  );
  let paramIndex = nextParamIndex;

  // Colour relevance CTE for hex-based ranking — separate ranking params, not
  // a WHERE condition, so it's built here rather than in buildFilterConditions.
  let colorRelevanceCte = "";
  let hasColorRelevanceRanking: boolean = false;
  if (filters.color && filters.color.length > 0) {
    const relevanceCte = buildColorRelevanceCte(filters.color, paramIndex);
    if (relevanceCte.hasHexFilters) {
      colorRelevanceCte = relevanceCte.cte;
      params.push(...relevanceCte.params);
      paramIndex += relevanceCte.params.length;
      hasColorRelevanceRanking = true;
    }
  }

  // Cursor pagination
  // Track params added before cursor for count query
  const paramsBeforeCursor = params.length;
  let cursorCondition = "";
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      // Use COALESCE to handle NULL capture_date in comparison
      // Order: effective_date DESC, created_at DESC, id DESC
      // We need items where (effective_date, created_at, id) < cursor values
      const effectiveDateExpr = `COALESCE(
        (SELECT iid.capture_date FROM item_image_details iid WHERE iid.item_id = items.id),
        items.created_at
      )`;
      const cursorEffectiveDate =
        cursorData.captureDate || cursorData.createdAt;

      cursorCondition = `AND (
        ${effectiveDateExpr} < $${paramIndex}::timestamp
        OR (
          ${effectiveDateExpr} = $${paramIndex}::timestamp
          AND items.created_at < $${paramIndex + 1}::timestamp
        )
        OR (
          ${effectiveDateExpr} = $${paramIndex}::timestamp
          AND items.created_at = $${paramIndex + 1}::timestamp
          AND items.id < $${paramIndex + 2}::uuid
        )
      )`;
      params.push(cursorEffectiveDate);
      paramIndex++;
      params.push(cursorData.createdAt);
      paramIndex++;
      params.push(cursorData.id);
      paramIndex++;
    }
  }

  const whereClause = conditions.join(" AND ");

  // Fetch one extra to check if there are more results
  const fetchLimit = PAGE_SIZE + 1;

  // Build ORDER BY clause - prioritize colour relevance when hex search is active
  const orderByClause = hasColorRelevanceRanking
    ? `ORDER BY
        COALESCE(cr.relevance, 0) DESC,
        COALESCE(iid.capture_date, items.created_at) DESC,
        items.created_at DESC,
        items.id DESC`
    : `ORDER BY
        COALESCE(iid.capture_date, items.created_at) DESC,
        items.created_at DESC,
        items.id DESC`;

  // Build the query with optional colour relevance CTE
  const cteClause = hasColorRelevanceRanking ? `WITH ${colorRelevanceCte}` : "";
  const colorRelevanceJoin = hasColorRelevanceRanking
    ? "LEFT JOIN color_relevance cr ON cr.item_id = items.id"
    : "";

  // Query items with all fields needed for display
  const itemsQuery = `
    ${cteClause}
    SELECT
      items.id,
      items.kind,
      items.processing_status,
      items.file_key,
      items.cover_file_key,
      items.favicon_file_key,
      items.meta,
      items.source_type,
      items.source_url,
      items.capture_source,
      items.title,
      items.description,
      items.tags,
      items.user_tags,
      items.created_at,
      iid.objects,
      iid.colors,
      iid.ocr_text,
      iid.capture_date,
      iid.blur_data_url,
      ad.author as article_author,
      ad.domain as article_domain,
      ad.published_at as article_published_at,
      ad.reading_time as article_reading_time,
      ad.content as article_content,
      td.tweet_id as twitter_tweet_id,
      td.author_name as twitter_author_name,
      td.author_username as twitter_author_username,
      td.author_avatar_url as twitter_author_avatar_url,
      td.text as twitter_text,
      td.posted_at as twitter_posted_at,
      td.media as twitter_media,
      td.quoted_tweet_id as twitter_quoted_tweet_id,
      td.card as twitter_card,
      td.cover_media_index as twitter_cover_media_index,
      ig.post_id as instagram_post_id,
      ig.media_type as instagram_media_type,
      ig.author_name as instagram_author_name,
      ig.author_username as instagram_author_username,
      ig.caption as instagram_caption,
      ig.posted_at as instagram_posted_at,
      ig.media as instagram_media,
      ig.like_count as instagram_like_count,
      ig.comment_count as instagram_comment_count,
      ig.cover_media_index as instagram_cover_media_index,
      vd.platform as video_platform,
      vd.video_id as video_video_id,
      vd.channel_name as video_channel_name,
      vd.channel_url as video_channel_url,
      vd.duration as video_duration,
      vd.embed_url as video_embed_url,
      vd.thumbnail_url as video_thumbnail_url,
      pd.domain as product_domain,
      pd.brand as product_brand,
      pd.price as product_price,
      pd.currency as product_currency,
      pd.availability as product_availability,
      pd.images as product_images,
      pd.cover_image_index as product_cover_image_index,
      bd.authors as book_authors,
      bd.publisher as book_publisher,
      bd.published_at as book_published_at,
      bd.isbn as book_isbn,
      bd.page_count as book_page_count,
      bd.domain as book_domain,
      bd.status as book_status,
      bd.started_at as book_started_at,
      bd.started_at_precision as book_started_at_precision,
      bd.finished_at as book_finished_at,
      bd.finished_at_precision as book_finished_at_precision,
      bd.progress_value as book_progress_value,
      bd.progress_unit as book_progress_unit,
      bd.progress_updated_at as book_progress_updated_at,
      bd.rating as book_rating,
      bd.review as book_review,
      nd.content as note_content
    FROM items
    LEFT JOIN item_image_details iid ON iid.item_id = items.id
    LEFT JOIN item_article_details ad ON ad.item_id = items.id
    LEFT JOIN item_twitter_details td ON td.item_id = items.id
    LEFT JOIN item_instagram_details ig ON ig.item_id = items.id
    LEFT JOIN item_video_details vd ON vd.item_id = items.id
    LEFT JOIN item_product_details pd ON pd.item_id = items.id
    LEFT JOIN item_book_details bd ON bd.item_id = items.id
    LEFT JOIN item_note_details nd ON nd.item_id = items.id
    ${colorRelevanceJoin}
    WHERE ${whereClause}
    ${cursorCondition}
    ${orderByClause}
    LIMIT ${fetchLimit}
  `;

  const rawItems = await db.$queryRawUnsafe<RawItemRow[]>(
    itemsQuery,
    ...params,
  );

  // Get item IDs for location fetch
  const itemIds = rawItems.map((item) => item.id);

  // Fetch locations for all items in one query
  const locations =
    itemIds.length > 0
      ? await db.$queryRawUnsafe<RawLocationRow[]>(
          `SELECT id, item_id, source, latitude, longitude, neighborhood, city, region, country, country_code, formatted
         FROM item_locations
         WHERE item_id = ANY($1::uuid[])`,
          itemIds,
        )
      : [];

  // Group locations by item_id
  const locationsByItemId = new Map<string, RawLocationRow[]>();
  for (const loc of locations) {
    const existing = locationsByItemId.get(loc.item_id) || [];
    existing.push(loc);
    locationsByItemId.set(loc.item_id, existing);
  }

  // Check if there are more results
  const hasMore = rawItems.length > PAGE_SIZE;
  const pageItems = rawItems.slice(0, PAGE_SIZE);

  // Build match reasons based on filters
  const buildMatchReasons = (_itemId: string): MatchReason[] => {
    const reasons: MatchReason[] = [];

    if (filters.type && filters.type.length > 0) {
      for (const f of filters.type) {
        if (!f.negated) {
          reasons.push({ field: "type", value: f.value });
        }
      }
    }

    if (filters.tag && filters.tag.length > 0) {
      for (const f of filters.tag) {
        if (!f.negated) {
          reasons.push({ field: "tags", value: f.value });
        }
      }
    }

    if (filters.object && filters.object.length > 0) {
      for (const f of filters.object) {
        if (!f.negated) {
          reasons.push({ field: "objects", value: f.value });
        }
      }
    }

    if (filters.source && filters.source.length > 0) {
      for (const f of filters.source) {
        if (!f.negated) {
          reasons.push({ field: "source", value: f.value });
        }
      }
    }

    if (filters.location && filters.location.length > 0) {
      for (const f of filters.location) {
        if (!f.negated) {
          reasons.push({ field: "location", value: f.value });
        }
      }
    }

    if (filters.color && filters.color.length > 0) {
      for (const f of filters.color) {
        if (!f.negated) {
          const colorName = normalizeColorFilterValue(f.value);
          reasons.push({
            field: "colors",
            value: colorName || f.value,
          });
        }
      }
    }

    return reasons;
  };

  // Transform raw items to SearchItem format
  const resultItems: SearchItem[] = pageItems.map((item) => ({
    ...transformRawItemToItem(item, locationsByItemId.get(item.id) || []),
    match: { reasons: buildMatchReasons(item.id) },
  }));

  // Generate cursor for next page
  let nextCursor: string | undefined;
  if (hasMore && pageItems.length > 0) {
    const lastItem = pageItems[pageItems.length - 1];
    nextCursor = encodeCursor({
      captureDate: lastItem.capture_date?.toISOString() ?? null,
      createdAt: lastItem.created_at.toISOString(),
      id: lastItem.id,
    });
  }

  // Get total count (without pagination)
  const countQuery = `
    SELECT COUNT(*) as count
    FROM items
    LEFT JOIN item_image_details iid ON iid.item_id = items.id
    WHERE ${whereClause}
  `;
  const countResult = await db.$queryRawUnsafe<[{ count: bigint }]>(
    countQuery,
    ...params.slice(0, paramsBeforeCursor), // Exclude cursor params
  );
  const total = Number(countResult[0].count);

  return {
    items: resultItems,
    total,
    cursor: nextCursor,
  };
}

/**
 * Execute ranked search using full-text + vector + OCR search with RRF.
 */
async function executeRankedSearch(
  userId: string,
  filters: ParsedFilters,
  query: string,
  warnings: SearchWarning[],
): Promise<{ items: SearchItem[]; total: number }> {
  // Full-text + vector + OCR fused with RRF (shared with the MCP server)
  const ranked = await rankedSearch(userId, filters, query, {
    onVectorUnavailable: () => warnings.push("vector_search_unavailable"),
  });

  if (ranked.length === 0) {
    return { items: [], total: 0 };
  }

  // Index the match metadata by item id for reason-building below
  const ocrSnippets = new Map<string, string>();
  const vectorSimilarities = new Map<string, number>();
  const sourceMap = new Map<string, string[]>();
  for (const result of ranked) {
    if (result.ocrSnippet) ocrSnippets.set(result.id, result.ocrSnippet);
    if (result.vectorSimilarity !== null) {
      vectorSimilarities.set(result.id, result.vectorSimilarity);
    }
    sourceMap.set(result.id, result.sources);
  }

  // Fetch full item data for the ranked results
  const itemIds = ranked.map((r) => r.id);

  const rawItems = await db.$queryRawUnsafe<RawItemRow[]>(
    `
    SELECT
      i.id,
      i.kind,
      i.processing_status,
      i.file_key,
      i.cover_file_key,
      i.favicon_file_key,
      i.meta,
      i.source_type,
      i.source_url,
      i.capture_source,
      i.title,
      i.description,
      i.tags,
      i.user_tags,
      i.notes,
      i.created_at,
      iid.objects,
      iid.colors,
      iid.ocr_text,
      iid.capture_date,
      iid.blur_data_url,
      ad.author as article_author,
      ad.domain as article_domain,
      ad.published_at as article_published_at,
      ad.reading_time as article_reading_time,
      ad.content as article_content,
      td.tweet_id as twitter_tweet_id,
      td.author_name as twitter_author_name,
      td.author_username as twitter_author_username,
      td.author_avatar_url as twitter_author_avatar_url,
      td.text as twitter_text,
      td.posted_at as twitter_posted_at,
      td.media as twitter_media,
      td.quoted_tweet_id as twitter_quoted_tweet_id,
      td.card as twitter_card,
      td.cover_media_index as twitter_cover_media_index,
      ig.post_id as instagram_post_id,
      ig.media_type as instagram_media_type,
      ig.author_name as instagram_author_name,
      ig.author_username as instagram_author_username,
      ig.caption as instagram_caption,
      ig.posted_at as instagram_posted_at,
      ig.media as instagram_media,
      ig.like_count as instagram_like_count,
      ig.comment_count as instagram_comment_count,
      ig.cover_media_index as instagram_cover_media_index,
      vd.platform as video_platform,
      vd.video_id as video_video_id,
      vd.channel_name as video_channel_name,
      vd.channel_url as video_channel_url,
      vd.duration as video_duration,
      vd.embed_url as video_embed_url,
      vd.thumbnail_url as video_thumbnail_url,
      pd.domain as product_domain,
      pd.brand as product_brand,
      pd.price as product_price,
      pd.currency as product_currency,
      pd.availability as product_availability,
      pd.images as product_images,
      pd.cover_image_index as product_cover_image_index,
      bd.authors as book_authors,
      bd.publisher as book_publisher,
      bd.published_at as book_published_at,
      bd.isbn as book_isbn,
      bd.page_count as book_page_count,
      bd.domain as book_domain,
      bd.status as book_status,
      bd.started_at as book_started_at,
      bd.started_at_precision as book_started_at_precision,
      bd.finished_at as book_finished_at,
      bd.finished_at_precision as book_finished_at_precision,
      bd.progress_value as book_progress_value,
      bd.progress_unit as book_progress_unit,
      bd.progress_updated_at as book_progress_updated_at,
      bd.rating as book_rating,
      bd.review as book_review,
      nd.content as note_content
    FROM items i
    LEFT JOIN item_image_details iid ON iid.item_id = i.id
    LEFT JOIN item_article_details ad ON ad.item_id = i.id
    LEFT JOIN item_twitter_details td ON td.item_id = i.id
    LEFT JOIN item_instagram_details ig ON ig.item_id = i.id
    LEFT JOIN item_video_details vd ON vd.item_id = i.id
    LEFT JOIN item_product_details pd ON pd.item_id = i.id
    LEFT JOIN item_book_details bd ON bd.item_id = i.id
    LEFT JOIN item_note_details nd ON nd.item_id = i.id
    WHERE i.id = ANY($1::uuid[])
  `,
    itemIds,
  );

  // Fetch locations for all items in one query
  const locations =
    itemIds.length > 0
      ? await db.$queryRawUnsafe<RawLocationRow[]>(
          `SELECT id, item_id, source, latitude, longitude, neighborhood, city, region, country, country_code, formatted
         FROM item_locations
         WHERE item_id = ANY($1::uuid[])`,
          itemIds,
        )
      : [];

  // Group locations by item_id
  const locationsByItemId = new Map<string, RawLocationRow[]>();
  for (const loc of locations) {
    const existing = locationsByItemId.get(loc.item_id) || [];
    existing.push(loc);
    locationsByItemId.set(loc.item_id, existing);
  }

  // Create a map for quick lookup
  const itemMap = new Map(rawItems.map((item) => [item.id, item]));

  // Build result items in RRF rank order
  // Color filter is already applied in the individual search functions
  const resultItems: SearchItem[] = [];
  for (const result of ranked) {
    const item = itemMap.get(result.id);
    if (!item) continue;

    const ocrSnippet = ocrSnippets.get(result.id);
    const sources = sourceMap.get(result.id) || [];
    const vectorSimilarity = vectorSimilarities.get(result.id);

    // Build match reasons
    const reasons: MatchReason[] = [];

    // Add search match reasons based on sources
    const hasFulltext = sources.includes("fulltext");
    const hasVector = sources.includes("vector");
    const hasOcr = sources.includes("ocr");

    // OCR match (from dedicated OCR search)
    if (hasOcr && ocrSnippet) {
      reasons.push({
        field: "ocrText",
        snippet: ocrSnippet,
      });
    }

    // Full-text match (title, tags, description)
    if (hasFulltext) {
      reasons.push({
        field: null, // indicates full-text match on metadata
        value: query,
      });
    }

    // Vector/semantic match
    if (hasVector && vectorSimilarity !== undefined) {
      // Convert similarity score to 0-1 proximity
      // Inner product similarity can range roughly -1 to 1 for normalized vectors
      // Map to 0-1 where higher = more similar
      const proximity = Math.max(0, Math.min(1, (vectorSimilarity + 1) / 2));
      reasons.push({
        field: null, // null field indicates semantic/vector match
        value: query,
        proximity,
      });
    }

    // Add filter-based match reasons
    if (filters.type) {
      for (const f of filters.type) {
        if (!f.negated) reasons.push({ field: "type", value: f.value });
      }
    }
    if (filters.tag) {
      for (const f of filters.tag) {
        if (!f.negated) reasons.push({ field: "tags", value: f.value });
      }
    }
    if (filters.object) {
      for (const f of filters.object) {
        if (!f.negated) reasons.push({ field: "objects", value: f.value });
      }
    }
    if (filters.source) {
      for (const f of filters.source) {
        if (!f.negated) reasons.push({ field: "source", value: f.value });
      }
    }
    if (filters.location) {
      for (const f of filters.location) {
        if (!f.negated) reasons.push({ field: "location", value: f.value });
      }
    }
    if (filters.color) {
      for (const f of filters.color) {
        if (!f.negated) {
          const colorName = normalizeColorFilterValue(f.value);
          reasons.push({ field: "colors", value: colorName || f.value });
        }
      }
    }

    resultItems.push({
      ...transformRawItemToItem(item, locationsByItemId.get(item.id) || []),
      match: { reasons },
    });
  }

  return {
    items: resultItems,
    total: resultItems.length,
  };
}
