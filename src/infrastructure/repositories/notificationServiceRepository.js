// Parameterized persistence for notificationService.js; the application coordinates transactions.
const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.criarNotificacaoSql1 =
  () => `INSERT INTO notificacoes (usuario_id, aluno_id, tipo, titulo, mensagem, link, icone, cor) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
