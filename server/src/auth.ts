import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export interface AuthConfig {
  user: string;
  password: string;
  secret: string;
}

const COOKIE = "fm_token";

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function login(cfg: AuthConfig) {
  return (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" ||
        !(safeEqual(username, cfg.user) && safeEqual(password, cfg.password))) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }
    const token = jwt.sign({ sub: username }, cfg.secret, { expiresIn: "12h" });
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.json({ username });
  };
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
}

export function requireAuth(cfg: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE];
    try {
      const payload = jwt.verify(token, cfg.secret) as { sub: string };
      res.locals.user = payload.sub;
      next();
    } catch {
      res.status(401).json({ error: "Não autenticado" });
    }
  };
}
