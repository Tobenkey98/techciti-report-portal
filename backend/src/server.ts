import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { connectDatabase, disconnectDatabase } from "./lib/prisma.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      adminOrigin: env.ADMIN_ORIGIN,
      tutorOrigin: env.TUTOR_ORIGIN,
      tutorPortalUrl: env.tutorPortalBase,
      timezone: env.DEFAULT_TIMEZONE,
    },
    `TechCiti API listening on http://localhost:${env.PORT}`,
  );
});

/** Fail fast if the database is unreachable rather than 500-ing every request. */
connectDatabase().catch((error) => {
  logger.error({ err: error }, "could not connect to MySQL");
  process.exit(1);
});

/* -------------------------------------------------------------------------- */
/*                              Graceful shutdown                             */
/* -------------------------------------------------------------------------- */

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const forceExit = setTimeout(() => {
    logger.error("graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    await disconnectDatabase().catch(() => undefined);
    clearTimeout(forceExit);
    logger.info("shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception — shutting down");
  void shutdown("uncaughtException");
});

export { app, server };