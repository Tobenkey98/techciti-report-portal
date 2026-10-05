import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const BCRYPT_ROUNDS = 12;

const JWT_ISSUER = "techciti-reports-api";
const JWT_AUDIENCE = "techciti-admin";

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: string;
}

/** Hashes a plaintext password for storage. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Compares a plaintext candidate against the stored hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/**
 * Generates a tutor's private portal token: 48 hex characters (24 random
 * bytes) — unguessable, URL safe and revocable.
 */
export function generateTutorToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Short random reference, used for import batch ids. */
export function generateReference(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

/** Timing-safe comparison for values that are not password hashes. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/** Issues the admin session JWT (delivered in an httpOnly cookie). */
export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign({ ...payload }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as AdminTokenPayload;
}