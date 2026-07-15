import express, { type Express } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { connectRedis } from "./db/redis.js";
import { attachSyncServer } from "./services/syncService.js";
import { PORT, CORS_ORIGIN } from "./config.js";
import { csrfProtection } from "./middleware/csrf.js";
import authRoutes from "./routes/auth.js";

const app: Express = express();

// Security middleware
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
    },
  },
}));
app.use(cookieParser());

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Middleware
app.use(express.json());

// CORS
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-XSRF-TOKEN");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Per-route rate limiters
const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth routes before CSRF (login/register don't need CSRF token)
app.use("/api/v1/auth/register", authRegisterLimiter);
app.use("/api/v1/auth/reset-password", passwordResetLimiter);
app.use("/api/v1/auth", authRoutes);

// CSRF protection (excludes GET/HEAD/OPTIONS)
app.use("/api/v1/tasks", csrfProtection);
app.use("/api/v1/projects", csrfProtection);
app.use("/api/v1/labels", csrfProtection);
app.use("/api/v1/sections", csrfProtection);
app.use("/api/v1/comments", csrfProtection);
app.use("/api/v1/reminders", csrfProtection);
app.use("/api/v1/habits", csrfProtection);
app.use("/api/v1/filters", csrfProtection);
app.use("/api/v1/preferences", csrfProtection);
app.use("/api/v1/activity", csrfProtection);
app.use("/api/v1/collaboration", csrfProtection);

// Routes
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
