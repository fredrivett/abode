"use client";

import type { Logger, LogLevel } from "./logger-types";

export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;

  const log = (level: LogLevel, args: unknown[]) => {
    // biome-ignore lint/suspicious/noConsole: browser logging is intentional
    const consoleFn = console[level] ?? console.log;
    consoleFn(prefix, ...args);
  };

  return {
    debug: (...args: unknown[]) => log("debug", args),
    info: (...args: unknown[]) => log("info", args),
    warn: (...args: unknown[]) => log("warn", args),
    error: (...args: unknown[]) => log("error", args),
    child: (bindings?: Record<string, unknown>) => {
      const nextNamespace =
        typeof bindings?.module === "string"
          ? `${namespace}:${bindings.module}`
          : namespace;
      return createLogger(nextNamespace);
    },
  };
}
