const repository = require("../../infrastructure/repositories/tarefaUseCasesRepository.js");
const { criarNotificacao } = require("../services/notificationService");
const {
  text,
  integerId,
  numberInRange,
  dateOnly,
  ALLOWED_PRIORITY,
  ALLOWED_TASK_STATUS,
  ALLOWED_YEARS,
} = require("../../domain/validation");
exports.listar = async (command, outcome) => {
  try {
    const turmaFilter = ALLOWED_YEARS.includes(command.filters.turma)
      ? command.filters.turma
      : "";
    const statusFilter = ALLOWED_TASK_STATUS.includes(command.filters.status)
      ? command.filters.status
      : "";
    const scoped = command.session.userCargo === "Professor";
    let classes = null;
    if (scoped) {
      const result = await repository.query(
        "SELECT turma FROM professor_turmas WHERE professor_id = $1 ORDER BY turma",
        [command.session.userId],
      );
      classes = result.rows.map((row) => row.turma);
    }
    let query = repository.listarSql1();
    const params = [];
    if (scoped) {
      params.push(classes);
      query += repository.listarSqlScoped(params.length);
    }
    if (turmaFilter) {
      params.push(turmaFilter);
      query += repository.listarSql2(params.length);
    }
    if (statusFilter) {
      params.push(statusFilter);
      query += repository.listarSql3(params.length);
    }
    query += repository.listarSql4();
    const [tarefasResult, alunosResult, statsResult, competenciasResult] =
      await Promise.all([
        repository.query(query, params),
        scoped
          ? repository.query(repository.listarSql5(true), [classes])
          : repository.query(repository.listarSql5()),
        scoped
          ? repository.query(repository.listarSql6(true), [classes])
          : repository.query(repository.listarSql6()),
        repository.query(repository.listarSql7()),
      ]);
    outcome.data({
      tarefas: tarefasResult.rows,
      alunos: alunosResult.rows,
      stats: statsResult.rows[0],
      user: command.session.user,
      userCargo: command.session.userCargo,
      listaCompetencias: competenciasResult.rows,
      turmas: classes || [],
      filtros: {
        turma: turmaFilter,
        status: statusFilter,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("Erro ao carregar tarefas:", err.message);
    command.message("error_msg", "Erro ao carregar tarefas");
    outcome.complete("/dashboard");
  }
};
exports.criar = async (command, outcome) => {
  const titulo = text(command.input.titulo, 200, {
    min: 1,
  });
  const descricao = text(command.input.descricao, 5000) || null;
  const turma = ALLOWED_YEARS.includes(command.input.turma)
    ? command.input.turma
    : null;
  const data_entrega = command.input.data_entrega
    ? dateOnly(command.input.data_entrega)
    : null;
  const prioridade = ALLOWED_PRIORITY.includes(command.input.prioridade)
    ? command.input.prioridade
    : "MEDIA";
  const competencia_id = command.input.competencia_id
    ? integerId(command.input.competencia_id)
    : null;
  const requestedStudents = command.input.alunos ?? [];
  if (
    !Array.isArray(requestedStudents) ||
    requestedStudents.length > 500 ||
    requestedStudents.some((id) => !integerId(id))
  ) {
    return outcome.code(400).data({
      error:
        "Lista de alunos inválida; informe até 500 identificadores válidos.",
    });
  }
  const alunos = requestedStudents.map(integerId);
  if (
    !titulo ||
    !turma ||
    (command.input.data_entrega && !data_entrega) ||
    (command.input.competencia_id && !competencia_id)
  ) {
    command.message("error_msg", "Título e turma são obrigatórios");
    return outcome.complete("/dashboard/tarefas");
  }
  const client = await repository.connect();
  const notificationAlunoIds = [];
  try {
    await client.query(repository.criarSql1());
    const tarefaResult = await client.query(repository.criarSql2(), [
      titulo,
      descricao,
      turma,
      data_entrega,
      prioridade,
      competencia_id,
      command.session.userId,
    ]);
    const tarefaId = tarefaResult.rows[0].id;
    let alunosParaAtribuir = alunos;
    if (alunosParaAtribuir.length === 0) {
      const alunosTurma = await client.query(repository.criarSql3(), [turma]);
      alunosParaAtribuir = alunosTurma.rows.map((row) => row.id);
    } else {
      const valid = await client.query(repository.criarSql4(), [
        turma,
        alunosParaAtribuir,
      ]);
      alunosParaAtribuir = valid.rows.map((row) => row.id);
    }
    for (const alunoId of [...new Set(alunosParaAtribuir)]) {
      const inserted = await client.query(repository.criarSql5(), [
        tarefaId,
        alunoId,
      ]);
      if (inserted.rows[0])
        notificationAlunoIds.push(inserted.rows[0].aluno_id);
    }
    await client.query(repository.criarSql6());
    for (const alunoId of notificationAlunoIds) {
      await criarNotificacao(
        "tarefa",
        null,
        alunoId,
        "Nova Tarefa",
        `Você recebeu uma nova tarefa: ${titulo}`,
        "/aluno/tarefas",
        "fas fa-tasks",
        "#217346",
      );
    }
    command.message("success_msg", "Tarefa criada com sucesso!");
    outcome.complete("/dashboard/tarefas");
  } catch (err) {
    await client.query(repository.criarSql7());
    console.error("Erro ao criar tarefa:", err);
    command.message("error_msg", "Erro ao criar tarefa");
    outcome.complete("/dashboard/tarefas");
  } finally {
    client.release();
  }
};
exports.avaliarAluno = async (command, outcome) => {
  const tarefa_id = integerId(command.input.tarefa_id);
  const aluno_id = integerId(command.input.aluno_id);
  const nota = numberInRange(command.input.nota, 0, 10);
  const feedback = text(command.input.feedback, 5000) || null;
  if (!tarefa_id || !aluno_id || nota === null)
    return outcome.code(400).data({
      success: false,
      error: "Dados de avaliação inválidos.",
    });
  const client = await repository.connect();
  try {
    await client.query(repository.avaliarAlunoSql1());
    const owned = await client.query(repository.avaliarAlunoSql2(), [
      tarefa_id,
      aluno_id,
      command.session.userId,
      command.session.userCargo === "Admin",
    ]);
    if (!owned.rows.length) {
      await client.query(repository.avaliarAlunoSql3());
      return outcome.code(404).data({
        error: "Entrega não encontrada.",
      });
    }
    if (!["ENTREGUE", "DEVOLVIDA"].includes(owned.rows[0].status)) {
      await client.query(repository.avaliarAlunoSql4());
      return outcome.code(409).data({
        error: "Esta entrega não está disponível para avaliação.",
      });
    }
    const updated = await client.query(repository.avaliarAlunoSql5(), [
      nota,
      feedback,
      tarefa_id,
      aluno_id,
    ]);
    if (updated.rows.length === 0) {
      await client.query(repository.avaliarAlunoSql6());
      return outcome.code(404).data({
        success: false,
        error: "Entrega não encontrada.",
      });
    }
    const tarefa = await client.query(repository.avaliarAlunoSql7(), [
      tarefa_id,
    ]);
    let virouCompetencia = false;
    if (tarefa.rows[0]?.competencia_id) {
      await client.query(repository.avaliarAlunoSql8(), [
        aluno_id,
        tarefa.rows[0].competencia_id,
        nota,
        "Avaliado pelo professor",
      ]);
      virouCompetencia = true;
      const media = await client.query(repository.avaliarAlunoSql9(), [
        aluno_id,
      ]);
      if (media.rows[0].media)
        await client.query(repository.avaliarAlunoSql10(), [
          media.rows[0].media,
          aluno_id,
        ]);
    }
    await client.query(repository.avaliarAlunoSql11());
    await criarNotificacao(
      "avaliacao",
      null,
      aluno_id,
      "Tarefa Avaliada",
      `Sua tarefa foi avaliada com nota ${nota}`,
      "/aluno/tarefas",
      "fas fa-star",
      "#217346",
    );
    outcome.data({
      success: true,
      virouCompetencia,
    });
  } catch (err) {
    await client.query(repository.avaliarAlunoSql12());
    console.error("Erro ao avaliar tarefa:", err);
    outcome.code(500).data({
      success: false,
      error: "Erro ao avaliar tarefa.",
    });
  } finally {
    client.release();
  }
};
exports.devolverAluno = async (command, outcome) => {
  const tarefa_id = integerId(command.input.tarefa_id);
  const aluno_id = integerId(command.input.aluno_id);
  if (!tarefa_id || !aluno_id)
    return outcome.code(400).data({
      success: false,
      error: "Dados inválidos.",
    });
  try {
    const result = await repository.query(repository.devolverAlunoSql1(), [
      tarefa_id,
      aluno_id,
      command.session.userId,
      command.session.userCargo === "Admin",
    ]);
    if (result.rows.length === 0)
      return outcome.code(404).data({
        success: false,
        error: "Entrega não encontrada.",
      });
    await criarNotificacao(
      "devolucao",
      null,
      aluno_id,
      "Tarefa Devolvida",
      "Sua tarefa foi devolvida para correção",
      "/aluno/tarefas",
      "fas fa-undo-alt",
      "#ffa500",
    );
    outcome.data({
      success: true,
    });
  } catch (err) {
    console.error("Erro ao devolver tarefa:", err);
    outcome.code(500).data({
      success: false,
      error: "Erro ao devolver tarefa.",
    });
  }
};
exports.obterDetalhes = async (command, outcome) => {
  const tarefaId = integerId(command.ids.id);
  if (!tarefaId)
    return outcome.code(400).data({
      error: "Tarefa inválida",
    });
  try {
    const tarefaResult = await repository.query(
      repository.obterDetalhesSql1(),
      [tarefaId],
    );
    if (tarefaResult.rows.length === 0)
      return outcome.code(404).data({
        error: "Tarefa não encontrada",
      });
    const alunosResult = await repository.query(
      repository.obterDetalhesSql2(),
      [tarefaId, tarefaResult.rows[0].turma],
    );
    outcome.data({
      tarefa: tarefaResult.rows[0],
      alunos: alunosResult.rows,
    });
  } catch (err) {
    console.error("Erro ao buscar tarefa:", err);
    outcome.code(500).data({
      error: "Erro ao buscar tarefa",
    });
  }
};
exports.editar = async (command, outcome) => {
  const tarefaId = integerId(command.ids.id);
  const titulo = text(command.input.titulo, 200, {
    min: 1,
  });
  const descricao = text(command.input.descricao, 5000) || null;
  const data_entrega = command.input.data_entrega
    ? dateOnly(command.input.data_entrega)
    : null;
  const prioridade = ALLOWED_PRIORITY.includes(command.input.prioridade)
    ? command.input.prioridade
    : null;
  const status = ALLOWED_TASK_STATUS.includes(command.input.status)
    ? command.input.status
    : null;
  if (
    !tarefaId ||
    !titulo ||
    !prioridade ||
    !status ||
    (command.input.data_entrega && !data_entrega)
  ) {
    command.message("error_msg", "Dados da tarefa inválidos.");
    return outcome.complete("/dashboard/tarefas");
  }
  try {
    const updated = await repository.query(repository.editarSql1(), [
      titulo,
      descricao,
      data_entrega,
      prioridade,
      status,
      tarefaId,
      command.session.userId,
      command.session.userCargo === "Admin",
    ]);
    if (!updated.rows.length)
      return outcome.code(404).data({
        error: "Tarefa não encontrada.",
      });
    command.message("success_msg", "Tarefa atualizada com sucesso!");
    outcome.complete("/dashboard/tarefas");
  } catch (err) {
    console.error("Erro ao editar tarefa:", err);
    command.message("error_msg", "Erro ao editar tarefa");
    outcome.complete("/dashboard/tarefas");
  }
};
exports.excluir = async (command, outcome) => {
  const tarefaId = integerId(command.ids.id);
  if (!tarefaId) {
    command.message("error_msg", "Tarefa inválida");
    return outcome.complete("/dashboard/tarefas");
  }
  try {
    const removed = await repository.query(repository.excluirSql1(), [
      tarefaId,
      command.session.userId,
      command.session.userCargo === "Admin",
    ]);
    if (!removed.rows.length)
      return outcome.code(404).data({
        error: "Tarefa não encontrada.",
      });
    command.message("success_msg", "Tarefa excluída com sucesso!");
    outcome.complete("/dashboard/tarefas");
  } catch (err) {
    console.error("Erro ao excluir tarefa:", err);
    command.message("error_msg", "Erro ao excluir tarefa");
    outcome.complete("/dashboard/tarefas");
  }
};
exports.atualizarStatusAluno = async (command, outcome) => {
  const tarefa_id = integerId(command.input.tarefa_id);
  const aluno_id = integerId(command.input.aluno_id);
  const status = [
    "PENDENTE",
    "ENTREGUE",
    "CONCLUIDA",
    "DEVOLVIDA",
    "ATRASADA",
  ].includes(command.input.status)
    ? command.input.status
    : null;
  const observacoes = text(command.input.observacoes, 2000) || null;
  if (!tarefa_id || !aluno_id || !status)
    return outcome.code(400).data({
      error: "Dados inválidos",
    });
  try {
    const updated = await repository.query(
      repository.atualizarStatusAlunoSql1(),
      [
        status,
        tarefa_id,
        aluno_id,
        command.session.userId,
        command.session.userCargo === "Admin",
      ],
    );
    if (!updated.rows.length)
      return outcome.code(404).data({
        error: "Entrega não encontrada.",
      });
    outcome.data({
      success: true,
    });
  } catch (err) {
    console.error("Erro ao atualizar status:", err);
    outcome.code(500).data({
      error: "Erro ao atualizar status",
    });
  }
};
exports.estatisticas = async (command, outcome) => {
  try {
    if (command.session.userCargo === "Coordenador")
      return outcome.code(403).data({ error: "Estatísticas de tarefas disponíveis para professores e administradores." });
    const scoped = command.session.userCargo === "Professor";
    const classes = scoped
      ? (await repository.query(
          "SELECT turma FROM professor_turmas WHERE professor_id = $1",
          [command.session.userId],
        )).rows.map((row) => row.turma)
      : null;
    const result = scoped
      ? await repository.query(repository.estatisticasSql1(true), [classes])
      : await repository.query(repository.estatisticasSql1());
    outcome.data(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    outcome.code(500).data({
      error: "Erro ao buscar estatísticas",
    });
  }
};
