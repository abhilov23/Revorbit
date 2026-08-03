import { pino } from "pino";

export interface CreateLoggerOptions {
  level?: string;
  pretty?: boolean;
}

export function createLogger(options: CreateLoggerOptions = {}) {
  const { level = "info", pretty = false } = options;

  return pino({
    level,
    ...(pretty && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    }),
  });
}

export type Logger = ReturnType<typeof createLogger>;
