import type { ActorType, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

export interface AuditInput {
  actorType: ActorType;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Prisma.InputJsonValue;
}

/**
 * Writes an audit row.
 *
 * Auditing must never break the request that triggered it, so failures are
 * logged and swallowed rather than propagated.
 */
export async function recordActivity(input: AuditInput): Promise<void> {
  try {
    await prisma.activityLog.create({ data: input });
  } catch (error) {
    logger.error({ err: error, action: input.action }, "failed to write activity log");
  }
}

/** Audit entry for an authenticated admin request. */
export function auditAdmin(
  admin: { id: string },
  action: string,
  entityType: string,
  entityId: string,
  meta?: Prisma.InputJsonValue,
): Promise<void> {
  return recordActivity({
    actorType: "ADMIN",
    actorId: admin.id,
    action,
    entityType,
    entityId,
    meta,
  });
}

/** Audit entry for an authenticated tutor request. */
export function auditTutor(
  tutor: { id: string },
  action: string,
  entityType: string,
  entityId: string,
  meta?: Prisma.InputJsonValue,
): Promise<void> {
  return recordActivity({
    actorType: "TUTOR",
    actorId: tutor.id,
    action,
    entityType,
    entityId,
    meta,
  });
}