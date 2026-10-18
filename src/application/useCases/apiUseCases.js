const repository = require("../../infrastructure/repositories/apiUseCasesRepository.js");
const {
  integerId,
  text,
  booleanValue,
  ALLOWED_YEARS,
} = require("../../domain/validation");
exports.getConta = async (command, outcome) => {
  try {
    const formatDateTime = (value) =>
      value
        ? new Date(value).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "—";
    const formatDate = (value) =>
      value
        ? new Date(value).toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })
        : "—";
    if (command.session.aluno?.id) {
      const result = await repository.query(repository.getContaSql1(), [
        command.session.aluno.id,
      ]);
      if (!result.rows.length)
        return outcome.code(404).data({
          error: "Aluno não encontrado",
        });
      const row = result.rows[0];
      return outcome.data({
        initial: row.nome?.charAt(0).toUpperCase() || "A",
        name: row.nome,
        class: row.ano_escolar,
        registration: row.matricula || "—",
        email: row.email || "Não informado",
        age: row.idade ? `${row.idade} anos` : "—",
        assessments: Number(row.avaliacoes || 0),
        attendance: `${Number(row.presenca || 0)}%`,
        status: row.status || "ATIVO",
        created: formatDate(row.data_criacao),
        lastAccess: formatDateTime(row.ultimo_acesso),
      });
    }
    if (command.session.userId) {
      const result = await repository.query(repository.getContaSql2(), [
        command.session.userId,
      ]);
      if (!result.rows.length)
        return outcome.code(404).data({
          error: "Usuário não encontrado",
        });
      const row = result.rows[0];
      let tasks = 0;
      let students = 0;
      try {
        const stats = await repository.query(repository.getContaSql3(), [
          command.session.userId,
        ]);
        tasks = Number(stats.rows[0]?.tarefas || 0);
        students = Number(stats.rows[0]?.alunos || 0);
      } catch (statsError) {
        console.error(
          "Erro ao buscar estatísticas da conta:",
          statsError.message,
        );
        try {
          const taskCount = await repository.query(repository.getContaSql4(), [
            command.session.userId,
          ]);
          tasks = Number(taskCount.rows[0]?.total || 0);
        } catch (_) {}
      }
      return outcome.data({
        initial: row.nome?.charAt(0).toUpperCase() || "P",
        name: row.nome,
        email: row.email || "Não informado",
        role: row.cargo || command.session.userCargo || "Professor",
        created: formatDate(row.data_criacao),
        lastAccess: formatDateTime(row.ultimo_acesso),
        tasks,
        students,
      });
    }
    return outcome.code(401).data({
      error: "Não autorizado",
    });
  } catch (err) {
    console.error("Erro ao buscar dados da conta:", err);
    return outcome.code(500).data({
      error: "Erro ao buscar dados da conta",
    });
  }
};
exports.getNotificacoes = async (command, outcome) => {
  try {
    let query = "";
    let params = [];
    if (command.session.aluno) {
      query = repository.getNotificacoesSql1();
      params = [command.session.aluno.id];
    } else if (command.session.user) {
      query = repository.getNotificacoesSql2();
      params = [command.session.userId];
    } else {
      return outcome.data({
        notificacoes: [],
        totalNaoLidas: 0,
      });
    }
    const result = await repository.query(query, params);
    const countResult = await repository.query(
      repository.getNotificacoesSql3(
        command.session.aluno ? "aluno_id" : "usuario_id",
      ),
      [
        command.session.aluno
          ? command.session.aluno.id
          : command.session.userId,
      ],
    );
    outcome.data({
      notificacoes: result.rows,
      totalNaoLidas: parseInt(countResult.rows[0].total),
    });
  } catch (err) {
    console.error("Erro ao buscar notificações:", err);
    outcome.code(500).data({
      error: "Erro ao buscar notificações",
    });
  }
};
exports.marcarNotificacaoLida = async (command, outcome) => {
  try {
    const id = integerId(command.ids.id);
    if (!id)
      return outcome.code(400).data({
        error: "ID inválido",
      });
    let query = "";
    let params = [];
    if (command.session.aluno) {
      query = repository.marcarNotificacaoLidaSql1();
      params = [id, command.session.aluno.id];
    } else if (command.session.user) {
      query = repository.marcarNotificacaoLidaSql2();
      params = [id, command.session.userId];
    } else {
      return outcome.code(401).data({
        error: "Não autorizado",
      });
    }
    const result = await repository.query(query, params);
    if (result.rows.length > 0) {
      outcome.data({
        success: true,
      });
    } else {
      outcome.code(404).data({
        error: "Notificação não encontrada",
      });
    }
  } catch (err) {
    console.error("Erro ao marcar notificação como lida:", err);
    outcome.code(500).data({
      error: "Erro ao processar",
    });
  }
};
exports.marcarTodasNotificacoesLidas = async (command, outcome) => {
  try {
    let query = "";
    let params = [];
    if (command.session.aluno) {
      query = repository.marcarTodasNotificacoesLidasSql1();
      params = [command.session.aluno.id];
    } else if (command.session.user) {
      query = repository.marcarTodasNotificacoesLidasSql2();
      params = [command.session.userId];
    } else {
      return outcome.code(401).data({
        error: "Não autorizado",
      });
    }
    await repository.query(query, params);
    outcome.data({
      success: true,
    });
  } catch (err) {
    console.error("Erro ao marcar todas como lidas:", err);
    outcome.code(500).data({
      error: "Erro ao processar",
    });
  }
};
exports.getConfiguracoesNotificacoes = async (command, outcome) => {
  try {
    const ownerColumn = command.session.aluno?.id
      ? "aluno_id"
      : command.session.userId
        ? "usuario_id"
        : null;
    const ownerId = command.session.aluno?.id || command.session.userId;
    if (!ownerColumn || !ownerId)
      return outcome.code(401).data({
        error: "Não autorizado",
      });
    let result = await repository.query(
      repository.getConfiguracoesNotificacoesSql1(ownerColumn),
      [ownerId],
    );
    if (!result.rows.length) {
      result = await repository.query(
        repository.getConfiguracoesNotificacoesSql2(ownerColumn),
        [ownerId],
      );
    }
    return outcome.data(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar configurações de notificações:", err.message);
    return outcome.code(500).data({
      error: "Erro ao buscar configurações de notificações",
    });
  }
};
exports.saveConfiguracoesNotificacoes = async (command, outcome) => {
  try {
    const ownerColumn = command.session.aluno?.id
      ? "aluno_id"
      : command.session.userId
        ? "usuario_id"
        : null;
    const ownerId = command.session.aluno?.id || command.session.userId;
    if (!ownerColumn || !ownerId)
      return outcome.code(401).data({
        error: "Não autorizado",
      });
    const keys = [
      "notificacoes_ativas",
      "notificacoes_email",
      "notificacoes_tarefas",
      "notificacoes_avaliacoes",
      "notificacoes_competencias",
    ];
    const updates = [];
    const params = [ownerId];
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(command.input || {}, key))
        continue;
      const value = booleanValue(command.input[key]);
      if (value === null)
        return outcome.code(400).data({
          error: "Configuração de notificações inválida.",
        });
      params.push(value);
      updates.push(`${key} = $${params.length}`);
    }
    if (!updates.length)
      return outcome.code(400).data({
        error: "Nenhuma configuração válida foi enviada.",
      });
    await repository.query(
      repository.saveConfiguracoesNotificacoesSql1(ownerColumn),
      [ownerId],
    );
    const result = await repository.query(
      repository.saveConfiguracoesNotificacoesSql2(
        updates.join(", "),
        ownerColumn,
      ),
      params,
    );
    if (!result.rows.length)
      return outcome.code(404).data({
        error: "Configuração não encontrada.",
      });
    return outcome.data({
      success: true,
      config: result.rows[0],
    });
  } catch (err) {
    console.error("Erro ao salvar configurações de notificações:", err.message);
    return outcome.code(500).data({
      error: "Erro ao salvar configurações de notificações",
    });
  }
};
exports.buscarAlunos = async (command, outcome) => {
  try {
    const busca = text(command.filters.busca, 100) || "";
    const turma = ALLOWED_YEARS.includes(command.filters.turma)
      ? command.filters.turma
      : "";
    let classes = null;
    if (command.session.userCargo === "Professor") {
      const assigned = await repository.query(
        "SELECT turma FROM professor_turmas WHERE professor_id = $1",
        [command.session.userId],
      );
      classes = assigned.rows.map((row) => row.turma);
      if (!classes.length || (turma && !classes.includes(turma)))
        return outcome.data({ sucesso: true, total: 0, alunos: [] });
    }
    let query = repository.buscarAlunosSql1();
    const params = [];
    if (busca) {
      params.push(`%${busca.trim().toLowerCase()}%`);
      query += repository.buscarAlunosSql2(params.length, params.length, params.length);
    }
    if (turma) {
      params.push(turma);
      query += repository.buscarAlunosSql3(params.length);
    } else if (classes !== null) {
      params.push(classes);
      query += ` AND a.ano_escolar = ANY($${params.length}::text[])`;
    }
    query += repository.buscarAlunosSql4();
    const result = await repository.query(query, params);
    outcome.data({
      sucesso: true,
      total: result.rows.length,
      alunos: result.rows,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("Erro ao buscar alunos:", err.message);
    outcome.code(500).data({
      sucesso: false,
      error: "Erro interno ao realizar busca",
    });
  }
};
exports.healthCheck = async (command, outcome) => {
  try {
    await repository.query(repository.healthCheckSql1());
    outcome.code(200).data({
      status: "UP",
      timestamp: new Date().toISOString(),
      database: "CONNECTED",
    });
  } catch (err) {
    console.error("Erro na verificação do Health Check:", err);
    outcome.code(500).data({
      status: "DOWN",
      timestamp: new Date().toISOString(),
      database: "DISCONNECTED",
    });
  }
};
