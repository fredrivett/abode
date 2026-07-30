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
    external: ["@prisma/client", "jsdom"],
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
