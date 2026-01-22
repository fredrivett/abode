import "server-only";

import pino, { type Logger as PinoLogger } from "pino";
import pinoPretty from "pino-pretty";
import { isDevelopment } from "@/env";
import type { Logger } from "./logger-types";

let serverLogger: PinoLogger | null = null;

function getServerLogger(): PinoLogger {
  if (serverLogger) return serverLogger;

  const devPrettyStream = pinoPretty({
    colorize: true,
    translateTime: "HH:MM:ss",
    ignore: "pid,hostname,module,requestId",
    messageFormat: "[{module}] {msg}",
  });
  const prodSyncDestination = pino.destination({ sync: true });

  serverLogger = pino(
    { level: isDevelopment ? "debug" : "info" },
    (isDevelopment
      ? devPrettyStream
      : prodSyncDestination) as import("pino").DestinationStream,
  );

  return serverLogger;
}

export function createLogger(namespace: string): Logger {
  return getServerLogger().child({ module: namespace }) as Logger;
}
