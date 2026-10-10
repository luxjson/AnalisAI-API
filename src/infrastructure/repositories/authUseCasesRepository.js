const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.loginSql1 = (part0) =>
  `
  SELECT id, nome, email, senha, matricula, aluno_id, status
  FROM alunos_login
  WHERE ${part0} = $1
`;
exports.loginSql2 = () =>
  "SELECT id,nome,email,senha,cargo,status FROM usuarios WHERE email=$1";
exports.loginSql3 = () => "SELECT id,nome,ano_escolar FROM alunos WHERE id=$1";
exports.loginSql4 = (part0) =>
  `UPDATE ${part0} SET senha=$1 WHERE id=$2 AND senha=$3`;
exports.loginSql5 = (part0) =>
  `
  UPDATE ${part0}
  SET ultimo_acesso = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
  WHERE id = $1
`;
exports.solicitarRedefinicaoSenhaSql1 = () =>
  "SELECT id,nome FROM usuarios WHERE email=$1";
exports.solicitarRedefinicaoSenhaSql2 = () =>
  `
  INSERT INTO solicitacoes_senha(usuario_id, email, token,
    status)
  SELECT $1, $2, $3, 'PENDENTE'
  WHERE NOT EXISTS (
    SELECT 1
    FROM solicitacoes_senha
    WHERE usuario_id = $1 AND status = 'PENDENTE')
`;
exports.solicitarRedefinicaoSenhaSql3 = () =>
  "SELECT id FROM usuarios WHERE cargo='Admin' AND status='ATIVO'";
