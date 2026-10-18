const repository = require("../../infrastructure/repositories/alunoUseCasesRepository.js");
const { criarNotificacao } = require("../services/notificationService");
const passwords = require("../../infrastructure/passwords");
const { text, integerId, password } = require("../../domain/validation");
exports.dashboard = async (command, outcome) => {
  try {
    const alunoId = command.session.aluno.id;
    const alunoResult = await repository.query(repository.dashboardSql1(), [
      alunoId,
    ]);
    if (alunoResult.rows.length === 0) {
      command.message("error_msg", "Aluno não encontrado");
      return outcome.complete("/logout");
    }
    const alunoRow = alunoResult.rows[0];
    const aluno = { ...alunoRow, presenca: alunoRow.presenca_calculada == null ? null : Number(alunoRow.presenca_calculada) };
    const competenciasResult = await repository.query(
      repository.dashboardSql2(),
      [alunoId],
    );
    const competencias = competenciasResult.rows;
    let mediaGeral = 0;
    if (competencias.length > 0) {
      const soma = competencias.reduce(
        (acc, comp) => acc + parseFloat(comp.nota),
        0,
      );
      mediaGeral = soma / competencias.length;
    }
    const categoriasMap = new Map();
    competencias.forEach((comp) => {
      if (!categoriasMap.has(comp.categoria)) {
        categoriasMap.set(comp.categoria, {
          categoria: comp.categoria,
          soma: 0,
          count: 0,
          media: 0,
        });
      }
      const cat = categoriasMap.get(comp.categoria);
      cat.soma += parseFloat(comp.nota);
      cat.count++;
      cat.media = (cat.soma / cat.count) * 10;
    });
    const categorias = Array.from(categoriasMap.values());
    await repository.query(repository.dashboardSql3(), [alunoId]);
    outcome.data({
      aluno,
      competencias,
      mediaGeral,
      categorias,
      success_msg: command.message("success_msg"),
      error_msg: command.message("error_msg"),
    });
  } catch (err) {
    console.error("Erro no dashboard do aluno:", err);
    command.message("error_msg", "Erro ao carregar dashboard");
    outcome.complete("/logout");
  }
};
exports.competencias = async (command, outcome) => {
  try {
    const alunoId = command.session.aluno.id;
    const alunoResult = await repository.query(repository.competenciasSql1(), [
      alunoId,
    ]);
    const alunoRow = alunoResult.rows[0];
    const aluno = { ...alunoRow, presenca: alunoRow.presenca_calculada == null ? null : Number(alunoRow.presenca_calculada) };
    const competenciasResult = await repository.query(
      repository.competenciasSql2(),
      [alunoId],
    );
    const stats = await repository.query(repository.competenciasSql3(), [
      alunoId,
    ]);
    outcome.data({
      aluno,
      competencias: competenciasResult.rows,
      stats: stats.rows[0],
      success_msg: command.message("success_msg"),
      error_msg: command.message("error_msg"),
    });
  } catch (err) {
    console.error("Erro ao carregar competências do aluno:", err);
    command.message("error_msg", "Erro ao carregar competências");
    outcome.complete("/aluno");
  }
};
exports.evolucao = async (command, outcome) => {
  try {
    const alunoId = command.session.aluno.id;
    const alunoResult = await repository.query(repository.evolucaoSql1(), [
      alunoId,
    ]);
    const aluno = alunoResult.rows[0];
    const competenciasResult = await repository.query(
      repository.evolucaoSql2(),
      [alunoId],
    );
    const competencias = competenciasResult.rows;
    const historicoResult = await repository.query(repository.evolucaoSql3(), [
      alunoId,
    ]);
    const historico = historicoResult.rows;
    const categoriasMap = new Map();
    competencias.forEach((comp) => {
      if (!categoriasMap.has(comp.categoria)) {
        categoriasMap.set(comp.categoria, {
          categoria: comp.categoria,
          soma: 0,
          count: 0,
          media: 0,
        });
      }
      const cat = categoriasMap.get(comp.categoria);
      cat.soma += parseFloat(comp.nota);
      cat.count++;
      cat.media = (cat.soma / cat.count) * 10;
    });
    const categorias = Array.from(categoriasMap.values());
    outcome.data({
      aluno,
      competencias,
      historico,
      categorias,
      success_msg: command.message("success_msg"),
      error_msg: command.message("error_msg"),
    });
  } catch (err) {
    console.error("Erro ao carregar evolução:", err);
    command.message("error_msg", "Erro ao carregar evolução");
    outcome.complete("/aluno");
  }
};
exports.alterarSenha = async (command, outcome) => {
  const senha_atual =
    typeof command.input.senha_atual === "string"
      ? command.input.senha_atual
      : "";
  const nova_senha = password(command.input.nova_senha);
  const confirmar_senha =
    typeof command.input.confirmar_senha === "string"
      ? command.input.confirmar_senha
      : "";
  const alunoId = command.session.aluno.id;
  const voltar = () => outcome.complete("/aluno?settings=account");
  try {
    const result = await repository.query(repository.alterarSenhaSql1(), [
      alunoId,
    ]);
    if (result.rows.length === 0) {
      command.message("error_msg", "Aluno não encontrado");
      return voltar();
    }
    const senhaAtualValida = await passwords.compare(
      senha_atual,
      result.rows[0].senha,
    );
    if (!senhaAtualValida) {
      command.message("error_msg", "Senha atual incorreta");
      return voltar();
    }
    if (!nova_senha) {
      command.message(
        "error_msg",
        "A nova senha deve ter entre 12 e 128 caracteres",
      );
      return voltar();
    }
    if (nova_senha !== confirmar_senha) {
      command.message("error_msg", "As senhas não coincidem");
      return voltar();
    }
    const novaSenhaHash = await passwords.hash(nova_senha);
    await repository.query(repository.alterarSenhaSql2(), [
      novaSenhaHash,
      alunoId,
    ]);
    {
      await repository.query(repository.alterarSenhaSql3(), [String(alunoId)]);
    }
    const oldSessionData = {
      ...command.session.aluno,
    };
    await new Promise((resolve, reject) =>
      command.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    command.session.aluno = oldSessionData;
    command.session.csrfToken = require("crypto")
      .randomBytes(32)
      .toString("hex");
    await new Promise((resolve, reject) =>
      command.session.save((err) => (err ? reject(err) : resolve())),
    );
    command.message("success_msg", "Senha alterada com sucesso!");
    return voltar();
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    command.message("error_msg", "Erro ao alterar senha");
    return voltar();
  }
};
exports.tarefas = async (command, outcome) => {
  try {
    const alunoId = command.session.aluno.id;
    await repository.query(repository.tarefasSql1(), [alunoId]);
    const tarefasResult = await repository.query(repository.tarefasSql2(), [
      alunoId,
    ]);
    const statsResult = await repository.query(repository.tarefasSql3(), [
      alunoId,
    ]);
    outcome.data({
      aluno: command.session.aluno,
      tarefas: tarefasResult.rows,
      stats: statsResult.rows[0] || {
        total: 0,
        pendentes: 0,
        aguardando: 0,
        concluidas: 0,
        devolvidas: 0,
        atrasadas: 0,
      },
      success_msg: command.message("success_msg"),
      error_msg: command.message("error_msg"),
    });
  } catch (err) {
    console.error("Erro ao carregar tarefas do aluno:", err);
    command.message("error_msg", "Erro ao carregar tarefas");
    outcome.complete("/aluno");
  }
};
exports.enviarTarefa = async (command, outcome) => {
  const tarefaAlunoId = integerId(command.ids.id),
    alunoId = command.session.aluno.id;
  const resposta = text(command.input.resposta_texto, 10000) || null,
    arquivo = command.attachment;
  if (command.input.resposta_texto && !resposta)
    return outcome.code(400).data({
      error: "Resposta inválida ou maior que 10000 caracteres.",
    });
  if (!tarefaAlunoId || (!resposta && !arquivo))
    return outcome.code(400).data({
      error: "Envie uma resposta em texto ou um arquivo.",
    });
  const { storageKey, validateFile } = require("../../domain/fileValidation");
  if (arquivo && !validateFile(arquivo))
    return outcome.code(400).data({
      error: "O conteúdo do arquivo não corresponde ao formato informado.",
    });
  const client = await repository.connect();
  try {
    await client.query(repository.enviarTarefaSql1());
    const current = await client.query(repository.enviarTarefaSql2(), [
      tarefaAlunoId,
      alunoId,
    ]);
    const row = current.rows[0];
    if (!row) {
      await client.query(repository.enviarTarefaSql3());
      return outcome.code(409).data({
        error: "Esta tarefa já foi entregue, encerrada ou alterada.",
      });
    }
    const key = arquivo ? storageKey(arquivo) : row.resposta_arquivo;
    if (arquivo)
      await client.query(repository.enviarTarefaSql4(), [
        key,
        arquivo.originalname.slice(0, 255),
        arquivo.mimetype,
        arquivo.buffer.length,
        arquivo.buffer,
      ]);
    await client.query(repository.enviarTarefaSql5(), [
      resposta,
      key,
      tarefaAlunoId,
      alunoId,
    ]);
    if (arquivo && row.resposta_arquivo && row.resposta_arquivo !== key)
      await client.query(repository.enviarTarefaSql6(), [row.resposta_arquivo]);
    await client.query(repository.enviarTarefaSql7());
    if (row.criado_por)
      await criarNotificacao(
        "entrega",
        row.criado_por,
        null,
        "Tarefa Entregue",
        `${command.session.aluno.nome} entregou a tarefa: ${row.titulo}`,
        "/dashboard/tarefas",
        "fas fa-check-circle",
        "#ff0101",
      );
    return outcome.data({
      success: true,
      message: "Tarefa enviada com sucesso!",
      next: "/aluno/tarefas",
    });
  } catch (err) {
    await client.query(repository.enviarTarefaSql8());
    throw err;
  } finally {
    client.release();
  }
};
exports.apiDadosGrafico = async (command, outcome) => {
  try {
    const alunoId = command.session.aluno.id;
    const result = await repository.query(repository.apiDadosGraficoSql1(), [
      alunoId,
    ]);
    outcome.data(result.rows);
  } catch (err) {
    console.error("Erro ao buscar dados do gráfico:", err);
    outcome.code(500).data({
      error: "Erro ao carregar dados",
    });
  }
};
exports.apiRankingComparativo = async (command, outcome) => {
  try {
    const alunoId = command.session.aluno.id;
    const aluno = command.session.aluno;
    const alunoMedia = await repository.query(
      repository.apiRankingComparativoSql1(),
      [alunoId],
    );
    const turmaMedia = await repository.query(
      repository.apiRankingComparativoSql2(),
      [aluno.ano_escolar],
    );
    const geralMedia = await repository.query(
      repository.apiRankingComparativoSql3(),
    );
    outcome.data({
      aluno: parseFloat(alunoMedia.rows[0].media).toFixed(1),
      turma: parseFloat(turmaMedia.rows[0].media).toFixed(1),
      geral: parseFloat(geralMedia.rows[0].media).toFixed(1),
    });
  } catch (err) {
    console.error("Erro ao buscar ranking comparativo:", err);
    outcome.code(500).data({
      error: "Erro ao carregar dados",
    });
  }
};
