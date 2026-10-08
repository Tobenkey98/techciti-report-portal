import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Repository root, resolved from src/config → ../../ */
export const ROOT_DIR = path.resolve(here, "..", "..");

/**
 * Loads `.env` using Node's built-in loader (Node >= 20.12), so no dotenv
 * dependency is needed. Values already present in the real environment always
 * win, which is what you want in containers and CI.
 */
function loadEnvFile(): void {
  const envFile = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envFile)) return;
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envFile);
      return;
    }
  } catch {
    /* fall through to the minimal parser below */
  }
  // Minimal .env parser for older runtimes.
  for (const rawLine of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

/**
 * Every environment variable is read and validated exactly once, here.
 * A missing or malformed value fails the process at boot rather than
 * producing a confusing 500 at request time.
 */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === "boolean" ? value : ["1", "true", "yes", "on"].includes(value.toLowerCase()),
  );

/**
 * A comma-separated allowlist of origins, one entry validated per origin.
 *
 * Trailing slashes are stripped and duplicates collapsed here rather than at
 * every comparison site, so `https://a.ng/` and `https://a.ng` are one entry
 * instead of two that never both match. The schema still reports which entry
 * was wrong, so a typo names the offending value instead of failing opaquely.
 */
const originList = z
  .string()
  .transform((value) => [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))])
  .refine((list) => list.length > 0, "must list at least one origin")
  .refine((list) => list.every((entry) => z.string().url().safeParse(entry).success), (list) => ({
    message: `not a valid origin URL: ${list.find((entry) => !z.string().url().safeParse(entry).success)}`,
  }))
  .transform((list) => list.map((entry) => entry.replace(/\/+$/, "")));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  COOKIE_NAME: z.string().default("techciti_admin_session"),
  COOKIE_SECURE: booleanish.default("false"),

  SUPER_ADMIN_NAME: z.string().default("TechCiti Super Admin"),
  SUPER_ADMIN_EMAIL: z.string().email().default("admin@techciti.ng"),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default("TechCiti2026!"),

  /**
   * Origins allowed to call `/api/admin/*`, comma-separated.
   *
   * More than one is permitted because a single Next.js deployment often
   * serves both `/admin` and `/t/<token>` from the same host, in which case
   * the admin and tutor apps legitimately share an origin and both lists
   * contain it. Splitting the two apps across different domains remains
   * supported: list the admin domain only in ADMIN_ORIGIN and only the tutor
   * domain in TUTOR_ORIGIN, and the namespaces stay mutually exclusive.
   */
  ADMIN_ORIGIN: originList,
  /** Origins allowed to call `/api/tutor/*.`, comma-separated. See ADMIN_ORIGIN. */
  TUTOR_ORIGIN: originList,
  /** Public base URL of the tutor app, used to build /t/<token> links. */
  TUTOR_PORTAL_URL: z.string().url(),

  DEFAULT_TIMEZONE: z.string().default("Africa/Lagos"),
  MAX_MONTHS_AHEAD: z.coerce.number().int().min(0).max(12).default(0),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(5),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`\n✖ Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.\n`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === "production",
  isDevelopment: raw.NODE_ENV === "development",
  /** Tutors are reached at TUTOR_PORTAL_URL + /t/<token> */
  tutorPortalBase: raw.TUTOR_PORTAL_URL.replace(/\/+$/, ""),
  uploadMaxBytes: raw.UPLOAD_MAX_MB * 1024 * 1024,
} as const;

/**
 * Allowed origins, split by portal so a tutor app can never reach admin routes.
 *
 * Both are allowlists because one Next.js deployment commonly serves `/admin`
 * and `/t/<token>` from the same host, which puts the same origin in both.
 * That does not weaken the split: a *separate* admin host and tutor host can
 * still each list only themselves, and `enforceOrigin` still rejects any
 * request whose Origin is absent from the relevant list.
 */
export const origins = {
  admin: raw.ADMIN_ORIGIN,
  tutor: raw.TUTOR_ORIGIN,
} as const;

export type Env = typeof env;