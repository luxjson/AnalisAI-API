require("dotenv").config();
const fs = require("fs"),
  path = require("path");
const { Pool } = require("pg");
async function migrate() {
  const address = process.env.DB_URL_UNPOOLED || process.env.DB_URL;
  if (!address) throw new Error("DB_URL_UNPOOLED necessário.");
  const u = new URL(address);
  if (u.hostname.includes("-pooler"))
    throw new Error(
      "Migrações exigem DB_URL_UNPOOLED com conexão direta (sem -pooler).",
    );
  if (process.env.DB_SSL_MODE !== "disable") {
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
  }
  const pool = new Pool({
    connectionString: u.toString(),
    max: 1,
    ssl:
      process.env.DB_SSL_MODE === "disable"
        ? false
        : { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('analisai-migrations-v2'))",
    );
    await client.query(
      `
  CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)
`,
    );
    for (const name of fs
      .readdirSync(path.join(__dirname, "../migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const found = await client.query(
        "SELECT 1 FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (found.rows.length) continue;
      await client.query(
        fs.readFileSync(path.join(__dirname, "../migrations", name), "utf8"),
      );
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        name,
      ]);
      console.log("Migração aplicada:", name);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client?.release();
    await pool.end();
  }
}
migrate().catch((err) => {
  console.error("Migração falhou:", err.message);
  process.exitCode = 1;
});
