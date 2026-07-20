import express from "express";
import cookieParser from "cookie-parser";
import type { Router } from "express";

export function createApp(router: Router, mountPath = "/api/v1") {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(mountPath, router);
  return app;
}
