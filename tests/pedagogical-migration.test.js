"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("pedagogical migration applies to an existing schema and enforces attendance constraints", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();

  try {
    await db.exec(`
      CREATE TABLE usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        cargo VARCHAR(50) DEFAULT 'Professor',
        status VARCHAR(20) DEFAULT 'ATIVO'
      );
      CREATE TABLE alunos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        ano_escolar VARCHAR(50) NOT NULL,
        idade INTEGER NOT NULL
      );
      INSERT INTO usuarios (nome, email, senha, cargo)
      VALUES
        ('Admin', 'admin@example.test', 'hash', 'Admin'),
        ('Professor', 'professor@example.test', 'hash', 'Professor');
      INSERT INTO alunos (nome, ano_escolar, idade)
      VALUES ('Aluno', '1º MÉDIO', 15);
    `);

    const migration = fs.readFileSync(
      path.join(__dirname, "..", "migrations", "006_pedagogical_workflows.sql"),
      "utf8",
    );
    await db.exec(migration);

    const users = await db.query(
      "SELECT cargo, onboarding_concluido FROM usuarios ORDER BY id",
    );
    assert.deepEqual(
      users.rows.map((user) => [user.cargo, user.onboarding_concluido]),
      [
        ["Admin", true],
        ["Professor", false],
      ],
    );

    await db.query(
      "INSERT INTO professor_turmas (professor_id, turma) VALUES ($1, $2)",
      [2, "1º MÉDIO"],
    );
    await db.query(
      `INSERT INTO frequencia_registros
        (aluno_id, turma, data_aula, horario_inicio, horario_fim, status, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [1, "1º MÉDIO", "2026-10-16", "08:00", "08:50", "PRESENTE", 2],
    );
    await db.query(
      `INSERT INTO solicitacoes_relatorio
        (solicitante_id, professor_id, aluno_id, mensagem)
       VALUES ($1, $2, $3, $4)`,
      [1, 2, 1, "Relatório individual de teste"],
    );

    await assert.rejects(() =>
      db.query(
        `INSERT INTO frequencia_registros
          (aluno_id, turma, data_aula, horario_inicio, horario_fim, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [1, "1º MÉDIO", "2026-10-16", "09:00", "08:50", "PRESENTE"],
      ),
    );
    await assert.rejects(() =>
      db.query(
        `INSERT INTO frequencia_registros
          (aluno_id, turma, data_aula, horario_inicio, horario_fim, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [1, "1º MÉDIO", "2026-10-16", "09:00", "09:50", "SEM_REGISTRO"],
      ),
    );
    await assert.rejects(() =>
      db.query(
        `INSERT INTO solicitacoes_relatorio
          (solicitante_id, professor_id, mensagem)
         VALUES ($1, $2, $3)`,
        [1, 2, "Solicitação sem aluno nem turma"],
      ),
    );
  } finally {
    await db.close();
  }
});
