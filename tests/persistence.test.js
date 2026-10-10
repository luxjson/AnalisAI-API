const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { setup } = require("./fixture");
let f, app, admin, teacher, student;
const origin = "http://localhost:5173";
async function login(kind, address, senha = "TesteSeguro123!") {
  const http = request.agent(app),
    r = await http.get("/api/v1/auth/session");
  const previous = r.headers["set-cookie"][0].split(";")[0];
  const result = await http
    .post("/api/v1/auth/" + kind)
    .set("Origin", origin)
    .set("X-CSRF-Token", r.body.csrfToken)
    .send(
      kind === "aluno"
        ? { email: address, senha }
        : { usuario: address, senha },
    )
    .expect(200);
  return {
    http,
    csrf: result.body.csrfToken,
    oldCookie: previous,
    newCookie: result.headers["set-cookie"][0].split(";")[0],
    send(method, p, body) {
      return http[method]("/api/v1" + p)
        .set("Origin", origin)
        .set("X-CSRF-Token", this.csrf)
        .send(body);
    },
  };
}
before(async () => {
  f = await setup();
  app = require("../src/presentation/app").createApp();
  admin = await login("professor", "admin@test.local");
  teacher = await login("professor", "prof@test.local");
  student = await login("aluno", "aluno@test.local");
});
after(async () => f?.close());
test("session fixation denied and session persisted without DDL in HTTP", async () => {
  assert.notEqual(teacher.oldCookie, teacher.newCookie);
  await request(app)
    .get("/api/v1/conta")
    .set("Cookie", teacher.oldCookie)
    .expect(401);
  assert.ok(
    Number(
      (await f.query("SELECT COUNT(*) AS total FROM web_sessions")).rows[0]
        .total,
    ) >= 3,
  );
});
test("bcrypt credentials upgraded after successful login", async () => {
  const bcrypt = require("bcryptjs");
  await f.query("UPDATE usuarios SET senha=$1 WHERE id=3", [
    await bcrypt.hash("TesteSeguro123!", 10),
  ]);
  await login("professor", "outro@test.local");
  assert.match(
    (await f.query("SELECT senha FROM usuarios WHERE id=3")).rows[0].senha,
    /^\$argon2id\$/,
  );
});
test("password rotation invalidates other PostgreSQL sessions", async () => {
  const second = await login("professor", "prof@test.local");
  const r = await teacher
    .send("patch", "/professores/senha", {
      senha_atual: "TesteSeguro123!",
      nova_senha: "NovoSegredoSeguro123!",
      confirmar_senha: "NovoSegredoSeguro123!",
    })
    .expect(200);
  teacher.csrf = r.body.csrfToken;
  await second.http.get("/api/v1/conta").expect(401);
  await teacher.http.get("/api/v1/conta").expect(200);
});
test("preference persistence upsert and strict booleans", async () => {
  const body = {
    notificacoes_ativas: false,
    notificacoes_tarefas: true,
    notificacoes_avaliacoes: false,
    notificacoes_competencias: true,
    notificacoes_email: false,
  };
  await student.send("patch", "/preferencias/notificacoes", body).expect(200);
  assert.equal(
    (await student.http.get("/api/v1/preferencias/notificacoes")).body
      .notificacoes_ativas,
    false,
  );
  await student
    .send("patch", "/preferencias/notificacoes", {
      ...body,
      notificacoes_ativas: "anything",
    })
    .expect(400);
  assert.equal(
    Number(
      (
        await f.query(
          "SELECT COUNT(*) AS count FROM configuracoes_notificacoes WHERE aluno_id=1",
        )
      ).rows[0].count,
    ),
    1,
  );
});
test("calendar range, recurring holiday, all classes and owner check", async () => {
  await teacher
    .send("post", "/calendario/eventos", {
      titulo: "Evento",
      tipo: "EVENTO",
      data_inicio: "2026-10-10",
      data_fim: "2026-10-12",
      turma: "1º MÉDIO",
      cor: "#217346",
    })
    .expect(200);
  await teacher
    .send("post", "/calendario/feriados", {
      nome: "Anual",
      data: "2020-10-12",
      recorrente: true,
    })
    .expect(200);
  const r = await teacher.http
    .get("/api/v1/calendario/mes?mes=10&ano=2026")
    .expect(200);
  assert.equal(r.body.eventos.length, 1);
  assert.equal(r.body.feriados.length, 1);
  await teacher
    .send("post", "/calendario/eventos", {
      titulo: "Ruim",
      tipo: "EVENTO",
      data_inicio: "2026-10-12",
      data_fim: "2026-10-10",
    })
    .expect(400);
  await teacher.http.get("/api/v1/calendario/mes?mes=0&ano=2026").expect(400);
});
test("calendar refuses an invalid class instead of creating a general event", async () => {
  const before = await f.query(
    "SELECT COUNT(*) AS total FROM calendario_eventos",
  );
  await teacher
    .send("post", "/calendario/eventos", {
      titulo: "Turma inválida",
      tipo: "EVENTO",
      data_inicio: "2026-10-20",
      turma: "TURMA INEXISTENTE",
    })
    .expect(400);
  const after = await f.query(
    "SELECT COUNT(*) AS total FROM calendario_eventos",
  );
  assert.equal(after.rows[0].total, before.rows[0].total);
});

test("assignment ID distinct from task ID and file access ownership", async () => {
  await f.query(
    `
  INSERT INTO tarefas(titulo, turma, criado_por)
  VALUES ('Primeira', '1º MÉDIO', 2),('Segunda', '1º MÉDIO',
    2)
`,
  );
  await f.query("INSERT INTO tarefas_alunos(tarefa_id,aluno_id)VALUES(2,1)");
  await student.http
    .post("/api/v1/estudante/atribuicoes/1/entregas")
    .set("Origin", origin)
    .set("X-CSRF-Token", student.csrf)
    .attach("arquivo", Buffer.from("%PDF-1.4\nTeste\n%%EOF"), "atividade.pdf")
    .expect(200);
  const file = (
    await f.query("SELECT resposta_arquivo FROM tarefas_alunos WHERE id=1")
  ).rows[0].resposta_arquivo;
  await student.http.get("/api/v1/arquivos/" + file).expect(200);
  await teacher.http.get("/api/v1/arquivos/" + file).expect(200);
  const other = await login("aluno", "aluno2@test.local");
  await other.http.get("/api/v1/arquivos/" + file).expect(404);
  await request(app)
    .get("/api/v1/arquivos/" + file)
    .expect(401);
});
test("AI grade zero audit retains previous zero and requires explicit confirmation", async () => {
  await teacher
    .send("post", "/ia/avaliacoes", {
      alunoId: 1,
      competenciaId: 1,
      nota: 0,
      confirm: true,
    })
    .expect(200);
  await teacher
    .send("post", "/ia/avaliacoes", {
      alunoId: 1,
      competenciaId: 1,
      nota: 8,
      confirm: true,
    })
    .expect(200);
  const audit = (
    await f.query(
      "SELECT nota_anterior,nota_nova FROM ia_auditoria_notas ORDER BY id DESC LIMIT 1",
    )
  ).rows[0];
  assert.equal(Number(audit.nota_anterior), 0);
  assert.equal(Number(audit.nota_nova), 8);
  await teacher
    .send("post", "/ia/avaliacoes", {
      alunoId: 1,
      competenciaId: 1,
      nota: 10,
      confirm: false,
    })
    .expect(400);
});
test("legacy JSONB backup columns supported and dates survive serialization", async () => {
  process.env.NEON_API_KEY = "";
  process.env.NEON_PROJECT_ID = "";
  await f.query(
    "ALTER TABLE system_backups ADD COLUMN data JSONB NOT NULL DEFAULT '{}'::jsonb",
  );
  await f.query(
    "ALTER TABLE system_backups ADD COLUMN reason VARCHAR(100) NOT NULL DEFAULT 'migracao'",
  );
  await f.query(
    "ALTER TABLE system_backups ALTER COLUMN checksum SET NOT NULL",
  );
  const backup = require("../src/application/services/backupService");
  const record = await backup.createBackup("teste-isolado");
  const bytes = await backup.getBackupFile(record.filename);
  const decoded = JSON.parse(bytes.toString());
  assert.ok(
    decoded.tables.usuarios[0].data_criacao.match(/^\d{4}-\d{2}-\d{2}T/),
  );
  const db = (
    await f.query(
      "SELECT data,content FROM system_backups ORDER BY id DESC LIMIT 1",
    )
  ).rows[0];
  assert.deepEqual(db.data, db.content);
  assert.ok(!bytes.toString().includes("connectionString"));
});
test("public password-reset response does not reveal account existence", async () => {
  const h = request.agent(app),
    r = await h.get("/api/v1/auth/session");
  async function reset(email) {
    return h
      .post("/api/v1/auth/solicitacoes-senha")
      .set("Origin", origin)
      .set("X-CSRF-Token", r.body.csrfToken)
      .send({ email })
      .expect(202);
  }
  const a = await reset("prof@test.local"),
    b = await reset("absent@test.local");
  assert.equal(a.body.message, b.body.message);
});
test("logout destroys session and clears cookie", async () => {
  const r = await student.send("post", "/auth/logout", {}).expect(200);
  assert.ok(
    r.headers["set-cookie"].some((v) => v.includes("Expires=Thu, 01 Jan 1970")),
  );
  await student.http.get("/api/v1/conta").expect(401);
});
test("REST user update uses path identity and preserves last admin", async () => {
  await admin
    .send("patch", "/admin/usuarios/2", {
      id: 1,
      nome: "Prof Teste",
      email: "prof@test.local",
      cargo: "Coordenador",
      status: "ATIVO",
    })
    .expect(200);
  assert.equal(
    (await f.query("SELECT cargo FROM usuarios WHERE id=2")).rows[0].cargo,
    "Coordenador",
  );
  await admin
    .send("patch", "/admin/usuarios/1", {
      nome: "Admin Teste",
      email: "admin@test.local",
      cargo: "Professor",
      status: "ATIVO",
    })
    .expect(400);
  await assert.rejects(
    f.query("UPDATE usuarios SET cargo='Professor' WHERE id=1"),
    (error) => error.code === "23514",
  );
});
test("import transaction retains zeros, validates catalog and counts duplicates", async () => {
  const c = (await f.query("SELECT nome FROM competencias WHERE id=1")).rows[0]
    .nome;
  const row = {
    nome: "IMPORTADO SEGURO",
    ano_escolar: "1º MÉDIO",
    idade: 15,
    presenca: 0,
    competencias: [{ nome: c, nota: 0 }],
  };
  const result = await admin
    .send("post", "/alunos/importacoes/completas", { alunos: [row, row] })
    .expect(200);
  assert.equal(result.body.importados, 1);
  assert.equal(result.body.duplicados, 1);
  assert.equal(result.body.credenciais.length, 1);
  const a = (
    await f.query(
      "SELECT id,presenca,nota FROM alunos WHERE nome='IMPORTADO SEGURO'",
    )
  ).rows[0];
  assert.equal(a.presenca, 0);
  assert.equal(Number(a.nota), 0);
  await admin
    .send("post", "/alunos/importacoes/completas", {
      alunos: [
        {
          ...row,
          nome: "INEXISTENTE SEGURO",
          competencias: [{ nome: "Não existe", nota: 9 }],
        },
      ],
    })
    .expect(400);
  assert.equal(
    (await f.query("SELECT id FROM alunos WHERE nome='INEXISTENTE SEGURO'"))
      .rows.length,
    0,
  );
});

test("session store reports a missing table without an unhandled startup rejection", async () => {
  const db = require("../src/infrastructure/database");
  const Store = require("../src/infrastructure/sessionStore");
  const original = db.query,
    missing = Object.assign(new Error("Missing isolated table"), {
      code: "42P01",
    });
  let store;
  try {
    db.query = () => Promise.reject(missing);
    store = new Store();
    db.query = original;
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(
      new Promise((resolve, reject) =>
        store.get("isolated", (error, value) =>
          error ? reject(error) : resolve(value),
        ),
      ),
      (error) => error === missing,
    );
  } finally {
    db.query = original;
    if (store) clearInterval(store.cleanup);
  }
});
