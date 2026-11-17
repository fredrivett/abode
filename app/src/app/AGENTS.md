# Routes, pages & server actions (`app/src/app/`)

Scoped conventions for this directory. See the `add-authed-page` skill (`.agents/skills/add-authed-page/`) for the how-to.

## Auth

- Every `(app)/` page awaits `requireCompletedSignup()` (`@/lib/auth/require-completed-signup`) as the first statement of its component and of any `generateMetadata` — a layout isn't an auth boundary, because Next renders a page without the layouts above it when the client's router state says it already has them. `(app)/layout.tsx` calls it too, but on its own the layout only guards navigations. `app-page-gate.test.ts` fails for a page that lacks it. Stricter sections (admin) nest their own gate (`requireAdmin`) under a `(protected)` group instead; sign-in itself is enforced by the middleware (`PROTECTED_ROUTE_PREFIXES`).
- API routes (`api/**/route.ts`) are **not** guarded by the layout — guard explicitly: `createClient()` → `getCompletedSignupUser(supabase)` (`@/lib/auth/completed-signup-user`) → `401 { message: "Unauthorized" }` if no user (a route that also serves visitors treats a null user as anonymous instead). It's `getUserWithMfa` plus the completed-signup check, so an email-confirmed account that never claimed an invite can't use the API either; `no-api-incomplete-signup.grit` flags `getUserWithMfa` in `src/app/api/**`.
- Routes the browser extension or personal access tokens must reach export through `authedRoute({ tokenScope }, handler)` (`@/lib/http/authed-route`) instead: it opens the viewer frame, runs `authenticateRequest` (the same completed-signup check for every credential), answers 401 when nobody is authenticated (500 if the auth lookup itself throws) before the handler runs, and passes the handler `{ params, principal }`; add `cors: true` for extension routes. `tokenScope` is `"read"` / `"write"` for the scope a personal access token needs, or `null` to reject personal access tokens, written as a literal. It only governs personal access tokens: cookie sessions and Supabase bearer tokens (the extension) authenticate regardless. Every route using it must be listed, with its scope, in `src/lib/auth/token-route-access.test.ts` — so opening a route to tokens shows up in review. Only the wrapper calls `authenticateRequest`.
- Resolve the user with `getUserWithMfa(supabase)` or a helper built on it (`getAuthUser`, `getAuthenticatedUser`) — it validates the session and treats a 2FA user mid-challenge as signed out. Never raw `supabase.auth.getUser()` or `getSession()` — `no-raw-cookie-getuser.grit` flags raw `getUser` across `src/**`, exempting only the AAL1-by-design callers and browser upload hooks listed in `biome.json`.
- A new top-level `(app)` section goes in `PROTECTED_ROUTE_PREFIXES` (`@/lib/supabase/middleware`); `middleware-protection.test.ts` enforces it.

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
