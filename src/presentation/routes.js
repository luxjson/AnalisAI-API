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

router.get("/perfil-pedagogico", checkAuth, rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "pedagogical-profile-read" }), execute(pedagogicalController.getProfile));
router.patch("/perfil-pedagogico", checkAuth, rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: "pedagogical-profile-write" }), execute(pedagogicalController.saveProfile));
router.get("/frequencia", checkAuth, rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: "attendance-read" }), execute(pedagogicalController.getAttendance));
router.post("/frequencia", checkAuth, rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: "attendance-write" }), execute(pedagogicalController.saveAttendance));
router.get("/alunos/:id/relatorio.pdf", checkAnyAuth, rateLimit({ windowMs: 60 * 1000, max: 15, keyPrefix: "student-report-pdf" }), execute(pedagogicalController.studentReportPdf));
router.get("/relatorios/solicitacoes", checkAuth, rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "report-requests-read" }), execute(pedagogicalController.getReportRequests));
router.post("/relatorios/solicitacoes", checkAuth, rateLimit({ windowMs: 60 * 1000, max: 15, keyPrefix: "report-requests-write" }), execute(pedagogicalController.createReportRequest));
router.patch("/relatorios/solicitacoes/:id", checkAuth, rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: "report-requests-update" }), execute(pedagogicalController.updateReportRequest));

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
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-avaliacoes" }),
  checkAssignedClass,
  execute(professorController.adicionarCompetencia),
);
router.patch(
  "/alunos/presenca",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-patch-alunos-presenca" }),
  checkAssignedClass,
  execute(professorController.atualizarPresenca),
);
router.post("/alunos", checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-alunos" }), checkAssignedClass, execute(professorController.addAluno));
router.delete(
  "/admin/dados-pedagogicos",
  checkAuth,
  checkAdmin,
  execute(professorController.eraseAll),
);
router.post(
  "/alunos/importacoes",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-alunos-importacoes" }),
  checkAssignedClass,
  execute(professorController.importarDados),
);
router.post(
  "/alunos/importacoes/completas",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-alunos-importacoes-completas" }),
  checkAssignedClass,
  execute(professorController.importarDadosCompletos),
);
router.get(
  "/alunos/importacoes/modelo",
  checkAuth,
  execute(professorController.baixarModeloImportacao),
);
router.get("/tarefas", checkTeacherOrAdmin, execute(tarefaController.listar));
router.post("/tarefas", checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-tarefas" }), checkAssignedClass, execute(tarefaController.criar));
router.post(
  "/tarefas/avaliacoes",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-tarefas-avaliacoes" }),
  checkAssignedClass,
  execute(tarefaController.avaliarAluno),
);
router.post(
  "/tarefas/devolucoes",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-tarefas-devolucoes" }),
  checkAssignedClass,
  execute(tarefaController.devolverAluno),
);
router.patch(
  "/tarefas/atribuicoes/status",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-patch-tarefas-atribuicoes-status" }),
  checkAssignedClass,
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
  rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: "calendar-event-write" }),
  checkAssignedClass,
  execute(calendarioController.criarEvento),
);
router.post(
  "/calendario/feriados",
  checkAuth,
  checkAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: "admin-holiday-create" }),
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
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "admin-users-read" }),
  execute(adminController.listarUsuarios),
);
router.post(
  "/admin/usuarios",
  checkAuth,
  checkAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: "admin-users-create" }),
  execute(adminController.adicionarUsuario),
);
router.patch(
  "/admin/usuarios/:id",
  checkAuth,
  checkAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: "admin-users-update" }),
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
router.get("/alunos/:id", checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: "scope-get-alunos-id" }), checkAssignedClass, execute(professorController.alunoDados));
router.post(
  "/alunos/:id/redefinicao-senha",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-alunos-id-redefinicao-senha" }),
  checkAssignedClass,
  execute(professorController.gerarSenhaAluno),
);
router.get(
  "/alunos/:id/competencias",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: "scope-get-alunos-id-competencias" }),
  checkAssignedClass,
  execute(professorController.competenciasAluno),
);
router.delete(
  "/avaliacoes/:id",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-delete-avaliacoes-id" }),
  checkAssignedClass,
  execute(professorController.deletarCompetencia),
);
router.delete(
  "/alunos/:id",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-delete-alunos-id" }),
  checkAssignedClass,
  execute(professorController.deleteAluno),
);
router.get("/tarefas/:id", checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: "scope-get-tarefas-id" }), checkAssignedClass, execute(tarefaController.obterDetalhes));
router.patch("/tarefas/:id", checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-patch-tarefas-id" }), checkAssignedClass, execute(tarefaController.editar));
router.delete("/tarefas/:id", checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-delete-tarefas-id" }), checkAssignedClass, execute(tarefaController.excluir));
router.delete(
  "/calendario/eventos/:id",
  checkTeacherOrAdmin,
  execute(calendarioController.deletarEvento),
);
router.delete(
  "/calendario/feriados/:id",
  checkAuth,
  checkAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: "admin-holiday-delete" }),
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
  rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: "admin-users-delete" }),
  execute(adminController.deletarUsuario),
);
router.post(
  "/admin/solicitacoes-senha/:id/aprovacoes",
  checkAuth,
  checkAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: "admin-password-approve" }),
  execute(adminController.aprovarSolicitacaoSenha),
);
router.post(
  "/admin/solicitacoes-senha/:id/rejeicoes",
  checkAuth,
  checkAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: "admin-password-reject" }),
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
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-ia-alunos-id-analises" }),
  checkAssignedClass,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: "ai-student-analysis" }),
  execute(aiController.analyzeStudent),
);
router.post(
  "/ia/avaliacoes",
  checkTeacherOrAdmin,
  rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: "scope-post-ia-avaliacoes" }),
  checkAssignedClass,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: "ai-grade-update" }),
  execute(aiController.updateGrade),
);
module.exports = router;
