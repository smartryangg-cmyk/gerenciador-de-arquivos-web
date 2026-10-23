import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { login, logout, requireAuth, type AuthConfig } from "./auth.js";
import { filesRouter } from "./files.js";

export interface AppConfig {
  root: string;
  auth: AuthConfig;
  staticDir?: string;
}

export function createApp(cfg: AppConfig) {
  fs.mkdirSync(cfg.root, { recursive: true });
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.post("/api/login", login(cfg.auth));
  app.post("/api/logout", logout);
  app.get("/api/me", requireAuth(cfg.auth), (_req, res) => res.json({ username: res.locals.user }));
  app.use("/api/files", requireAuth(cfg.auth), filesRouter(cfg.root));

  if (cfg.staticDir && fs.existsSync(cfg.staticDir)) {
    app.use(express.static(cfg.staticDir));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(cfg.staticDir!, "index.html")));
  }
  return app;
}
