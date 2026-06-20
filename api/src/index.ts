import express, { type Express } from "express";
import { createServer } from "http";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { connectRedis } from "./db/redis.js";
import { attachSyncServer } from "./services/syncService.js";

const app: Express = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// CORS
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

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

  httpServer.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  void start();
}

export default app;
export { httpServer };
