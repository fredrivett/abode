<picture>
  <source media="(prefers-color-scheme: dark)" srcset="app/public/abode-light.svg" width="127">
  <source media="(prefers-color-scheme: light)" srcset="app/public/abode.svg" width="127">
  <img src="app/public/abode.svg" alt="Abode" width="127">
</picture>

# 🏠 abode — the home for your info

The mymind you can own. Beautiful like Sublime, but open like Ghost.
Your mind shouldn’t live on someone else’s server.
A place to dwell.

## Development

- `bin/install` — installs dependencies inside `app/` (run after cloning or when packages change).
- `bin/dev` — sources `.env` / `.env.local`, then starts the Next.js dev server on http://localhost:3300.
- Both scripts automatically start Supabase locally (via `bunx supabase start`) when Docker and the Supabase CLI are available.
- Prereqs: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and Docker running in the background.
- On first run, the scripts symlink `app/.env` → `../.env.local` so Next.js picks up your root env values.
- Supabase local services use dedicated ports to avoid clashes with other repos.

### Port Allocation

All ports are derived from `CONDUCTOR_PORT` (defaults to `3300` outside Conductor). Each Conductor workspace gets 10 ports (`+0` to `+9`).

| Offset | Service | Runtime Status |
|--------|---------|----------------|
| +0 | Next.js dev server | Active (Conductor `run` script) |
| +1 | Supabase API (kong) | Active (E2E tests only) |
| +2 | Supabase DB (postgres) | Active (E2E tests only) |
| +3 | Mailpit web UI | Active (E2E tests only) |
| +4 | Mailpit SMTP | Active (E2E tests only) |
| +5 | E2E test Next.js server | Active during `test:e2e` only |
| +6 | Studio | Excluded (`-x studio`) |
| +7 | Analytics | Excluded (`-x logflare,vector`) |
| +8 | Pooler | Disabled |
| +9 | Edge Runtime | Excluded (`-x edge-runtime`) |

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

## What it is

Open-source, self-hostable library for saving images, links, quotes, videos, PDFs, and articles. Visual, minimal, serendipitous; single-player first. “Shelf” (public curation) comes later.

Self-host for free or pay for managed hosting.

## Non-goals

    •	Not a second brain / tasks / notes suite.
    •	No social network at launch (optional shelves later).
    •	No theming/customization in v0.

⸻

## Stack (initial)

    •	Frontend: Next.js (React), Tailwind, shadcn/ui. Layout uses masonry (Pinterest-style) flow.
    •	Backend: Supabase (Postgres + Storage) accessed via Prisma.
    •	Auth: Supabase Auth or WorkOS (TBD).
    •	Search/Similarity: pgvector from day one (text + image embeddings).
    •	Workers/Jobs: Inngest or lightweight queue; deploy workers on Railway/Fly (open to Railway). Web on Vercel or Railway.
    •	File storage: Supabase Storage (S3-compatible options later).

⸻

## Core objects

    •	Item: { id, user_id, kind, url?, file_key?, text?, meta jsonb, tags[], content_html?, ocr_text?, created_at, updated_at }
    •	kind: image | link | quote | video | pdf | book | note
    •	Embeddings stored separately and joined for similarity.
    •	User: { id, email, settings }
    •	Username claim deferred to v1 (for shelves).

⸻

## Product flows

### v0

#### Capture

- Website only to start (drop-zone + URL input + paste to save).
- Browser extension later; mobile much later.

#### Explore

- Dense masonry gallery; hover quick actions; keyboard nav.
- Filters: kind, tag; global text search.
- Similar items (“more like this”) as soon as embeddings are available.

#### Feed

- Simple personal feed that blends recent + resurfaced saved items (lightweight heuristics).
- No “random” button; keep it quiet and ambient.

### v1

#### Shelf

- Username claimed at signup (v1).
- Public shelf for explicitly selected items only (opt-in per item).

Enrichment pipeline (modular)

Executed asynchronously after initial save:

1. Metadata

- Fetch OG tags, favicon, content-type; store in meta.

2. Article extraction

- Uses [Defuddle](https://github.com/kepano/defuddle) to extract main article content from web pages.
- Alternative: [@mozilla/readability](https://github.com/mozilla/readability) is more battle-tested (~30k weekly downloads vs ~400 for Defuddle) but Defuddle provides better output for modern web pages and HTML-to-Markdown conversion.

3. OCR

- PaddleOCR (Python worker) for images/PDFs; write to ocr_text.
- Cloud APIs optional later; keep privacy/cost predictable.

4. Embeddings (pgvector)

- Text: sentence-transformers model.
- Images: TBD.
- Store in item_vectors(item_id, embedding) for similarity.

5. Auto-tagging

- Text/articles: keyphrase extraction (KeyBERT/YAKE?).
- Images: zero-shot labels via CLIP + optional BLIP caption?
- YouTube: pull transcript → keyphrases; save thumbnail.

Notes:

- Ideally each step is idempotent and can be enabled/disabled independently.
- Self-hosters can run core app only (capture + browse + search) and add workers later without touching the app.

⸻

Search & serendipity

- Text search across title/notes/ocr/extracted article text.
- Similarity search (pgvector) for “more like this”.
- Feed mixes recency and light resurfacing (e.g., time-based, tag-based spreads). No heavy recommendation system in v0.

⸻

Privacy

- Private by default; no public endpoints until a user explicitly publishes a shelf in v1.
- Use storage/server-side encryption where available; avoid sending user content to third-party APIs by default.
- If/when external providers are enabled (e.g., LLM captioning), make it explicit and opt-in.

⸻

Hosting & deployment

- Web app → Vercel or Railway.
- Workers → Railway (good fit for Python OCR/embedding jobs) or Fly.
- Database/Storage → Prisma + Supabase.
- One Docker Compose for local dev and self-hosting? Not v0.

⸻

Modularity (self-hosting)

- Core app runs without workers (capture/browse/search on text).
- Optional modules: OCR, embeddings, auto-tagging, article snapshots.
- Modules are enabled via environment flags; each is an isolated worker.
- No UI “feature toggles” required to self-host — you can simply not run the workers you don’t want.

⸻

Export & portability (not sure how yet, but allow users to export their data).

⸻

Roadmap

v0 (MVP)
• Capture via website (URL, file, text/quote)
• Masonry gallery, text search, filters, text search
• Metadata extraction + article parsing
• PaddleOCR pipeline?
• pgvector embeddings + “more like this”
• Simple personal feed
• Private-by-default; managed + self-host paths

v1
• Username claim + public Shelf (opt-in per item)
• Auto-tagging refinements; nicer captions
• Browser extension
• Better feed heuristics; similarity tuned
• Basic admin tools (exports, usage, storage)

Later
• Mobile capture
• Federation between shelves (optional)
• More robust local-first sync (Yjs) if/when justified

⸻

References / positioning
• Like Ghost → Medium, or Fathom Analytics → Google Analytics (open, ownable, focused).
• “The mymind you can own. Beautiful like Sublime, but open like Ghost.”
• “Your mind shouldn’t live on someone else’s server.”
• Built to be a place to dwell.

⸻

If you want, I can spin this into a contributor guide next (repo layout + worker interfaces + embedding/OCR job contracts) so you can start coding without getting bogged down in upfront docs.

---

#### Concepts

within
inner
elsewhere/somewhere/nowhere
tiny
little
pocket
fractal
wonder
