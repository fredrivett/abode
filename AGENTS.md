# Agent Guidelines for abode

## General Principles

- Be concise. Preserve important meaning but remove fluff, sacrifice grammar for the sake of concision.
- Understand that multiple agents may be working at once, so don't revert if you find changes you didn't make.

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

## Testing

When making styling/UI changes, the user sees them in real-time via the dev server — no build needed to verify.

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

If a migration cannot be generated from schema changes (extremely rare), discuss with the team before manually writing SQL.

### E2E Test Database (`supabase-e2e/`)

The `supabase-e2e/` directory contains config for an isolated Supabase instance used by E2E tests. Its `migrations/` and `templates/` are **symlinks** to the main `supabase/` directory.

- **Never run write operations** (`supabase migration new`, `supabase db diff`, etc.) with `--workdir ./supabase-e2e` — these would write into the real `supabase/migrations/` directory via the symlink.
- **Only `start`, `stop`, and `status`** should be used with `--workdir ./supabase-e2e`.
- See `README.md` for the full port allocation table.

## Lessons learned

When a recurring defect is fixed, append a one-line entry here — but first try to convert the lesson into a deterministic check (type, lint, or test) via the `learn` skill in `.agents/skills/learn/`. Use this list only for context a check can't capture.

- _No entries yet._

## Trigger.dev

Background tasks live in `app/trigger/`. Project conventions **and the full Trigger.dev v4 SDK reference** are in `app/trigger/AGENTS.md` (path-scoped — loaded when you work there) rather than here, to keep this file lean. See also the `add-trigger-task` skill in `.agents/skills/add-trigger-task/`.
