import { logger } from "./logger.js";

interface Attempt {
  failures: number;
  /** Epoch ms until which login is refused for this key. */
  lockedUntil: number;
  firstFailureAt: number;
}

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
/** Failures are forgotten this long after the first one in a streak. */
const STREAK_MS = 30 * 60_000;

const attempts = new Map<string, Attempt>();

/** Bounds memory if the process is hammered with unique emails/IPs. */
const MAX_TRACKED_KEYS = 5000;

function sweep(now: number): void {
  for (const [key, attempt] of attempts) {
    if (now - attempt.firstFailureAt > STREAK_MS) attempts.delete(key);
  }
}

export interface LockState {
  locked: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

/** Called before verifying a password. Throws nothing — returns the state. */
export function lockState(key: string): LockState {
  const now = Date.now();
  if (attempts.size > MAX_TRACKED_KEYS) sweep(now);

  const attempt = attempts.get(key);
  if (!attempt) return { locked: false, retryAfterSeconds: 0, remaining: MAX_FAILURES };

  if (attempt.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.ceil((attempt.lockedUntil - now) / 1000),
      remaining: 0,
    };
  }

  return { locked: false, retryAfterSeconds: 0, remaining: MAX_FAILURES - attempt.failures };
}

/** Records a failed sign-in and locks the key once the limit is reached. */
export function recordFailure(key: string): LockState {
  const now = Date.now();
  const existing = attempts.get(key);
  const attempt: Attempt =
    existing && now - existing.firstFailureAt <= STREAK_MS
      ? { ...existing, failures: existing.failures + 1 }
      : { failures: 1, lockedUntil: 0, firstFailureAt: now };

  if (attempt.failures >= MAX_FAILURES) {
    attempt.lockedUntil = now + LOCK_MS;
    logger.warn({ key, failures: attempt.failures }, "sign-in locked");
  }

  attempts.set(key, attempt);
  return lockState(key);
}

/** Clears the streak after a successful sign-in. */
export function recordSuccess(key: string): void {
  attempts.delete(key);
}

/** Test/ops helper. */
export function resetLoginAttempts(): void {
  attempts.clear();
}

export const LOGIN_MAX_FAILURES = MAX_FAILURES;