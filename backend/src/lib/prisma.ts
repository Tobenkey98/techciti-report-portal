import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * A single Prisma client for the whole process.
 *
 * In development `tsx watch` re-evaluates modules on every change, which would
 * otherwise open a new connection pool each time until MySQL refuses
 * connections. Caching on `globalThis` keeps one client across hot reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "trace"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
          ]
        : [{ emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }],
  });

if (!env.isProduction) globalForPrisma.prisma = prisma;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info("Connected to MySQL");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/** Cheap liveness probe for /api/health. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}