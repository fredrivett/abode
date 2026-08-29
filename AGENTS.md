# Agent Guidelines for abode

## General Principles

- Be concise. Preserve important meaning but remove fluff, sacrifice grammar for the sake of concision.
- Understand that multiple agents may be working at once, so don't revert if you find changes you didn't make.

## Public repo

This repository is public/open-source. Everything you write into git or GitHub is world-readable — commit messages, branch names, PR and issue text, code comments, and screenshots, not just code. Never put secrets, real user data (e.g. emails), private/internal URLs, or sensitive business context in any of them. The gitleaks hook and CI only scan committed code, not PR/commit text or images — those are on you.

## Commands

Run from the `./app` directory unless noted. `bun run check:fix` is the primary quality gate after any code change.

> This table is verified against `package.json` by `bun run check:commands-doc` (CI). Adding or renaming a script means updating this table (or the allowlist in `app/scripts/check-commands-doc.ts`).

| Command | What it does | When to use |
| --- | --- | --- |
| `bun run dev` | Start Next.js dev server (Turbopack) | Local development — the user usually has this running |
| `bun run build` | Production build (webpack) | CI / verifying a prod build — **not** during a dev session |
| `bun run check:fix` | Biome autofix + `tsc --noEmit` | After every code change (run this before considering work done) |
| `bun run fix` | Biome lint/format autofix | Quick format/lint pass |
| `bun run lint` | Biome check, no fixes | Read-only lint (matches CI) |
| `bun run ts:check` | TypeScript check (`tsc --noEmit`) | Verify types only |
| `bun run test` | Unit tests (vitest, jsdom) | After logic changes |
| `bun run test:integration` | Integration tests (Testcontainers Postgres — requires Docker) | After DB / server-side changes |
| `bun run test:all` | All vitest projects | Full vitest run |
| `bun run test:e2e` | Playwright E2E (isolated Supabase — requires Docker) | After user-facing flow changes |
| `bun run test:coverage` | Vitest with coverage | Check coverage |
| `bun run prisma:generate` | Generate Prisma client | After schema changes / fresh install |
| `bun run prisma:migrate --name <name>` | Create + apply a dev migration (`prisma migrate dev`) | Only per the Database Migrations policy below |
| `bun add <pkg>` | Install a dependency (bun only, from `./app`) | Adding dependencies |
| `bun run storybook` | Run Storybook on port 6306 | Component development |

## Boundaries

Most "always / never" rules live in the relevant sections below. In addition, **ask the user first** before any of the following:

- Running database migrations or any destructive Prisma command (`prisma migrate`, `prisma db push`, `prisma migrate reset`).
- Any operation that touches production data or production services (prod DB writes, prod Supabase changes, deleting users or items).
- Changing auth/session logic, or email templates that are mirrored manually in the Supabase Dashboard.
- Adding a new third-party dependency or external service.
- Rewriting git history, force-pushing, or deleting branches.
- Deploying to production or promoting a deployment.

## Git Commits

- Commit only when the user asks — don't auto-commit after every change.
- When you do commit, split the work into **logical chunks**: one commit per coherent, self-contained change (e.g. schema/migration, then lib + tests, then API route, then UI) rather than a single catch-all commit. Each commit should build and pass checks on its own.

## App URL

**Production URL:** `https://www.abode.fyi`

Use `getAppBaseUrl()` from `@/lib/url` to get the environment-specific base URL:

```ts
import { getAppBaseUrl } from "@/lib/url";

const baseUrl = getAppBaseUrl();
// Local dev: http://localhost:<port>
// Vercel preview: https://{VERCEL_URL}
// Production: https://www.abode.fyi
```

## Development Server Management

**IMPORTANT**: Do NOT run `bun run build` during development sessions when the user is watching the dev server. This breaks the running development environment.

The user typically has the development server running via `bun run dev` and is actively watching changes. Running build commands interrupts this workflow.

## Code Quality

After making code changes, run from the `./app` directory:

```bash
cd ./app
bun run check:fix
```

This (1) auto-fixes lint/format issues (Biome) and (2) reports TypeScript errors. Fix any TypeScript errors that can't be auto-fixed before considering the task complete.

### Type Safety

- **Prefer type guards over type assertions** — runtime checks that narrow types instead of `as` casts.
- **Avoid `any`** — use `unknown` with type guards, or define proper types. `noExplicitAny` is enforced as a lint error.
- **No suppression comments** — `@ts-ignore` / `@ts-nocheck` are banned (CI-enforced via `lint:suppressions`); only use `@ts-expect-error: <reason>` with a description when truly unavoidable.
- **No stub placeholders** — don't leave `throw new Error("not implemented")` (or similar) behind; the `no-stub.grit` Biome plugin flags them.

```ts
// ❌ Bad: type assertion
const type = searchParams.get("type") as "email" | "signup";

// ✅ Good: type guard
const VALID_OTP_TYPES = ["email", "signup", "recovery", "email_change"] as const;
type OtpType = (typeof VALID_OTP_TYPES)[number];

function isValidOtpType(value: string | null): value is OtpType {
  return value !== null && VALID_OTP_TYPES.includes(value as OtpType);
}

const type = searchParams.get("type");
if (!isValidOtpType(type)) {
  return { error: "Invalid type" };
}
// type is now narrowed to OtpType
```

### Function Signatures

- **No two positional params of the same type.** When a function takes two or more args of the same type (e.g. two `string`s), take a single object param so call sites are self-labeling and can't be silently transposed. A single param, or params of clearly distinct types, can stay positional.

```ts
// ❌ Bad: itemRunTags(userId, itemId) type-checks but is silently wrong
function itemRunTags(itemId: string, userId: string): string[] { ... }

// ✅ Good: the call site names each value — itemRunTags({ itemId, userId })
function itemRunTags({ itemId, userId }: { itemId: string; userId: string }): string[] { ... }
```

## Optional Services & Graceful Degradation

abode must run on a **minimal core** (Postgres + Supabase) so it's genuinely self-hostable. Everything else is an **optional enhancement** that lights up when its key is present and degrades cleanly when it isn't. This is a core principle — follow it whenever you touch a third-party integration.

The canonical list of services and their tiers (required / recommended core / optional) is the **[External services table in the README](README.md#external-services)**. When you add or change a service, update that table.

**The pattern** (see `isReplicateConfigured()` in `src/lib/embeddings.ts` + its use in `trigger/analyze-image.ts` for the reference implementation):

1. Expose an `isXConfigured(): boolean` predicate that checks for the key. Never assume an optional key is set.
2. **Not configured → skip cleanly.** No throw, an `info`/`log` line, and continue. A missing optional key is a valid deployment, not an error.
3. **Configured but errored → catch and continue.** Log a `warn`, report via `captureServerException`, but don't fail the surrounding work — one optional enhancement failing must never fail item capture or the whole enrichment task.
4. Don't do setup work (signed URLs, client init, fetches) for a service you're going to skip — guard first.
5. Env schema (`env.server.ts`): optional-service keys are `.optional()`, never `.min(1)`. Only core-tier keys are required.

When you add a new integration, decide its tier, add the predicate, and wire the skip/catch paths — with tests for both the configured and unconfigured branches.

## Code Formatting

- Lean towards self-documenting code, but add comments where necessary.
- When refactoring code don't leave behind a comment (e.g. "// This code now lives in ...").
- When adding comments, if it's a simple one-liner, use inline comments with no full stop.
- Prefer single line returns when the line is less than our max line length.
- You can run `bun run fix` across the project to format/lint files; no need to ask for confirmation first.

## Component Usage

### Button Component

Use the `Button` component from `@/components/ui/button` instead of hardcoded anchor/button elements. Use `asChild` prop for link functionality:

```tsx
<Button asChild size="lg">
  <a href="/login">Get Started</a>
</Button>
```

- Buttons already manage spacing between children. When adding icons, rely on the button's layout instead of adding extra margin classes to the icon.

### Loading States

Use the shared `IsLoading` component from `@/components/ui/is-loading` for any loading indicator in buttons or displays instead of hardcoded ellipses (`...`).

### Component stories and tests

Stories and tests do different jobs — they complement each other, neither replaces the other:

- **Stories (`*.stories.tsx`) cover appearance.** Every reusable component gets one alongside it, with a named story per meaningful variant. Stories are also executed in CI as browser render tests via the Storybook Vitest addon (the `storybook` project), so they catch render crashes across variants. They're blind to logic — a story renders green even when the wrong thing renders. Follow the existing convention (`title: "<Area>/<Component>"`, `tags: ["autodocs"]`) — see `src/components/rooms/room-card.stories.tsx`.
- **RTL tests (`*.test.tsx`) cover logic.** For any component with real branching or behavior (gated badges, conditional content, pluralization, interaction), add a colocated React Testing Library test asserting the rendered output per branch — see `src/components/rooms/room-card.test.tsx`. These run in the fast `unit` (jsdom) project. RTL is blind to appearance (jsdom has no layout engine), which is exactly why stories still carry the visual side. A purely presentational component with no branching doesn't need one — don't add ceremony where there's nothing to assert.
- **Pure, non-visual logic** belongs in a plain unit test (`*.test.ts`) as usual.

## Testing

**Always add tests for new logic and behavior — this is the default, not an afterthought.** When you add or change a function, API route, access-control rule, or user-facing flow, ship the tests in the same change. Prefer the cheapest layer that genuinely covers the behavior: a unit test for pure logic (e.g. access/permission helpers), an integration test for DB/service code, an E2E test for a user flow. Only skip tests when the change is purely cosmetic or there is genuinely nothing to assert — and when you skip, say so explicitly in the PR rather than leaving the tests checkbox silently unchecked. Untested logic is treated as incomplete work.

### Visual verification (UI changes)

When you make a styling/UI change, **visually verify it yourself — don't rely on `tsc`/tests passing.** The user sees changes live via the dev server, but you should confirm the result with a screenshot before calling it done.

Use [`agent-browser`](https://github.com/vercel-labs/agent-browser) (headless, bundled Chrome — no extension needed) against the running dev server (port `${CONDUCTOR_PORT}`, falls back to `3300`):

```bash
agent-browser open http://localhost:${CONDUCTOR_PORT:-3300}
agent-browser screenshot /tmp/check.png   # then Read the image to inspect it
```

Add `--full` for the whole page. Check both light and dark mode, and a narrow viewport for anything layout-sensitive. If `agent-browser` isn't installed: `npm install -g agent-browser && agent-browser install`.

For automated tests, run from the `./app` directory:

```bash
cd ./app
bun run test              # Unit tests only
bun run test:integration  # Integration tests (requires Docker)
bun run test:all          # All Vitest tests
bun run test:e2e          # E2E tests with Playwright (requires Docker)
```

### Test Types

#### Unit Tests

- **Files**: `*.test.ts` or `*.spec.ts` (e.g., `utils.test.ts`)
- **Environment**: jsdom
- **Database**: None

#### Integration Tests

- **Files**: `*.integration.test.ts` or `*.integration.spec.ts`
- **Environment**: Node
- **Database**: PostgreSQL test container via Testcontainers
- Longer timeouts for container startup
- Sequential execution to avoid database conflicts

#### E2E Tests

- **Files**: `e2e/*.spec.ts` (unauthenticated), `e2e/*.auth.spec.ts` (authenticated)
- **Tool**: Playwright
- **Database**: Isolated Supabase instance (started/stopped per test run via `supabase-e2e/`)
- Tests run against a real Next.js dev server
- Authenticated tests use Playwright's `storageState` pattern (setup project signs in via UI)

### Test Infrastructure

- **Integration tests**: `test/db-container.ts` + `vitest.setup.db.ts` — Testcontainers PostgreSQL
- **E2E tests**: `e2e/supabase-setup.ts` + `e2e/global-setup.ts` — Isolated Supabase on `CONDUCTOR_PORT`-derived ports

### Path Aliases in Tests

- `@/` — Maps to `./src` (all test types)
- `@app/` — Maps to `./app` root (integration tests only)

## Analytics & Instrumentation

When shipping a user-facing feature, instrument it as part of the change (not later):

- Capture a PostHog event for the key action — client via `posthog.capture(...)` (or a tracker in `src/components/tracking`), server via `getPostHogClient()?.capture(...)`.
- For a **new flow**, add or update a funnel/insight so drop-off is measurable.
- Ensure new error paths report via `captureServerException` (server) or the error boundary (client).

The PR template includes a checklist for this.

## Dependencies

All package installations must use `bun` from the `./app` directory:

```bash
cd ./app
bun add package-name
```

Never use `npm` or `yarn`. Always install from the app directory.

## Supabase Email Templates

**Local dev templates are in `supabase/templates/` and configured in `supabase/config.toml`. These do NOT deploy to production.** Production templates are configured manually in the **Supabase Dashboard** under Authentication > Email Templates.

### Critical Rules

- **NEVER use `{{ .ConfirmationURL }}`** in email templates — it bypasses our `/auth/confirm` route and breaks the signup flow.
- **ALWAYS use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>`** where `<type>` matches the template (signup, recovery, email_change).
- **If you change a local template, you MUST flag to the user that the production template in the Supabase Dashboard also needs updating to match.**

## Database Migrations

**Policy: ask first.** By default only edit the schema file (`prisma/schema.prisma`); ask the user before running any migration command. When the user approves or instructs, create the migration from the schema:

```bash
cd ./app
bun run prisma:migrate --name your_migration_name
```

### Migration Workflow

1. Edit the Prisma schema (`prisma/schema.prisma`).
2. With the user's go-ahead, run the migrate command — this generates the SQL migration automatically.
3. Review the generated SQL in `prisma/migrations/` if needed.

### Critical Rules

- **Always generate migrations from the schema** — never hand-write migration SQL files. Prisma generates migrations by comparing your schema to the database state.
- **Never edit existing migrations** — they are immutable once created. If you need more changes, create a NEW migration. Editing existing migrations breaks the migration chain and causes conflicts.
- **Never run `prisma migrate reset`** — this destroys all data.
- **Never run `prisma db push`** — this bypasses migration history and can cause drift.
- **Never manually create migration folders/files** — `prisma:migrate` creates properly timestamped folders and SQL files.
- **Every new table must enable RLS (default-deny)** — add `ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;` in the same migration (Prisma can't express RLS in the schema, so use `prisma migrate dev --create-only` then add the SQL). Without it the table is reachable by the anon/authenticated Supabase roles. Enforced by the `rls-coverage` integration test.

If a migration cannot be generated from schema changes (extremely rare), discuss with the team before manually writing SQL.

### E2E Test Database (`supabase-e2e/`)

The `supabase-e2e/` directory contains config for an isolated Supabase instance used by E2E tests. Its `migrations/` and `templates/` are **symlinks** to the main `supabase/` directory.

- **Never run write operations** (`supabase migration new`, `supabase db diff`, etc.) with `--workdir ./supabase-e2e` — these would write into the real `supabase/migrations/` directory via the symlink.
- **Only `start`, `stop`, and `status`** should be used with `--workdir ./supabase-e2e`.
- See `README.md` for the full port allocation table.

## Lessons learned

When a recurring defect is fixed, append a one-line entry here — but first try to convert the lesson into a deterministic check (type, lint, or test) via the `learn` skill in `.agents/skills/learn/`. Use this list only for context a check can't capture.

- New Postgres tables must enable RLS (default-deny) or they're reachable by the anon/authenticated Supabase roles — enforced by `src/lib/__tests__/rls-coverage.integration.test.ts`.
- Server-side fetches of a user-supplied URL must use `safeFetch` (`@/lib/http/safe-fetch`), never the global `fetch`, or the SSRF gate is bypassed — enforced in `trigger/**` and `src/app/api/**` by `app/biome/no-raw-fetch.grit`.
- `biome.json` takes no comments: with one present Biome 2.2 silently falls back to its default config (whole repo reformats to tabs) rather than erroring — document Biome config decisions in the plugin file, not inline.
- User-initiated item processing must enqueue via `enqueueUserProcessing` (applies the per-user concurrencyKey + `USER_ACTION_PRIORITY`), never raw `tasks.trigger`, or live runs lose priority to background work — enforced over `src/lib/items/**` and `src/app/api/**` by `app/biome/no-raw-user-processing.grit`. Trigger `priority` is a positive `createdAt` offset; a *negative* one delays a run into the future (strands it in `queued`).
- Trigger `priority` must stay well below ~2.1M seconds: the API rejects an over-large value (`priority × 1000` ms overflows int32), throwing `TriggerApiError` from `tasks.trigger` and breaking *every* enqueue that carries it. A year-long `USER_ACTION_PRIORITY` silently killed all user-initiated processing — guarded by `enqueue-user-processing.test.ts` (`MAX_SAFE_PRIORITY`).
- Cookie-authed API routes must resolve the user via `getUserWithMfa` (`@/lib/supabase/server`), never `supabase.auth.getUser()` directly, or a 2FA user's AAL1 session (password sign-in, TOTP not completed) bypasses the challenge — the page middleware only guards page navigations. Enforced over `src/app/api/**` by `app/biome/no-raw-cookie-getuser.grit`.

## Trigger.dev

Background tasks live in `app/trigger/`. Project conventions **and the full Trigger.dev v4 SDK reference** are in `app/trigger/AGENTS.md` (path-scoped — loaded when you work there) rather than here, to keep this file lean. See also the `add-trigger-task` skill in `.agents/skills/add-trigger-task/`.
