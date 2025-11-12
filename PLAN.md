## Tech Foundations Plan

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
