#!/usr/bin/env bun
/**
 * Copies the document scanner's runtime assets into `public/vendor/` so they're
 * served from our own origin (run as `postinstall`, output is gitignored).
 *
 * scanic loads its ML detector chunk with a runtime-relative `import()` that a
 * bundler can't follow, and that chunk fetches the ONNX runtime + model from a
 * third-party CDN by default. Serving both from `/vendor/` keeps the scanner
 * self-hostable and free of third-party requests. The worker loads them via
 * the URLs in `src/lib/scanner/assets.ts`.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(appDir, "public", "vendor");

const COPIES = [
  {
    from: join(appDir, "node_modules", "scanic", "dist"),
    to: join(vendorDir, "scanic"),
    files: ["scanic.js", "scanic-mlDetector.js", "scanic-ort.wasm.min.js"],
  },
  {
    from: join(appDir, "node_modules", "scanic-ml", "dist"),
    to: join(vendorDir, "scanic-ml"),
    files: [
      "doccornernet_lean.ort",
      "ort-wasm-simd-threaded.mjs",
      "ort-wasm-simd-threaded.wasm",
    ],
  },
];

for (const { from, to, files } of COPIES) {
  if (!existsSync(from)) {
    // Partial installs (e.g. `bun install --production` of another workspace) — nothing to copy
    console.warn(`[copy-scanner-assets] missing ${from}, skipping`);
    continue;
  }
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  for (const file of files) {
    cpSync(join(from, file), join(to, file));
  }
}
