# Trigger.dev tasks (`app/trigger/`)

Scoped rules for files in this directory. See the full Trigger.dev reference and the `add-trigger-task` skill (`.agents/skills/add-trigger-task/`) for the how-to.

- **v4 SDK only** — `import { task, schemaTask, logger } from "@trigger.dev/sdk"`. Never `client.defineJob` (v2; breaks the app).
- Tasks are **auto-discovered** via `dirs: ["trigger"]` in `trigger.config.ts` — no manual registration.
- `id` is kebab-case, unique, and **stable** (it's the trigger key). Keep it in sync with the exported symbol.
- Always set a `retry` config and a sensible `maxDuration`.
- **Error handling convention**: in `run`, `try/catch` → `logger.error(...)` + `captureServerException(error, userId, { task })` → if the work backs a user-visible item, set `processingStatus: "failed"` → **re-throw** so Trigger.dev retries.
- Return an object including at least `{ success: true }`.
- Don't remove `@trigger.dev/sdk`/`@trigger.dev/core` from `serverExternalPackages` in `next.config.ts` (zod v4-vs-v3 resolution).
