import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_vtxdupmohtuvxabigigk",
  // node-22 (not the default "node" = 21.7.3): 21 can't `require()` an ES module,
  // which broke deploys via jsdom → html-encoding-sniffer@6 → @exodus/bytes (ESM
  // only). require(ESM) is supported from Node 22.12+, and node-22 is 22.16.
  // (node-24 isn't offered by the installed @trigger.dev/sdk version.)
  runtime: "node-22",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  // Project-wide TTL: a run that hasn't STARTED within this window is dropped
  // from the queue and never executes. This bounds a run's total lifespan
  // (queue wait + maxDuration) so a late/queued run can't resume after the
  // stuck-items reaper has failed its item and the user has retried — which
  // would let the stale run clobber the retry. COUPLED KNOBS — keep consistent:
  //   ttl + longest task maxDuration  <  reaper threshold
  //   (STUCK_ITEM_THRESHOLD_MS in src/lib/items/reap-stuck-items.ts).
  //   Here: 2h + 10m < 4h. ✓
  // Also coupled to image throughput: at `image-analysis` concurrencyLimit 2
  // (trigger/queues.ts) uploads drain ~600/h, so this 2h TTL tolerates a burst
  // of ~1200 queued images before the tail starts dropping. Raising throughput
  // (Replicate limit → concurrency) lets this TTL shrink.
  ttl: "2h",
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
  build: {
    external: ["@prisma/client", "jsdom", "sharp"],
    extensions: [
      prismaExtension({
        mode: "legacy",
        version: "6.19.0",
        schema: "prisma/schema.prisma",
        migrate: false,
        directUrlEnvVarName: "DIRECT_URL",
      }),
    ],
  },
});
