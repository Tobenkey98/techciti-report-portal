import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../config/env.js";

const base: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Rate limiting is disabled while running tests so suites are not flaky.
  skip: () => env.NODE_ENV === "test",
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down and try again shortly." },
  },
};

/**
 * Normalises an IP for use in a rate-limit key.
 *
 * IPv6 addresses are collapsed to their /64 prefix so a single client with a
 * rotating address cannot sidestep the limit by cycling addresses from the same
 * allocation. `::ffff:` is the IPv4-mapped form Express produces behind a
 * proxy, so it is unwrapped first.
 */
function ipKey(ip: string | undefined): string {
  const address = (ip ?? "unknown").replace(/^::ffff:/, "");
  if (!address.includes(":")) return address;
  const groups = address.split(":");
  return groups.slice(0, 4).join(":") || "::1";
}

/** Broad safety net applied to the whole API surface. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 300,
  keyGenerator: (req) => ipKey(req.ip),
});

/**
 * Login protection: 5 attempts per 15 minutes, keyed on IP **and** email so
 * neither a single noisy IP nor a single targeted account can be brute-forced
 * without tripping the limit.
 */
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase().slice(0, 120)
        : "unknown";
    return `${ipKey(req.ip)}:${email}`;
  },
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many sign-in attempts. Wait 15 minutes and try again.",
    },
  },
});

/**
 * Bulk imports are expensive — each one parses a whole file and may open a
 * transaction — so they are spaced out. The budget is generous enough for a
 * realistic admin session (download a template, preview, correct, commit, plus a
 * second file), while still stopping a runaway upload loop.
 */
export const importLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req) => ipKey(req.ip),
});

/** Document generation spins up a headless browser. */
export const documentLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => ipKey(req.ip),
});