import express, { type Application, type RequestHandler } from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env, origins } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { pingDatabase } from "./lib/prisma.js";
import { apiLimiter } from "./middleware/rate-limit.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { tutorRouter } from "./modules/tutor/tutor.routes.js";

/**
 * Split-origin CORS.
 *
 * CORS is a browser convenience, not a security boundary — the real protections
 * are the session cookie (httpOnly, SameSite=Strict), the `X-Tutor-Token` header
 * and the ownership checks in every query. What CORS buys us here is defence in
 * depth: the tutor app cannot even *attempt* an admin call, and vice versa.
 */
const ADMIN_ORIGINS = new Set(origins.admin);
const TUTOR_ORIGINS = new Set(origins.tutor);

function corsFor(allowed: Set<string>): RequestHandler {
  const options: CorsOptions = {
    origin(origin, callback) {
      // Same-origin requests and non-browser clients send no Origin header.
      // `curl`/server-to-server calls are not subject to CORS at all.
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowed.has(origin.replace(/\/+$/, "")));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tutor-Token", "X-Requested-With"],
    exposedHeaders: ["Content-Disposition", "Retry-After"],
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
  return cors(options);
}

/**
 * A request to `/api/admin/*` from the tutor origin (or the reverse) is
 * rejected outright with 403 rather than merely lacking CORS headers, so a
 * misconfigured deployment fails loudly instead of mysteriously.
 */
const enforceOrigin = (name: string, allowed: Set<string>): RequestHandler =>
  (req, res, next) => {
    const origin = req.get("origin");
    if (!origin) {
      next();
      return;
    }
    if (!allowed.has(origin.replace(/\/+$/, ""))) {
      logger.warn({ origin, url: req.originalUrl }, `rejected cross-origin ${name} request`);
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `This origin is not allowed to use the ${name} API.`,
        },
      });
      return;
    }
    next();
  };

export function createApp(): Application {
  const app = express();

  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // The API serves JSON and file downloads, never HTML, so a strict CSP is
      // not needed here; the HTML report is rendered on a separate origin.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  app.use(
    pinoHttp({
      logger,
      // Health checks would otherwise dominate the log.
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());

  // ------------------------------------------------------------- health ----
  const startedAt = Date.now();

  app.get("/api/health", async (_req, res) => {
    const database = await pingDatabase();
    res.status(database ? 200 : 503).json({
      success: database,
      data: {
        status: database ? "ok" : "degraded",
        database: database ? "up" : "down",
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        version: "1.0.0",
        environment: env.NODE_ENV,
        serverTime: new Date().toISOString(),
        timezone: env.DEFAULT_TIMEZONE,
      },
    });
  });

  // -------------------------------------------------------- namespace roots --
  app.use("/api/admin", corsFor(ADMIN_ORIGINS), enforceOrigin("admin", ADMIN_ORIGINS), apiLimiter, adminRouter);
  app.use("/api/tutor", corsFor(TUTOR_ORIGINS), enforceOrigin("tutor", TUTOR_ORIGINS), apiLimiter, tutorRouter);

  /** A self-describing index so a new integrator can find the endpoints. */
  app.get("/api", (_req, res) => {
    res.json({
      success: true,
      data: {
        name: "TechCiti Tutor Report Portal API",
        version: "1.0.0",
        namespaces: {
          admin: {
            base: "/api/admin",
            origins: origins.admin,
            auth: "httpOnly cookie session (8h), set by POST /api/admin/auth/login",
            docs: "See README.md — Admin endpoints",
          },
          tutor: {
            base: "/api/tutor",
            origins: origins.tutor,
            auth: 'Header "X-Tutor-Token: <token from /t/<token> URL>"',
            docs: "See README.md — Tutor endpoints",
          },
        },
        health: "/api/health",
      },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}