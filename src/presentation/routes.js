const express = require("express");
const router = express.Router();
const execute = require("./execute");
const {
  checkAuth,
  checkAlunoAuth,
  checkAnyAuth,
  checkAdmin,
  checkTeacherOrAdmin,
  checkAssignedClass,
} = require("./middlewares/auth");
const { rateLimit } = require("./middlewares/security");
const upload = require("./middlewares/upload");
const authController = require("../application/useCases/authUseCases");
const professorController = require("../application/useCases/professorUseCases");
const alunoController = require("../application/useCases/alunoUseCases");
const tarefaController = require("../application/useCases/tarefaUseCases");
const calendarioController = require("../application/useCases/calendarioUseCases");
const adminController = require("../application/useCases/adminUseCases");
const apiController = require("../application/useCases/apiUseCases");
const aiController = require("../application/useCases/aiUseCases");
const pedagogicalController = require("../application/useCases/pedagogicalUseCases");

router.get("/perfil-pedagogico", checkAuth, execute(pedagogicalController.getProfile));
router.patch("/perfil-pedagogico", checkAuth, execute(pedagogicalController.saveProfile));
router.get("/frequencia", checkAuth, execute(pedagogicalController.getAttendance));
router.post("/frequencia", checkAuth, execute(pedagogicalController.saveAttendance));
router.get("/alunos/:id/relatorio.pdf", checkAnyAuth, execute(pedagogicalController.studentReportPdf));
router.get("/relatorios/solicitacoes", checkAuth, execute(pedagogicalController.getReportRequests));
router.post("/relatorios/solicitacoes", checkAuth, execute(pedagogicalController.createReportRequest));
router.patch("/relatorios/solicitacoes/:id", checkAuth, execute(pedagogicalController.updateReportRequest));

router.post("/auth/logout", execute(authController.logout));
router.get(
  "/professores/painel",
  checkAuth,
  execute(professorController.dashboard),
);
router.get("/professores/ia", checkTeacherOrAdmin, execute(aiController.teacherPage));
router.get("/alunos", checkTeacherOrAdmin, execute(professorController.editAlunos));
router.get(
  "/professores/estatisticas",
  checkAuth,
  execute(professorController.graficos),
);
router.get("/equipe", execute(professorController.equipe));
router.patch(
  "/professores/senha",
  checkAuth,
  execute(professorController.alterarSenha),
);
router.post(
  "/avaliacoes",
  checkTeacherOrAdmin,
  checkAssignedClass,
  execute(professorController.adicionarCompetencia),
);
router.patch(
  "/alunos/presenca",
  checkTeacherOrAdmin,
  checkAssignedClass,
  execute(professorController.atualizarPresenca),
);
router.post("/alunos", checkTeacherOrAdmin, checkAssignedClass, execute(professorController.addAluno));
router.delete(
  "/admin/dados-pedagogicos",
  checkAuth,
  checkAdmin,
  execute(professorController.eraseAll),
);
router.post(
  "/alunos/importacoes",
  checkTeacherOrAdmin,
  checkAssignedClass,
  execute(professorController.importarDados),
);
router.post(
  "/alunos/importacoes/completas",
  checkTeacherOrAdmin,
  checkAssignedClass,
  execute(professorController.importarDadosCompletos),
);
router.get(
  "/alunos/importacoes/modelo",
  checkAuth,
  execute(professorController.baixarModeloImportacao),
);
router.get("/tarefas", checkTeacherOrAdmin, execute(tarefaController.listar));
router.post("/tarefas", checkTeacherOrAdmin, checkAssignedClass, execute(tarefaController.criar));
router.post(
  "/tarefas/avaliacoes",
  checkTeacherOrAdmin,
  execute(tarefaController.avaliarAluno),
);
router.post(
  "/tarefas/devolucoes",
  checkTeacherOrAdmin,
  execute(tarefaController.devolverAluno),
);
router.patch(
  "/tarefas/atribuicoes/status",
  checkTeacherOrAdmin,
  execute(tarefaController.atualizarStatusAluno),
);
router.get(
  "/tarefas/estatisticas",
  checkTeacherOrAdmin,
  execute(tarefaController.estatisticas),
);
router.get("/calendario", checkAuth, execute(calendarioController.listar));
router.post(
  "/calendario/eventos",
  checkTeacherOrAdmin,
  execute(calendarioController.criarEvento),
);
router.post(
  "/calendario/feriados",
  checkTeacherOrAdmin,
  execute(calendarioController.criarFeriado),
);
router.get(
  "/calendario/mes",
  checkAuth,
  execute(calendarioController.dadosMes),
);
router.get(
  "/estudante/painel",
  checkAlunoAuth,
  execute(alunoController.dashboard),
);
router.get(
  "/estudante/competencias",
  checkAlunoAuth,
  execute(alunoController.competencias),
);
router.get(
  "/estudante/evolucao",
  checkAlunoAuth,
  execute(alunoController.evolucao),
);
router.patch(
  "/estudante/senha",
  checkAlunoAuth,
  execute(alunoController.alterarSenha),
);
router.get(
  "/estudante/tarefas",
  checkAlunoAuth,
  execute(alunoController.tarefas),
);
router.get(
  "/estudante/grafico",
  checkAlunoAuth,
  execute(alunoController.apiDadosGrafico),
);
router.get(
  "/estudante/ranking",
  checkAlunoAuth,
  execute(alunoController.apiRankingComparativo),
);
router.get("/estudante/ia", checkAlunoAuth, execute(aiController.studentPage));
router.get(
  "/admin/usuarios",
  checkAuth,
  checkAdmin,
  execute(adminController.listarUsuarios),
);
router.post(
  "/admin/usuarios",
  checkAuth,
  checkAdmin,
  execute(adminController.adicionarUsuario),
);
router.patch(
  "/admin/usuarios/:id",
  checkAuth,
  checkAdmin,
  execute(adminController.atualizarUsuario),
);
router.get(
  "/admin/solicitacoes-senha",
  checkAuth,
  checkAdmin,
  execute(adminController.listarSolicitacoesSenha),
);
router.post(
  "/admin/diagnosticos",
  checkAuth,
  checkAdmin,
  execute(adminController.runCheckup),
);
router.post(
  "/admin/reparos",
  checkAuth,
  checkAdmin,
  execute(adminController.executeRepair),
);
router.get(
  "/admin/backups",
  checkAuth,
  checkAdmin,
  execute(adminController.getBackupInfo),
);
router.post(
  "/admin/backups",
  checkAuth,
  checkAdmin,
  execute(adminController.triggerBackup),
);
router.get("/conta", checkAnyAuth, execute(apiController.getConta));
router.get(
  "/notificacoes",
  checkAnyAuth,
  execute(apiController.getNotificacoes),
);
router.patch(
  "/notificacoes",
  checkAnyAuth,
  execute(apiController.marcarTodasNotificacoesLidas),
);
router.get(
  "/preferencias/notificacoes",
  checkAnyAuth,
  execute(apiController.getConfiguracoesNotificacoes),
);
router.patch(
  "/preferencias/notificacoes",
  checkAnyAuth,
  execute(apiController.saveConfiguracoesNotificacoes),
);
router.get("/alunos/busca", checkTeacherOrAdmin, execute(apiController.buscarAlunos));
router.get("/health", execute(apiController.healthCheck));
router.get("/ia/conversas", checkAnyAuth, execute(aiController.history));
router.post(
  "/auth/professor",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: "login-professor",
  }),
  execute(authController.loginProfessor),
);
router.post(
  "/auth/aluno",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "login-aluno" }),
  execute(authController.loginAluno),
);
router.post(
  "/auth/solicitacoes-senha",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: "forgot-password" }),
  execute(authController.solicitarRedefinicaoSenha),
);
const spreadsheets = require("../application/useCases/spreadsheetUseCases");
router.post(
  "/alunos/importacoes/preview",
  checkTeacherOrAdmin,
  upload.single("arquivo"),
  execute(spreadsheets.preview),
);
router.get("/alunos/exportacoes", checkTeacherOrAdmin, execute(spreadsheets.export));
router.get("/alunos/:id", checkTeacherOrAdmin, checkAssignedClass, execute(professorController.alunoDados));
router.post(
  "/alunos/:id/redefinicao-senha",
  checkTeacherOrAdmin,
  checkAssignedClass,
  execute(professorController.gerarSenhaAluno),
);
router.get(
  "/alunos/:id/competencias",
  checkTeacherOrAdmin,
  checkAssignedClass,
  execute(professorController.competenciasAluno),
);
router.delete(
  "/avaliacoes/:id",
  checkTeacherOrAdmin,
  checkAssignedClass,
  execute(professorController.deletarCompetencia),
);
router.delete(
  "/alunos/:id",
  checkTeacherOrAdmin,
  checkAssignedClass,
  execute(professorController.deleteAluno),
);
router.get("/tarefas/:id", checkTeacherOrAdmin, checkAssignedClass, execute(tarefaController.obterDetalhes));
router.patch("/tarefas/:id", checkTeacherOrAdmin, checkAssignedClass, execute(tarefaController.editar));
router.delete("/tarefas/:id", checkTeacherOrAdmin, checkAssignedClass, execute(tarefaController.excluir));
router.delete(
  "/calendario/eventos/:id",
  checkTeacherOrAdmin,
  execute(calendarioController.deletarEvento),
);
router.delete(
  "/calendario/feriados/:id",
  checkTeacherOrAdmin,
  execute(calendarioController.deletarFeriado),
);
router.post(
  "/estudante/atribuicoes/:id/entregas",
  checkAlunoAuth,
  upload.single("arquivo"),
  execute(alunoController.enviarTarefa),
);
router.delete(
  "/admin/usuarios/:id",
  checkAuth,
  checkAdmin,
  execute(adminController.deletarUsuario),
);
router.post(
  "/admin/solicitacoes-senha/:id/aprovacoes",
  checkAuth,
  checkAdmin,
  execute(adminController.aprovarSolicitacaoSenha),
);
router.post(
  "/admin/solicitacoes-senha/:id/rejeicoes",
  checkAuth,
  checkAdmin,
  execute(adminController.rejeitarSolicitacaoSenha),
);
router.post(
  "/admin/reauth",
  checkAuth,
  checkAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 5, keyPrefix: "checkup-password" }),
  execute(adminController.verifyDeletePassword),
);
router.get(
  "/admin/backups/:filename",
  checkAuth,
  checkAdmin,
  execute(adminController.downloadBackupFile),
);
router.patch(
  "/notificacoes/:id",
  checkAnyAuth,
  execute(apiController.marcarNotificacaoLida),
);
router.get("/auth/csrf", (req, res) =>
  res.json({ csrfToken: req.session.csrfToken }),
);
router.patch(
  "/ia/conversas/:id",
  checkAnyAuth,
  rateLimit({ windowMs: 60 * 1000, max: 40, keyPrefix: "ai-history-edit" }),
  execute(aiController.updateConversation),
);
router.post(
  "/ia/estudante/mensagens",
  checkAlunoAuth,
  rateLimit({ windowMs: 60 * 1000, max: 12, keyPrefix: "ai-student" }),
  execute(aiController.studentChat),
);
router.post(
  "/ia/professor/mensagens",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 12, keyPrefix: "ai-teacher" }),
  execute(aiController.teacherChat),
);
router.post(
  "/ia/alunos/:id/analises",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: "ai-student-analysis" }),
  execute(aiController.analyzeStudent),
);
router.post(
  "/ia/avaliacoes",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: "ai-grade-update" }),
  execute(aiController.updateGrade),
);
module.exports = router;
