const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.diagnoseTableSql1 = () => `
        SELECT COUNT(*) as total FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
    `;
exports.diagnoseTableSql2 = (part0) => `SELECT COUNT(*) as total FROM ${part0}`;
exports.diagnoseTableSql3 = () => `
                SELECT COUNT(*) as count FROM alunos WHERE presenca < 0 OR presenca > 100
            `;
exports.diagnoseTableSql4 = () => `
                SELECT COUNT(*) as count FROM alunos WHERE nota < 0 OR nota > 10
            `;
exports.diagnoseTableSql5 = () => `
                SELECT COUNT(*) as count FROM alunos WHERE idade < 10 OR idade > 20
            `;
exports.diagnoseTableSql6 = () => `
                SELECT COUNT(*) as count FROM alunos a 
                LEFT JOIN alunos_login al ON a.id = al.aluno_id 
                WHERE al.id IS NULL
            `;
exports.diagnoseTableSql7 = () => `
                SELECT COUNT(*) as count FROM alunos_login al 
                LEFT JOIN alunos a ON al.aluno_id = a.id 
                WHERE a.id IS NULL
            `;
exports.diagnoseTableSql8 = () => `
                SELECT COUNT(*) as count FROM (
                    SELECT matricula FROM alunos_login GROUP BY matricula HAVING COUNT(*) > 1
                ) sub
            `;
exports.diagnoseTableSql9 = () => `
                SELECT COUNT(*) as count FROM aluno_competencias ac
                LEFT JOIN alunos a ON ac.aluno_id = a.id
                LEFT JOIN competencias c ON ac.competencia_id = c.id
                WHERE a.id IS NULL OR c.id IS NULL
            `;
exports.diagnoseTableSql10 = () => `
                SELECT COUNT(*) as count FROM aluno_competencias WHERE nota < 0 OR nota > 10
            `;
exports.diagnoseTableSql11 = () => `
                SELECT COUNT(*) as count FROM tarefas t
                LEFT JOIN usuarios u ON t.criado_por = u.id
                WHERE t.criado_por IS NOT NULL AND u.id IS NULL
            `;
exports.diagnoseTableSql12 = () => `
                SELECT COUNT(*) as count FROM tarefas t
                LEFT JOIN competencias c ON t.competencia_id = c.id
                WHERE t.competencia_id IS NOT NULL AND c.id IS NULL
            `;
exports.diagnoseTableSql13 = () => `
                SELECT COUNT(*) as count FROM tarefas_alunos ta
                LEFT JOIN tarefas t ON ta.tarefa_id = t.id
                LEFT JOIN alunos a ON ta.aluno_id = a.id
                WHERE t.id IS NULL OR a.id IS NULL
            `;
exports.diagnoseTableSql14 = () => `
                SELECT COUNT(*) as count FROM tarefas_alunos 
                WHERE nota IS NOT NULL AND (nota < 0 OR nota > 10)
            `;
exports.diagnoseTableSql15 = () => `
                SELECT COUNT(*) as count FROM tarefas_alunos
                WHERE status NOT IN ('PENDENTE', 'ENTREGUE', 'CONCLUIDA', 'DEVOLVIDA', 'ATRASADA')
            `;
exports.diagnoseTableSql16 = () => `
                SELECT COUNT(*) as count FROM usuarios WHERE cargo NOT IN ('Professor', 'Coordenador', 'Admin')
            `;
exports.diagnoseTableSql17 = () => `
                SELECT COUNT(*) as count FROM usuarios WHERE status NOT IN ('ATIVO', 'INATIVO')
            `;
exports.diagnoseTableSql18 = () => `
                SELECT COUNT(*) as count FROM solicitacoes_senha s
                LEFT JOIN usuarios u ON s.usuario_id = u.id
                WHERE u.id IS NULL
            `;
exports.diagnoseTableSql19 = () => `
                SELECT COUNT(*) as count FROM solicitacoes_senha
                WHERE status = 'PENDENTE' AND data_solicitacao < (CURRENT_TIMESTAMP - INTERVAL '30 days')
            `;
exports.diagnoseTableSql20 = () => `
                SELECT COUNT(*) as count FROM notificacoes n
                LEFT JOIN usuarios u ON n.usuario_id = u.id
                LEFT JOIN alunos a ON n.aluno_id = a.id
                WHERE (n.usuario_id IS NOT NULL AND u.id IS NULL)
                   OR (n.aluno_id IS NOT NULL AND a.id IS NULL)
                   OR (n.usuario_id IS NULL AND n.aluno_id IS NULL)
            `;
exports.diagnoseTableSql21 = () => `
                SELECT COUNT(*) as count FROM configuracoes_notificacoes cn
                LEFT JOIN usuarios u ON cn.usuario_id = u.id
                LEFT JOIN alunos a ON cn.aluno_id = a.id
                WHERE (cn.usuario_id IS NOT NULL AND u.id IS NULL)
                   OR (cn.aluno_id IS NOT NULL AND a.id IS NULL)
            `;
exports.diagnoseTableSql22 = () => `
                SELECT COUNT(*) as count FROM ia_conversas c
                LEFT JOIN usuarios u ON c.usuario_id = u.id
                LEFT JOIN alunos a ON c.aluno_id = a.id
                WHERE (c.usuario_id IS NOT NULL AND u.id IS NULL)
                   OR (c.aluno_id IS NOT NULL AND a.id IS NULL)
                   OR (c.usuario_id IS NULL AND c.aluno_id IS NULL)
            `;
exports.diagnoseTableSql23 = () => `
                SELECT COUNT(*) as count FROM ia_mensagens m
                LEFT JOIN ia_conversas c ON m.conversa_id = c.id
                WHERE c.id IS NULL
            `;
exports.repairSystemSql1 = () => "BEGIN";
exports.repairSystemSql2 = () => `
                        UPDATE alunos 
                        SET presenca = CASE WHEN presenca < 0 THEN 0 ELSE 100 END
                        WHERE presenca < 0 OR presenca > 100
                    `;
exports.repairSystemSql3 = () => `
                        UPDATE alunos 
                        SET nota = CASE WHEN nota < 0 THEN 0.0 ELSE 10.0 END
                        WHERE nota < 0 OR nota > 10
                    `;
exports.repairSystemSql4 = () => `
                        UPDATE alunos
                        SET idade = CASE WHEN idade < 10 THEN 10 ELSE 20 END
                        WHERE idade < 10 OR idade > 20
                    `;
exports.repairSystemSql5 = () => `
                        SELECT a.id, a.nome FROM alunos a 
                        LEFT JOIN alunos_login al ON a.id = al.aluno_id 
                        WHERE al.id IS NULL
                    `;
exports.repairSystemSql6 = () => `
                                INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status)
                                VALUES ($1, $2, $3, $4, $5, 'ATIVO')
                                ON CONFLICT DO NOTHING
                            `;
exports.repairSystemSql7 = () => `
                        DELETE FROM alunos_login al
                        WHERE NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = al.aluno_id)
                    `;
exports.repairSystemSql8 = () => `
                        DELETE FROM aluno_competencias ac
                        WHERE NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = ac.aluno_id)
                           OR NOT EXISTS (SELECT 1 FROM competencias c WHERE c.id = ac.competencia_id)
                    `;
exports.repairSystemSql9 = () => `
                        UPDATE aluno_competencias
                        SET nota = CASE WHEN nota < 0 THEN 0.0 ELSE 10.0 END
                        WHERE nota < 0 OR nota > 10
                    `;
exports.repairSystemSql10 = () => `
                        UPDATE tarefas t
                        SET criado_por = NULL
                        WHERE t.criado_por IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = t.criado_por)
                    `;
exports.repairSystemSql11 = () => `
                        UPDATE tarefas t
                        SET competencia_id = NULL
                        WHERE t.competencia_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM competencias c WHERE c.id = t.competencia_id)
                    `;
exports.repairSystemSql12 = () => `
                        DELETE FROM tarefas_alunos ta
                        WHERE NOT EXISTS (SELECT 1 FROM tarefas t WHERE t.id = ta.tarefa_id)
                           OR NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = ta.aluno_id)
                    `;
exports.repairSystemSql13 = () => `
                        UPDATE tarefas_alunos
                        SET nota = CASE WHEN nota < 0 THEN 0.0 ELSE 10.0 END
                        WHERE nota IS NOT NULL AND (nota < 0 OR nota > 10)
                    `;
exports.repairSystemSql14 = () => `
                        UPDATE tarefas_alunos
                        SET status = 'PENDENTE'
                        WHERE status NOT IN ('PENDENTE', 'ENTREGUE', 'CONCLUIDA', 'DEVOLVIDA', 'ATRASADA')
                    `;
exports.repairSystemSql15 = () => `
                        UPDATE usuarios
                        SET cargo = 'Professor'
                        WHERE cargo NOT IN ('Professor', 'Coordenador', 'Admin')
                    `;
exports.repairSystemSql16 = () => `
                        UPDATE usuarios
                        SET status = 'INATIVO'
                        WHERE status NOT IN ('ATIVO', 'INATIVO')
                    `;
exports.repairSystemSql17 = () => `
                        DELETE FROM solicitacoes_senha s
                        WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = s.usuario_id)
                    `;
exports.repairSystemSql18 = () => `
                        UPDATE solicitacoes_senha
                        SET status = 'REJEITADA', data_resposta = CURRENT_TIMESTAMP
                        WHERE status = 'PENDENTE' AND data_solicitacao < (CURRENT_TIMESTAMP - INTERVAL '30 days')
                    `;
exports.repairSystemSql19 = () => `
                        DELETE FROM notificacoes n
                        WHERE (n.usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = n.usuario_id))
                           OR (n.aluno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = n.aluno_id))
                           OR (n.usuario_id IS NULL AND n.aluno_id IS NULL)
                    `;
exports.repairSystemSql20 = () => `
                        DELETE FROM configuracoes_notificacoes cn
                        WHERE (cn.usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = cn.usuario_id))
                           OR (cn.aluno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = cn.aluno_id))
                    `;
exports.repairSystemSql21 = () => `
                        DELETE FROM ia_conversas c
                        WHERE (c.usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = c.usuario_id))
                           OR (c.aluno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = c.aluno_id))
                           OR (c.usuario_id IS NULL AND c.aluno_id IS NULL)
                    `;
exports.repairSystemSql22 = () => `
                        DELETE FROM ia_mensagens m
                        WHERE NOT EXISTS (SELECT 1 FROM ia_conversas c WHERE c.id = m.conversa_id)
                    `;
exports.repairSystemSql23 = () => "COMMIT";
exports.repairSystemSql24 = () => "ROLLBACK";
