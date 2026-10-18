const database = require("../database");

exports.listar = (session) => database.query(
  `SELECT a.id AS aluno_id, a.nome,
          fr.status, fr.observacao,
          COUNT(fr.id) OVER (PARTITION BY a.id) AS periodos_registrados
     FROM alunos a
     LEFT JOIN frequencia_registros fr
       ON fr.aluno_id = a.id
      AND fr.data_aula = $1::date
      AND fr.horario_inicio = $2::time
      AND fr.horario_fim = $3::time
    ORDER BY a.nome ASC`,
  [session.data, session.inicio, session.fim],
);

exports.salvar = async (session, registros, registradoPor) => {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    let rowCount = 0;
    for (const registro of registros) {
      const result = await client.query(
        `INSERT INTO frequencia_registros
           (aluno_id, data_aula, horario_inicio, horario_fim, status, registrado_por)
         VALUES ($1, $2::date, $3::time, $4::time, $5, $6)
         ON CONFLICT (aluno_id, data_aula, horario_inicio, horario_fim)
         DO UPDATE SET status = EXCLUDED.status,
                       registrado_por = EXCLUDED.registrado_por,
                       atualizado_em = CURRENT_TIMESTAMP
         RETURNING id`,
        [Number(registro.aluno_id), session.data, session.inicio, session.fim,
         registro.status, registradoPor],
      );
      rowCount += result.rowCount;
    }
    await client.query("COMMIT");
    return { rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
