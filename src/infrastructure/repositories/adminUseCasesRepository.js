// Parameterized persistence for adminUseCases.js; the application coordinates transactions.
const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.listarUsuariosSql1 = () =>
  "SELECT id, nome, email, cargo, status FROM usuarios ORDER BY nome ASC";
exports.adicionarUsuarioSql1 = () =>
  "INSERT INTO usuarios (nome, email, senha, cargo, status) VALUES ($1, $2, $3, $4, $5)";
exports.atualizarUsuarioSql1 = () =>
  "SELECT cargo, status FROM usuarios WHERE id = $1";
exports.atualizarUsuarioSql2 = () =>
  "UPDATE usuarios SET nome=$1, email=$2, cargo=$3, status=$4 WHERE id=$5";
exports.atualizarUsuarioSql3 = () =>
  `DELETE FROM web_sessions WHERE sess->>'userId' = $1`;
exports.deletarUsuarioSql1 = () => "BEGIN";
exports.deletarUsuarioSql2 = () =>
  "SELECT id, cargo, status FROM usuarios WHERE id = $1 FOR UPDATE";
exports.deletarUsuarioSql3 = () => "ROLLBACK";
exports.deletarUsuarioSql4 = () =>
  "SELECT COUNT(*) FROM usuarios WHERE cargo = 'Admin' AND status = 'ATIVO'";
exports.deletarUsuarioSql5 = () => "ROLLBACK";
exports.deletarUsuarioSql6 = () =>
  "DELETE FROM web_sessions WHERE sess->>'userId' = $1";
exports.deletarUsuarioSql7 = () => "DELETE FROM usuarios WHERE id = $1";
exports.deletarUsuarioSql8 = () => "COMMIT";
exports.deletarUsuarioSql9 = () => "ROLLBACK";
exports.listarSolicitacoesSenhaSql1 = () => `
            SELECT 
                s.*,
                u.nome
            FROM solicitacoes_senha s
            JOIN usuarios u ON s.usuario_id = u.id
            WHERE s.status = 'PENDENTE'
            ORDER BY s.data_solicitacao DESC
        `;
exports.aprovarSolicitacaoSenhaSql1 = () => "BEGIN";
exports.aprovarSolicitacaoSenhaSql2 = () =>
  "SELECT id, usuario_id FROM solicitacoes_senha WHERE id = $1 AND status = $2 FOR UPDATE";
exports.aprovarSolicitacaoSenhaSql3 = () => "ROLLBACK";
exports.aprovarSolicitacaoSenhaSql4 = () =>
  "SELECT id FROM usuarios WHERE id = $1 FOR UPDATE";
exports.aprovarSolicitacaoSenhaSql5 = () => "ROLLBACK";
exports.aprovarSolicitacaoSenhaSql6 = () =>
  "UPDATE usuarios SET senha = $1 WHERE id = $2";
exports.aprovarSolicitacaoSenhaSql7 = () =>
  `DELETE FROM web_sessions WHERE sess->>'userId' = $1`;
exports.aprovarSolicitacaoSenhaSql8 = () =>
  `UPDATE solicitacoes_senha SET status = 'APROVADA', data_resposta = CURRENT_TIMESTAMP, respondido_por = $1 WHERE id = $2`;
exports.aprovarSolicitacaoSenhaSql9 = () => "COMMIT";
exports.aprovarSolicitacaoSenhaSql10 = () => "ROLLBACK";
exports.rejeitarSolicitacaoSenhaSql1 = () =>
  "SELECT * FROM solicitacoes_senha WHERE id = $1 AND status = $2";
exports.rejeitarSolicitacaoSenhaSql2 = () => `UPDATE solicitacoes_senha 
             SET status = 'REJEITADA', data_resposta = CURRENT_TIMESTAMP, respondido_por = $1 
             WHERE id = $2`;
