const { createApp } = require("./presentation/app");
const db = require("./infrastructure/database");
const config = require("./presentation/config");
async function start() {
  await db.query("SELECT 1");

  await db.query("SELECT 1 FROM security_rate_limits LIMIT 0");
  await db.query("SELECT 1 FROM web_sessions LIMIT 0");
  const server = createApp().listen(config.port, "0.0.0.0", () =>
    console.log(`AnalisAI API disponível na porta ${config.port}`),
  );
  server.requestTimeout = 60000;
  server.headersTimeout = 65000;
  if (process.env.BACKUP_ENABLED === "true")
    require("./application/services/backupService").init();
  const cleanup = setInterval(
    () =>
      db
        .query(
          `
  DELETE
  FROM security_rate_limits
  WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '2 days'
`,
        )
        .catch(() => {}),
    3600000,
  ).unref();
  const stop = () => {
    clearInterval(cleanup);
    server.close(async () => {
      await db.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
start().catch((err) => {
  console.error("Falha na inicialização:", err.code || err.name);
  process.exit(1);
});
