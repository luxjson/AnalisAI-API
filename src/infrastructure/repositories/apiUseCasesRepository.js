const database = require("../database");
const annualAttendance = `(
  SELECT CASE WHEN COUNT(*) = 0 THEN NULL
    ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE fr.status = 'PRESENTE') / COUNT(*))::INTEGER
  END
  FROM frequencia_registros fr
  WHERE fr.aluno_id = a.id
    AND fr.data_aula >= date_trunc('year', CURRENT_DATE)::DATE
    AND fr.data_aula < (date_trunc('year', CURRENT_DATE) + INTERVAL '1 year')::DATE
)`;
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.getContaSql1 = () => `
  SELECT a.nome, a.ano_escolar, a.idade, a.presenca, ${annualAttendance} AS presenca_calculada, al.email,
  al.matricula, al.status, al.data_criacao, al.ultimo_acesso,
  (
    SELECT COUNT(*)
    FROM aluno_competencias ac
    WHERE ac.aluno_id = a.id) AS avaliacoes
  FROM alunos a
  JOIN alunos_login al ON al.aluno_id = a.id
  WHERE a.id = $1 LIMIT 1
`;
exports.getContaSql2 = () =>
  `
  SELECT nome, email, cargo, data_criacao, ultimo_acesso
  FROM usuarios
  WHERE id = $1 LIMIT 1
`;
exports.getContaSql3 = () => `
  SELECT(
    SELECT COUNT(*)
    FROM tarefas
    WHERE criado_por = $1) AS tarefas,(
    SELECT COUNT(DISTINCT ta.aluno_id)
    FROM tarefas_alunos ta INNER
    JOIN tarefas t ON t.id = ta.tarefa_id
    WHERE t.criado_por = $1) AS alunos
`;
exports.getContaSql4 = () =>
  "SELECT COUNT(*) AS total FROM tarefas WHERE criado_por = $1";
exports.getNotificacoesSql1 = () =>
  `
  SELECT *
  FROM notificacoes
  WHERE aluno_id = $1 AND lida = false
  ORDER BY data_criacao DESC LIMIT 20
`;
exports.getNotificacoesSql2 = () =>
  `
  SELECT *
  FROM notificacoes
  WHERE usuario_id = $1 AND lida = false
  ORDER BY data_criacao DESC LIMIT 20
`;
exports.getNotificacoesSql3 = (part0) =>
  `
  SELECT COUNT(*) as total
  FROM notificacoes
  WHERE ${part0} = $1 AND lida = false
`;
exports.marcarNotificacaoLidaSql1 = () =>
  `UPDATE notificacoes SET lida = true WHERE id = $1 AND aluno_id = $2 RETURNING id`;
exports.marcarNotificacaoLidaSql2 = () =>
  `UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2 RETURNING id`;
exports.marcarTodasNotificacoesLidasSql1 = () =>
  `UPDATE notificacoes SET lida = true WHERE aluno_id = $1 AND lida = false`;
exports.marcarTodasNotificacoesLidasSql2 = () =>
  `UPDATE notificacoes SET lida = true WHERE usuario_id = $1 AND lida = false`;
exports.getConfiguracoesNotificacoesSql1 = (part0) =>
  `SELECT * FROM configuracoes_notificacoes WHERE ${part0} = $1 LIMIT 1`;
exports.getConfiguracoesNotificacoesSql2 = (part0) =>
  `INSERT INTO configuracoes_notificacoes (${part0}) VALUES ($1) RETURNING *`;
exports.saveConfiguracoesNotificacoesSql1 = (part0) =>
  `
  INSERT INTO configuracoes_notificacoes(${part0})
  VALUES ($1) ON CONFLICT DO NOTHING
`;
exports.saveConfiguracoesNotificacoesSql2 = (part0, part1) =>
  `
  UPDATE configuracoes_notificacoes
  SET ${part0}
  WHERE ${part1} = $1
  RETURNING *
`;
exports.buscarAlunosSql1 = () => `
  SELECT a.id, a.nome, a.ano_escolar, a.nota, a.presenca, ${annualAttendance} AS presenca_calculada, a.nivel,
  al.email, al.matricula
  FROM alunos a
  LEFT
  JOIN alunos_login al ON a.id = al.aluno_id
  WHERE 1 = 1
`;
exports.buscarAlunosSql2 = (part0, part1, part2) =>
  ` AND (LOWER(a.nome) LIKE $${part0} OR LOWER(al.email) LIKE $${part1} OR LOWER(al.matricula) LIKE $${part2})`;
exports.buscarAlunosSql3 = (part0) => ` AND a.ano_escolar = $${part0}`;
exports.buscarAlunosSql4 = () => ` ORDER BY a.nome ASC LIMIT 50`;
exports.healthCheckSql1 = () => "SELECT 1";
