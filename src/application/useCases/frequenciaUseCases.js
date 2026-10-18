const repository = require("../../infrastructure/repositories/frequenciaRepository");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const STATUSES = new Set(["PRESENTE", "FALTA", "JUSTIFICADA"]);

function validateSession(input) {
  const data = typeof input.data === "string" ? input.data : "";
  const inicio = typeof input.inicio === "string" ? input.inicio : "";
  const fim = typeof input.fim === "string" ? input.fim : "";
  if (!DATE_RE.test(data) || Number.isNaN(Date.parse(data + "T00:00:00Z")))
    return null;
  if (!TIME_RE.test(inicio) || !TIME_RE.test(fim) || fim <= inicio) return null;
  return { data, inicio, fim };
}

function staffAllowed(command, outcome) {
  const cargo = command.session?.userCargo;
  if (!["Professor", "Coordenador", "Admin"].includes(cargo)) {
    outcome.code(403).data({ error: "Seu perfil não pode gerenciar frequência." });
    return false;
  }
  return true;
}

exports.listar = async (command, outcome) => {
  if (!staffAllowed(command, outcome)) return;
  const session = validateSession(command.filters);
  if (!session) {
    outcome.code(400).data({ error: "Informe data, inicio e fim válidos." });
    return;
  }
  const result = await repository.listar(session);
  outcome.data({
    data: session.data,
    inicio: session.inicio,
    fim: session.fim,
    alunos: result.rows,
  });
};

exports.salvar = async (command, outcome) => {
  if (!staffAllowed(command, outcome)) return;
  const session = validateSession(command.input);
  const registros = command.input.registros;
  if (!session || !Array.isArray(registros) || registros.length > 500) {
    outcome.code(400).data({ error: "Dados da chamada inválidos." });
    return;
  }
  const ids = new Set();
  for (const registro of registros) {
    const id = Number(registro?.aluno_id);
    if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id) ||
        !STATUSES.has(registro?.status)) {
      outcome.code(400).data({ error: "Cada aluno deve ter um status válido e único." });
      return;
    }
    ids.add(id);
  }
  if (!registros.length) {
    outcome.code(400).data({ error: "Selecione ao menos um aluno." });
    return;
  }
  const result = await repository.salvar(session, registros, command.session.userId);
  outcome.data({ success: true, salvos: result.rowCount });
};
