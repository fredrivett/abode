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

| Service                                                       | Tier                    | Unlocks                                                       | Without it                                              |
| ------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| PostgreSQL + [Supabase](https://supabase.com) (auth, storage) | 🔒 **Required**         | the app itself                                                | won't run                                               |
| [Trigger.dev](https://trigger.dev)                            | ⭐ **Recommended core** | runs the enrichment pipeline and builds data exports          | capture + full-text search work, but no auto-enrichment or data export |
| [OpenAI](https://openai.com)                                  | ⭐ **Recommended core** | titles, descriptions, tags, OCR, semantic search              | items stay bare; full-text search only                  |
| [Replicate](https://replicate.com) (CLIP)                     | 🧩 Optional             | image embeddings (powers similar images)                      | skipped                                                 |
| [Google Cloud Vision](https://cloud.google.com/vision)        | 🧩 Optional             | dominant colours; cheaper full-page OCR for scanned documents | colours skipped; document OCR uses OpenAI if configured |
| [TypeSafe](https://typesafe.ai) (Jev)                         | 🧩 Optional             | calibrated article-vs-webpage kind refinement                | structural heuristic decides the kind                   |
| [Mapbox](https://mapbox.com)                                  | 🧩 Optional             | location + static map thumbnails                              | skipped                                                 |
| [Resend](https://resend.com)                                  | 🧩 Optional             | invite / waitlist / admin emails                              | email features off                                      |
| [PostHog](https://posthog.com)                                | 🧩 Optional             | product analytics + session replay (saved content masked)     | no telemetry (the default)                              |

Self-hosted instances send **no telemetry** unless you set your own PostHog key.

PostHog analytics and session replays are linked to the signed-in account and record how the app is used, not what people save. Everything below is masked in the browser before it's sent (`app/src/lib/analytics/`):

- **Replays:** all on-screen text, input values, images and media, and link/image URLs.
- **Click events:** a button's text and labels are kept only when they're UI copy written in this codebase (e.g. "Save", "Delete"); link targets are dropped.
- **URLs:** search queries, links shared to `/save`, and the names of your own rooms (so private rooms never appear). Visits to other people's public rooms are recorded as-is.

Set `NEXT_PUBLIC_SITE_URL` to your instance's public URL (e.g. `https://abode.example.com`) so emails, share links and embeds point at your instance rather than abode.fyi. It's inlined at build time, so set it before building. Self-hosted instances are kept out of search engines (`robots.txt` disallows all).

### Usage & cost limits

To stop a single account (or an abuser) running up your AI bill, abode has durable daily/monthly per-user **$ caps** plus a system-wide daily **circuit-breaker**. They're **enforced by default on any deployed instance** (production, preview, or staging) — so a fresh deploy is capped without configuration and can't silently run uncapped. Local dev and tests run in **shadow mode** (every action counted and logged, nothing blocked); when shadow mode is active the server logs a one-time warning at first use.

Tune the thresholds to your own economics via `PER_USER_DAILY_USD`, `PER_USER_MONTHLY_USD`, and `SYSTEM_DAILY_USD` (all optional; sensible defaults apply if unset). To force a specific behaviour, set `USAGE_LIMITS_ENFORCED=true` (always enforce) or `=false` (deliberately opt a deploy out, e.g. to run a shadow window). Defaults are intentionally conservative — the right numbers depend on your pricing, so set your own before relying on them.

## Features

- **Capture:** Save via URL, file upload, paste, or text input. Supports images, articles, tweets, and videos.
- **Document scanning:** Scan multi-page documents with your phone's camera, in the browser (no app): live edge detection, auto-capture once the page is held steady, perspective correction, and a B&W "scanned" look (or greyscale/colour). Every page is OCR'd (with OpenAI or Google Cloud Vision configured) so documents are searchable by their text, and each document is titled from it (issuer, type, date) with OpenAI.
- **Gallery:** Dense masonry layout with hover actions, infinite scroll, and keyboard navigation.
- **Search:** Full-text search across titles, descriptions, OCR text, and extracted article content, blended with pgvector semantic (text-embedding) search via reciprocal rank fusion. Quote a phrase (`"like this"`) to only match items containing that exact text in their title, description, notes, tags, OCR or scanned pages (not article content).
- **Rooms:** Manual collections and smart rooms (dynamic, filter-based), plus auto-generated book shelves (Want to read / Reading / Read) that appear once you have books and stay in sync as you update reading status.
- **MCP server:** Connect Claude, Cursor and other AI assistants to search and read your library (`/api/mcp`, read-only), with a personal access token that has read access.
- **Access tokens:** Personal access tokens with independent permissions: read your library (for MCP), save new items (for scripts or an iOS Shortcut), or both.
- **Enrichment pipeline:** Automatic metadata extraction, article parsing (Mozilla Readability), OCR and auto-tagging (OpenAI; full-page document OCR via Google Cloud Vision when configured), and embedding generation — all via async Trigger.dev tasks.
- **Export:** Download everything as a ZIP from Settings → Export: a complete `abode.json`, a Markdown file per item (Obsidian-ready), a Netscape `bookmarks.html` with a folder per room, a Goodreads-format `books.csv`, and every upload, scan and saved image. Large libraries split into parts. Built in the background (needs Trigger.dev) and kept for 7 days.
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
- Markdown notes with a WYSIWYG editor (headings, lists, checklists, quotes, code)
- Document scanning (in-browser camera, edge detection + auto-capture, B&W/greyscale/colour, multi-page, per-page OCR)
- Masonry gallery, full-text + semantic search, filters
- Metadata extraction + article parsing (Mozilla Readability)
- OCR + auto-tagging (OpenAI)
- Dominant-colour extraction, palette bar + colour search
- pgvector text embeddings blended into search
- Similar images (CLIP visual embeddings, mean-centered)
- Location (auto + manual) + map thumbnails (Mapbox)
- Rooms (manual + smart collections)
- Public rooms, profiles + room embedding
- Article highlighting (with per-highlight notes)
- Command palette (⌘K) + keyboard navigation
- MCP server for AI assistants + scoped personal access tokens
- Admin dashboard, waitlist, invite system
- Data export (JSON, Markdown, bookmarks, books CSV, every file)

**🔜 Next:**

- Browser extension
- Import an abode export (eject to another instance)
- Importers — bring your library from mymind, Raindrop, Are.na and Pinterest
- Self-hosting guide + Docker Compose

**🔮 Later:**

- Expo mobile app
- Self-hosted / privacy model option — run image analysis + embeddings without third-party APIs

## License

[AGPL-3.0](./LICENSE) · Copyright © 2026 Jotmake Limited

Contributions are welcome. Note that abode is offered under the AGPL-3.0; a commercial license may be offered separately in the future.
