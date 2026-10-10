const readline = require("node:readline/promises");
const { Writable } = require("node:stream");
const database = require("../src/infrastructure/database");
const passwords = require("../src/infrastructure/passwords");
const { text, email, password } = require("../src/domain/validation");
async function main() {
  if (!process.stdin.isTTY)
    throw new Error(
      "Execute em um terminal interativo para não expor a senha em argumentos ou histórico.",
    );
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const reader = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  let nome, address, secret;
  try {
    nome = text(await reader.question("Nome do administrador: "), 100, {
      min: 2,
    });
    address = email(await reader.question("E-mail: "));
    process.stdout.write("Senha (12–128 caracteres; entrada oculta): ");
    muted = true;
    secret = password(await reader.question(""));
    muted = false;
    process.stdout.write("\n");
  } finally {
    muted = false;
    reader.close();
  }
  if (!nome || !address || !secret)
    throw new Error("Nome, e-mail ou senha inválidos.");
  const hash = await passwords.hash(secret);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('analisai-admin-membership'))",
    );
    const admins = await client.query(
      "SELECT 1 FROM usuarios WHERE cargo='Admin' AND status='ATIVO' LIMIT 1",
    );
    if (admins.rows.length)
      throw new Error(
        "Já existe administrador ativo. Use o painel existente para cadastrar usuários.",
      );
    await client.query(
      "INSERT INTO usuarios(nome,email,senha,cargo,status) VALUES($1,$2,$3,'Admin','ATIVO')",
      [nome, address, hash],
    );
    await client.query("COMMIT");
    console.log("Administrador criado.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
main()
  .catch((error) => {
    console.error(
      error.code === "23505" ? "Este e-mail já existe." : error.message,
    );
    process.exitCode = 1;
  })
  .finally(() => database.end());
