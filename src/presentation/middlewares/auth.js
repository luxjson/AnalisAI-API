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
  if (!req.session.userId)
    return res.status(401).json({ error: "Acesso de professor necessário." });
  return ["Professor", "Admin"].includes(req.session.userCargo)
    ? next()
    : res.status(403).json({ error: "Esta operação é exclusiva de professores e administradores." });
}
async function checkAssignedClass(req, res, next) {
  if (!req.session.userId)
    return res.status(401).json({ error: "Acesso de professor necessário." });
  if (req.session.userCargo === "Admin") return next();
  if (req.session.userCargo !== "Professor")
    return res.status(403).json({ error: "Acesso exclusivo do professor responsável." });

  try {
    const classes = new Set();
    const input = req.body || {};
    const directClass = input.turma || input.ano_escolar || req.query?.turma;
    if (typeof directClass === "string" && directClass.trim())
      classes.add(directClass.trim());

    for (const student of Array.isArray(input.alunos) ? input.alunos : []) {
      if (typeof student?.ano_escolar === "string" && student.ano_escolar.trim())
        classes.add(student.ano_escolar.trim());
      else if (typeof student?.turma === "string" && student.turma.trim())
        classes.add(student.turma.trim());
    }

    const studentId = Number(input.aluno_id || input.alunoId);
    if (Number.isSafeInteger(studentId) && studentId > 0) {
      const student = await db.query(
        "SELECT ano_escolar FROM alunos WHERE id = $1 LIMIT 1",
        [studentId],
      );
      if (!student.rows.length)
        return res.status(404).json({ error: "Aluno não encontrado." });
      classes.add(student.rows[0].ano_escolar);
    }

    const taskId = Number(input.tarefa_id);
    if (Number.isSafeInteger(taskId) && taskId > 0) {
      const task = await db.query(
        "SELECT turma FROM tarefas WHERE id = $1 LIMIT 1",
        [taskId],
      );
      if (!task.rows.length)
        return res.status(404).json({ error: "Tarefa não encontrada." });
      classes.add(task.rows[0].turma);
    }

    const routeId = Number(req.params?.id);
    if (Number.isSafeInteger(routeId) && routeId > 0) {
      if (req.path.startsWith("/avaliacoes/")) {
        const assessment = await db.query(
          `SELECT a.ano_escolar
           FROM aluno_competencias ac
           JOIN alunos a ON a.id = ac.aluno_id
           WHERE ac.id = $1 LIMIT 1`,
          [routeId],
        );
        if (!assessment.rows.length)
          return res.status(404).json({ error: "Avaliação não encontrada." });
        classes.add(assessment.rows[0].ano_escolar);
      } else if (req.path.startsWith("/tarefas/")) {
        const task = await db.query(
          "SELECT turma FROM tarefas WHERE id = $1 LIMIT 1",
          [routeId],
        );
        if (!task.rows.length)
          return res.status(404).json({ error: "Tarefa não encontrada." });
        classes.add(task.rows[0].turma);
      } else if (req.path.startsWith("/alunos/") || req.path.startsWith("/ia/alunos/")) {
        const student = await db.query(
          "SELECT ano_escolar FROM alunos WHERE id = $1 LIMIT 1",
          [routeId],
        );
        if (!student.rows.length)
          return res.status(404).json({ error: "Aluno não encontrado." });
        classes.add(student.rows[0].ano_escolar);
      }
    }

    if (!classes.size || [...classes].some((value) => typeof value !== "string" || !value.trim()))
      return res.status(403).json({ error: "Não foi possível identificar a turma sob sua responsabilidade." });

    const assigned = await db.query(
      "SELECT turma FROM professor_turmas WHERE professor_id = $1 AND turma = ANY($2::text[])",
      [req.session.userId, [...classes]],
    );
    const assignedSet = new Set(assigned.rows.map((row) => row.turma));
    if ([...classes].some((turma) => !assignedSet.has(turma)))
      return res.status(403).json({ error: "A operação contém alunos ou turmas fora da sua responsabilidade." });

    req.assignedClasses = [...classes];
    return next();
  } catch (error) {
    return next(error);
  }
}
module.exports = {
  refreshIdentity,
  checkAuth,
  checkAlunoAuth,
  checkAnyAuth,
  checkAdmin,
  checkTeacherOrAdmin,
  checkAssignedClass,
};
