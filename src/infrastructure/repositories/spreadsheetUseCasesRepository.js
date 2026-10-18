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
exports.exportSql1 = (scoped = false) =>
  `
  SELECT a.*, ${annualAttendance} AS presenca_calculada, COALESCE(json_agg(json_build_object('nome', c.nome,
        'nota', ac.nota, 'observacoes', ac.observacoes)
      ORDER BY ac.data_registro) FILTER(
      WHERE ac.id IS NOT NULL), '[]'::json) competencias
  FROM alunos a
  LEFT
  JOIN aluno_competencias ac ON ac.aluno_id = a.id
  LEFT
  JOIN competencias c ON c.id = ac.competencia_id
  ${scoped ? "WHERE a.ano_escolar = ANY($1::text[])" : ""}
  GROUP BY a.id
  ORDER BY a.nome
`;
