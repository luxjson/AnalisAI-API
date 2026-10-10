// Parameterized persistence for professorUseCases.js; the application coordinates transactions.
const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.dashboardSql1 = () => `
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'nota', ac.nota
                            )
                        )
                        FROM aluno_competencias ac
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
            ORDER BY a.nome ASC
        `;
exports.dashboardSql2 = () => `
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `;
exports.dashboardSql3 = () => `
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            LEFT JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar LIKE '%MÉDIO%'
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `;
exports.dashboardSql4 = () => `
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            LEFT JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar LIKE '%FUNDAMENTAL%'
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `;
exports.editAlunosSql1 = () => `
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', nd.id,
                                'titulo', nd.titulo,
                                'descricao', nd.descricao,
                                'valor', nd.valor,
                                'data_criacao', nd.data_criacao
                            ) ORDER BY nd.id ASC
                        )
                        FROM notas_detalhadas nd
                        WHERE nd.aluno_id = a.id
                    ), 
                    '[]'::json
                ) as notas_individuais,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', ac.id,
                                'competencia_id', ac.competencia_id,
                                'nome', c.nome,
                                'descricao', c.descricao,
                                'categoria', c.categoria,
                                'nota', ac.nota,
                                'observacoes', ac.observacoes,
                                'data_registro', ac.data_registro
                            ) ORDER BY ac.id ASC
                        )
                        FROM aluno_competencias ac
                        JOIN competencias c ON ac.competencia_id = c.id
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
            ORDER BY a.id ASC
        `;
exports.editAlunosSql2 = () => `
            SELECT id, nome, descricao, categoria
            FROM competencias 
            ORDER BY id ASC
        `;
exports.graficosSql1 = () => `
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'nota', ac.nota
                            )
                        )
                        FROM aluno_competencias ac
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
        `;
exports.alterarSenhaSql1 = () => "SELECT senha FROM usuarios WHERE id = $1";
exports.alterarSenhaSql2 = () => "UPDATE usuarios SET senha = $1 WHERE id = $2";
exports.alterarSenhaSql3 = () =>
  "DELETE FROM web_sessions WHERE sess->>'userId'=$1";
exports.alunoDadosSql1 = () => `
            SELECT 
                a.id,
                a.nome,
                a.presenca,
                al.email,
                al.matricula
            FROM alunos a
            LEFT JOIN alunos_login al ON a.id = al.aluno_id
            WHERE a.id = $1
        `;
exports.gerarSenhaAlunoSql1 = () =>
  "UPDATE alunos_login SET senha = $1 WHERE aluno_id = $2 RETURNING email, matricula";
exports.gerarSenhaAlunoSql2 = () =>
  "DELETE FROM web_sessions WHERE sess->'aluno'->>'id' = $1";
exports.competenciasAlunoSql1 = () => `
            SELECT 
                ac.*, 
                c.nome, 
                c.descricao as competencia_desc,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `;
exports.adicionarCompetenciaSql1 = () =>
  "INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes) VALUES ($1, $2, $3, $4)";
exports.deletarCompetenciaSql1 = () =>
  "DELETE FROM aluno_competencias WHERE id = $1";
exports.atualizarPresencaSql1 = () =>
  "UPDATE alunos SET presenca = $1 WHERE id = $2";
exports.addAlunoSql1 = () => "BEGIN";
exports.addAlunoSql2 = () => "SELECT 1 FROM alunos WHERE nome = $1 LIMIT 1";
exports.addAlunoSql3 = () => "ROLLBACK";
exports.addAlunoSql4 =
  () => `INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel)
       VALUES ($1, $2, $3, 0, 100, 'EM DESENVOLVIMENTO') RETURNING id`;
exports.addAlunoSql5 =
  () => `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status)
       VALUES ($1, $2, $3, $4, $5, 'ATIVO')`;
exports.addAlunoSql6 = () => "COMMIT";
exports.addAlunoSql7 = () => "ROLLBACK";
exports.deleteAlunoSql1 = () => "DELETE FROM alunos WHERE id = $1";
exports.eraseAllSql1 = () => "BEGIN";
exports.eraseAllSql2 = () => "COMMIT";
exports.eraseAllSql3 = () => "ROLLBACK";
exports.processarImportacaoSql1 = () =>
  "SELECT id, nome FROM alunos WHERE nome = ANY($1::text[])";
exports.processarImportacaoSql2 = () => "BEGIN";
exports.processarImportacaoSql3 = () => "SELECT id, nome FROM competencias";
exports.processarImportacaoSql4 =
  () => `INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel)
         VALUES ($1, $2, $3, 0, $4, 'EM DESENVOLVIMENTO') RETURNING id`;
exports.processarImportacaoSql5 =
  () => `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status)
         VALUES ($1, $2, $3, $4, $5, 'ATIVO')`;
exports.processarImportacaoSql6 =
  () => `INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes)
           VALUES ($1, $2, $3, $4)`;
exports.processarImportacaoSql7 = () => "COMMIT";
exports.processarImportacaoSql8 = () => "ROLLBACK";

exports.erasePedagogicalData = async (client) => {
  await client.query(
    "TRUNCATE TABLE tarefas_alunos,tarefas,aluno_competencias,notas_detalhadas,alunos_login,alunos,uploaded_files RESTART IDENTITY CASCADE",
  );
  await client.query("DELETE FROM web_sessions WHERE sess ? 'aluno'");
};
