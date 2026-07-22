<picture>
  <source media="(prefers-color-scheme: dark)" srcset="app/public/abode-light.svg" width="127">
  <source media="(prefers-color-scheme: light)" srcset="app/public/abode.svg" width="127">
  <img src="app/public/abode.svg" alt="Abode" width="127">
</picture>

# 🏠 abode

**your home should be yours.**

save everything. sort nothing. own it all.

save the link, the photo, the tweet, the note-to-self — then find it the way you think. no folders, no tags, no digging.

→ [abode.fyi](https://www.abode.fyi)

## Open source & self-hostable

abode is open source under **AGPL-3.0**. Use the hosted version if you want it managed — or **run it yourself and own your data, free, forever.**

Self-hosting is currently best-effort and unsupported: the code's all here and the docs are as clear as we can make them, but abode's a small project, so there's no SLA and fixes land when they land. The hosted version is the supported option. Issues and PRs are welcome — replies may just be slow.

## What it is

The mymind you can own — beautiful like Sublime, open like Ghost. Your mind shouldn't live on someone else's server.

Open-source, self-hostable library for saving images, links, tweets, videos, and articles. Visual, minimal, serendipitous; single-player first.

## Stack

Next.js 16 (React 19) · Tailwind CSS 4 · shadcn/ui · Zustand · TanStack Query · Prisma · PostgreSQL (pgvector + tsvector) · Bun · deploys on Vercel.

## External services

The only thing you _must_ provision to self-host is a database and Supabase. Everything else is an enhancement that lights up when you add its key and [degrades cleanly](AGENTS.md#optional-services--graceful-degradation) when you don't.

| Service | Tier | Unlocks | Without it |
| --- | --- | --- | --- |
| PostgreSQL + [Supabase](https://supabase.com) (auth, storage) | **Required** | the app itself | won't run |
| [Trigger.dev](https://trigger.dev) | **Recommended core** | runs the enrichment pipeline | capture + full-text search work, but no auto-enrichment |
| [OpenAI](https://openai.com) | **Recommended core** | titles, descriptions, tags, OCR, semantic search | items stay bare; full-text search only |
| [Replicate](https://replicate.com) (CLIP) | Optional | image embeddings (for future "similar image") | skipped |
| [Google Cloud Vision](https://cloud.google.com/vision) | Optional | dominant-colour extraction | skipped |
| [Mapbox](https://mapbox.com) | Optional | location + static map thumbnails | skipped |
| [Resend](https://resend.com) | Optional | invite / waitlist / admin emails | email features off |
| [PostHog](https://posthog.com) | Optional | product analytics | no telemetry (the default) |

Self-hosted instances send **no telemetry** unless you set your own PostHog key.

## Features

- **Capture:** Save via URL, file upload, paste, or text input. Supports images, articles, tweets, and videos.
- **Gallery:** Dense masonry layout with hover actions, infinite scroll, and keyboard navigation.
- **Search:** Full-text search across titles, descriptions, OCR text, and extracted article content, blended with pgvector semantic (text-embedding) search via reciprocal rank fusion.
- **Rooms:** Manual collections and smart rooms (dynamic, filter-based).
- **Enrichment pipeline:** Automatic metadata extraction, article parsing (Mozilla Readability), OCR and auto-tagging (OpenAI), and embedding generation — all via async Trigger.dev tasks.
- **Admin:** User management, waitlist, and invite system.

## Development

- `bin/install` — installs dependencies inside `app/` (run after cloning or when packages change).
- `bin/dev` — sources `.env` / `.env.local`, then starts the Next.js dev server on http://localhost:3300.
- Both scripts automatically start Supabase locally (via `bunx supabase start`) when Docker and the Supabase CLI are available.
- Prereqs: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and Docker running in the background.
- On first run, the scripts symlink `app/.env` → `../.env.local` so Next.js picks up your root env values.
- Supabase local services use dedicated ports to avoid clashes with other repos.

### Port Allocation

All ports are derived from `CONDUCTOR_PORT` (defaults to `3300` outside Conductor). Each Conductor workspace gets 10 ports (`+0` to `+9`).

| Offset | Service                 | Runtime Status                  |
| ------ | ----------------------- | ------------------------------- |
| +0     | Next.js dev server      | Active (Conductor `run` script) |
| +1     | Supabase API (kong)     | Active (E2E tests only)         |
| +2     | Supabase DB (postgres)  | Active (E2E tests only)         |
| +3     | Mailpit web UI          | Active (E2E tests only)         |
| +4     | Mailpit SMTP            | Active (E2E tests only)         |
| +5     | E2E test Next.js server | Active during `test:e2e` only   |
| +6     | Studio                  | Excluded (`-x studio`)          |
| +7     | Analytics               | Excluded (`-x logflare,vector`) |
| +8     | Pooler                  | Disabled                        |
| +9     | Edge Runtime            | Excluded (`-x edge-runtime`)    |

- **+0** is always in use by the Conductor dev server
- **+1 to +4** are used by the isolated Supabase instance started during E2E tests (`supabase-e2e/`)
- **+5** is the shadow DB port in Supabase config (never bound at runtime), reused for the E2E test Next.js server
- **+6 to +9** are assigned in `config.toml` but services are excluded via `-x` flags and never bind

### Starting Supabase Manually

If you need to start Supabase manually (outside of `bin/dev`):

```bash
./scripts/start-supabase.sh
```

**Note:** This script includes a workaround for a [known Supabase bug](https://github.com/orgs/supabase/discussions/20753) where custom email templates fail to load due to a race condition. The script restarts the auth container after startup to ensure templates are loaded. This workaround can be removed once Supabase fixes the underlying issue.

## Roadmap

**Done (v0):**
- Capture via website (URL, file, text/quote, tweets)
- Masonry gallery, full-text + semantic search, filters
- Metadata extraction + article parsing (Mozilla Readability)
- OCR + auto-tagging (OpenAI)
- pgvector text embeddings blended into search
- Rooms (manual + smart collections)
- Admin dashboard, waitlist, invite system

**Next:**
- Browser extension
- Public rooms / shelves
- Better feed heuristics
- Export / portability

**Later:**
- Mobile capture
- Self-hosting guide + Docker Compose

## License

[AGPL-3.0](./LICENSE) · Copyright © 2026 Jotmake Limited

Contributions are welcome. Note that abode is offered under the AGPL-3.0; a commercial license may be offered separately in the future.
