const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  supertest = require("supertest"),
  session = require("express-session");
const { setup } = require("./fixture");
let f, app, admin, teacher, other, student, student2, taskId;
const origin = "http://localhost:5173";
async function agent(kind, email) {
  const http = supertest.agent(app),
    r = await http.get("/api/v1/auth/session").expect(200);
  const auth = await http
    .post("/api/v1/auth/" + kind)
    .set("Origin", origin)
    .set("X-CSRF-Token", r.body.csrfToken)
    .send(
      kind === "aluno"
        ? { email, senha: "TesteSeguro123!" }
        : { usuario: email, senha: "TesteSeguro123!" },
    )
    .expect(200);
  return {
    http,
    csrf: auth.body.csrfToken,
    send(method, path, body) {
      return http[method]("/api/v1" + path)
        .set("Origin", origin)
        .set("X-CSRF-Token", this.csrf)
        .send(body);
    },
  };
}
before(async () => {
  f = await setup();
  app = require("../src/presentation/app").createApp({
    store: new session.MemoryStore(),
  });
  admin = await agent("professor", "admin@test.local");
  teacher = await agent("professor", "prof@test.local");
  other = await agent("professor", "outro@test.local");
  student = await agent("aluno", "aluno@test.local");
  student2 = await agent("aluno", "aluno2@test.local");
});
after(async () => f?.close());
test("health, security headers, no confidential caching", async () => {
  await supertest(app).get("/health").expect(200);
  const r = await supertest(app).get("/api/v1/auth/session").expect(200);
  assert.match(r.headers["cache-control"], /no-store/);
  assert.equal(r.headers["x-content-type-options"], "nosniff");
  assert.equal(r.headers["x-powered-by"], undefined);
});
test("anonymous access and cross-role access denied", async () => {
  await supertest(app).get("/api/v1/alunos").expect(401);
  await teacher.http.get("/api/v1/admin/usuarios").expect(403);
  await student.http.get("/api/v1/alunos").expect(401);
  await teacher.http.get("/api/v1/estudante/painel").expect(401);
});
test("CSRF absent, invalid and hostile origin denied", async () => {
  await teacher.http.post("/api/v1/alunos").send({}).expect(403);
  await teacher.http
    .post("/api/v1/alunos")
    .set("Origin", origin)
    .set("X-CSRF-Token", "invalid")
    .send({})
    .expect(403);
  await teacher.http
    .post("/api/v1/alunos")
    .set("Origin", "https://evil.example")
    .set("X-CSRF-Token", teacher.csrf)
    .send({})
    .expect(403);
});
test("malformed and oversized JSON controlled", async () => {
  await supertest(app)
    .post("/api/v1/auth/aluno")
    .set("Content-Type", "application/json")
    .send("{")
    .expect(400);
  await supertest(app)
    .post("/api/v1/auth/aluno")
    .send({ data: "a".repeat(2100000) })
    .expect(413);
});
test("page data flows for professor, student, administrator", async () => {
  for (const p of [
    "/professores/painel",
    "/alunos",
    "/professores/estatisticas",
    "/tarefas",
    "/calendario",
    "/conta",
    "/notificacoes",
    "/preferencias/notificacoes",
    "/ia/conversas",
  ])
    await teacher.http.get("/api/v1" + p).expect(200);
  for (const p of [
    "/estudante/painel",
    "/estudante/competencias",
    "/estudante/evolucao",
    "/estudante/tarefas",
    "/estudante/grafico",
    "/estudante/ranking",
    "/conta",
  ])
    await student.http.get("/api/v1" + p).expect(200);
  for (const p of ["/admin/usuarios", "/admin/solicitacoes-senha"])
    await admin.http.get("/api/v1" + p).expect(200);
});
test("zero grade and attendance preserved, level recalculated", async () => {
  await teacher
    .send("post", "/avaliacoes", { aluno_id: 1, competencia_id: 1, nota: 0 })
    .expect(200);
  let row = (await f.query("SELECT nota,nivel FROM alunos WHERE id=1")).rows[0];
  assert.equal(Number(row.nota), 0);
  assert.equal(row.nivel, "INAPTO");
  await teacher
    .send("patch", "/alunos/presenca", { aluno_id: 1, presenca: 0 })
    .expect(200);
  assert.equal(
    (await f.query("SELECT presenca FROM alunos WHERE id=1")).rows[0].presenca,
    0,
  );
});
test("invalid grade types, SQL injection id and name arrays rejected", async () => {
  for (const nota of [-1, 11, true, "", " ", null])
    await teacher
      .send("post", "/avaliacoes", { aluno_id: 1, competencia_id: 1, nota })
      .expect(400);
  await teacher.http.get("/api/v1/alunos/1%20OR%201=1").expect(400);
  await teacher
    .send("post", "/alunos", {
      nome: ["x"],
      ano_escolar: "1º MÉDIO",
      idade: 15,
    })
    .expect(400);
});
test("task assignment, IDOR, sanitized delivery and duplicate evaluation", async () => {
  await teacher
    .send("post", "/tarefas", {
      titulo: "Tarefa teste",
      descricao: "Conteúdo <img src=x onerror=alert(1)>",
      turma: "1º MÉDIO",
      prioridade: "MEDIA",
      alunos: [1],
      competencia_id: 1,
    })
    .expect(200);
  taskId = (await f.query("SELECT id FROM tarefas ORDER BY id DESC LIMIT 1"))
    .rows[0].id;
  const d = await teacher.http.get("/api/v1/tarefas/" + taskId).expect(200);
  assert.equal(d.body.alunos.length, 1);
  assert.doesNotMatch(d.body.tarefa.descricao, /<img/);
  await student2
    .send("post", `/estudante/atribuicoes/${taskId}/entregas`, {
      resposta_texto: "Outro",
    })
    .expect(409);
  await student
    .send("post", `/estudante/atribuicoes/${taskId}/entregas`, {
      resposta_texto: "Minha resposta <script>alert(1)</script>",
    })
    .expect(200);
  await other
    .send("post", "/tarefas/avaliacoes", {
      tarefa_id: taskId,
      aluno_id: 1,
      nota: 8,
    })
    .expect(404);
  await other.send("delete", "/tarefas/" + taskId, {}).expect(404);
  await teacher
    .send("post", "/tarefas/avaliacoes", {
      tarefa_id: taskId,
      aluno_id: 1,
      nota: 0,
    })
    .expect(200);
  await teacher
    .send("post", "/tarefas/avaliacoes", {
      tarefa_id: taskId,
      aluno_id: 1,
      nota: 10,
    })
    .expect(409);
});
test("disguised executable upload rejected", async () => {
  await student.http
    .post(`/api/v1/estudante/atribuicoes/${taskId}/entregas`)
    .set("Origin", origin)
    .set("X-CSRF-Token", student.csrf)
    .attach("arquivo", Buffer.from("<script>alert(1)</script>"), "attack.pdf")
    .expect(400);
});
test("spreadsheet preview retains zeros and XLSX downloads work", async () => {
  const csv =
    "ID,ALUNO,ANO ESCOLAR,IDADE,MÉDIA,PRESENÇA,NÍVEL,COMPETÊNCIAS\n1,IMPORTADO TESTE,1º MÉDIO,15,,0,,Lógica: 0\n";
  const r = await teacher.http
    .post("/api/v1/alunos/importacoes/preview")
    .set("Origin", origin)
    .set("X-CSRF-Token", teacher.csrf)
    .attach("arquivo", Buffer.from(csv), "import.csv")
    .expect(200);
  assert.equal(r.body.alunos[0].presenca, 0);
  assert.equal(r.body.alunos[0].competencias[0].nota, 0);
  for (const p of ["/alunos/exportacoes", "/alunos/importacoes/modelo"]) {
    const res = await teacher.http
      .get("/api/v1" + p)
      .buffer(true)
      .parse((r, done) => {
        const d = [];
        r.on("data", (v) => d.push(v));
        r.on("end", () => done(null, Buffer.concat(d)));
      })
      .expect(200);
    assert.equal(res.body.subarray(0, 2).toString(), "PK");
  }
});
test("foreign notification unchanged and conversation IDOR denied", async () => {
  const n = (
    await f.query(
      `
  INSERT INTO notificacoes(aluno_id, tipo, titulo)
  VALUES (2, 'tarefa', 'Privado')
  RETURNING id
`,
    )
  ).rows[0].id;
  await student.send("patch", "/notificacoes/" + n, {}).expect(404);
  assert.equal(
    (await f.query("SELECT lida FROM notificacoes WHERE id=$1", [n])).rows[0]
      .lida,
    false,
  );
  await teacher
    .send("patch", "/ia/conversas/999", { acao: "renomear", titulo: "Teste" })
    .expect(404);
});
test("inactive identity revokes active session", async () => {
  await f.query("UPDATE usuarios SET status='INATIVO' WHERE id=3");
  await other.http.get("/api/v1/conta").expect(401);
});
test("sanitizer and Argon2id", async () => {
  assert.equal(
    require("../src/domain/validation").text(
      "<img src=x onerror=alert(1)>Olá &amp; mundo",
      100,
    ),
    "Olá & mundo",
  );
  const p = require("../src/infrastructure/passwords"),
    hash = await p.hash("TesteSeguro123!");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await p.compare("TesteSeguro123!", hash), true);
  assert.equal(await p.compare("errada", hash), false);
});
test("distributed login rate limit", async () => {
  const h = supertest.agent(app),
    r = await h.get("/api/v1/auth/session");
  for (let i = 0; i < 10; i++) {
    const res = await h
      .post("/api/v1/auth/professor")
      .set("Origin", origin)
      .set("X-CSRF-Token", r.body.csrfToken)
      .send({ usuario: "missing@test.local", senha: "errada" });
    assert.ok([401, 429].includes(res.status));
  }
  await h
    .post("/api/v1/auth/professor")
    .set("Origin", origin)
    .set("X-CSRF-Token", r.body.csrfToken)
    .send({ usuario: "missing@test.local", senha: "errada" })
    .expect(429);
});
