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
- [ ] **Image analysis & auto-tagging (Google Cloud Vision)**
  - [ ] Set up Google Cloud project and enable Vision API.
  - [ ] Add Vision API credentials to env vars.
  - [ ] Create image analysis service that calls Vision API on upload.
  - [ ] Extract and store: labels/tags, OCR text, dominant colors, metadata.
  - [ ] Update `items.meta` schema to include: `tags[]`, `ocrText`, `colors[]`, `visionData`.
  - [ ] Add client-side color extraction as fallback/supplement (node-vibrant).
- [ ] **pgvector & embeddings**
  - [ ] Enable pgvector extension in Supabase.
  - [ ] Add `item_vectors` table with columns: `item_id`, `embedding vector(1536)`, `embedding_type` (text/image).
  - [ ] Set up OpenAI embeddings API (text-embedding-3-small for text).
  - [ ] Generate embeddings for: OCR text, tags, user notes.
  - [ ] Store embeddings in `item_vectors` table linked to items.
- [ ] **Search implementation (hybrid: vector + full-text)**
  - [ ] Add PostgreSQL full-text search on `items.meta` (tags, OCR text, notes).
  - [ ] Implement vector similarity search using pgvector for semantic queries.
  - [ ] Create unified search API that combines both approaches:
    - Full-text search for exact matches (tags, OCR text)
    - Vector search for semantic/fuzzy queries
    - Color filtering (exact match on extracted colors)
    - Date range filtering
  - [ ] Build search UI with real-time results and filters.
  - [ ] Add search by color (visual color picker + hex input).
  - [ ] Consider adding "find similar" feature using vector similarity.
- [ ] **Async/worker stubs**
  - [ ] Add placeholder queue/job layer (start with simple cron/worker script to process `jobs` table; avoid Inngest until needed) with contracts for metadata, OCR, embeddings.
  - [ ] Document expected payloads in `docs/workers.md`.
- [ ] **Testing & linting**
  - [ ] Keep Biome for lint/format.
  - [ ] Add tests only when needed; defer baseline Vitest + Testing Library setup unless required.
- [ ] **Observability**
  - [ ] Add `pino` logger wrapper (reuse patterns from FR/log.limo); plan for Sentry instrumentation hook when justified.

### Outstanding questions

- **Image analysis privacy:** V1 uses Google Cloud Vision; consider self-hosted option (CLIP + Tesseract) for V2 with privacy toggle.
- **Visual similarity:** Defer CLIP image embeddings for "same vibe" / similar images feature until V2.
- **Smart Spaces:** Auto-clustering/grouping can be added after basic search works.

### Frontend

- Next.js App Router with Tailwind CSS v4, shadcn/ui components, Storybook, and TanStack Query for client cache/mutations.

### Data & API Layer

- Prisma ORM connected to Supabase Postgres. Share Zod schemas between client/server.
- Next Route Handlers and server actions expose REST/RPC endpoints secured via middleware.

### Authentication & Authorization

- Using Supabase Auth with `@supabase/ssr` package; enforce RLS on tables keyed by `user_id`.

### Search & Similarity

- **Hybrid search:** Combine PostgreSQL full-text search (exact matches) with pgvector semantic search (fuzzy/meaning-based queries).
- **Text embeddings:** OpenAI text-embedding-3-small for OCR text, tags, and notes stored in `item_vectors` table.
- **Image analysis:** Google Cloud Vision API for auto-tagging, OCR, and color extraction (V1).
- **Visual similarity (V2):** Consider CLIP image embeddings for "same vibe" / similar images feature.
- **Privacy option (V2):** Self-hosted CLIP + Tesseract stack as alternative to Google Vision for privacy-conscious users.

### Async Processing & Workers

- Phase in Inngest for orchestration when enrichment pipelines (metadata, OCR, embeddings, auto-tagging) are ready.
- Deploy Python workers (e.g., PaddleOCR, article parsing) on Railway only when needed; keep queue interfaces idempotent.

### Caching & Queues

- Defer Redis until pressure arises; Upstash Redis is the preferred managed option for dedupe caches, rate limits, or job coordination when required.

### File Storage

- Supabase Storage buckets with signed URLs and RLS-aware policies for user uploads.
- Benefits: first-class integration with Supabase auth, S3-compatible API, CDN.

### Infrastructure & Deployment

- Deploy web app on Vercel (preview URLs, edge features). Supabase manages Postgres/auth/storage.
- Consider adding Railway for long-lived/background workers when enrichment pipelines go live.
- Maintain environment secrets via provider tooling (Vercel env, Supabase secrets).

### Observability & Tooling

- Adopt Pino for structured logging, integrate Sentry once instrumentation is needed, and consider OpenTelemetry exporters for tracing.
- Keep Biome for lint/format; add Vitest + Testing Library for unit/integration tests and Playwright for e2e flows.

### Future Considerations

- Optional modules (OCR, embeddings, auto-tagging) should be toggleable via env flags to support self-hosters.
- Revisit Storybook, design systems, and advanced hosting consolidation as roadmap evolves.
