const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.createConversationSql1 = (part0) =>
  `
  INSERT INTO ia_conversas(${part0}, titulo)
  VALUES ($1, $2)
  RETURNING id, titulo, fixado, data_criacao, data_atualizacao
`;
exports.findConversationSql1 = (part0) =>
  `SELECT id, titulo FROM ia_conversas WHERE id = $1 AND ${part0} = $2`;
exports.saveMessageSql1 = () =>
  "INSERT INTO ia_mensagens (conversa_id, papel, conteudo) VALUES ($1, $2, $3)";
exports.saveMessageSql2 = () =>
  "UPDATE ia_conversas SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = $1";
exports.updateConversationTitleSql1 = () =>
  `
  UPDATE ia_conversas
  SET titulo = CASE
  WHEN titulo = 'Nova conversa' THEN
  $1
  ELSE titulo END
  WHERE id = $2
`;
exports.detectGradeActionSql1 = () =>
  "SELECT id, nome FROM alunos WHERE LOWER(nome) = LOWER($1) LIMIT 1";
exports.detectGradeActionSql2 = () =>
  "SELECT id, nome FROM competencias WHERE LOWER(nome) = LOWER($1) LIMIT 1";
exports.getConversationHistorySql1 = () =>
  `
  SELECT papel AS role, conteudo AS text
  FROM ia_mensagens
  WHERE conversa_id = $1
  ORDER BY data_criacao DESC LIMIT 8
`;
exports.historySql1 = (part0) =>
  `
  SELECT id, titulo, fixado, data_criacao, data_atualizacao
  FROM ia_conversas
  WHERE ${part0} = $1
  ORDER BY fixado DESC, data_atualizacao DESC LIMIT 50
`;
exports.historySql2 = () =>
  `
  SELECT conversa_id, papel AS role, conteudo AS text
  FROM ia_mensagens
  WHERE conversa_id = ANY($1::int [ ])
  ORDER BY data_criacao ASC
`;
exports.getStudentContextSql1 = () =>
  "SELECT nome, ano_escolar, idade, presenca, nota, nivel FROM alunos WHERE id = $1";
exports.getStudentContextSql2 = () => `
  SELECT c.nome, c.categoria, ac.nota, ac.observacoes, TO_CHAR(ac.data_registro,
    'DD/MM/YYYY') AS data
  FROM aluno_competencias ac
  JOIN competencias c ON c.id = ac.competencia_id
  WHERE ac.aluno_id = $1
  ORDER BY ac.data_registro DESC LIMIT 80
`;
exports.getStudentContextSql3 = () => `
  SELECT t.titulo, t.descricao, t.data_entrega, t.competencia_id,
  ta.status, ta.nota, ta.feedback
  FROM tarefas_alunos ta
  JOIN tarefas t ON t.id = ta.tarefa_id
  WHERE ta.aluno_id = $1
  ORDER BY t.data_entrega DESC NULLS LAST LIMIT 40
`;
exports.teacherChatSql1 = () => "update_grade";
exports.teacherChatSql2 = () => `
  SELECT a.id, a.nome, a.ano_escolar, a.presenca, a.nota, a.nivel,
  COALESCE(json_agg(json_build_object('nome', c.nome, 'nota',
        ac.nota, 'observacoes', ac.observacoes)) FILTER(
      WHERE c.id IS NOT NULL), '[]') AS competencias
  FROM alunos a
  LEFT
  JOIN aluno_competencias ac ON ac.aluno_id = a.id
  LEFT
  JOIN competencias c ON c.id = ac.competencia_id
  GROUP BY a.id
  ORDER BY a.nome LIMIT 200
`;
exports.teacherChatSql3 = () =>
  "SELECT id, nome, categoria, descricao FROM competencias ORDER BY nome";
exports.teacherChatSql4 = () => `
  SELECT t.titulo, t.turma, t.data_entrega, ta.status, ta.nota,
  ta.feedback
  FROM tarefas t
  JOIN tarefas_alunos ta ON ta.tarefa_id = t.id
  ORDER BY t.data_entrega DESC NULLS LAST LIMIT 300
`;
exports.updateGradeSql1 = () => "BEGIN";
exports.updateGradeSql2 = () => "SELECT id FROM alunos WHERE id=$1 FOR UPDATE";
exports.updateGradeSql3 = () =>
  `
  SELECT id, nota
  FROM aluno_competencias
  WHERE aluno_id = $1 AND competencia_id = $2
  ORDER BY data_registro DESC, id DESC LIMIT 1 FOR UPDATE
`;
exports.updateGradeSql4 = () =>
  `
  UPDATE aluno_competencias
  SET nota = $1, observacoes = COALESCE(observacoes,
    'Alterado pelo professor via IA')
  WHERE id = $2
`;
exports.updateGradeSql5 = () =>
  `
  INSERT INTO aluno_competencias(aluno_id, competencia_id,
    nota, observacoes)
  VALUES ($1, $2, $3, $4)
`;
exports.updateGradeSql6 = () =>
  `
  UPDATE alunos
  SET nota = COALESCE((
      SELECT AVG(nota)
      FROM aluno_competencias
      WHERE aluno_id = $1), 0)
  WHERE id = $1
`;
exports.updateGradeSql7 = () =>
  `
  INSERT INTO ia_auditoria_notas(usuario_id, aluno_id, competencia_id,
    nota_anterior, nota_nova)
  VALUES ($1, $2, $3, $4, $5)
`;
exports.updateGradeSql8 = () => "COMMIT";
exports.updateGradeSql9 = () => "ROLLBACK";
exports.updateConversationSql1 = (part0) =>
  `DELETE FROM ia_conversas WHERE id = $1 AND ${part0} = $2 RETURNING id`;
exports.updateConversationSql2 = (part0) =>
  `
  UPDATE ia_conversas
  SET fixado = NOT fixado
  WHERE id = $1 AND ${part0} = $2
  RETURNING id, fixado
`;
exports.updateConversationSql3 = (part0) =>
  `
  UPDATE ia_conversas
  SET titulo = $1
  WHERE id = $2 AND ${part0} = $3
  RETURNING id, titulo
`;
