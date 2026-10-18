const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.listarSql1 = () => `
  SELECT t.*, u.nome as professor_nome, COUNT(ta.id) as total_alunos,
  COUNT(CASE
    WHEN ta.status = 'CONCLUIDA' THEN
    1 END) as concluidas, COUNT(CASE
    WHEN ta.status = 'ENTREGUE' THEN
    1 END) as entregues, COUNT(CASE
    WHEN ta.status = 'DEVOLVIDA' THEN
    1 END) as devolvidas, COUNT(CASE
    WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN
    1 END) as atrasadas, COUNT(CASE
    WHEN ta.status = 'PENDENTE' AND t.data_entrega >= CURRENT_DATE THEN
    1 END) as pendentes
  FROM tarefas t
  LEFT
  JOIN usuarios u ON t.criado_por = u.id
  LEFT
  JOIN tarefas_alunos ta ON t.id = ta.tarefa_id
  WHERE 1 = 1
`;
exports.listarSql2 = (part0) => " AND t.turma = $" + part0;
exports.listarSqlScoped = (part0) => ` AND t.turma = ANY(${part0}::text[])`;
exports.listarSql3 = (part0) => ` AND t.status = $${part0}`;
exports.listarSql4 = () =>
  ` GROUP BY t.id, u.nome ORDER BY CASE WHEN t.status = 'ATIVA' THEN 1 ELSE 2 END, t.data_criacao DESC`;
exports.listarSql5 = (scoped = false) => `
  SELECT id, nome, ano_escolar
  FROM alunos
  ${scoped ? "WHERE ano_escolar = ANY($1::text[])" : ""}
  ORDER BY nome ASC
`;
exports.listarSql6 = (scoped = false) => `
  SELECT COUNT(*) as total, COUNT(CASE
    WHEN status = 'ATIVA' THEN
    1 END) as ativas, COUNT(CASE
    WHEN data_entrega < CURRENT_DATE AND status = 'ATIVA' THEN
    1 END) as atrasadas,(
    SELECT COUNT(*)
    FROM tarefas_alunos ta
    JOIN tarefas t ON t.id = ta.tarefa_id
    WHERE ta.status = 'ENTREGUE'
    ${scoped ? "AND t.turma = ANY($1::text[])" : ""}) as aguardando_correcao
  FROM tarefas
  ${scoped ? "WHERE turma = ANY($1::text[])" : ""}
`;
exports.listarSql7 = () =>
  "SELECT id, nome FROM competencias ORDER BY nome ASC";
exports.criarSql1 = () => "BEGIN";
exports.criarSql2 = () => `
  INSERT INTO tarefas(titulo, descricao, turma, data_entrega,
    prioridade, competencia_id, criado_por, data_atualizacao)
  VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
  RETURNING id
`;
exports.criarSql3 = () =>
  "SELECT id FROM alunos WHERE ano_escolar = $1 ORDER BY id";
exports.criarSql4 = () =>
  "SELECT id FROM alunos WHERE ano_escolar = $1 AND id = ANY($2::int[])";
exports.criarSql5 = () => `
  INSERT INTO tarefas_alunos(tarefa_id, aluno_id, status)
  VALUES ($1, $2, 'PENDENTE') ON CONFLICT(tarefa_id, aluno_id) DO NOTHING
  RETURNING aluno_id
`;
exports.criarSql6 = () => "COMMIT";
exports.criarSql7 = () => "ROLLBACK";
exports.avaliarAlunoSql1 = () => "BEGIN";
exports.avaliarAlunoSql2 = () =>
  `
  SELECT ta.status, t.competencia_id
  FROM tarefas_alunos ta
  JOIN tarefas t ON t.id = ta.tarefa_id
  WHERE ta.tarefa_id = $1 AND ta.aluno_id = $2 AND (t.criado_por = $3 OR $4) FOR
  UPDATE OF ta
`;
exports.avaliarAlunoSql3 = () => "ROLLBACK";
exports.avaliarAlunoSql4 = () => "ROLLBACK";
exports.avaliarAlunoSql5 = () => `
  UPDATE tarefas_alunos
  SET nota = $1, feedback = $2, status = 'CONCLUIDA', data_avaliacao =
  CURRENT_TIMESTAMP
  WHERE tarefa_id = $3 AND aluno_id = $4
  RETURNING id
`;
exports.avaliarAlunoSql6 = () => "ROLLBACK";
exports.avaliarAlunoSql7 = () =>
  "SELECT competencia_id FROM tarefas WHERE id = $1";
exports.avaliarAlunoSql8 = () =>
  `
  INSERT INTO aluno_competencias(aluno_id, competencia_id,
    nota, observacoes)
  VALUES ($1, $2, $3, $4)
`;
exports.avaliarAlunoSql9 = () =>
  "SELECT AVG(nota) as media FROM aluno_competencias WHERE aluno_id = $1";
exports.avaliarAlunoSql10 = () => "UPDATE alunos SET nota = $1 WHERE id = $2";
exports.avaliarAlunoSql11 = () => "COMMIT";
exports.avaliarAlunoSql12 = () => "ROLLBACK";
exports.devolverAlunoSql1 = () => `
  UPDATE tarefas_alunos
  SET status = 'DEVOLVIDA', nota = NULL, feedback = NULL, data_avaliacao = NULL
  WHERE tarefa_id = $1 AND aluno_id = $2 AND status IN ('ENTREGUE',
    'DEVOLVIDA') AND EXISTS (
    SELECT 1
    FROM tarefas t
    WHERE t.id = tarefa_id AND (t.criado_por = $3 OR $4))
  RETURNING id
`;
exports.obterDetalhesSql1 = () => `
  SELECT t.*, c.nome as competencia_nome, u.nome as professor_nome
  FROM tarefas t
  LEFT
  JOIN competencias c ON t.competencia_id = c.id
  LEFT
  JOIN usuarios u ON t.criado_por = u.id
  WHERE t.id = $1
`;
exports.obterDetalhesSql2 = () => `
  SELECT a.id, a.nome, a.ano_escolar, COALESCE(ta.status, 'PENDENTE') as
  status_tarefa, ta.nota, ta.feedback, ta.resposta_texto, ta.resposta_arquivo,
  ta.data_entrega as data_entrega_aluno, ta.data_avaliacao,
  TO_CHAR(ta.data_entrega, 'DD/MM/YYYY HH24:MI') as data_entrega_formatada
  FROM alunos a
  JOIN tarefas_alunos ta ON a.id = ta.aluno_id AND ta.tarefa_id = $1
  WHERE a.ano_escolar = $2
  ORDER BY CASE
  WHEN ta.status = 'ENTREGUE' THEN
  1
  WHEN ta.status = 'DEVOLVIDA' THEN
  2
  WHEN ta.status = 'PENDENTE' THEN
  3
  ELSE 4 END, a.nome ASC
`;
exports.editarSql1 = () =>
  `
  UPDATE tarefas
  SET titulo = $1, descricao = $2, data_entrega = $3, prioridade = $4,
  status = $5, data_atualizacao = CURRENT_TIMESTAMP
  WHERE id = $6 AND (criado_por = $7 OR $8)
  RETURNING id
`;
exports.excluirSql1 = () =>
  "DELETE FROM tarefas WHERE id = $1 AND (criado_por=$2 OR $3) RETURNING id";
exports.atualizarStatusAlunoSql1 = () =>
  `
  UPDATE tarefas_alunos
  SET status = $1, data_entrega = CASE
  WHEN $1 = 'CONCLUIDA' THEN
  CURRENT_TIMESTAMP
  ELSE data_entrega END
  WHERE tarefa_id = $2 AND aluno_id = $3 AND EXISTS (
    SELECT 1
    FROM tarefas t
    WHERE t.id = tarefa_id AND (t.criado_por = $4 OR $5))
  RETURNING id
`;
exports.estatisticasSql1 = (scoped = false) => `
  SELECT COUNT(*) as total, COUNT(CASE
    WHEN status = 'ATIVA' THEN
    1 END) as ativas, COUNT(CASE
    WHEN data_entrega < CURRENT_DATE AND status = 'ATIVA' THEN
    1 END) as atrasadas, COUNT(CASE
    WHEN prioridade = 'ALTA' AND status = 'ATIVA' THEN
    1 END) as prioridade_alta
  FROM tarefas
  ${scoped ? "WHERE turma = ANY($1::text[])" : ""}
`;
