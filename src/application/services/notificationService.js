const repository = require("../../infrastructure/repositories/notificationServiceRepository.js");
async function criarNotificacao(
  tipo,
  usuarioId,
  alunoId,
  titulo,
  mensagem,
  link,
  icone = "fas fa-bell",
  cor = "#ff0101",
) {
  try {
    await repository.query(repository.criarNotificacaoSql1(), [
      usuarioId || null,
      alunoId || null,
      tipo,
      titulo,
      mensagem,
      link,
      icone,
      cor,
    ]);
  } catch (err) {
    console.error("Erro ao criar notificação:", err);
  }
}
module.exports = {
  criarNotificacao,
};
