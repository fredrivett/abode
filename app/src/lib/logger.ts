import type { Logger as PinoLogger } from "pino";

type LogLevel = "debug" | "info" | "warn" | "error";

interface GenericLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  child: (bindings?: Record<string, unknown>) => GenericLogger;
}

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV === "development";

let serverLogger: PinoLogger | null = null;

function getServerLogger(): PinoLogger {
  if (serverLogger) return serverLogger;

  const pino = require("pino") as typeof import("pino");
  const pinoPretty = require("pino-pretty") as typeof import("pino-pretty");

  const devPrettyStream = pinoPretty({
    colorize: true,
    translateTime: "HH:MM:ss",
    ignore: "pid,hostname,module,requestId",
    messageFormat: "[{module}] {msg}",
  });
  const prodSyncDestination = pino.destination({ sync: true });

  serverLogger = pino(
    { level: isDev ? "debug" : "info" },
    (isDev
      ? devPrettyStream
      : prodSyncDestination) as import("pino").DestinationStream,
  );

  return serverLogger;
}

function createBrowserLogger(namespace: string): GenericLogger {
  const prefix = `[${namespace}]`;

  const log = (level: LogLevel, args: unknown[]) => {
    // biome-ignore lint/suspicious/noConsole: expected to surface logs in the browser
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
      return createBrowserLogger(nextNamespace);
    },
  };
}

export type Logger = GenericLogger;

export function createLogger(namespace: string): GenericLogger {
  if (isBrowser) {
    return createBrowserLogger(namespace);
  }

  return getServerLogger().child({ module: namespace }) as GenericLogger;
}
