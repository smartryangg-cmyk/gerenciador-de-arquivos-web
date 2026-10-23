import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

let root: string;
let agent: ReturnType<typeof request.agent>;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "fm-"));
  const app = createApp({ root, auth: { user: "admin", password: "senha", secret: "s" } });
  agent = request.agent(app);
  await agent.post("/api/login").send({ username: "admin", password: "senha" }).expect(200);
});

describe("autenticação", () => {
  it("bloqueia sem login", async () => {
    const app = createApp({ root, auth: { user: "admin", password: "senha", secret: "s" } });
    await request(app).get("/api/files/list").expect(401);
  });
  it("recusa senha errada", async () => {
    const app = createApp({ root, auth: { user: "admin", password: "senha", secret: "s" } });
    await request(app).post("/api/login").send({ username: "admin", password: "x" }).expect(401);
  });
});

describe("arquivos", () => {
  it("cria pasta, envia, lista, renomeia, move e exclui", async () => {
    await agent.post("/api/files/mkdir").send({ path: "", name: "docs" }).expect(200);
    await agent.post("/api/files/upload").field("path", "").attach("files", Buffer.from("olá"), "nota.txt").expect(200);

    const list = await agent.get("/api/files/list").query({ path: "" }).expect(200);
    expect(list.body.items.map((i: any) => i.name)).toEqual(["docs", "nota.txt"]);

    await agent.post("/api/files/rename").send({ path: "nota.txt", newName: "leia.txt" }).expect(200);
    await agent.post("/api/files/move").send({ path: "leia.txt", dest: "docs" }).expect(200);
    const dl = await agent.get("/api/files/download").query({ path: "docs/leia.txt" }).expect(200);
    expect(dl.headers["content-disposition"]).toContain("attachment");

    await agent.post("/api/files/delete").send({ path: "docs" }).expect(200);
    expect(fs.readdirSync(root).filter((n) => n !== ".uploads-tmp")).toEqual([]);
  });

  it("impede sair da raiz", async () => {
    await agent.get("/api/files/list").query({ path: "../" }).expect(400);
    await agent.get("/api/files/download").query({ path: "../../etc/passwd" }).expect(400);
    await agent.post("/api/files/mkdir").send({ path: "", name: "../fora" }).expect(400);
    await agent.post("/api/files/delete").send({ path: "" }).expect(400);
  });

  it("não move pasta para dentro dela mesma", async () => {
    await agent.post("/api/files/mkdir").send({ path: "", name: "a" }).expect(200);
    await agent.post("/api/files/move").send({ path: "a", dest: "a" }).expect(400);
  });
});
