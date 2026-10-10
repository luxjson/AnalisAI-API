const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.listarSql1 = () =>
  `
  SELECT *
  FROM calendario_eventos
  WHERE data_inicio <= make_date($2::int, $1::int, 1) + INTERVAL '1 month' -
  INTERVAL '1 day' AND COALESCE(data_fim, data_inicio) >= make_date($2::int,
    $1::int, 1)
`;
exports.listarSql2 = () => ` AND ($3 = '' OR turma = $3 OR turma IS NULL)`;
exports.listarSql3 = () => " ORDER BY data_inicio ASC";
exports.listarSql4 = () => exports.dadosMesSql2();
exports.listarSql5 = () =>
  `
  SELECT tipo, COUNT(*) as total, MIN(cor) as cor
  FROM calendario_eventos
  GROUP BY tipo
  ORDER BY total DESC
`;
exports.criarEventoSql1 = () =>
  `
  INSERT INTO calendario_eventos(titulo, descricao, tipo, data_inicio,
    data_fim, turma, cor, criado_por)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;
exports.criarFeriadoSql1 = () =>
  `
  INSERT INTO feriados(nome, data, recorrente)
  VALUES ($1, $2, $3) ON CONFLICT(data, nome) DO NOTHING
`;
exports.deletarEventoSql1 = () =>
  `
  DELETE
  FROM calendario_eventos
  WHERE id = $1 AND (criado_por = $2 OR $3 = true)
  RETURNING id
`;
exports.deletarFeriadoSql1 = () => "DELETE FROM feriados WHERE id = $1";
exports.dadosMesSql1 = () =>
  `
  SELECT *
  FROM calendario_eventos
  WHERE data_inicio <= make_date($2::int, $1::int, 1) + INTERVAL '1 month' -
  INTERVAL '1 day' AND COALESCE(data_fim, data_inicio) >= make_date($2::int,
    $1::int, 1) AND ($3 = '' OR turma = $3 OR turma IS NULL)
  ORDER BY data_inicio ASC
`;
exports.dadosMesSql2 = () =>
  `
  SELECT id, nome, recorrente, CASE
  WHEN recorrente THEN
  (make_date($2::int, $1::int, 1) +(EXTRACT(DAY
        FROM data)::int - 1) * INTERVAL '1 day')::date
  ELSE data END data
  FROM feriados
  WHERE EXTRACT(MONTH
    FROM data) = $1 AND (EXTRACT(YEAR
      FROM data) = $2 OR recorrente) AND EXTRACT(DAY
    FROM data) <= EXTRACT(DAY
    FROM make_date($2::int, $1::int, 1) + INTERVAL '1 month' - INTERVAL '1 day')
`;
