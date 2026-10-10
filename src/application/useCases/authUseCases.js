const repository = require("../../infrastructure/repositories/authUseCasesRepository.js");
const passwords = require("../../infrastructure/passwords");
const crypto = require("crypto");
const { email } = require("../../domain/validation");
const { criarNotificacao } = require("../services/notificationService");
const sessionCall = (session, method) =>
  new Promise((resolve, reject) =>
    session[method]((err) => (err ? reject(err) : resolve())),
  );
async function login(context, result, kind) {
  const isStudent = kind === "aluno";
  const input = context.input;
  const matricula =
    typeof input.matricula === "string"
      ? input.matricula.trim().toUpperCase()
      : "";
  const address = email(isStudent ? input.email : input.usuario);
  const secret = typeof input.senha === "string" ? input.senha : "";
  if ((!address && !(isStudent && matricula)) || !secret || secret.length > 128)
    return result.code(401).data({
      error: "Credenciais inválidas.",
    });
  const rows = isStudent
    ? await repository.query(
        repository.loginSql1(matricula ? "matricula" : "email"),
        [matricula || address],
      )
    : await repository.query(repository.loginSql2(), [address]);
  const user = rows.rows[0];
  if (!user) {
    await passwords.dummyVerify(secret);
    return result.code(401).data({
      error: "Credenciais inválidas.",
    });
  }
  const valid = await passwords.compare(secret, user.senha);
  if (!valid || user.status !== "ATIVO")
    return result.code(401).data({
      error: "Credenciais inválidas.",
    });
  let student;
  if (isStudent) {
    student = (await repository.query(repository.loginSql3(), [user.aluno_id]))
      .rows[0];
    if (!student)
      return result.code(401).data({
        error: "Credenciais inválidas.",
      });
  }
  const table = isStudent ? "alunos_login" : "usuarios";
  if (passwords.needsUpgrade(user.senha))
    await repository.query(repository.loginSql4(table), [
      await passwords.hash(secret),
      user.id,
      user.senha,
    ]);
  await sessionCall(context.session, "regenerate");
  if (isStudent)
    context.session.aluno = {
      ...student,
      login_id: user.id,
      matricula: user.matricula,
    };
  else
    Object.assign(context.session, {
      user: user.nome,
      userId: user.id,
      userCargo: user.cargo,
      userStatus: user.status,
    });
  context.session.csrfToken = crypto.randomBytes(32).toString("hex");
  await repository.query(repository.loginSql5(table), [user.id]);
  await sessionCall(context.session, "save");
  return result.data({
    success: true,
    next: isStudent ? "/aluno" : "/dashboard",
    csrfToken: context.session.csrfToken,
  });
}
exports.loginProfessor = (c, r) => login(c, r, "professor");
exports.loginAluno = (c, r) => login(c, r, "aluno");
exports.logout = async (c, r) => {
  await sessionCall(c.session, "destroy");
  return r.data({
    success: true,
    next: "/",
  });
};
exports.solicitarRedefinicaoSenha = async (context, result) => {
  const address = email(context.input.email);
  if (!address)
    return result.code(400).data({
      error: "Informe um e-mail válido.",
    });
  const user = (
    await repository.query(repository.solicitarRedefinicaoSenhaSql1(), [
      address,
    ])
  ).rows[0];
  if (user) {
    await repository.query(repository.solicitarRedefinicaoSenhaSql2(), [
      user.id,
      address,
      crypto.randomBytes(32).toString("hex"),
    ]);
    const admins = await repository.query(
      repository.solicitarRedefinicaoSenhaSql3(),
    );
    for (const admin of admins.rows)
      await criarNotificacao(
        "solicitacao_senha",
        admin.id,
        null,
        "Solicitação de Redefinição de Senha",
        `${user.nome} solicitou redefinição de senha`,
        "/dashboard/solicitacoes-senha",
        "fas fa-key",
        "#ff0101",
      );
  }
  return result.code(202).data({
    success: true,
    message:
      "Se o e-mail estiver cadastrado, a solicitação será analisada por um administrador.",
    next: "/esqueci-senha",
  });
};
