<picture>
  <source media="(prefers-color-scheme: dark)" srcset="app/public/abode-light.svg" width="127">
  <source media="(prefers-color-scheme: light)" srcset="app/public/abode.svg" width="127">
  <img src="app/public/abode.svg" alt="Abode" width="127">
</picture>

# 🏡 abode

**your home should be yours.**

save everything. sort nothing. own it all.

save the link, the photo, the tweet, the note-to-self — then find it the way you think. no folders, no tags, no digging.

🏡 [abode.fyi](https://www.abode.fyi)

## Open source & self-hostable

abode is open source under **AGPL-3.0**. Use the hosted version if you want it managed, eject anytime to **run it yourself and own your data, free, forever.**

Self-hosting is currently a work-in-progress best-effort: the code's all here and the docs are evolving, but abode's a small project, so please bear with me. The hosted version is the supported option. Issues and PRs are welcome — replies may just be slow at times.

## What it is

Open-source, self-hostable app for saving images, links, tweets, videos, and articles. Visual, minimal, serendipitous; single-player first.

Your mind shouldn't be trapped on someone else's server, and you shouldn't need to commit to a lifelong subscription to access it.

## Stack

Next.js 16 (React 19) · Tailwind CSS 4 · shadcn/ui · Zustand · TanStack Query · Prisma · PostgreSQL (pgvector + tsvector) · Bun · deploys on Vercel.

## External services

The only thing you _must_ provision to self-host is a database and Supabase. Everything else is an enhancement that lights up when you add its key and [degrades cleanly](AGENTS.md#optional-services--graceful-degradation) when you don't.

| Service                                                       | Tier                 | Unlocks                                          | Without it                                              |
| ------------------------------------------------------------- | -------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| PostgreSQL + [Supabase](https://supabase.com) (auth, storage) | 🔒 **Required**         | the app itself                                   | won't run                                               |
| [Trigger.dev](https://trigger.dev)                            | ⭐ **Recommended core** | runs the enrichment pipeline                     | capture + full-text search work, but no auto-enrichment |
| [OpenAI](https://openai.com)                                  | ⭐ **Recommended core** | titles, descriptions, tags, OCR, semantic search | items stay bare; full-text search only                  |
| [Replicate](https://replicate.com) (CLIP)                     | 🧩 Optional             | image embeddings (for future "similar image")    | skipped                                                 |
| [Google Cloud Vision](https://cloud.google.com/vision)        | 🧩 Optional             | dominant-colour extraction                       | skipped                                                 |
| [Mapbox](https://mapbox.com)                                  | 🧩 Optional             | location + static map thumbnails                 | skipped                                                 |
| [Resend](https://resend.com)                                  | 🧩 Optional             | invite / waitlist / admin emails                 | email features off                                      |
| [PostHog](https://posthog.com)                                | 🧩 Optional             | product analytics                                | no telemetry (the default)                              |

Self-hosted instances send **no telemetry** unless you set your own PostHog key.

## Features

- **Capture:** Save via URL, file upload, paste, or text input. Supports images, articles, tweets, and videos.
- **Gallery:** Dense masonry layout with hover actions, infinite scroll, and keyboard navigation.
- **Search:** Full-text search across titles, descriptions, OCR text, and extracted article content, blended with pgvector semantic (text-embedding) search via reciprocal rank fusion.
- **Rooms:** Manual collections and smart rooms (dynamic, filter-based).
- **Enrichment pipeline:** Automatic metadata extraction, article parsing (Mozilla Readability), OCR and auto-tagging (OpenAI), and embedding generation — all via async Trigger.dev tasks.
- **Admin:** User management, waitlist, and invite system.

## Development

**Prerequisites:** [Bun](https://bun.sh), [Docker](https://www.docker.com/) (for local Supabase), and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

1. Copy `.env.example` to `.env` and fill in your keys — only the **Required** tier from [External services](#external-services) is needed to boot.
2. `bin/install` — install dependencies (runs inside `app/`).
3. `bin/dev` — start the dev server on http://localhost:3300 (also starts local Supabase via Docker when available).

More contributor detail — environment plumbing, port allocation, running Supabase manually, and the quality gate — is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

**✅ Done (v0):**

- Capture via website (URL, file, paste, compose) — images, articles, tweets, videos, products, books, notes
- Masonry gallery, full-text + semantic search, filters
- Metadata extraction + article parsing (Mozilla Readability)
- OCR + auto-tagging (OpenAI)
- Dominant-colour extraction, palette bar + colour search
- pgvector text embeddings blended into search
- Location (auto + manual) + map thumbnails (Mapbox)
- Rooms (manual + smart collections)
- Public rooms, profiles + room embedding
- Article highlighting (with per-highlight notes)
- Command palette (⌘K) + keyboard navigation
- Admin dashboard, waitlist, invite system

**🔜 Next:**

- Browser extension
- Similar images (via existing CLIP image embeddings)
- Export / eject
- Self-hosting guide + Docker Compose

**🔮 Later:**

- Expo mobile app
- Self-hosted / privacy model option — run image analysis + embeddings without third-party APIs

## License

[AGPL-3.0](./LICENSE) · Copyright © 2026 Jotmake Limited

Contributions are welcome. Note that abode is offered under the AGPL-3.0; a commercial license may be offered separately in the future.
