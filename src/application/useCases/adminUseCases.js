const repository = require("../../infrastructure/repositories/adminUseCasesRepository.js");
const { criarNotificacao } = require("../services/notificationService");
const bcrypt = require("../../infrastructure/passwords");
const crypto = require("crypto");
const {
  text,
  email,
  password,
  integerId,
  ALLOWED_CARGOS,
  ALLOWED_STATUS,
} = require("../../domain/validation");
const checkupService = require("../services/checkupService");
const backupService = require("../services/backupService");
function checkupUnlocked(command) {
  const at = Number(command.session?.adminCheckupUnlockedAt || 0);
  return (
    command.session?.adminCheckupUnlocked === true &&
    Number.isFinite(at) &&
    Date.now() - at <= 10 * 60 * 1000
  );
}
exports.listarUsuarios = async (command, outcome) => {
  try {
    const result = await repository.query(repository.listarUsuariosSql1());
    const isAdmin = command.session.userCargo === "Admin";
    const userCargo = command.session.userCargo;
    const userId = command.session.userId;
    const user = command.session.user;
    outcome.data({
      usuarios: result.rows,
      isAdmin: isAdmin,
      userCargo: userCargo,
      userId: userId,
      user: user,
      success_msg: command.message("success_msg"),
      error_msg: command.message("error_msg"),
    });
  } catch (err) {
    console.error(err);
    command.message("error_msg", "Erro ao carregar usuários");
    outcome.complete("/dashboard");
  }
};
exports.adicionarUsuario = async (command, outcome) => {
  const nome = text(command.input.nome, 100, {
    min: 2,
  });
  const userEmail = email(command.input.email);
  const senha = password(command.input.senha);
  const cargo = ALLOWED_CARGOS.includes(command.input.cargo)
    ? command.input.cargo
    : null;
  if (!nome) {
    command.message("error_msg", "Nome inválido (mínimo 2 caracteres).");
    return outcome.complete("/dashboard/usuarios");
  }
  if (!userEmail) {
    command.message("error_msg", "E-mail inválido.");
    return outcome.complete("/dashboard/usuarios");
  }
  if (!senha) {
    command.message("error_msg", "Senha deve ter entre 12 e 128 caracteres.");
    return outcome.complete("/dashboard/usuarios");
  }
  if (!cargo) {
    command.message("error_msg", "Cargo inválido.");
    return outcome.complete("/dashboard/usuarios");
  }
  try {
    const senhaHash = await bcrypt.hash(senha, 12);
    await repository.query(repository.adicionarUsuarioSql1(), [
      nome,
      userEmail,
      senhaHash,
      cargo,
      "ATIVO",
    ]);
    command.message("success_msg", "Usuário cadastrado com sucesso!");
    outcome.complete("/dashboard/usuarios");
  } catch (err) {
    command.message("error_msg", "Erro ao cadastrar usuário");
    outcome.complete("/dashboard/usuarios");
  }
};
exports.atualizarUsuario = async (command, outcome) => {
  const id = integerId(command.ids.id);
  const nome = text(command.input.nome, 100, {
    min: 2,
  });
  const userEmail = email(command.input.email);
  const cargo = ALLOWED_CARGOS.includes(command.input.cargo)
    ? command.input.cargo
    : null;
  const status = ALLOWED_STATUS.includes(command.input.status)
    ? command.input.status
    : null;
  if (!id) {
    command.message("error_msg", "ID de usuário inválido.");
    return outcome.complete("/dashboard/usuarios");
  }
  if (!nome) {
    command.message("error_msg", "Nome inválido (mínimo 2 caracteres).");
    return outcome.complete("/dashboard/usuarios");
  }
  if (!userEmail) {
    command.message("error_msg", "E-mail inválido.");
    return outcome.complete("/dashboard/usuarios");
  }
  if (!cargo) {
    command.message("error_msg", "Cargo inválido.");
    return outcome.complete("/dashboard/usuarios");
  }
  if (!status) {
    command.message("error_msg", "Status inválido.");
    return outcome.complete("/dashboard/usuarios");
  }
  if (
    id === command.session.userId &&
    (status !== "ATIVO" || cargo !== "Admin")
  ) {
    command.message(
      "error_msg",
      "Você não pode desativar ou remover seu próprio acesso de administrador.",
    );
    return outcome.complete("/dashboard/usuarios");
  }
  try {
    const current = await repository.query(repository.atualizarUsuarioSql1(), [
      id,
    ]);
    if (current.rows.length === 0) {
      command.message("error_msg", "Usuário não encontrado.");
      return outcome.complete("/dashboard/usuarios");
    }
    const roleChanged =
      current.rows[0].cargo !== cargo || current.rows[0].status !== status;
    await repository.query(repository.atualizarUsuarioSql2(), [
      nome,
      userEmail,
      cargo,
      status,
      id,
    ]);
    if (roleChanged) {
      await repository.query(repository.atualizarUsuarioSql3(), [String(id)]);
    }
    command.message("success_msg", "Usuário atualizado com sucesso!");
    outcome.complete("/dashboard/usuarios");
  } catch (err) {
    command.message("error_msg", "Erro ao atualizar usuário");
    outcome.complete("/dashboard/usuarios");
  }
};
exports.deletarUsuario = async (command, outcome) => {
  const id = integerId(command.ids.id);
  if (!id || id === command.session.userId) {
    command.message("error_msg", "Usuário inválido ou ação não permitida.");
    return outcome.complete("/dashboard/usuarios");
  }
  const client = await repository.connect();
  let inTransaction = false;
  try {
    await client.query(repository.deletarUsuarioSql1());
    inTransaction = true;
    const target = await client.query(repository.deletarUsuarioSql2(), [id]);
    if (!target.rows.length) {
      await client.query(repository.deletarUsuarioSql3());
      inTransaction = false;
      command.message("error_msg", "Usuário não encontrado.");
      return outcome.complete("/dashboard/usuarios");
    }
    if (target.rows[0].cargo === "Admin" && target.rows[0].status === "ATIVO") {
      const admins = await client.query(repository.deletarUsuarioSql4());
      if (Number(admins.rows[0].count) <= 1) {
        await client.query(repository.deletarUsuarioSql5());
        inTransaction = false;
        command.message(
          "error_msg",
          "O último administrador ativo não pode ser removido.",
        );
        return outcome.complete("/dashboard/usuarios");
      }
    }
    await client.query(repository.deletarUsuarioSql6(), [String(id)]);
    await client.query(repository.deletarUsuarioSql7(), [id]);
    await client.query(repository.deletarUsuarioSql8());
    inTransaction = false;
    command.message("success_msg", "Usuário removido com sucesso!");
    return outcome.complete("/dashboard/usuarios");
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query(repository.deletarUsuarioSql9());
      } catch (_) {}
    }
    console.error("Erro ao excluir usuário:", err);
    command.message("error_msg", "Erro ao excluir usuário.");
    return outcome.complete("/dashboard/usuarios");
  } finally {
    client.release();
  }
};
exports.listarSolicitacoesSenha = async (command, outcome) => {
  try {
    const result = await repository.query(
      repository.listarSolicitacoesSenhaSql1(),
    );
    outcome.data({
      solicitacoes: result.rows,
      user: command.session.user,
      userCargo: command.session.userCargo,
      isAdmin: command.session.userCargo === "Admin",
    });
  } catch (err) {
    console.error("Erro ao carregar solicitações:", err);
    command.message("error_msg", "Erro ao carregar solicitações");
    outcome.complete("/dashboard");
  }
};
exports.aprovarSolicitacaoSenha = async (command, outcome) => {
  const novaSenha = password(command.input?.nova_senha);
  const solicitacaoId = integerId(command.ids.id);
  if (!solicitacaoId || !novaSenha) {
    command.message(
      "error_msg",
      "A nova senha deve ter entre 12 e 128 caracteres.",
    );
    return outcome.complete("/dashboard/solicitacoes-senha");
  }
  const client = await repository.connect();
  let inTransaction = false;
  try {
    await client.query(repository.aprovarSolicitacaoSenhaSql1());
    inTransaction = true;
    const solicitacao = await client.query(
      repository.aprovarSolicitacaoSenhaSql2(),
      [solicitacaoId, "PENDENTE"],
    );
    if (!solicitacao.rows.length) {
      await client.query(repository.aprovarSolicitacaoSenhaSql3());
      inTransaction = false;
      command.message(
        "error_msg",
        "Solicitação não encontrada ou já processada.",
      );
      return outcome.complete("/dashboard/solicitacoes-senha");
    }
    const request = solicitacao.rows[0];
    const userLock = await client.query(
      repository.aprovarSolicitacaoSenhaSql4(),
      [request.usuario_id],
    );
    if (!userLock.rows.length) {
      await client.query(repository.aprovarSolicitacaoSenhaSql5());
      inTransaction = false;
      command.message("error_msg", "Usuário não encontrado.");
      return outcome.complete("/dashboard/solicitacoes-senha");
    }
    const novaSenhaHash = await bcrypt.hash(novaSenha, 12);
    await client.query(repository.aprovarSolicitacaoSenhaSql6(), [
      novaSenhaHash,
      request.usuario_id,
    ]);
    await client.query(repository.aprovarSolicitacaoSenhaSql7(), [
      String(request.usuario_id),
    ]);
    await client.query(repository.aprovarSolicitacaoSenhaSql8(), [
      command.session.userId,
      solicitacaoId,
    ]);
    await client.query(repository.aprovarSolicitacaoSenhaSql9());
    inTransaction = false;
    try {
      await criarNotificacao(
        "senha_alterada",
        request.usuario_id,
        null,
        "Senha Redefinida",
        "Sua senha foi redefinida por um administrador",
        "/login",
        "fas fa-check-circle",
        "#217346",
      );
    } catch (notificationError) {
      console.error(
        "Erro ao criar notificação de senha redefinida:",
        notificationError.message,
      );
    }
    command.message("success_msg", "Senha redefinida com sucesso!");
    return outcome.complete("/dashboard/solicitacoes-senha");
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query(repository.aprovarSolicitacaoSenhaSql10());
      } catch (_) {}
    }
    console.error("Erro ao aprovar solicitação:", err);
    command.message("error_msg", "Erro ao aprovar solicitação.");
    return outcome.complete("/dashboard/solicitacoes-senha");
  } finally {
    client.release();
  }
};
exports.rejeitarSolicitacaoSenha = async (command, outcome) => {
  const { motivo } = command.input;
  const solicitacaoId = integerId(command.ids.id);
  const safeMotivo = text(command.input.motivo, 500) || null;
  if (!solicitacaoId) {
    command.message("error_msg", "Solicitação inválida.");
    return outcome.complete("/dashboard/solicitacoes-senha");
  }
  try {
    const solicitacao = await repository.query(
      repository.rejeitarSolicitacaoSenhaSql1(),
      [solicitacaoId, "PENDENTE"],
    );
    if (solicitacao.rows.length === 0) {
      command.message("error_msg", "Solicitação não encontrada");
      return outcome.complete("/dashboard/solicitacoes-senha");
    }
    const s = solicitacao.rows[0];
    await repository.query(repository.rejeitarSolicitacaoSenhaSql2(), [
      command.session.userId,
      solicitacaoId,
    ]);
    await criarNotificacao(
      "solicitacao_rejeitada",
      s.usuario_id,
      null,
      "Solicitação de Senha Rejeitada",
      safeMotivo || "Sua solicitação foi rejeitada. Contate o administrador.",
      `/login`,
      "fas fa-times-circle",
      "#ff0101",
    );
    command.message("success_msg", "Solicitação rejeitada");
    outcome.complete("/dashboard/solicitacoes-senha");
  } catch (err) {
    console.error("Erro ao rejeitar solicitação:", err);
    command.message("error_msg", "Erro ao rejeitar solicitação");
    outcome.complete("/dashboard/solicitacoes-senha");
  }
};
exports.verifyDeletePassword = async (command, outcome) => {
  try {
    const { password } = command.input;
    if (!password || typeof password !== "string") {
      return outcome.code(400).data({
        valid: false,
        message: "Senha não fornecida.",
      });
    }
    const expectedPassword =
      process.env.PASS_DELETE_HASH || process.env.PASS_DELETE;
    if (!expectedPassword) {
      console.error("PASS_DELETE não está configurado no .env");
      return outcome.code(500).data({
        valid: false,
        message: "Erro de configuração do servidor.",
      });
    }
    const hashProvided = crypto.createHash("sha256").update(password).digest();
    const hashExpected = crypto
      .createHash("sha256")
      .update(expectedPassword)
      .digest();
    const isMatch = expectedPassword.startsWith("$argon2")
      ? await bcrypt.compare(password, expectedPassword)
      : crypto.timingSafeEqual(hashProvided, hashExpected);
    if (isMatch) {
      command.session.adminCheckupUnlocked = true;
      command.session.adminCheckupUnlockedAt = Date.now();
      await new Promise((resolve, reject) =>
        command.session.save((err) => (err ? reject(err) : resolve())),
      );
      return outcome.data({
        valid: true,
      });
    } else {
      command.session.adminCheckupUnlocked = false;
      return outcome.code(401).data({
        valid: false,
        message: "Senha administrativa incorreta.",
      });
    }
  } catch (err) {
    console.error("Erro ao verificar senha administrativa:", err);
    return outcome.code(500).data({
      valid: false,
      message: "Erro interno ao verificar senha.",
    });
  }
};
exports.runCheckup = async (command, outcome) => {
  try {
    if (!checkupUnlocked(command)) {
      return outcome.code(403).data({
        error: "Acesso bloqueado. Confirme a senha administrativa primeiro.",
      });
    }
    const diagnostic = await checkupService.runSystemCheckup();
    const backupStatus = await backupService.getBackupStatus();
    outcome.data({
      ...diagnostic,
      backupStatus,
    });
  } catch (err) {
    console.error("Erro ao executar diagnóstico do sistema:", err);
    outcome.code(500).data({
      error: "Falha ao executar o diagnóstico das tabelas.",
    });
  }
};
exports.executeRepair = async (command, outcome) => {
  try {
    if (!checkupUnlocked(command)) {
      return outcome.code(403).data({
        error: "Acesso bloqueado. Confirme a senha administrativa primeiro.",
      });
    }
    const targetTable = command.input.table || "all";
    const result = await checkupService.repairSystem(targetTable);
    outcome.data(result);
  } catch (err) {
    console.error("Erro ao executar reparo no banco de dados:", err);
    if (err.code === "INVALID_TARGET_TABLE")
      return outcome.code(400).data({
        error: "Tabela de reparo inválida.",
      });
    outcome.code(500).data({
      error: "Falha ao executar o procedimento de correção.",
    });
  }
};
exports.getBackupInfo = async (command, outcome) => {
  try {
    if (!checkupUnlocked(command)) {
      return outcome.code(403).data({
        error: "Acesso não autorizado.",
      });
    }
    const info = await backupService.getBackupStatus();
    outcome.data(info);
  } catch (err) {
    console.error("Erro ao consultar backup:", err);
    outcome.code(500).data({
      error: "Erro ao consultar status de backup.",
    });
  }
};
exports.triggerBackup = async (command, outcome) => {
  try {
    if (!checkupUnlocked(command)) {
      return outcome.code(403).data({
        error: "Acesso não autorizado.",
      });
    }
    const backup = await backupService.createBackup("manual-admin");
    const status = await backupService.getBackupStatus();
    outcome.data({
      success: true,
      backup,
      status,
    });
  } catch (err) {
    console.error("Erro ao gerar backup sob demanda:", err);
    outcome.code(500).data({
      error: "Falha ao gerar o arquivo de backup.",
    });
  }
};
exports.downloadBackupFile = async (command, outcome) => {
  try {
    if (!checkupUnlocked(command)) {
      return outcome.code(403).data("Acesso negado.");
    }
    const filename = command.ids.filename;
    const content = await backupService.getBackupFile(filename);
    if (!content)
      return outcome.code(404).data("Arquivo de backup não encontrado.");
    outcome.header("Content-Type", "application/json; charset=utf-8");
    outcome.header("Content-Disposition", `attachment; filename="${filename}"`);
    outcome.header("Cache-Control", "private, no-store");
    return outcome.binary(content);
  } catch (err) {
    console.error("Erro no download do backup:", err);
    outcome.code(500).data("Erro ao baixar snapshot.");
  }
};
