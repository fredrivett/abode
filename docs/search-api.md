# Search API

**Status:** Implemented
**Owner:** Unassigned

## Overview

Hybrid search using pgvector + Postgres full-text search. Keeps everything in one database with no sync complexity.

> **Future consideration:** If we need typo tolerance, synonyms, or better ranking, consider migrating to Typesense.

## Authentication

All endpoints require auth. Scope queries to the authenticated user's items only (follow pattern in `GET /api/v1/items`).

## Two Search Modes

### Filters Only (no `q` param)

- Standard DB query with WHERE clauses
- Paginate by capture date desc (fallback to `createdAt`) with cursor, page size 20
- Returns page of results + cursor for next page

### Free Text Search (has `q` param, may include filters)

- Apply any filters as WHERE clauses first (narrows the search pool)
- Run full-text + vector search in parallel on filtered set
- Merge with RRF (k=60), cap at top 100 results
- Return all 100 items in one response (minimal fields)
- Client paginates through the list (shows 10-20 at a time, loads more on scroll)

**Requires at least one filter or query** — for unfiltered item listing, use `GET /api/v1/items`.

## Query Param Examples

```
# Simple text search
GET /api/v1/search?q=blue+car

# Filters only (cursor pagination)
GET /api/v1/search?type=image&tag=vacation
GET /api/v1/search?type=image&cursor=abc123

# Text search with filters
GET /api/v1/search?q=sunset&type=image&tag=vacation&tag=summer

# Negated filter
GET /api/v1/search?q=beach&tag=!work

# Color search
GET /api/v1/search?color=red
GET /api/v1/search?color=%23FF5733

# Date range (uses capture date if available, else createdAt)
GET /api/v1/search?date=>2024-01-01&date=<2024-06-01

# Location (flat search across all location fields)
GET /api/v1/search?location=paris

# Object detection filter
GET /api/v1/search?object=person

# OCR-specific search
GET /api/v1/search?ocr=receipt
```

Frontend translates `@tag:vacation` syntax to `tag=vacation` query params before calling API.

## Ranking: RRF (Reciprocal Rank Fusion)

Run both queries, fetch top 100 from each, merge by rank position. Items appearing in both lists get boosted naturally.

**Formula:** `score = Σ 1/(k + rank)` where k=60

- **Full-text**: Weighted tsvector search on `title` (A), `description`/`tags` (B), `ocrText` (C)
- **Vector**: Embed query using OpenAI `text-embedding-3-small`, inner product similarity on `item_text_vectors`

> Note: 100 from each for 100 results is fine at our scale. If ranking gaps appear later, bump to 150-200 from each.

## Filter Implementation

Filters are **exact match, case-insensitive**. Fuzzy/partial matching happens via free text search (`q`), not filters.

**Data stored as-is** (preserving original case). Queries use case-insensitive comparison:

| Filter | Implementation |
|--------|----------------|
| `type=image` | `WHERE kind = 'image'` |
| `tag=landscape` | `WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower('landscape'))` |
| `tag=!work` | `WHERE NOT EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower('work'))` |
| `object=tree` | `WHERE EXISTS (SELECT 1 FROM unnest(objects) t WHERE lower(t) = lower('tree'))` |
| `source=camera` | `WHERE lower(source) = lower('camera')` |
| `color=red` or `color=#FF5733` | Convert named colors to hex, find items with closest color match within deltaE ≤ 5.0 threshold (using `color-diff` library with CIE76 formula) |
| `date=>2024-01-15` | `WHERE COALESCE(capture_date, created_at) > date` |
| `location=paris` | `WHERE EXISTS (SELECT 1 FROM item_locations WHERE item_id = items.id AND (lower(city) = lower('paris') OR lower(country) = lower('paris') OR lower(region) = lower('paris') OR lower(neighborhood) = lower('paris')))` |
| `ocr=receipt` | Full-text search on `ocr_text` field only |

## Response Shape

```typescript
type SearchWarning =
  | "vector_search_unavailable"
  | "rate_limited"
  | "partial_results"
  | "slow_query";

type MatchReason = {
  field: string | null;  // "title", "tags", "location.city", null for vector
  value?: string;        // matched term, hex, "Paris"
  snippet?: string;      // "...total: $45.00 from **receipt**..." (for ocrText matches)
  proximity?: number;    // 0-1 for fuzzy matches (color, vector)
};

type SearchResultItem = {
  id: string;
  kind: string;
  fileKey: string;
  title: string | null;
  tags: string[];
  colors: { hex: string; percentage: number }[] | null;
  createdAt: string;
  match: {
    reasons: MatchReason[];
  };
};

type SearchResponse = {
  items: SearchResultItem[];
  total: number;               // total matches (may exceed 100 for ranked mode)
  cursor?: string;             // only present for filters-only mode (base64 encoded)
  warnings?: SearchWarning[];
};
```

**Match type inference from field:**
- `"title"`, `"tags"`, `"ocrText"` → text match
- `"colors"` → color match (include proximity 0-1)
- `"location.city"`, `"location.country"` etc → location match
- `null` → vector/semantic match (include proximity 0-1)

## Cursor Format

Base64-encoded JSON for filters-only pagination:

```typescript
// Encoded cursor contains:
{
  captureDate: string | null;  // ISO timestamp or null
  createdAt: string;           // ISO timestamp (fallback sort)
  id: string;                  // tie-breaker
}

// Example: eyJjYXB0dXJlRGF0ZSI6bnVsbCwiY3JlYXRlZEF0IjoiMjAyNC0wMS0xNVQxMjowMDowMFoiLCJpZCI6ImFiYzEyMyJ9
```

## Error Handling & Fallbacks

- **Embedding API failure** (timeout, rate limit): Fall back to text-only search, include `"vector_search_unavailable"` in `warnings` array. UI can show toast and allow retry.
- **DB error**: Return 500, frontend shows error toast
- **No results**: Return empty array, frontend shows "No items found"
- **No query or filters**: Return 400, require at least one
- **Slow query** (>3s): Include `"slow_query"` warning

## Rate Limiting

Basic rate limiting from the start using middleware:

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `GET /api/v1/search` | 30 req/min | Expensive (embedding API calls) |
| `GET /api/v1/filters` | 120 req/min | Cheap (DB reads only) |

Return `429 Too Many Requests` with `Retry-After` header (seconds until limit resets).

## Query Embedding Cache

Cache query embeddings to reduce OpenAI API calls. This cache stores **query text → embedding vector** mappings, not search results. No invalidation needed when items change because the same query always produces the same embedding.

```typescript
import { LRUCache } from 'lru-cache';

const queryEmbeddingCache = new LRUCache<string, number[]>({
  max: 1000,            // max 1000 cached queries
  ttl: 1000 * 60 * 60,  // 1 hour TTL (for memory management only)
});

async function getQueryEmbedding(query: string): Promise<number[]> {
  const normalized = query.toLowerCase().trim();

  const cached = queryEmbeddingCache.get(normalized);
  if (cached) return cached;

  const embedding = await generateTextEmbedding(normalized);
  queryEmbeddingCache.set(normalized, embedding);
  return embedding;
}
```

## Implementation: Parallel Search

Execute full-text and vector search in parallel at the application level:

```typescript
const [textResults, vectorResults] = await Promise.all([
  fullTextSearch(userId, filters, query, 100),
  vectorSearch(userId, filters, queryEmbedding, 100),
]);

const merged = reciprocalRankFusion(textResults, vectorResults, { k: 60, limit: 100 });
```

This approach:
- Keeps queries simple and debuggable
- Allows independent optimization of each search type
- Parallel execution keeps latency low

## Database Migration

### 1. Add tsvector generated column with weights

Prisma doesn't support generated columns natively, so:

**Step 1:** Add to schema.prisma so Prisma knows the column exists:

```prisma
model Item {
  // ... other fields
  searchVector Unsupported("tsvector")?
}
```

**Step 2:** Create and edit migration:

```bash
npx prisma migrate dev --name add_search_vector --create-only
```

**Step 3:** Edit the generated .sql file:

```sql
-- Add weighted tsvector column
ALTER TABLE items ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(ocr_text, '')), 'C')
  ) STORED;

-- GIN index for full-text search
CREATE INDEX items_search_idx ON items USING GIN (search_vector);
```

**Step 4:** Run the migration:

```bash
npx prisma migrate dev
```

### 2. Add GIN indexes for array filtering

Current btree indexes on `tags` and `objects` don't support `= ANY()` efficiently. Add GIN indexes:

```sql
-- Replace btree with GIN for array element lookups
DROP INDEX IF EXISTS items_tags_idx;
DROP INDEX IF EXISTS items_objects_idx;

CREATE INDEX items_tags_gin_idx ON items USING GIN (tags);
CREATE INDEX items_objects_gin_idx ON items USING GIN (objects);
```

### 3. Add location indexes

```sql
CREATE INDEX idx_item_locations_city ON item_locations (lower(city));
CREATE INDEX idx_item_locations_country ON item_locations (lower(country));
CREATE INDEX idx_item_locations_region ON item_locations (lower(region));
CREATE INDEX idx_item_locations_neighborhood ON item_locations (lower(neighborhood));
```

## Data Sync

Two different sync mechanisms:

- **tsvector column**: Auto-synced by PostgreSQL (generated column updates when source fields change)
- **Vector embeddings**: Synced via Trigger.dev job on upload, stores in `item_text_vectors` (1536d OpenAI) and `item_visual_vectors` (768d CLIP)

## Existing Code to Integrate With

- `app/src/lib/search/types.ts` — Filter types, parsing, serialization (frontend `@tag:x` syntax)
- `app/src/lib/search/use-search.ts` — URL state management hook
- `app/src/components/search/` — Search input, filter chips, dropdowns
- `app/src/lib/embeddings.ts` — OpenAI embedding functions

## Endpoints

### `GET /api/v1/search` — Main search endpoint

**Query params:** `q`, `type`, `tag`, `object`, `color`, `date`, `source`, `location`, `ocr`, `cursor`

**Requirements:**
- At least one of `q` or a filter param
- Auth required

**Returns:** Items with match metadata (see response shape above)

### `GET /api/v1/filters` — Available filter values for autocomplete

**Query params:** `type` (optional — tag, object, color, source, location)

**Behavior:**
- If `type` provided: returns values for that filter type only
- If no `type`: returns all filter values grouped by type
- All values sorted alphabetically at API level
- Location values deduplicated across all location fields

**Response:**

```typescript
type FiltersResponse = {
  tag?: string[];
  object?: string[];
  color?: string[];      // hex values
  source?: string[];
  location?: string[];   // deduplicated flat list of unique city/country/neighborhood/region values
};
```

---

## Future Considerations

Features to consider adding later:

- **Sort options** — currently hardcoded to relevance for search, date for filters
- **Faceted counts** — "10 images, 5 videos" breakdown in results
- **Search history** — recent searches for quick access
- **Saved searches** — bookmarkable filter combinations

### Performance: Case-insensitive tag/object filtering

The current tag and object filters use `lower()` for case-insensitive matching:

```sql
EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower($1))
```

This prevents PostgreSQL from using GIN indexes on the arrays, requiring a scan of each tag in each row. At small scale (hundreds/thousands of items per user) this is fine since queries are already scoped to a single user. At larger scale it may become slow.

**Potential solutions:**

1. **Generated column** (recommended) — Add a `tags_lower text[]` generated column that stores lowercased tags, with a GIN index on that column. Query uses `tags_lower`, UI displays original `tags`. Preserves user casing (`iPhone`, `NYC`) while enabling index usage.

2. **Normalize on write** — Store tags lowercase when saving. Query becomes `WHERE $1 = ANY(tags)` which uses the GIN index directly. Simpler but loses original case in the UI.

3. **Expression index** — Not directly supported for arrays with `lower()`, but could work with a custom function.
