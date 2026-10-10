require("dotenv").config();
const { Pool, types } = require("pg");
types.setTypeParser(1082, (value) => value);

if (!process.env.DB_URL) throw new Error("DB_URL deve ser configurado.");

const production = process.env.NODE_ENV === "production";
const allowInsecureTls = process.env.DB_SSL_REJECT_UNAUTHORIZED === "false";
if (production && process.env.DB_SSL_MODE === "disable")
  throw new Error("TLS do PostgreSQL não pode ser desativado em produção.");
if (production && allowInsecureTls)
  throw new Error(
    "DB_SSL_REJECT_UNAUTHORIZED=false não é permitido em produção.",
  );

let connectionString = process.env.DB_URL;
const databaseUrl = new URL(connectionString);
for (const key of [
  "sslmode",
  "uselibpqcompat",
  "sslcert",
  "sslkey",
  "sslrootcert",
])
  databaseUrl.searchParams.delete(key);
connectionString = databaseUrl.toString();

const pool = new Pool({
  connectionString,
  ssl:
    process.env.DB_SSL_MODE === "disable"
      ? false
      : { rejectUnauthorized: !allowInsecureTls },
  max: Number(process.env.DB_POOL_MAX) || 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  query_timeout: 15_000,
  application_name: "analisai",
});

pool.on("error", (err) =>
  console.error("Erro inesperado no pool PostgreSQL:", err.message),
);

module.exports = pool;
module.exports.ensureRuntimeSchema = async () => {
  await pool.query("SELECT 1 FROM system_backups LIMIT 0");
};
