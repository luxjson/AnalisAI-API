const repository = require("../../infrastructure/repositories/calendarioUseCasesRepository.js");
const {
  text,
  integerId,
  hexColor,
  dateOnly,
  ALLOWED_YEARS,
} = require("../../domain/validation");
exports.listar = async (command, outcome) => {
  try {
    const turmaFilter = ALLOWED_YEARS.includes(command.filters.turma)
      ? command.filters.turma
      : "";
    const mes =
      Number.isInteger(Number(command.filters.mes)) &&
      Number(command.filters.mes) >= 1 &&
      Number(command.filters.mes) <= 12
        ? Number(command.filters.mes)
        : new Date().getMonth() + 1;
    const ano =
      Number.isInteger(Number(command.filters.ano)) &&
      Number(command.filters.ano) >= 2000 &&
      Number(command.filters.ano) <= 2100
        ? Number(command.filters.ano)
        : new Date().getFullYear();
    let eventosQuery = repository.listarSql1();
    const params = [mes, ano];
    if (turmaFilter) {
      params.push(turmaFilter);
      eventosQuery += repository.listarSql2();
    }
    eventosQuery += repository.listarSql3();
    const [eventosResult, feriadosResult, tiposResult] = await Promise.all([
      repository.query(eventosQuery, params),
      repository.query(repository.listarSql4(), [mes, ano]),
      repository.query(repository.listarSql5()),
    ]);
    outcome.data({
      user: command.session.user,
      userCargo: command.session.userCargo,
      eventos: eventosResult.rows,
      feriados: feriadosResult.rows,
      tipos: tiposResult.rows,
      filtros: {
        turma: turmaFilter,
        mes,
        ano,
      },
    });
  } catch (err) {
    console.error("Erro ao carregar calendário:", err);
    command.message("error_msg", "Erro ao carregar calendário");
    outcome.complete("/dashboard");
  }
};
function validDate(value) {
  return dateOnly(value);
}
exports.criarEvento = async (command, outcome) => {
  const titulo = text(command.input.titulo, 200, {
    min: 1,
  });
  const descricao = text(command.input.descricao, 5000) || null;
  const tipo = text(command.input.tipo, 50, {
    min: 1,
  });
  const data_inicio = validDate(command.input.data_inicio);
  const data_fim = command.input.data_fim
    ? validDate(command.input.data_fim)
    : null;
  const turma = command.input.turma
    ? ALLOWED_YEARS.includes(command.input.turma)
      ? command.input.turma
      : null
    : null;
  const cor = command.input.cor ? hexColor(command.input.cor) : "#ff0101";
  if (
    !titulo ||
    !data_inicio ||
    !tipo ||
    (command.input.cor && !cor) ||
    (command.input.data_fim && !data_fim) ||
    (data_fim && data_fim < data_inicio)
  ) {
    command.message("error_msg", "Dados do evento inválidos.");
    return outcome.complete("/dashboard/calendario");
  }
  try {
    await repository.query(repository.criarEventoSql1(), [
      titulo,
      descricao,
      tipo,
      data_inicio,
      data_fim,
      turma,
      cor,
      command.session.userId,
    ]);
    command.message("success_msg", "Evento adicionado com sucesso!");
    outcome.complete("/dashboard/calendario");
  } catch (err) {
    console.error("Erro ao criar evento:", err);
    command.message("error_msg", "Erro ao criar evento");
    outcome.complete("/dashboard/calendario");
  }
};
exports.criarFeriado = async (command, outcome) => {
  const nome = text(command.input.nome, 200, {
    min: 1,
  });
  const data = validDate(command.input.data);
  if (!nome || !data) {
    command.message("error_msg", "Nome e data são obrigatórios");
    return outcome.complete("/dashboard/calendario");
  }
  try {
    await repository.query(repository.criarFeriadoSql1(), [
      nome,
      data,
      command.input.recorrente === "true" || command.input.recorrente === true,
    ]);
    command.message("success_msg", "Feriado adicionado com sucesso!");
    outcome.complete("/dashboard/calendario");
  } catch (err) {
    console.error("Erro ao adicionar feriado:", err);
    command.message("error_msg", "Erro ao adicionar feriado");
    outcome.complete("/dashboard/calendario");
  }
};
exports.deletarEvento = async (command, outcome) => {
  const id = integerId(command.ids.id);
  if (!id)
    return outcome.code(400).data({
      success: false,
      error: "ID inválido",
    });
  try {
    const result = await repository.query(repository.deletarEventoSql1(), [
      id,
      command.session.userId,
      command.session.userCargo === "Admin",
    ]);
    if (!result.rowCount)
      return outcome.code(404).data({
        success: false,
        error: "Evento não encontrado",
      });
    outcome.data({
      success: true,
    });
  } catch (err) {
    console.error("Erro ao deletar evento:", err);
    outcome.code(500).data({
      success: false,
    });
  }
};
exports.deletarFeriado = async (command, outcome) => {
  const id = integerId(command.ids.id);
  if (!id)
    return outcome.code(400).data({
      success: false,
      error: "ID inválido",
    });
  try {
    await repository.query(repository.deletarFeriadoSql1(), [id]);
    outcome.data({
      success: true,
    });
  } catch (err) {
    console.error("Erro ao deletar feriado:", err);
    outcome.code(500).data({
      success: false,
    });
  }
};
exports.dadosMes = async (command, outcome) => {
  const mes = Number(command.filters.mes);
  const ano = Number(command.filters.ano);
  const turma = ALLOWED_YEARS.includes(command.filters.turma)
    ? command.filters.turma
    : "";
  if (
    !Number.isInteger(mes) ||
    mes < 1 ||
    mes > 12 ||
    !Number.isInteger(ano) ||
    ano < 2000 ||
    ano > 2100
  )
    return outcome.code(400).data({
      error: "Período inválido",
    });
  try {
    const eventos = await repository.query(repository.dadosMesSql1(), [
      mes,
      ano,
      turma,
    ]);
    const feriados = await repository.query(repository.dadosMesSql2(), [
      mes,
      ano,
    ]);
    outcome.data({
      eventos: eventos.rows,
      feriados: feriados.rows,
    });
  } catch (err) {
    console.error("Erro ao buscar dados do calendário:", err);
    outcome.code(500).data({
      error: "Erro ao buscar dados",
    });
  }
};
