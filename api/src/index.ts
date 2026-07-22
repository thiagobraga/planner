import express, { type Express } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { createServer } from "http";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { connectRedis } from "./db/redis.js";
import { attachSyncServer } from "./services/syncService.js";
import { PORT, CORS_ORIGIN, DISABLE_RATE_LIMITS_IN_DEV, IS_PRODUCTION } from "./config.js";
import { csrfProtection } from "./middleware/csrf.js";
import { requestContext } from "./middleware/requestContext.js";
import { originCheck } from "./middleware/origin.js";
import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";

const app: Express = express();
app.set("trust proxy", IS_PRODUCTION ? 1 : 0);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      reportUri: "/api/v1/csp-violation",
    },
  },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginEmbedderPolicy: { policy: "require-corp" },
}));

// Permissions-Policy (Helmet v7 removed built-in support)
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  next();
});
app.use(cookieParser());

// Request ID on every response
app.use((req, res, next) => {
  res.setHeader("X-Request-Id", crypto.randomUUID());
  next();
});

if (!DISABLE_RATE_LIMITS_IN_DEV) {
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);
}

app.use(express.json({ limit: "100kb" }));

// Reject non-JSON Content-Type on unsafe methods — prevents CSRF form-encoded bypass
app.use("/api/v1", (req, res, next) => {
  if (req.path.startsWith("/auth")) {
    next();
    return;
  }
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    const ct = req.headers["content-type"] ?? "";
    if (!ct.startsWith("application/json")) {
      res.status(415).json({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Only application/json is accepted on this endpoint",
        },
      });
      return;
    }
  }
  next();
});

// CORS
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-XSRF-TOKEN,X-Socket-Id");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Binds the calling socket to the request so events can name their origin
app.use("/api/v1", requestContext);

// Liveness probe — must stay ahead of authMiddleware so container healthchecks
// and the host reverse proxy can reach it without credentials
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth routes (mounted before CSRF — login/register don't need tokens)
// Each auth route handles its own IP + account-based rate limiting via rateLimitService
app.use("/api/v1/auth", authRoutes);

// Origin check for unsafe requests
app.use("/api/v1", originCheck);

// Auth session validation (before CSRF so req.sessionId is available)
app.use("/api/v1", async (req, res, next) => {
  if (req.path.startsWith("/auth")) {
    next();
    return;
  }
  await authMiddleware(req, res, next);
});

// Global CSRF protection — safe methods set the cookie, unsafe methods validate
app.use("/api/v1", csrfProtection);

// Cache-Control for all API responses
app.use("/api/v1", (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

// All other API routes
app.use("/api/v1", routes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

const httpServer = createServer(app);

async function start() {
  try {
    await connectRedis();
    await attachSyncServer(httpServer);
  } catch (err) {
    console.error("⚠️  SYNC DISABLED: Redis/Socket.IO startup failed. Real-time updates will not work.", err);
  }

  httpServer.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  void start();
}

export default app;
export { httpServer };
