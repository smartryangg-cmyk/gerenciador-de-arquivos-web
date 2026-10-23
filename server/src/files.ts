import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { resolveSafe, validName, PathError } from "./paths.js";

type Handler = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

const INLINE_TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".pdf": "application/pdf", ".mp4": "video/mp4", ".mp3": "audio/mpeg",
};
const TEXT_EXTS = new Set([".txt", ".md", ".json", ".csv", ".log", ".js", ".ts", ".css", ".xml", ".yml", ".yaml"]);

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function filesRouter(root: string): Router {
  const router = Router();
  const upload = multer({ dest: path.join(root, ".uploads-tmp") });

  router.get("/list", wrap(async (req, res) => {
    const dir = resolveSafe(root, str(req.query.path));
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const items = await Promise.all(
      entries
        .filter((e) => !(dir === path.resolve(root) && e.name === ".uploads-tmp"))
        .map(async (e) => {
          const st = await fs.stat(path.join(dir, e.name));
          return {
            name: e.name,
            type: e.isDirectory() ? "dir" : "file",
            size: st.size,
            modified: st.mtime.toISOString(),
          };
        }),
    );
    items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    res.json({ path: str(req.query.path), items });
  }));

  router.get("/download", wrap(async (req, res) => {
    const file = resolveSafe(root, str(req.query.path));
    const st = await fs.stat(file);
    if (!st.isFile()) return res.status(400).json({ error: "Não é um arquivo" });
    const ext = path.extname(file).toLowerCase();
    // Só exibe inline tipos que o navegador não executa como página; o resto vira download.
    const inline = req.query.inline === "1" && (INLINE_TYPES[ext] || TEXT_EXTS.has(ext));
    res.setHeader("Content-Length", st.size);
    res.setHeader("X-Content-Type-Options", "nosniff");
    const filename = encodeURIComponent(path.basename(file));
    if (inline) {
      res.type(INLINE_TYPES[ext] ?? "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${filename}`);
    } else {
      res.type("application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
    }
    createReadStream(file).pipe(res);
  }));

  router.post("/upload", upload.array("files"), wrap(async (req, res) => {
    const dir = resolveSafe(root, str(req.body.path));
    const files = (req.files as Express.Multer.File[]) ?? [];
    const saved: string[] = [];
    for (const f of files) {
      const name = Buffer.from(f.originalname, "latin1").toString("utf8");
      if (!validName(name)) {
        await fs.rm(f.path, { force: true });
        continue;
      }
      await fs.rename(f.path, path.join(dir, name));
      saved.push(name);
    }
    res.json({ saved });
  }));

  router.post("/mkdir", wrap(async (req, res) => {
    const name = str(req.body.name);
    if (!validName(name)) return res.status(400).json({ error: "Nome inválido" });
    const dir = resolveSafe(root, path.posix.join(str(req.body.path), name));
    await fs.mkdir(dir);
    res.json({ ok: true });
  }));

  router.post("/rename", wrap(async (req, res) => {
    const newName = str(req.body.newName);
    if (!validName(newName)) return res.status(400).json({ error: "Nome inválido" });
    const from = resolveSafe(root, str(req.body.path));
    if (from === path.resolve(root)) return res.status(400).json({ error: "Não é possível renomear a raiz" });
    const to = path.join(path.dirname(from), newName);
    resolveSafe(root, path.relative(root, to));
    if (await exists(to)) return res.status(409).json({ error: "Já existe um item com esse nome" });
    await fs.rename(from, to);
    res.json({ ok: true });
  }));

  router.post("/move", wrap(async (req, res) => {
    const from = resolveSafe(root, str(req.body.path));
    const destDir = resolveSafe(root, str(req.body.dest));
    if (from === path.resolve(root)) return res.status(400).json({ error: "Não é possível mover a raiz" });
    if (destDir === from || destDir.startsWith(from + path.sep)) {
      return res.status(400).json({ error: "Não é possível mover uma pasta para dentro dela mesma" });
    }
    const to = path.join(destDir, path.basename(from));
    if (await exists(to)) return res.status(409).json({ error: "Já existe um item com esse nome no destino" });
    await fs.rename(from, to);
    res.json({ ok: true });
  }));

  router.post("/delete", wrap(async (req, res) => {
    const target = resolveSafe(root, str(req.body.path));
    if (target === path.resolve(root)) return res.status(400).json({ error: "Não é possível excluir a raiz" });
    await fs.rm(target, { recursive: true });
    res.json({ ok: true });
  }));

  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof PathError) return res.status(400).json({ error: err.message });
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return res.status(404).json({ error: "Não encontrado" });
    if (code === "EEXIST") return res.status(409).json({ error: "Já existe" });
    if (code === "ENOTDIR") return res.status(400).json({ error: "Não é uma pasta" });
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  });

  return router;
}

async function exists(p: string) {
  return fs.access(p).then(() => true, () => false);
}
