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
- [ ] **Storage & uploads**
  - [ ] Create general-purpose Supabase storage bucket(s) with RLS policies (start with images; decide public vs private, max size).
  - [ ] Add upload helpers (prefer signed URL direct-to-storage; fallback: Next route proxy if needed).
- [ ] **pgvector & embeddings**
  - [ ] Enable pgvector extension in Supabase.
  - [ ] Add `item_text` (OCR/article/transcript) + `item_vectors` tables; keep `items` lean for now.
  - [ ] Add simple `jobs` table for embedding tasks processed by a lightweight worker/cron; choose embedding provider (OpenAI vs Voyage) later.
- [ ] **Async/worker stubs**
  - [ ] Add placeholder queue/job layer (start with simple cron/worker script to process `jobs` table; avoid Inngest until needed) with contracts for metadata, OCR, embeddings.
  - [ ] Document expected payloads in `docs/workers.md`.
- [ ] **Testing & linting**
  - [ ] Keep Biome for lint/format.
  - [ ] Add tests only when needed; defer baseline Vitest + Testing Library setup unless required.
- [ ] **Observability**
  - [ ] Add `pino` logger wrapper (reuse patterns from FR/log.limo); plan for Sentry instrumentation hook when justified.

### Outstanding questions

- Storage: Should the initial image bucket be public or private, and what is the expected max file size?
- Upload path: Confirm preference for signed URL direct uploads vs Next.js proxy.
- Embeddings: Which provider (OpenAI vs Voyage) when we wire the worker?

### Frontend

- Next.js App Router with Tailwind CSS v4, shadcn/ui components, Storybook, and TanStack Query for client cache/mutations.

### Data & API Layer

- Prisma ORM connected to Supabase Postgres. Share Zod schemas between client/server.
- Next Route Handlers and server actions expose REST/RPC endpoints secured via middleware.

### Authentication & Authorization

- Using Supabase Auth with `@supabase/ssr` package; enforce RLS on tables keyed by `user_id`.

### Search & Similarity

- Use pgvector in Supabase for embeddings stored in `item_vectors`.
- Generate embeddings via OpenAI or Voyage AI initially; allow swapping to self-hosted sentence-transformers later for cost control.

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
