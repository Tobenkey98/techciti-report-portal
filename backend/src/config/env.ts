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

  /** Admin deployment origin. ONLY this origin may call /api/admin/*. */
  ADMIN_ORIGIN: z.string().url(),
  /** Tutor deployment origin. ONLY this origin may call /api/tutor/*. */
  TUTOR_ORIGIN: z.string().url(),
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

/** Allowed origins, split by portal so a tutor app can never reach admin routes. */
export const origins = {
  admin: raw.ADMIN_ORIGIN.replace(/\/+$/, ""),
  tutor: raw.TUTOR_ORIGIN.replace(/\/+$/, ""),
} as const;

export type Env = typeof env;