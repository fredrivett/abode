## Tech Foundations Plan

### Setup Checklist

- [x] **Bootstrap app workspace**
  - [x] Run `bin/install` to ensure Bun dependencies are installed inside `app/`.
  - [x] Confirm `bin/dev` serves the Next.js app on http://localhost:3300.
- [x] **Tailwind CSS v4 + design tokens**
  - [x] Upgrade/verify Tailwind v4 config, add base tokens (colors, spacing, typography).
  - [x] Wire global styles (`app/src/app/globals.css`) and add a `tailwind.config.ts` preset when needed.
- [x] **shadcn/ui + component scaffolding**
  - [x] Install shadcn CLI, generate foundational components (Button, Input).
- [x] **Storybook**
  - [x] Install Storybook (Next preset) inside `app/`.
  - [x] Add a couple of example stories for shadcn components.
  - [x] Wire Storybook into `bin/dev` so it runs alongside Next.js (headless/no-open).
- [x] **Supabase & Prisma plumbing**
  - [x] Add Supabase CLI config (`supabase/config.toml`) and auto-start via `bin/install`/`bin/dev`.
  - [x] Setup prisma, initial schema, run migration.
- [x] **Prisma workflow**
  - [x] Add `bun run prisma:generate` and `bun run prisma:migrate` scripts.
  - [x] Integrate Prisma client helper with edge-safe `globalThis` guard.
- [x] **TanStack Query + API layer**
  - [x] Install `@tanstack/react-query` and set up the provider in `app/src/app/layout.tsx`.
  - [ ] Add a shared fetch client with Supabase access token injection, error normalization, and lightweight retry for 429/5xx; wire as the default TanStack Query fetcher.
- [x] **Supabase auth**
  - [x] Configure Supabase project, enable email auth, and set JWT secret locally.
  - [x] Implement middleware to load the session, enforce `user_id` scoping, and wire client helpers.
  - [x] Create auth pages (login, signup) with OTP email verification.
  - [x] Set up trigger to sync auth.users to public.users table.
- [x] **Storage & uploads**
  - [x] Create general-purpose Supabase storage bucket(s) with RLS policies (items bucket, private, 50MB limit + MIME allowlist).
  - [x] Add upload helpers (direct-to-storage from client with automatic dimension capture).
  - [x] Build dashboard UI with masonry grid layout for uploaded images.
  - [x] Implement delete functionality (removes from both storage and DB).
  - [x] Update schema with columns for AI analysis: `title`, `description`, `tags[]`, `objects[]`, `ocrText`, `colors`, `visionData`.
  - [x] Enable RLS on `items` table with policies: SELECT/INSERT/UPDATE/DELETE WHERE `user_id = auth.uid()` for multi-tenant data isolation.
- [x] **Image analysis & auto-tagging (Google Cloud Vision)**
  - [x] Set up Google Cloud project and enable Vision API.
  - [x] Add Vision API credentials to env vars.
  - [x] Create image analysis service that calls Vision API on upload.
  - [x] Extract and store: labels/tags, OCR text, dominant colors, metadata.
  - [x] Update `items.meta` schema to include: `tags[]`, `ocrText`, `colors[]`, `visionData`.
- [ ] **pgvector & embeddings**
  - [x] Enable pgvector extension in Supabase.
  - [x] Add split tables `item_visual_vectors` (768d) and `item_text_vectors` (1536d) with `id`, `item_id`, `user_id`, `model`, `embedding vector`, `created_at`.
  - [x] Add foreign keys: `item_id` → `items.id` (cascade delete), `user_id` → `users.id` for multi-tenant isolation.
  - [x] Index: HNSW on each embedding column (`vector_ip_ops`) plus supporting indexes on `item_id` and `user_id`.
  - [x] Enable RLS on both vector tables: `user_id = auth.uid()` for multi-tenant data isolation.
  - [x] Set up Replicate account and add `REPLICATE_API_TOKEN` to Vercel env.
  - [x] Install `replicate` and `openai` npm packages for embedding generation.
  - [x] Create embedding service (`lib/embeddings.ts`) with CLIP and OpenAI text embedding functions.
  - [x] Implement L2 normalization for embeddings before insert (for inner product optimization).
  - [x] Integrate visual embedding generation (CLIP via Replicate, 768 dims) into upload flow.
  - [x] Integrate text embedding generation (OpenAI `text-embedding-3-small`, 1536 dims) for OCR/tags/notes.
  - [x] Store vectors per kind in the split tables automatically on upload.
  - [x] Test embedding generation with sample image upload.
- [ ] **Search implementation (hybrid: vector + full-text)**
  - [ ] Add PostgreSQL full-text search on `items.meta` (tags, OCR text, notes).
  - [ ] Implement vector similarity search using pgvector with inner product distance (`<#>` operator) for semantic queries.
  - [ ] Create unified search API that combines both approaches:
    - Full-text search for exact matches (tags, OCR text)
    - Vector search for semantic/fuzzy queries (use normalized embeddings with inner product for fastest performance)
    - Color filtering (exact match on extracted colors)
    - Date range filtering
  - [ ] Build search UI with real-time results and filters.
  - [ ] Add search by color (visual color picker + hex input).
  - [ ] Add "find similar" feature using visual vector similarity (primary use case for CLIP embeddings).
- [ ] **Async/worker stubs**
  - [ ] Add placeholder queue/job layer (start with simple cron/worker script to process `jobs` table; avoid Inngest until needed) with contracts for metadata, OCR, embeddings.
  - [ ] Document expected payloads in `docs/workers.md`.
- [ ] **Testing & linting**
  - [ ] Keep Biome for lint/format.
  - [ ] Add tests only when needed; defer baseline Vitest + Testing Library setup unless required.
- [ ] **Observability**
  - [x] Add `pino` logger wrapper (reuse patterns from FR/log.limo); plan for Sentry instrumentation hook when justified.
  - [ ] Add dev-only embeddings debug UI (KNN viewer + optional PCA/UMAP scatter) to inspect vectors and nearest neighbors.
  - [ ] Monitor pgvector query performance with `pg_stat_statements`.
  - [ ] Track embedding costs (Replicate + OpenAI) via logging.

### Outstanding questions

- **Image analysis privacy:** V1 uses Google Cloud Vision; consider self-hosted option for V2 with privacy toggle.
- **Smart Spaces:** Auto-clustering/grouping can be added after basic search works.
- **Embedding model upgrades:** Start with CLIP via Replicate; upgrade to DINOv2 when quality improvements justify hosting costs.

### Frontend

- Next.js App Router with Tailwind CSS v4, shadcn/ui components, Storybook, and TanStack Query for client cache/mutations.

### Data & API Layer

- Prisma ORM connected to Supabase Postgres. Share Zod schemas between client/server.
- Next Route Handlers and server actions expose REST/RPC endpoints secured via middleware.

### Authentication & Authorization

- Using Supabase Auth with `@supabase/ssr` package; enforce RLS on tables keyed by `user_id`.

### Search & Similarity

- **Hybrid search:** Combine PostgreSQL full-text search (exact matches) with pgvector semantic search (fuzzy/meaning-based queries) using HNSW indexing with inner product distance.
- **Visual embeddings:** CLIP via Replicate API (512 dims) for "similar vibe" / visual similarity (V1). Upgrade path to DINOv2 (768 dims, superior quality) in V2.
- **Text embeddings:** OpenAI text-embedding-3-small (1536 dims) for OCR text, tags, and notes.
- **Image analysis:** Google Cloud Vision API for auto-tagging, OCR, and color extraction (V1).
- **Performance:** Normalize all embeddings (L2) and use inner product (`<#>`) for fastest similarity queries.
- **Infrastructure:** Replicate for pay-per-use CLIP embeddings (~$0.002/image), no server management required, works with Vercel deployment.
- **Privacy option (V2):** Self-hosted model stack as alternative to cloud APIs for privacy-conscious users.

### Async Processing & Workers

- **Current (Phase 1)**: Synchronous processing with increased timeout (300s)
- **Future (Phase 2)**: Will re-evaluate async options when needed (processing approaches timeout, need better UX, or require reliability improvements)
- Deploy Python workers (e.g., PaddleOCR, article parsing) on Railway only when needed; keep queue interfaces idempotent.

See [docs/async-processing-options.md](docs/async-processing-options.md) for detailed evaluation of all options (Graphile Worker, pg-boss, Inngest, Trigger.dev, QStash, custom queue) with self-hosting considerations.

### Caching & Queues

- Defer Redis until pressure arises; Upstash Redis is the preferred managed option for dedupe caches, rate limits, or job coordination when required.

### File Storage

- Supabase Storage buckets with signed URLs and RLS-aware policies for user uploads.
- Benefits: first-class integration with Supabase auth, S3-compatible API, CDN.

### Infrastructure & Deployment

- Deploy web app on Vercel (preview URLs, edge features). Supabase manages Postgres/auth/storage.
- Use Replicate for pay-per-use CLIP embeddings (no server management, auto-scales, ~$0.002/image).
- Defer Railway/Modal for workers until embedding costs exceed $50/month or need DINOv2 upgrade.
- Maintain environment secrets via provider tooling (Vercel env: `REPLICATE_API_TOKEN`, `OPENAI_API_KEY`; Supabase secrets).

### Observability & Tooling

- Adopt Pino for structured logging, integrate Sentry once instrumentation is needed, and consider OpenTelemetry exporters for tracing.
- Keep Biome for lint/format; add Vitest + Testing Library for unit/integration tests and Playwright for e2e flows.

### Future Considerations

- Optional modules (OCR, embeddings, auto-tagging) should be toggleable via env flags to support self-hosters.
- Revisit Storybook, design systems, and advanced hosting consolidation as roadmap evolves.
