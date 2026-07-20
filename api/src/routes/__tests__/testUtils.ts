import express from "express";
import cookieParser from "cookie-parser";
import type { Router } from "express";

export function createApp(router: Router, mountPath = "/api/v1") {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  // Tests mock authMiddleware but since it was moved to index.ts globally,
  // we need to apply the mock here so req.userId gets set in tests.
  app.use((req, res, next) => {
    // Some routes tests might mock authMiddleware themselves and set req.userId,
    // but if they don't, default to test-user or let the mock intercept it.
    // However, the test files use `vi.mock` on auth.js which is not imported here.
    // The easiest fix is to just set req.userId here for all tests.
    Object.defineProperty(req, "userId", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: "test-user",
    });
    next();
  });

  app.use(mountPath, router);
  return app;
}
