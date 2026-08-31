# Scaling bottlenecks

Known throughput/scale ceilings, what causes each, and what to look into to raise
them. One section per bottleneck; add more as they're found.

## Contents

1. [Trigger.dev environment concurrency](#1-triggerdev-environment-concurrency) — the global cap everything shares
2. [Image-analysis throughput (Replicate CLIP)](#2-image-analysis-throughput-replicate-clip)
3. [URL classification (`classify-url`)](#3-url-classification-classify-url)
4. [OpenAI rate limits & cost](#4-openai-rate-limits--cost)
5. [Postgres connection pool](#5-postgres-connection-pool)
6. [Supabase storage uploads (front door)](#6-supabase-storage-uploads-front-door)

The invariant that couples the queue-drain knobs (TTL + reaper) is described in
[§2](#2-image-analysis-throughput-replicate-clip) and applies whenever you retune
burst tolerance.

---

## 1. Trigger.dev environment concurrency

**The global cap everything shares — check this first.** Every background task
draws from the environment's concurrency pool. Only two tasks set their own queue
(`image-analysis` = 2, `classify-url` = 3); the rest (`enrich-item`, `handle-*`,
`sync-*`, `persist-*`, backfills) run on the **default queue = the environment
pool**. So under load the env-wide limit can be the real limiter before any
per-queue cap bites, and the per-queue limits are themselves capped by the env
*base* limit (not the burst limit).

**What to look into:**
- Confirm the current env concurrency (base + burst) in the Trigger.dev dashboard
  → Concurrency. It's a plan/dashboard setting, **not in code**.
- If it's the ceiling, raise the plan / base limit ahead of an anticipated spike.
- Env concurrency can be raised at runtime; a single queue can also be overridden
  with `queues.overrideConcurrencyLimit(...)` (see §2) — but never above the env
  base limit.

## 2. Image-analysis throughput (Replicate CLIP)

Visual embeddings drain at **~600 uploads/hour globally**. Uploads past that rate
queue; a run not started within `ttl` (`2h`, `trigger.config.ts`) is dropped, and
the stuck-items reaper (`4h`, `reap-stuck-items.ts`) then fails its item as
`stalled`.

**What caps us — and what doesn't:**
- **Not** Replicate's account rate limit. Replicate allows **600 prediction
  creations/minute** (10/sec) with a payment method on file — ~60× our ~600/hour.
- **The cap is `concurrencyLimit: 2` (`app/trigger/queues.ts`) × per-prediction
  latency on a shared public model.** We call `andreasjansson/clip-features`, a
  community model on Replicate's shared pool — cold starts make each run slow, and
  bursting concurrent creations against that shared pool returns the 429s.
  `concurrencyLimit` is pinned at 2 to stay under that, so raising it alone just
  trades a backlog for 429s (which retry/back off to the same throughput).

**What to look into (highest leverage first):**
1. **Dedicated Replicate deployment — the real lever.** A private endpoint
   wrapping our pinned CLIP version with `min_instances` (warm → no cold starts)
   and `max_instances` (dedicated concurrency we control). Then `concurrencyLimit`
   can be raised to match without fighting a shared pool. Work: create the
   deployment; switch `generateImageEmbedding` (`app/src/lib/embeddings.ts`) from
   `replicate.run(version, …)` to `deployments.predictions.create(...)`, behind
   `isReplicateConfigured` so self-host still falls back to the public model;
   load-test the safe concurrency; set `concurrencyLimit` to match. **Confirm**
   a deployment can wrap a *public* community model version (else we push our own
   CLIP image — more setup).
2. **Raise `concurrencyLimit`** — only meaningful after (1), or if testing shows
   the shared pool tolerates >2. On its own it provokes 429s.
3. **`ttl` + reaper — buy time, not throughput.** They only decide how long a
   backlog waits before the tail is dropped. Raise them *together*, always keeping
   the invariant:
   ```
   ttl + longest task maxDuration (≤10m)  <  reaper threshold
   ```
   Now `2h10m < 4h`. Example retune: `ttl 3h` + reaper `5h`. Knobs in
   `trigger.config.ts` (`ttl`) and `reap-stuck-items.ts` (`STUCK_ITEM_THRESHOLD_MS`)
   — keep their coupling comments in sync.

**Gotchas:** keep a payment method on file at Replicate (no card → throttled to
1 req/sec). Raising concurrency worsens the silent 429-drop of embeddings — a
throttled prediction currently fails quietly rather than being retried/reported,
so more concurrency means more missing visual vectors. Make embedding failures
observable and retried first, and plan a visual-vector backfill after any big bump.

## 3. URL classification (`classify-url`)

The URL-ingestion twin of §2. `classify-url` (`trigger/classify-url.ts`) runs at
**`concurrencyLimit: 3`**, `maxDuration 120s`, and does fetch-page + OpenAI
classification. A burst of URL adds (as opposed to image uploads) is gated here,
separately from the image queue but still drawing on the same env pool (§1) and
OpenAI limits (§4).

**What to look into:**
- If URL adds back up, raise `concurrencyLimit` here — but it's bounded by OpenAI
  throughput (§4) and the env pool (§1), so raise those in step.
- Fetch latency/timeouts (`safeFetch`) dominate per-run time; slow external sites
  hold a slot for up to `maxDuration`.

## 4. OpenAI rate limits & cost

`enrich-item`, `classify-url`, vision/OCR (`openai-vision.ts`), product-image
filter, `translate-to-english`, tag generation, and `suggest-emoji` all call
OpenAI. OpenAI enforces per-account **RPM/TPM by tier**; under a spike these are a
shared ceiling across all the above, and a **cost-abuse surface**.

**What to look into:**
- Current OpenAI tier and its RPM/TPM headroom vs expected concurrent enrichments.
- Calls should be wrapped in `retryTransient` (self-throttles on 429) — verify new
  call sites are.
- Cost controls: the per-user daily AI-spend cap / shared rate-limit work is the
  guard here — ensure it's enabled before raising throughput limits.

## 5. Postgres connection pool

Prisma appends `connection_limit=5` per client (`src/lib/db.ts`,
`DATABASE_CONNECTION_LIMIT`), and there are separate read + write clients → up to
**~10 connections per running instance**. Under a **web-traffic** spike (many
concurrent Vercel instances) plus background workers, total connections can exhaust
Postgres — the classic serverless + Postgres wall, hit before any app-level limit.

**What to look into:**
- **Confirm `DATABASE_URL` points at the Supabase connection pooler (pgbouncer,
  transaction mode), not the direct connection.** Without pooling this ceiling is
  much lower. (`DIRECT_URL` is correctly the direct connection, used for migrations.)
- Size `connection_limit` × expected instance count against the pooler's client
  limit; tune `DATABASE_CONNECTION_LIMIT` if needed.
- Watch Supabase's connection/pooler saturation metrics during load.

## 6. Supabase storage uploads (front door)

Image uploads land in Supabase storage (via `src/app/api/v1/items/route.ts` /
`use-upload.ts`) **before** analysis is even queued — so a spike hits storage
first. Upload bandwidth, storage API rate limits, and Vercel function concurrency
on the upload route are the front-door ceiling.

**What to look into:**
- Supabase storage plan limits (request rate, egress) and any per-route Vercel
  function concurrency on the upload path.
- Whether large uploads should use resumable/direct-to-storage signed URLs to keep
  bytes off the Vercel function.
