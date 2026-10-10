const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { setup } = require("./fixture");
let f, app, admin, csrf;
const origin = "http://localhost:5173";
before(async () => {
  f = await setup();
  app = require("../src/presentation/app").createApp();
  admin = request.agent(app);
  const s = await admin.get("/api/v1/auth/session");
  const a = await admin
    .post("/api/v1/auth/professor")
    .set("Origin", origin)
    .set("X-CSRF-Token", s.body.csrfToken)
    .send({ usuario: "admin@test.local", senha: "TesteSeguro123!" })
    .expect(200);
  csrf = a.body.csrfToken;
});
after(async () => f?.close());
const send = (method, url, body) =>
  admin[method]("/api/v1" + url)
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send(body);
test("REST documentation exposes no environment configuration", async () => {
  const s = await request(app).get("/api/v1/openapi.json").expect(200);
  assert.equal(s.body.openapi, "3.1.0");
  assert.ok(s.body.paths["/admin/usuarios/{id}"].patch);
  assert.ok(!JSON.stringify(s.body).includes("postgres://"));
  await request(app).get("/api/v1").expect(200);
});
test("SQL injection remains bound data and student identifiers reject SQL", async () => {
  const r = await admin
    .get("/api/v1/alunos/busca")
    .query({ busca: "' OR 1=1; DROP TABLE alunos;--" })
    .expect(200);
  assert.equal(r.body.alunos.length, 0);
  await admin.get("/api/v1/alunos/1%20OR%201%3D1").expect(400);
  assert.equal(
    Number((await f.query("SELECT count(*) AS n FROM alunos")).rows[0].n),
    2,
  );
});
test("hostile origins never receive credentialed CORS access", async () => {
  const r = await admin
    .get("/api/v1/conta")
    .set("Origin", "https://hostile.example");
  assert.notEqual(
    r.headers["access-control-allow-origin"],
    "https://hostile.example",
  );
  await admin
    .post("/api/v1/alunos")
    .set("Origin", "https://hostile.example")
    .set("X-CSRF-Token", csrf)
    .send({})
    .expect(403);
});
test("malformed scalars and prototype fields cannot escalate permissions", async () => {
  await send("post", "/alunos", {
    nome: { value: "Nome" },
    cargo: "Admin",
  }).expect(400);
  await send(
    "patch",
    "/preferencias/notificacoes",
    JSON.parse('{"__proto__":{"polluted":true},"notificacoes_ativas":true}'),
  ).expect(200);
  assert.equal({}.polluted, undefined);
  assert.equal(
    (await admin.get("/api/v1/auth/session")).body.identity.cargo,
    "Admin",
  );
});
test("administrative diagnostics need recent reauthentication and wrong password revokes it", async () => {
  process.env.PASS_DELETE_HASH =
    await require("../src/infrastructure/passwords").hash("ReauthSeguro123!");
  await send("post", "/admin/diagnosticos", {}).expect(403);
  await send("post", "/admin/reauth", { password: "ReauthSeguro123!" }).expect(
    200,
  );
  await send("post", "/admin/diagnosticos", {}).expect(200);
  await send("post", "/admin/reauth", { password: "errada" }).expect(401);
  await send("post", "/admin/reparos", {}).expect(403);
});
test("spreadsheet metadata rejects decompression bombs and corrupt directories", () => {
  const { spreadsheetArchiveAllowed } = require("../src/domain/archiveLimits");
  assert.equal(spreadsheetArchiveAllowed(Buffer.from("PK-invalid")), false);
  const b = Buffer.alloc(68);
  b.write("PK");
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt32LE(1, 20);
  b.writeUInt32LE(40000000, 24);
  b.writeUInt32LE(0x06054b50, 46);
  b.writeUInt16LE(1, 56);
  b.writeUInt32LE(46, 58);
  b.writeUInt32LE(0, 62);
  assert.equal(spreadsheetArchiveAllowed(b), false);
});
test("existing active admin cannot be deleted, including direct database operation", async () => {
  await send("delete", "/admin/usuarios/1", {}).expect(400);
  await assert.rejects(
    f.query("DELETE FROM usuarios WHERE id=1"),
    (e) => e.code === "23514",
  );
});
test("invalid assignment list never silently assigns the entire class", async () => {
  const before = Number(
    (await f.query("SELECT count(*) AS n FROM tarefas")).rows[0].n,
  );
  await send("post", "/tarefas", {
    titulo: "Inválida",
    turma: "1º MÉDIO",
    alunos: ["invalid"],
  }).expect(400);
  assert.equal(
    Number((await f.query("SELECT count(*) AS n FROM tarefas")).rows[0].n),
    before,
  );
});
test("production refuses plaintext PostgreSQL configuration", () => {
  const { spawnSync } = require("node:child_process");
  const r = spawnSync(
    process.execPath,
    ["-e", "require('./src/infrastructure/database')"],
    {
      cwd: require("node:path").resolve(__dirname, ".."),
      env: {
        ...process.env,
        NODE_ENV: "production",
        DB_URL: "postgres://test:test@localhost/test",
        DB_SSL_MODE: "disable",
      },
      encoding: "utf8",
    },
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /TLS do PostgreSQL não pode ser desativado/);
});
