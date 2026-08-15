<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/abode-light.svg" width="110">
  <img src="assets/abode.svg" alt="abode" width="110">
</picture>

# abode — browser extension

Save the link, the photo, the tweet — to [abode](https://www.abode.fyi), in one click. Then find it the way you think. No folders, no tags, no digging — abode's smart rooms sort it for you.

Built with [WXT](https://wxt.dev) + React + Tailwind (Manifest V3). Chrome/Edge today, Firefox from the same codebase.

## What it does

- **Save the current page** — one click in the toolbar popup, with an instant "Saved ✓".
- **Right-click to save** a link, an image, or a text selection (selections become notes).
- **Keyboard shortcut** — `⌘/Ctrl + Shift + S` saves the current page from anywhere.

Everything routes through abode's existing `from-url` pipeline, so saved items get the same classification, metadata/article parsing, tagging, embeddings, and smart-room auto-filing as saves made on the website.

## How it authenticates

The extension signs the user in against Supabase directly (public URL + anon key — the same values the web app ships) and stores the session in `chrome.storage.local`. Saves are sent to abode's API with an `Authorization: Bearer <supabase access token>` header. The server verifies the JWT via `supabase.auth.getUser(token)` in a shared `authenticateRequest()` helper.

This deliberately avoids cookies (no `SameSite` downgrade, no CSRF surface) and is the same token model a future mobile app would use. The token is short-lived and refreshed on demand before each save (MV3 service workers can't be relied on to run refresh timers).

**Backend dependency:** the `/api/v1/items/from-url` and `/api/v1/items/notes` routes in the web app accept the bearer token and send CORS for extension origins. See `app/src/lib/auth/authenticate-request.ts` and `app/src/lib/http/cors.ts`.

## Develop

```bash
cd extension
bun install
cp .env.example .env      # fill in your Supabase URL + anon key (see below)
bun run dev               # launches a dev browser with the extension loaded
```

`bun run dev` opens a browser with the unpacked extension and hot-reloads on change. In dev, `host_permissions` include `http://localhost/*` and the save target is **auto-derived from this checkout's port** — Conductor's `CONDUCTOR_PORT`, or `:3300` for a plain checkout — so it hits whichever local abode server this branch runs. No per-workspace config needed.

### Load unpacked into your own browser (Chrome)

To test in your everyday browser instead of the dev one, build and load unpacked:

```bash
bun run build:local       # dev-mode build → targets your local abode server (workspace port / :3300)
# or: bun run build       # production build → targets https://www.abode.fyi
```

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select `extension/.output/chrome-mv3` (re-click the ↻ reload icon after each rebuild).
4. Pin the abode icon, sign in, and save.

Use `build:local` to point at your running dev server; use `build` for a real (store) build.

### Grab a build from CI (no local toolchain)

The extension isn't published to a store, so between releases the way to run the
latest `main` is the **Extension Build** workflow
(`.github/workflows/extension-build.yml`): on push to `main` touching
`extension/**` it typechecks, unit-tests, builds (production → `abode.fyi`), and
uploads the unpacked output as an artifact. (PRs run the typecheck + tests only —
the build needs the Supabase management token to resolve config, which is kept
off untrusted PR runs, so artifacts come from `main` or a manual dispatch.)

1. GitHub → **Actions** → **Extension Build** → the latest green run on `main`.
2. Download the **`abode-extension-chrome`** artifact and unzip it.
3. `chrome://extensions` → **Developer mode** → **Load unpacked** → the unzipped folder.

Load-unpacked doesn't auto-update — re-download after a new build. No extra
config: the build derives the Supabase URL and anon key (both public) from the
existing `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` secrets — the URL from
the ref, the anon key via the Supabase Management API.

## Configuration

Config comes from `WXT_`-prefixed env vars (see `.env.example`). All are **public** — never put the Supabase service-role key here.

| Var | What | Default |
| --- | --- | --- |
| `WXT_ABODE_BASE_URL` | The abode web app to save to (override) | dev → `localhost:${CONDUCTOR_PORT:-3300}`, prod build → `https://www.abode.fyi` |
| `WXT_SUPABASE_URL` | Supabase project URL (auth) | `http://localhost:55321` |
| `WXT_SUPABASE_ANON_KEY` | Supabase anon/publishable key | — |

`WXT_ABODE_BASE_URL` is normally left **unset** — the build derives the local-dev target from the workspace port and uses the prod URL for production builds. Set it only to override. Use `.env` for local dev and `.env.production` for a store build (WXT loads the right file per mode). A production build (`bun run build`) also drops `localhost` from `host_permissions`.

## Versioning & release

- The extension has **its own semver** in `package.json`, decoupled from the web app (they release on different cadences — the web app deploys continuously; extension updates are gated by Chrome review). WXT mirrors `version` into the manifest.
- Chrome requires the manifest `version` to strictly increase and be numeric-dotted (`1.0.0` → `1.0.1`); pre-release labels only go in `version_name`.
- Tag releases with a distinct prefix — **`extension-v1.0.0`** — so they're distinguishable from web-app tags in this repo.
- Package for the store with `bun run zip`.
- Because installed extensions update lazily, the `/api/v1` contract must stay **backward-compatible** with shipped versions — favour additive API changes; only break behind a new API version.

## Project layout

```
extension/
├─ wxt.config.ts          # manifest, permissions, modules, tailwind plugin
├─ entrypoints/
│  ├─ background.ts        # context menus, keyboard command, save + notify
│  └─ popup/               # React popup (login ↔ save view)
├─ lib/
│  ├─ auth.ts             # Supabase client + chrome.storage session + refresh
│  ├─ api.ts              # bearer-authed saves to abode
│  └─ config.ts           # env-sourced runtime config
├─ components/ui.tsx       # Button / Input / Spinner (abode-styled)
└─ assets/theme.css        # abode design tokens (kept in sync with the web app)
```
