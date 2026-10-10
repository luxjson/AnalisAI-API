const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const config = require("./config");
const db = require("../infrastructure/database");
const PostgresSessionStore = require("../infrastructure/sessionStore");
const {
  attachCsrfToken,
  csrfProtection,
  rateLimit,
} = require("./middlewares/security");
const { refreshIdentity, checkAnyAuth } = require("./middlewares/auth");
const fileStore = require("../infrastructure/fileStore");
function createApp({ store } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.production ? 1 : false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(
    cors({
      origin: config.origin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.get("/health", async (_req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "UP" });
    } catch {
      res.status(503).json({ status: "DOWN" });
    }
  });
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "200kb" }));
  app.use(
    session({
      store: store || new PostgresSessionStore(),
      name: config.cookieName,
      secret: config.secret,
      resave: false,
      saveUninitialized: false,
      cookie: config.cookie,
    }),
  );
  app.use(attachCsrfToken);
  app.use(
    "/api/v1",
    (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
    },
    require("./middlewares/audit"),
    require("./middlewares/inputLimits"),
    csrfProtection,
    rateLimit({ windowMs: 60000, max: 240, keyPrefix: "global" }),
    refreshIdentity,
  );
  app.get("/api/v1/auth/session", (req, res) =>
    res.json({
      identity: req.identity || null,
      csrfToken: req.session.csrfToken,
    }),
  );
  app.get("/api/v1", (_req, res) =>
    res.json({
      name: "AnalisAI",
      version: "2.0.0",
      documentation: "/api/v1/openapi.json",
    }),
  );
  app.get("/api/v1/openapi.json", (_req, res) =>
    res.json(require("../../docs/openapi.json")),
  );
  app.get(
    "/api/v1/arquivos/:filename",
    checkAnyAuth,
    async (req, res, next) => {
      try {
        const filename = req.params.filename;
        if (filename.length > 255 || !/^[a-zA-Z0-9._-]+$/.test(filename))
          return res.status(400).json({ error: "Arquivo inválido." });
        const access = await db.query(
          `
  SELECT ta.aluno_id, t.criado_por
  FROM tarefas_alunos ta
  JOIN tarefas t ON t.id = ta.tarefa_id
  WHERE ta.resposta_arquivo = $1
`,
          [filename],
        );
        const permitted = access.rows.some(
          (r) =>
            req.session.aluno?.id === r.aluno_id ||
            (req.session.userId &&
              (req.session.userId === r.criado_por ||
                req.session.userCargo === "Admin")),
        );
        if (!permitted)
          return res.status(404).json({ error: "Arquivo não encontrado." });
        const file = await fileStore.get(filename);
        if (!file)
          return res.status(404).json({ error: "Arquivo não encontrado." });
        res.set("Cache-Control", "private, no-store");
        res.set("Content-Type", "application/octet-stream");
        res.attachment(file.original_name.replace(/[\r\n]/g, ""));
        res.send(file.content);
      } catch (err) {
        next(err);
      }
    },
  );
  app.use(
    "/api/v1",
    (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
    },
    require("./routes"),
  );
  app.use((_req, res) =>
    res.status(404).json({ error: "Recurso não encontrado." }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status =
      err.type === "entity.too.large" || err.code === "LIMIT_FILE_SIZE"
        ? 413
        : err.type === "entity.parse.failed" ||
            err.name === "MulterError" ||
            ["23514", "22P02"].includes(err.code)
          ? 400
          : err.code === "23505"
            ? 409
            : 500;
    if (status === 500) console.error("Falha interna:", err.code || err.name);
    res.status(status).json({
      error:
        status === 413
          ? "Limite permitido excedido."
          : status === 409
            ? "Registro já existente."
            : status === 400
              ? "Dados inválidos."
              : "Serviço temporariamente indisponível.",
    });
  });
  return app;
}
module.exports = { createApp };
