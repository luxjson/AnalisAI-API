const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.exportSql1 = () =>
  `SELECT a.*,COALESCE(json_agg(json_build_object('nome',c.nome,'nota',ac.nota,'observacoes',ac.observacoes) ORDER BY ac.data_registro) FILTER(WHERE ac.id IS NOT NULL),'[]'::json) competencias FROM alunos a LEFT JOIN aluno_competencias ac ON ac.aluno_id=a.id LEFT JOIN competencias c ON c.id=ac.competencia_id GROUP BY a.id ORDER BY a.nome`;
