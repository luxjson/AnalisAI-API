const database = require("../database");

exports.query = (sql, parameters) => database.query(sql, parameters);
exports.connect = () => database.connect();

exports.profileSql = () => `
  SELECT id, nome, email, cargo, foto_perfil, onboarding_concluido
  FROM usuarios
  WHERE id = $1
  LIMIT 1
`;
exports.profileClassesSql = () => `
  SELECT turma
  FROM professor_turmas
  WHERE professor_id = $1
  ORDER BY turma
`;
exports.saveProfileSql = () => `
  UPDATE usuarios
  SET nome = $1,
      foto_perfil = COALESCE($2, foto_perfil),
      onboarding_concluido = TRUE
  WHERE id = $3
  RETURNING id, nome, email, cargo, onboarding_concluido
`;
exports.deleteClassesSql = () => `
  DELETE FROM professor_turmas
  WHERE professor_id = $1
`;
exports.insertClassSql = () => `
  INSERT INTO professor_turmas (professor_id, turma)
  VALUES ($1, $2)
  ON CONFLICT (professor_id, turma) DO NOTHING
`;
exports.assignedClassesSql = () => `
  SELECT turma
  FROM professor_turmas
  WHERE professor_id = $1 AND turma = $2
  LIMIT 1
`;
exports.teacherClassesSql = () => `
  SELECT turma
  FROM professor_turmas
  WHERE professor_id = $1
`;
exports.attendanceStudentsSql = () => `
  SELECT
    a.id,
    a.nome,
    a.ano_escolar,
    a.presenca,
    hoje.status AS status_registrado,
    hoje.justificativa AS justificativa_registrada,
    COALESCE(ano.total_aulas, 0)::INTEGER AS total_aulas,
    COALESCE(ano.presencas, 0)::INTEGER AS presencas,
    COALESCE(ano.faltas, 0)::INTEGER AS faltas,
    COALESCE(ano.justificadas, 0)::INTEGER AS justificadas,
    COALESCE(ano.dias_registrados, 0)::INTEGER AS dias_registrados,
    CASE WHEN COALESCE(ano.total_aulas, 0) = 0 THEN NULL
      ELSE ROUND(100.0 * ano.presencas / NULLIF(ano.total_aulas, 0))::INTEGER
    END AS frequencia_anual
  FROM alunos a
  LEFT JOIN frequencia_registros hoje
    ON hoje.aluno_id = a.id
   AND hoje.data_aula = $1::DATE
   AND hoje.horario_inicio = $2::TIME
   AND hoje.horario_fim = $3::TIME
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total_aulas,
      COUNT(*) FILTER (WHERE status = 'PRESENTE') AS presencas,
      COUNT(*) FILTER (WHERE status = 'FALTA') AS faltas,
      COUNT(*) FILTER (WHERE status = 'JUSTIFICADA') AS justificadas,
      COUNT(DISTINCT data_aula) AS dias_registrados
    FROM frequencia_registros fr
    WHERE fr.aluno_id = a.id
      AND fr.data_aula >= make_date($4::INTEGER, 1, 1)
      AND fr.data_aula < make_date($4::INTEGER + 1, 1, 1)
  ) ano ON TRUE
  WHERE a.ano_escolar = $5
  ORDER BY a.nome ASC
`;
exports.studentsInClassSql = () => `
  SELECT id
  FROM alunos
  WHERE ano_escolar = $1
  ORDER BY id
`;
exports.upsertAttendanceSql = () => `
  INSERT INTO frequencia_registros
    (aluno_id, turma, data_aula, horario_inicio, horario_fim,
     status, justificativa, registrado_por)
  VALUES ($1, $2, $3::DATE, $4::TIME, $5::TIME, $6, $7, $8)
  ON CONFLICT (aluno_id, data_aula, horario_inicio, horario_fim)
  DO UPDATE SET
    turma = EXCLUDED.turma,
    status = EXCLUDED.status,
    justificativa = EXCLUDED.justificativa,
    registrado_por = EXCLUDED.registrado_por,
    atualizado_em = CURRENT_TIMESTAMP
  RETURNING id
`;
exports.refreshAttendancePercentagesSql = () => `
  UPDATE alunos a
  SET presenca = COALESCE((
    SELECT ROUND(
      100.0 * COUNT(*) FILTER (WHERE fr.status = 'PRESENTE')
      / NULLIF(COUNT(*), 0)
    )::INTEGER
    FROM frequencia_registros fr
    WHERE fr.aluno_id = a.id
      AND fr.data_aula >= make_date($2::INTEGER, 1, 1)
      AND fr.data_aula < make_date($2::INTEGER + 1, 1, 1)
  ), 100)
  WHERE a.id = ANY($1::INTEGER[])
`;
exports.studentReportSql = () => `
  SELECT
    a.id, a.nome, a.ano_escolar, a.idade, a.nota,
    a.presenca, a.nivel, al.matricula
  FROM alunos a
  LEFT JOIN alunos_login al ON al.aluno_id = a.id
  WHERE a.id = $1
  LIMIT 1
`;
exports.studentCompetencesSql = () => `
  SELECT c.nome, c.categoria, ac.nota, ac.observacoes, ac.data_registro
  FROM aluno_competencias ac
  JOIN competencias c ON c.id = ac.competencia_id
  WHERE ac.aluno_id = $1
  ORDER BY ac.data_registro DESC, ac.id DESC
`;
exports.studentAttendanceSql = () => `
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
exports.teachersSql = () => `
  SELECT id, nome, email
  FROM usuarios
  WHERE cargo = 'Professor' AND status = 'ATIVO'
  ORDER BY nome ASC
`;
exports.createReportRequestSql = () => `
  INSERT INTO solicitacoes_relatorio
    (solicitante_id, professor_id, aluno_id, turma, mensagem)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id, solicitante_id, professor_id, aluno_id, turma,
            mensagem, status, data_solicitacao
`;
exports.reportRequestsForCoordinatorSql = () => `
  SELECT sr.*, solicitante.nome AS solicitante_nome,
    professor.nome AS professor_nome, a.nome AS aluno_nome
  FROM solicitacoes_relatorio sr
  JOIN usuarios solicitante ON solicitante.id = sr.solicitante_id
  JOIN usuarios professor ON professor.id = sr.professor_id
  LEFT JOIN alunos a ON a.id = sr.aluno_id
  WHERE sr.solicitante_id = $1
  ORDER BY sr.data_solicitacao DESC
  LIMIT 200
`;
exports.reportRequestsForTeacherSql = () => `
  SELECT sr.*, solicitante.nome AS solicitante_nome,
    professor.nome AS professor_nome, a.nome AS aluno_nome
  FROM solicitacoes_relatorio sr
  JOIN usuarios solicitante ON solicitante.id = sr.solicitante_id
  JOIN usuarios professor ON professor.id = sr.professor_id
  LEFT JOIN alunos a ON a.id = sr.aluno_id
  WHERE sr.professor_id = $1
  ORDER BY CASE sr.status WHEN 'PENDENTE' THEN 0 WHEN 'EM_ANDAMENTO' THEN 1 ELSE 2 END,
    sr.data_solicitacao DESC
  LIMIT 200
`;
exports.reportRequestsForAdminSql = () => `
  SELECT sr.*, solicitante.nome AS solicitante_nome,
    professor.nome AS professor_nome, a.nome AS aluno_nome
  FROM solicitacoes_relatorio sr
  JOIN usuarios solicitante ON solicitante.id = sr.solicitante_id
  JOIN usuarios professor ON professor.id = sr.professor_id
  LEFT JOIN alunos a ON a.id = sr.aluno_id
  ORDER BY sr.data_solicitacao DESC
  LIMIT 500
`;
exports.updateReportRequestSql = () => `
  UPDATE solicitacoes_relatorio
  SET status = $1, resposta = $2, data_atualizacao = CURRENT_TIMESTAMP
  WHERE id = $3 AND professor_id = $4
  RETURNING id, status, resposta, data_atualizacao
`;
exports.updateAnyReportRequestSql = () => `
  UPDATE solicitacoes_relatorio
  SET status = $1, resposta = $2, data_atualizacao = CURRENT_TIMESTAMP
  WHERE id = $3
  RETURNING id, status, resposta, data_atualizacao
`;
exports.notifyReportRequestSql = () => `
  INSERT INTO notificacoes
    (usuario_id, tipo, titulo, mensagem, link, icone, cor)
  VALUES ($1, 'relatorio', $2, $3, '/dashboard/relatorios-pedagogicos',
    'fas fa-file-pdf', '#217346')
`;
