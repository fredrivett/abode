---
name: add-trigger-task
description: Add a new Trigger.dev (v4) background task to the abode app and trigger it from app code. Use when creating async/background work — image analysis, sync jobs, notifications, backfills.
---

# Add a Trigger.dev task

Tasks live in `app/trigger/`. They are auto-discovered (`trigger.config.ts` has `dirs: ["trigger"]`) — no manual registration.

## 1. Create the task file (`app/trigger/<name>.ts`)

```ts
import { logger, task } from "@trigger.dev/sdk";
import { captureServerException } from "../src/lib/posthog-server";
import db from "../src/lib/db";

type MyTaskPayload = {
  itemId: string;
  userId: string;
};

export const myTask = task({
  id: "my-task", // kebab-case, unique, stable — used as the trigger key
  maxDuration: 60, // seconds
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: MyTaskPayload) => {
    logger.log("Starting my-task", { itemId: payload.itemId });
    try {
      // ...work...
      return { success: true, itemId: payload.itemId };
    } catch (error) {
      logger.error("my-task failed", { error });
      captureServerException(error, payload.userId, { task: "my-task" });
      // If the work backs a user-visible item, mark it failed:
      // await db.item.update({ where: { id: payload.itemId, userId: payload.userId }, data: { processingStatus: "failed" } });
      throw error; // re-throw so Trigger.dev retries
    }
  },
});
```

## 2. Trigger it from app code (route handler / server action)

```ts
import { tasks } from "@trigger.dev/sdk";
import type { myTask } from "@app/trigger/my-task"; // `@app/*` → app root; type-only

await tasks.trigger<typeof myTask>("my-task", { itemId, userId });
```

In server actions, wrap the trigger in try/catch and log a warning on failure so a queueing hiccup doesn't break the user flow.

## Conventions & gotchas

- **v4 SDK only** (`@trigger.dev/sdk`). Never `client.defineJob` (v2, breaks the app). See the Trigger.dev sections in `AGENTS.md`.
- **zod gotcha**: `@trigger.dev/sdk`/`core` are in `serverExternalPackages` in `app/next.config.ts` because the app is on zod v4 and Trigger ships zod v3 internally — do not remove that.
- Import the task **type** via the `@app/*` alias (`@app/trigger/<name>`) — a stable, depth-independent path (the codebase also has relative `../trigger/...` imports, but those are error-prone). `import type` keeps task code out of the app bundle.
- Triggering uses the string id (`"my-task"`) with the type param — keep the id and the exported symbol in sync.
- Verify with `bun run check:fix`. Do not run a production build during a dev session.
