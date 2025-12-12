# Async Image Processing Options

## Context

Abode processes images through multiple AI services (Google Vision, Replicate CLIP, OpenAI embeddings) which can take 6-18 seconds. This document evaluates options for running image analysis separately from the upload request.

## Key Constraints

1. **Self-hostable SaaS**: Users should be able to deploy via Docker Compose without external service signups
2. **Minimal dependencies**: Prefer using existing infrastructure (Postgres)
3. **Low cost**: Both for hosted SaaS and self-hosters
4. **Simple deployment**: One-command setup for self-hosting

## Current Approach (Phase 1)

**Status**: ✅ Implemented (2025-12-12)

Running image analysis synchronously within the API route with increased timeout:

```json
// vercel.json
{
  "functions": {
    "src/app/api/v1/items/route.ts": {
      "maxDuration": 300  // 5 minutes on Vercel Pro
    }
  }
}
```

**Pros**:
- Zero additional complexity
- No new services to manage
- Current processing (6-18s) well within limits
- Defers optimization until actually needed

**Cons**:
- Limited to 5min on Vercel Pro (300s)
- User waits for full processing before response
- No built-in retry mechanism
- Could timeout if processing gets more complex

**When to migrate**: When processing approaches 5min, need better UX, or require reliability improvements.

## Future Options (Phase 2)

### Option 1: Graphile Worker ⭐ Recommended

**Best for**: Production-ready, self-hostable, minimal dependencies

Uses existing Postgres database as job queue with dedicated worker process.

**Architecture**:
```
SaaS: Vercel → Postgres (Supabase) ← Worker (Railway $7/mo)
Self-hosted: Docker Compose (Next.js + Worker + Postgres)
```

**Pros**:
- ✅ Zero external service signups
- ✅ Uses existing Postgres (no Redis/external queue)
- ✅ Self-hostable out of the box
- ✅ Production-ready (<3ms latency via LISTEN/NOTIFY)
- ✅ Can run worker in same process (ultra-lean) or separate (scalable)
- ✅ Automatic retries, DLQ, cron support
- ✅ Postgres-first: can trigger jobs from DB triggers/functions

**Cons**:
- Need to deploy worker process (adds ~$7/mo for SaaS)
- Slightly more complex than fire-and-forget

**Cost**:
- SaaS: ~$7/mo (Railway/Render worker)
- Self-hosted: $0 (included in Docker Compose)

**Implementation**:
```typescript
// Install
bun add graphile-worker

// Queue jobs from API
import { quickAddJob } from "graphile-worker";
await quickAddJob(pool, "analyze_image", {
  itemId, fileKey, userId
});

// Worker (tasks/analyze_image.ts)
export default async (payload, helpers) => {
  const { itemId, fileKey, userId } = payload;
  // Your existing analyzeImageAsync logic
};

// Run worker
graphile-worker -c $DATABASE_URL
```

**Docker Compose**:
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
  worker:
    build: .
    command: node worker.js
  db:
    image: postgres:17
```

**References**:
- [Graphile Worker Docs](https://worker.graphile.org/)
- [GitHub](https://github.com/graphile/worker)
- [Performance](https://worker.graphile.org/docs/performance) - 99,600 jobs/sec queued, 11,800 jobs/sec processed

---

### Option 2: pg-boss

**Best for**: JavaScript-first API preference

Similar to Graphile Worker but with more traditional Node.js queue API.

**Pros**:
- ✅ JavaScript-idiomatic API (vs Postgres-first)
- ✅ Same self-hosting benefits as Graphile Worker
- ✅ Very popular (110K weekly downloads)
- ✅ Debouncing, rate limiting, priority queues built-in
- ✅ Exactly-once delivery guarantees

**Cons**:
- Less database-centric (can't trigger from Postgres functions)
- Slightly different feature set vs Graphile Worker

**Cost**: Same as Graphile Worker (~$7/mo SaaS, $0 self-hosted)

**When to choose**: If you prefer traditional Node.js queue API over Postgres-centric approach.

**Implementation**:
```typescript
// Install
bun add pg-boss

// Setup
import PgBoss from 'pg-boss';
const boss = new PgBoss(process.env.DATABASE_URL);
await boss.start();

// Queue job
await boss.send('analyze-image', { itemId, fileKey, userId });

// Worker
await boss.work('analyze-image', async (job) => {
  // Your processing logic
});
```

**References**:
- [pg-boss GitHub](https://github.com/timgit/pg-boss)
- [npm package](https://www.npmjs.com/package/pg-boss)
- [vs Graphile Worker discussion](https://github.com/graphile/worker/issues/173)

---

### Option 3: Custom Postgres Queue

**Best for**: Ultra-minimal dependencies, complete control

Build a simple job queue using Postgres tables and `SELECT FOR UPDATE SKIP LOCKED`.

**Pros**:
- ✅ Zero dependencies
- ✅ Complete control
- ✅ Simplest possible architecture
- ✅ Easy to understand and debug

**Cons**:
- ❌ Need to implement retries, DLQ, monitoring yourself
- ❌ Polling overhead (unless you add LISTEN/NOTIFY)
- ❌ Reinventing the wheel

**Schema**:
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_pending ON jobs(status, created_at)
WHERE status = 'pending';
```

**Worker pattern**:
```typescript
// Poll for jobs
const job = await db.$queryRaw`
  SELECT * FROM jobs
  WHERE status = 'pending'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
`;

// Process...
// Update status
```

**When to choose**: You want absolute minimal dependencies and are comfortable building queue infrastructure.

**References**:
- [Building a Postgres Job Queue](https://www.danieleteti.it/post/building-a-simple-yet-robust-job-queue-system-using-postgresql/)
- [Postgres Queues & MVCC](https://brandur.org/postgres-queues)
- [Implementing a Postgres Job Queue](https://aminediro.com/posts/pg_job_queue/)

---

## Ruled Out Options

These options are **not suitable** for a self-hostable SaaS:

### ❌ Inngest
- Requires users to sign up for external service
- SaaS-only (no self-hosting)
- Otherwise excellent: production-ready, great DX, TypeScript-first
- Cost: Free tier (50K-100K executions/mo), then $75/mo

### ❌ Trigger.dev
- Requires external account (though self-hosting available)
- More complex setup for self-hosters
- Cost: Limited free tier ($5/mo usage), $20-50/mo paid

### ❌ QStash (Upstash)
- Requires external service signup
- Ultra-cheap ($1 per 100K requests) but not self-hostable
- Simple HTTP-based queue, good for pure SaaS

### ❌ Vercel Workflow / Vercel Queues
- Currently in Beta (not production-ready)
- Vercel-only (self-hosters can't use)
- Promising for future Vercel-only deployments

### ❌ AWS SQS + Lambda
- Requires AWS account
- Complex setup (IAM, multiple services)
- Doesn't work for self-hosting
- Overkill for current scale

### ❌ BullMQ + Redis
- Requires Redis (additional dependency)
- Can't run workers on Vercel (need separate deployment)
- Upstash Redis expensive for BullMQ polling pattern
- Complex: API + Redis + Workers
- Cost: $25-150/mo

---

## Comparison Matrix

| Option | Production Ready | External Deps | Self-hostable | SaaS Cost/mo | Complexity |
|--------|------------------|---------------|---------------|--------------|------------|
| **Sync (current)** | ✅ Yes | 0 | ✅ Yes | $0 | Lowest |
| **Graphile Worker** | ✅ Yes | 0 | ✅ Yes | $7 | Low |
| **pg-boss** | ✅ Yes | 0 | ✅ Yes | $7 | Low |
| **Custom Queue** | ⚠️ DIY | 0 | ✅ Yes | $7 | Medium |
| **Inngest** | ✅ Yes | 1 (account) | ❌ No | $0-75 | Low |
| **Trigger.dev** | ✅ Yes | 1 (account) | ⚠️ Complex | $5-50 | Medium |
| **QStash** | ✅ Yes | 1 (account) | ❌ No | ~$0.03 | Low |
| **BullMQ + Redis** | ✅ Yes | 1 (Redis) | ⚠️ Complex | $25-150 | High |

---

## Recommendation

### Now (Phase 1)
**Keep synchronous processing with increased timeout** ✅ Done

- Current processing: 6-18s (well within 5min limit)
- Simplest approach
- Can migrate later without major refactor

### Later (Phase 2)
**Migrate to Graphile Worker** when needed

Triggers for migration:
- Processing time approaches 5min
- Want instant upload UX (return immediately, process in background)
- Need better reliability/retries
- Ready to package for self-hosting

**Why Graphile Worker**:
- Zero external service dependencies (uses existing Postgres)
- Works identically for SaaS and self-hosted
- Production-ready and battle-tested
- Users don't need to sign up for anything
- Simple Docker Compose addition

**Self-hosting story**:
```bash
docker compose up  # One command, everything included
```

---

## Additional Resources

### Postgres as Queue Pattern
- [Postgres Job Queues & Failure By MVCC](https://brandur.org/postgres-queues) - Deep dive into SKIP LOCKED
- [Scaling Postgres Queues to 100K events](https://www.rudderstack.com/blog/scaling-postgres-queue/) - Performance lessons
- [Choose Postgres Queue Technology (HN)](https://news.ycombinator.com/item?id=37636841) - Community discussion

### Library Comparisons
- [npm trends: graphile-worker vs pg-boss](https://npmtrends.com/graphile-worker-vs-pg-boss)
- [pg-boss vs graphile-worker discussion](https://github.com/graphile/worker/issues/173)

### Background Processing on Vercel
- [Vercel Function Execution Limits](https://vercel.com/docs/limits)
- [waitUntil API](https://vercel.com/changelog/waituntil-is-now-available-for-vercel-functions) - For non-critical fire-and-forget

---

## Timeline

- **2025-12-12**: Implemented Phase 1 (sync processing with 300s timeout)
- **TBD**: Phase 2 migration when triggers met (see above)
