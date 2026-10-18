const db = require("../../infrastructure/database");
async function refreshIdentity(req, res, next) {
  try {
    if (req.session.userId) {
      const r = await db.query(
        "SELECT id,nome,cargo,status,email,onboarding_concluido FROM usuarios WHERE id=$1",
        [req.session.userId],
      );
      const u = r.rows[0];
      if (!u || u.status !== "ATIVO") {
        return req.session.destroy(() =>
          res.status(401).json({ error: "Sessão encerrada." }),
        );
      }
      req.session.user = u.nome;
      req.session.userCargo = u.cargo;
      req.session.userStatus = u.status;
      req.identity = {
        kind: "professor",
        id: u.id,
        nome: u.nome,
        email: u.email,
        cargo: u.cargo,
        onboardingConcluido: u.onboarding_concluido === true,
      };
    } else if (req.session.aluno) {
      const r = await db.query(
        `
  SELECT a.id, a.nome, a.ano_escolar, al.id login_id, al.matricula,
  al.status
  FROM alunos a
  JOIN alunos_login al ON al.aluno_id = a.id
  WHERE a.id = $1
`,
        [req.session.aluno.id],
      );
      const u = r.rows[0];
      if (!u || u.status !== "ATIVO") {
        return req.session.destroy(() =>
          res.status(401).json({ error: "Sessão encerrada." }),
        );
      }
      req.session.aluno = {
        id: u.id,
        nome: u.nome,
        ano_escolar: u.ano_escolar,
        matricula: u.matricula,
        login_id: u.login_id,
      };
      req.identity = { kind: "aluno", ...req.session.aluno };
    }
    next();
  } catch (err) {
    next(err);
  }
}
function checkAuth(req, res, next) {
  return req.session.userId
    ? next()
    : res.status(401).json({ error: "Acesso de professor necessário." });
}
function checkAlunoAuth(req, res, next) {
  return req.session.aluno
    ? next()
    : res.status(401).json({ error: "Acesso de aluno necessário." });
}
function checkAnyAuth(req, res, next) {
  return req.session.userId || req.session.aluno
    ? next()
    : res.status(401).json({ error: "Autenticação necessária." });
}
function checkAdmin(req, res, next) {
  return req.session.userCargo === "Admin"
    ? next()
    : res.status(403).json({ error: "Acesso administrativo necessário." });
}
function checkTeacherOrAdmin(req, res, next) {
  return ["Professor", "Admin"].includes(req.session.userCargo)
    ? next()
    : res.status(403).json({ error: "Esta operação é exclusiva de professores e administradores." });
}
module.exports = {
  refreshIdentity,
  checkAuth,
  checkAlunoAuth,
  checkAnyAuth,
  checkAdmin,
  checkTeacherOrAdmin,
};
