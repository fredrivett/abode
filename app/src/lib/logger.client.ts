"use client";

import type { Logger, LogLevel } from "./logger-types";

/**
 * Creates a namespaced logger that writes to the browser console.
 *
 * Child loggers append their module name to the namespace with a colon separator.
 */
export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;

  const log = (level: LogLevel, args: unknown[]) => {
    // biome-ignore lint/suspicious/noConsole: This is the logger implementation
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
