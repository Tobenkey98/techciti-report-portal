import pino from "pino";
import { env } from "../config/env.js";

/** Minimal structured logger. HTTP logging is attached in app.ts via pino-http. */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "techciti-reports-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: env.isProduction
    ? undefined
    : {
        target: "pino/file",
        options: { destination: 1 },
      },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.x-tutor-token",
      "passwordHash",
      "password",
      "*.password",
    ],
    censor: "[redacted]",
  },
});

/**
 * pino's pretty transport is not bundled, so development logs are plain JSON.
 * Run `npm run dev` and pipe through your own formatter if you want colours.
 */
export type Logger = typeof logger;