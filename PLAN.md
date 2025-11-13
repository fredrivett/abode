## Tech Foundations Plan

### Setup Checklist

- [x] **Bootstrap app workspace**
  - [x] Run `bin/install` to ensure Bun dependencies are installed inside `app/`.
  - [x] Confirm `bin/dev` serves the Next.js app on http://localhost:3300.
- [x] **Tailwind CSS v4 + design tokens**
  - [x] Upgrade/verify Tailwind v4 config, add base tokens (colors, spacing, typography).
  - [x] Wire global styles (`app/src/app/globals.css`) and add a `tailwind.config.ts` preset when needed.
- [ ] **shadcn/ui + component scaffolding**
  - [ ] Install shadcn CLI, generate foundational components (Button, Input, Dialog, Dropdown).
  - [ ] Document usage pattern for future contributors inside `docs/ui.md`.
- [ ] **TanStack Query + API layer**
  - [ ] Install `@tanstack/react-query` and set up the provider in `app/src/app/layout.tsx`.
  - [ ] Add a shared fetch client with auth headers + error handling.
- [ ] **Supabase & Prisma plumbing**
  - [ ] Install `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`, `prisma`, `@prisma/client`.
  - [ ] Run `npx prisma init --datasource-provider postgresql` inside `app/`.
  - [ ] Configure `schema.prisma` for `users`, `items`, `item_vectors`, `tags`, etc.
  - [ ] Add `DATABASE_URL`/`DIRECT_URL` envs and document in `.env.example`.
- [ ] **Prisma workflow**
  - [ ] Add `bun run prisma:generate` and `bun run prisma:push` scripts.
  - [ ] Integrate Prisma client helper with edge-safe `globalThis` guard.
- [ ] **Supabase auth**
  - [ ] Configure Supabase project, enable email auth, and set JWT secret locally.
  - [ ] Implement middleware to load the session, enforce `user_id` scoping, and wire client helpers.
- [ ] **Storage & uploads**
  - [ ] Create Supabase storage buckets with RLS policies.
  - [ ] Add upload helpers (either direct-to-storage or via Next route handler).
- [ ] **pgvector & embeddings**
  - [ ] Enable pgvector extension in Supabase.
  - [ ] Add `item_vectors` table + Prisma model and migration.
- [ ] **Async/worker stubs**
  - [ ] Add placeholder queue/job layer (Inngest or simple cron) with contracts for metadata, OCR, embeddings.
  - [ ] Document expected payloads in `docs/workers.md`.
- [ ] **Testing & linting**
  - [ ] Keep Biome for lint/format.
  - [ ] Install Vitest + Testing Library; add sample component test.
- [ ] **Observability**
  - [ ] Add `pino` logger wrapper, plan for Sentry instrumentation hook.

### Frontend

- Next.js App Router with Tailwind CSS v4, shadcn/ui components, Storybook, and TanStack Query for client cache/mutations.

### Data & API Layer

- Prisma ORM connected to Supabase Postgres. Share Zod schemas between client/server.
- Next Route Handlers and server actions expose REST/RPC endpoints secured via middleware.

### Authentication & Authorization

- Start with Supabase Auth using `@supabase/auth-helpers-nextjs`; enforce RLS on tables keyed by `user_id`.

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
