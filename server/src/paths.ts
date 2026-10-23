import path from "node:path";

export class PathError extends Error {}

// Resolve um caminho relativo enviado pelo cliente dentro da raiz de armazenamento,
// recusando qualquer tentativa de sair dela (../, caminhos absolutos etc.).
export function resolveSafe(root: string, relative: string): string {
  const cleaned = (relative || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const full = path.resolve(root, cleaned);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
    throw new PathError("Caminho inválido");
  }
  return full;
}

export function validName(name: string): boolean {
  return !!name && name !== "." && name !== ".." && !/[\/\\\0]/.test(name) && name.length <= 255;
}
