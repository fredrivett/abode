# Routes, pages & server actions (`app/src/app/`)

Scoped conventions for this directory. See the `add-authed-page` skill (`.agents/skills/add-authed-page/`) for the how-to.

## Auth

- Pages under `(app)/` are **already authenticated** by `(app)/layout.tsx` — don't re-add a guard. Stricter access (admin) nests under a `(protected)` group with its own layout guard.
- API routes (`api/**/route.ts`) are **not** guarded by the layout — guard explicitly: `createClient()` → `supabase.auth.getUser()` → `401 { message: "Unauthorized" }` if no user.
- Always use `supabase.auth.getUser()` (validates the session), never `getSession()`.

## Route handlers (`api/**/route.ts`)

- Wrap handler bodies in `try/catch`; on error log with the structured logger (`log.error({ error, userId }, "context")`) and return `{ message: "Internal server error" }` with status `500`.
- Error responses are shaped `{ message: string }`. Never leak error internals in the response body.

## Server actions (`**/actions.ts`)

- Start the file with `"use server"`.
- Return a union result type, e.g. `type XResult = { error?: string; success?: boolean }` — don't throw to the client.
- Trigger background tasks inside `try/catch` with a warning log on failure (a queueing hiccup must not break the user flow). Use `import type` for the task reference.
- Use `revalidatePath` / `redirect` from `next/...` after mutations as appropriate.

## General

- Use `ROUTES.*` from `@/lib/routes` for redirect targets.
- Verify with `bun run check:fix`.
