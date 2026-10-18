const repository = require("../../infrastructure/repositories/spreadsheetUseCasesRepository.js");
const { exportWorkbook } = require("../services/spreadsheetService");
const { Worker } = require("node:worker_threads");
const path = require("node:path");
const { validateFile } = require("../../domain/fileValidation");
exports.preview = async (command, outcome) => {
  try {
    const file = command.attachment;
    if (!file || !/\.(xlsx|xls|csv)$/i.test(file.originalname))
      return outcome.code(400).data({
        error: "Envie uma planilha XLSX, XLS ou CSV.",
      });
    if (!validateFile(file))
      return outcome.code(400).data({
        error: "Assinatura do arquivo inválida.",
      });
    if (
      !require("../../domain/archiveLimits").spreadsheetArchiveAllowed(
        file.buffer,
      )
    )
      return outcome.code(400).data({
        error: "Arquivo compactado excede o limite permitido.",
      });
    const rows = await new Promise((resolve, reject) => {
      const worker = new Worker(
        path.join(__dirname, "../../infrastructure/spreadsheetWorker.js"),
        {
          workerData: Buffer.from(file.buffer),
          resourceLimits: {
            maxOldGenerationSizeMb: 128,
            maxYoungGenerationSizeMb: 32,
          },
        },
      );
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Planilha excedeu o tempo permitido."));
      }, 10000);
      worker.once("message", (data) => {
        clearTimeout(timer);
        worker.terminate();
        data.error ? reject(new Error(data.error)) : resolve(data.alunos);
      });
      worker.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0)
          reject(new Error("Não foi possível processar a planilha."));
      });
    });
    return outcome.data({
      alunos: rows,
    });
  } catch (error) {
    return outcome.code(400).data({
      error:
        error.message === "Planilha excedeu o tempo permitido."
          ? error.message
          : "Planilha inválida. Use o modelo e confira os campos obrigatórios.",
    });
  }
};
exports.export = async (command, outcome) => {
  const scoped = command.session.userCargo === "Professor";
  let classes = null;
  if (scoped) {
    const assigned = await repository.query(
      "SELECT turma FROM professor_turmas WHERE professor_id = $1",
      [command.session.userId],
    );
    classes = assigned.rows.map((row) => row.turma);
  }
  const result = scoped
    ? await repository.query(repository.exportSql1(true), [classes])
    : await repository.query(repository.exportSql1());
  const rows = result.rows.map((row) => ({
    ...row,
    presenca:
      row.presenca_calculada == null ? null : Number(row.presenca_calculada),
  }));
  outcome.header(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  outcome.header(
    "Content-Disposition",
    'attachment; filename="Relatorio_Completo_AnalisAI.xlsx"',
  );
  return outcome.binary(await exportWorkbook(rows));
};
