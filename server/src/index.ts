import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const required = (name: string) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Variável de ambiente ${name} é obrigatória`);
    process.exit(1);
  }
  return v;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const app = createApp({
  root: path.resolve(process.env.STORAGE_DIR ?? "./storage"),
  auth: {
    user: required("ADMIN_USER"),
    password: required("ADMIN_PASSWORD"),
    secret: required("JWT_SECRET"),
  },
  staticDir: path.resolve(here, "../../client/dist"),
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Gerenciador de arquivos em http://localhost:${port}`));
