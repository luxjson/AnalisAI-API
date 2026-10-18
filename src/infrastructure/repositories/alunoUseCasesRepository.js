const database = require("../database");
const annualAttendance = `(
  SELECT CASE WHEN COUNT(*) = 0 THEN NULL
    ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE fr.status = 'PRESENTE') / COUNT(*))::INTEGER
  END
  FROM frequencia_registros fr
  WHERE fr.aluno_id = a.id
    AND fr.data_aula >= date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE
    AND fr.data_aula < (date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 year')::DATE
)`;
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.dashboardSql1 = () => `
  SELECT a.*, ${annualAttendance} AS presenca_calculada, al.matricula, al.email, al.status, TO_CHAR(al.data_criacao,
    'DD/MM/YYYY') as data_cadastro
  FROM alunos a
  JOIN alunos_login al ON a.id = al.aluno_id
  WHERE a.id = $1
`;
exports.dashboardSql2 = () => `
  SELECT ac.*, c.nome, c.descricao, c.categoria, TO_CHAR(ac.data_registro,
    'DD/MM/YYYY') as data_formatada
  FROM aluno_competencias ac
  JOIN competencias c ON ac.competencia_id = c.id
  WHERE ac.aluno_id = $1
  ORDER BY ac.data_registro DESC
`;
exports.dashboardAttendanceSql = () => `
  SELECT
    COUNT(*)::INTEGER AS total_aulas,
    COUNT(*) FILTER (WHERE status = 'PRESENTE')::INTEGER AS presencas,
    COUNT(*) FILTER (WHERE status = 'FALTA')::INTEGER AS faltas,
    COUNT(*) FILTER (WHERE status = 'JUSTIFICADA')::INTEGER AS justificadas,
    COUNT(DISTINCT data_aula)::INTEGER AS dias_registrados
  FROM frequencia_registros
  WHERE aluno_id = $1
    AND data_aula >= make_date($2::INTEGER, 1, 1)
    AND data_aula < make_date($2::INTEGER + 1, 1, 1)
`;
exports.dashboardSql3 = () =>
  `
  UPDATE alunos_login
  SET ultimo_acesso = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
  WHERE aluno_id = $1
`;
exports.competenciasSql1 = () =>
  "SELECT nome, ano_escolar FROM alunos WHERE id = $1";
exports.competenciasSql2 = () => `
  SELECT ac.*, c.nome, c.descricao, c.categoria, TO_CHAR(ac.data_registro,
    'DD/MM/YYYY') as data_formatada, TO_CHAR(ac.data_registro,
    'HH24:MI') as hora_formatada
  FROM aluno_competencias ac
  JOIN competencias c ON ac.competencia_id = c.id
  WHERE ac.aluno_id = $1
  ORDER BY ac.data_registro DESC
`;
exports.competenciasSql3 = () => `
  SELECT COUNT(*) as total, COUNT(*) FILTER(
    WHERE nota >= 7) as aptas, COUNT(*) FILTER(
    WHERE nota >= 5 AND nota < 7) as desenvolvimento, COUNT(*) FILTER(
    WHERE nota < 5) as inaptas, COALESCE(AVG(nota), 0) as media_geral
  FROM aluno_competencias
  WHERE aluno_id = $1
`;
exports.evolucaoSql1 = () =>
  `SELECT nome, ano_escolar, presenca, ${annualAttendance} AS presenca_calculada FROM alunos a WHERE id = $1`;
exports.evolucaoSql2 = () => `
  SELECT ac.*, c.nome, c.descricao, c.categoria, TO_CHAR(ac.data_registro,
    'DD/MM/YYYY') as data_formatada
  FROM aluno_competencias ac
  JOIN competencias c ON ac.competencia_id = c.id
  WHERE ac.aluno_id = $1
  ORDER BY ac.data_registro DESC
`;
exports.evolucaoSql3 = () => `
  SELECT TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data, COUNT(*) as
  total_avaliacoes, COALESCE(AVG(ac.nota), 0) as media_dia
  FROM aluno_competencias ac
  WHERE ac.aluno_id = $1
  GROUP BY TO_CHAR(ac.data_registro, 'DD/MM/YYYY')
  ORDER BY data DESC
`;
exports.alterarSenhaSql1 = () =>
  "SELECT senha FROM alunos_login WHERE aluno_id = $1";
exports.alterarSenhaSql2 = () =>
  "UPDATE alunos_login SET senha = $1 WHERE aluno_id = $2";
exports.alterarSenhaSql3 = () =>
  "DELETE FROM web_sessions WHERE sess->'aluno'->>'id' = $1";
exports.tarefasSql1 = () => `
  UPDATE tarefas_alunos ta
  SET status = 'ATRASADA'
  FROM tarefas t
  WHERE ta.tarefa_id = t.id AND ta.aluno_id = $1 AND ta.status = 'PENDENTE' AND t
  .data_entrega < CURRENT_DATE
`;
exports.tarefasSql2 = () => `
  SELECT ta.id as tarefa_aluno_id, t.id as tarefa_id, t.titulo,
  t.descricao, t.turma, t.data_entrega as data_limite, c.nome as competencia_nome
  , ta.status, ta.nota, ta.feedback, ta.data_entrega as data_entrega_aluno,
  ta.data_avaliacao, TO_CHAR(t.data_entrega, 'DD/MM/YYYY') as
  data_limite_formatada, TO_CHAR(ta.data_entrega, 'DD/MM/YYYY HH24:MI') as
  data_entrega_formatada, TO_CHAR(ta.data_avaliacao, 'DD/MM/YYYY') as
  data_avaliacao_formatada, CASE
  WHEN ta.status = 'ENTREGUE' THEN
  'Aguardando correção'
  WHEN ta.status = 'CONCLUIDA' THEN
  'Corrigida'
  WHEN ta.status = 'DEVOLVIDA' THEN
  'Devolvida para correção'
  WHEN ta.status = 'ATRASADA' THEN
  'Atrasada'
  ELSE 'Pendente' END as status_texto, CASE
  WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN
  'ATRASADA'
  ELSE ta.status END as status_real
  FROM tarefas t
  JOIN tarefas_alunos ta ON t.id = ta.tarefa_id
  LEFT
  JOIN competencias c ON t.competencia_id = c.id
  WHERE ta.aluno_id = $1
  ORDER BY CASE
  WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN
  1
  WHEN ta.status = 'PENDENTE' THEN
  2
  WHEN ta.status = 'DEVOLVIDA' THEN
  3
  WHEN ta.status = 'ENTREGUE' THEN
  4
  WHEN ta.status = 'CONCLUIDA' THEN
  5
  ELSE 6 END, t.data_entrega ASC NULLS LAST
`;
exports.tarefasSql3 = () => `
  SELECT COUNT(*) as total, COUNT(CASE
    WHEN ta.status = 'PENDENTE' AND (t.data_entrega IS NULL OR t.data_entrega >=
      CURRENT_DATE) THEN
    1 END) as pendentes, COUNT(CASE
    WHEN ta.status = 'ENTREGUE' THEN
    1 END) as aguardando, COUNT(CASE
    WHEN ta.status = 'CONCLUIDA' THEN
    1 END) as concluidas, COUNT(CASE
    WHEN ta.status = 'DEVOLVIDA' THEN
    1 END) as devolvidas, COUNT(CASE
    WHEN ta.status = 'ATRASADA' OR (ta.status = 'PENDENTE' AND t.data_entrega <
      CURRENT_DATE) THEN
    1 END) as atrasadas
  FROM tarefas_alunos ta
  JOIN tarefas t ON ta.tarefa_id = t.id
  WHERE ta.aluno_id = $1
`;
exports.enviarTarefaSql1 = () => "BEGIN";
exports.enviarTarefaSql2 = () =>
  `
  SELECT ta.resposta_arquivo, t.criado_por, t.titulo
  FROM tarefas_alunos ta
  JOIN tarefas t ON t.id = ta.tarefa_id
  WHERE ta.id = $1 AND ta.aluno_id = $2 AND ta.status IN ('PENDENTE',
    'DEVOLVIDA', 'ATRASADA') AND t.status = 'ATIVA' FOR UPDATE OF ta
`;
exports.enviarTarefaSql3 = () => "ROLLBACK";
exports.enviarTarefaSql4 = () =>
  `
  INSERT INTO uploaded_files(storage_key, original_name, mime_type,
    size_bytes, content)
  VALUES ($1, $2, $3, $4, $5)
`;
exports.enviarTarefaSql5 = () =>
  `
  UPDATE tarefas_alunos
  SET status = 'ENTREGUE', data_entrega = CURRENT_TIMESTAMP,
  resposta_texto = COALESCE($1, resposta_texto), resposta_arquivo = $2
  WHERE id = $3 AND aluno_id = $4
`;
exports.enviarTarefaSql6 = () =>
  "DELETE FROM uploaded_files WHERE storage_key=$1";
exports.enviarTarefaSql7 = () => "COMMIT";
exports.enviarTarefaSql8 = () => "ROLLBACK";
exports.apiDadosGraficoSql1 = () => `
  SELECT c.nome, ac.nota, c.categoria
  FROM aluno_competencias ac
  JOIN competencias c ON ac.competencia_id = c.id
  WHERE ac.aluno_id = $1
  ORDER BY c.categoria, ac.nota DESC
`;
exports.apiRankingComparativoSql1 = () => `
  SELECT COALESCE(AVG(nota), 0) as media
  FROM aluno_competencias
  WHERE aluno_id = $1
`;
exports.apiRankingComparativoSql2 = () => `
  SELECT COALESCE(AVG(ac.nota), 0) as media
  FROM aluno_competencias ac
  JOIN alunos a ON ac.aluno_id = a.id
  WHERE a.ano_escolar = $1
`;
exports.apiRankingComparativoSql3 = () => `
SELECT COALESCE (AVG (nota), 0) as media
FROM aluno_competencias
`;
