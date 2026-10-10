process.env.NODE_ENV = "test";
process.env.DB_URL = "postgres://test:test@localhost/test";
process.env.DB_SSL_MODE = "disable";
process.env.APP_ORIGIN = "http://localhost:5173";
process.env.SESSION_SECRET = "isolated-test-secret-at-least-32-characters";
const { PGlite } = require("@electric-sql/pglite");
const fs = require("node:fs");
const path = require("node:path");
const db = require("../src/infrastructure/database");
const passwords = require("../src/infrastructure/passwords");
async function setup() {
  const sql = new PGlite();
  await sql.waitReady;
  for (const file of fs
    .readdirSync(path.join(__dirname, "../migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await sql.exec(
      fs.readFileSync(path.join(__dirname, "../migrations", file), "utf8"),
    );
  const query = async (text, values) => {
    const result = await sql.query(text, values);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  db.query = query;
  db.connect = async () => ({ query, release() {} });
  const hash = await passwords.hash("TesteSeguro123!");
  await query(
    `
  INSERT INTO usuarios(nome, email, senha, cargo, status)
  VALUES ('Admin Teste', 'admin@test.local', $1, 'Admin', 'ATIVO'),
  ('Prof Teste', 'prof@test.local', $1, 'Professor', 'ATIVO'),
  ('Outro Teste', 'outro@test.local', $1, 'Professor', 'ATIVO')
`,
    [hash],
  );
  await query(
    `
  INSERT INTO alunos(nome, ano_escolar, idade, presenca)
  VALUES ('ALUNO TESTE', '1º MÉDIO', 15, 100),('OUTRO ALUNO',
    '1º MÉDIO', 16, 75)
`,
  );
  await query(
    `
  INSERT INTO alunos_login(nome, email, senha, matricula, aluno_id)
  VALUES ('ALUNO TESTE', 'aluno@test.local', $1, 'TESTE1',
    1),('OUTRO ALUNO', 'aluno2@test.local', $1, 'TESTE2', 2)
`,
    [hash],
  );
  return {
    sql,
    query,
    close: async () => {
      await sql.close();
      await db.end();
    },
  };
}
module.exports = { setup };
