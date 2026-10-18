const repository = require("../../infrastructure/repositories/professorUseCasesRepository.js");
const path = require("path");
const fs = require("fs");
const passwords = require("../../infrastructure/passwords");
const crypto = require("crypto");
const {
  text,
  personName,
  password,
  integerId,
  numberInRange,
  ALLOWED_YEARS,
  randomPassword,
  normalizeToEmailName,
} = require("../../domain/validation");
async function getAssignedClasses(command) {
  if (command.session.userCargo !== "Professor") return null;
  const result = await repository.query(
    "SELECT turma FROM professor_turmas WHERE professor_id = $1 ORDER BY turma",
    [command.session.userId],
  );
  return result.rows.map((row) => row.turma);
}
async function runScopedQuery(command, query, classes) {
  return classes === null
    ? repository.query(query)
    : repository.query(query, [classes]);
}
exports.dashboard = async (command, outcome) => {
  try {
    const classes = await getAssignedClasses(command);
    const scoped = classes !== null;
    const run = (sql) => runScopedQuery(command, sql, classes);
    const alunosResult = await run(repository.dashboardSql1(scoped));
    const alunosComNivel = alunosResult.rows.map((aluno) => {
      let mediaCompetencias = 0;
      if (aluno.competencias && aluno.competencias.length > 0) {
        const soma = aluno.competencias.reduce(
          (acc, comp) => acc + parseFloat(comp.nota),
          0,
        );
        mediaCompetencias = soma / aluno.competencias.length;
      }
      let nivel = "EM DESENVOLVIMENTO";
      if (mediaCompetencias >= 7 && aluno.presenca >= 75) {
        nivel = "APTO";
      } else if (mediaCompetencias < 5 || aluno.presenca < 50) {
        nivel = "INAPTO";
      }
      return {
        ...aluno,
        nivel,
        media_competencias: mediaCompetencias.toFixed(1),
      };
    });
    const [rankingGeralResult, rankingMedioResult, rankingFundamentalResult] =
      await Promise.all([
        run(repository.dashboardSql2(scoped)),
        run(repository.dashboardSql3(scoped)),
        run(repository.dashboardSql4(scoped)),
      ]);
    const rankingGeral = rankingGeralResult.rows.map((item) => ({
      ...item,
      media: parseFloat(item.media) || 0,
    }));
    const rankingMedio = rankingMedioResult.rows.map((item) => ({
      ...item,
      media: parseFloat(item.media) || 0,
    }));
    const rankingFundamental = rankingFundamentalResult.rows.map((item) => ({
      ...item,
      media: parseFloat(item.media) || 0,
    }));
    outcome.data({
      user: command.session.user,
      alunos: alunosComNivel,
      rankingGeral,
      rankingMedio,
      rankingFundamental,
      userCargo: command.session.userCargo,
      isAdmin: command.session.userCargo === "Admin",
      turmas: classes || [],
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("Falha ao carregar o painel do professor:", err.message);
    command.message("error_msg", "Erro ao carregar dados do dashboard");
    outcome.data({
      user: command.session.user,
      alunos: [],
      rankingGeral: [],
      rankingMedio: [],
      rankingFundamental: [],
      turmas: [],
    });
  }
};
exports.editAlunos = async (command, outcome) => {
  try {
    const classes = await getAssignedClasses(command);
    const scoped = classes !== null;
    const [result, competenciasList] = await Promise.all([
      runScopedQuery(command, repository.editAlunosSql1(scoped), classes),
      repository.query(repository.editAlunosSql2()),
    ]);
    outcome.data({
      alunos: result.rows,
      listaCompetencias: competenciasList.rows,
      user: command.session.user,
      userCargo: command.session.userCargo,
      isAdmin: command.session.userCargo === "Admin",
      turmas: classes || [],
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("Falha ao carregar o editor:", err.message);
    command.message("error_msg", "Não foi possível carregar os dados");
    outcome.complete("/dashboard");
  }
};
exports.graficos = async (command, outcome) => {
  try {
    const classes = await getAssignedClasses(command);
    const scoped = classes !== null;
    const result = await runScopedQuery(
      command,
      repository.graficosSql1(scoped),
      classes,
    );
    const alunos = result.rows;
    let apto = 0;
    let inapto = 0;
    let somaMedio = 0;
    let countMedio = 0;
    let somaFundamental = 0;
    let countFundamental = 0;
    alunos.forEach((aluno) => {
      let mediaCompetencias = 0;
      if (aluno.competencias && aluno.competencias.length > 0) {
        const soma = aluno.competencias.reduce(
          (acc, comp) => acc + parseFloat(comp.nota),
          0,
        );
        mediaCompetencias = soma / aluno.competencias.length;
      }
      if (mediaCompetencias >= 7 && aluno.presenca >= 75) apto++;
      else if (mediaCompetencias < 5 || aluno.presenca < 50) inapto++;
      if (aluno.ano_escolar?.includes("MÉDIO")) {
        somaMedio += mediaCompetencias;
        countMedio++;
      } else if (aluno.ano_escolar?.includes("FUNDAMENTAL")) {
        somaFundamental += mediaCompetencias;
        countFundamental++;
      }
    });
    const stats = {
      total: alunos.length,
      apto,
      inapto,
      mediaMedio: countMedio > 0 ? (somaMedio / countMedio).toFixed(1) : 0,
      mediaFundamental:
        countFundamental > 0
          ? (somaFundamental / countFundamental).toFixed(1)
          : 0,
    };
    outcome.data({
      stats,
      userCargo: command.session.userCargo,
      isAdmin: command.session.userCargo === "Admin",
      user: command.session.user,
      turmas: classes || [],
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("Falha ao carregar gráficos:", err.message);
    command.message("error_msg", "Erro ao carregar gráficos");
    outcome.data({
      stats: {
        total: 0,
        apto: 0,
        inapto: 0,
        mediaMedio: 0,
        mediaFundamental: 0,
      },
      user: command.session.user,
      userCargo: command.session.userCargo,
      isAdmin: command.session.userCargo === "Admin",
      turmas: [],
    });
  }
};
exports.equipe = (command, outcome) => {
  outcome.data({});
};
exports.alterarSenha = async (command, outcome) => {
  const senha_atual =
    typeof command.input.senha_atual === "string"
      ? command.input.senha_atual
      : "";
  const nova_senha = password(command.input.nova_senha);
  const confirmar_senha =
    typeof command.input.confirmar_senha === "string"
      ? command.input.confirmar_senha
      : "";
  try {
    const result = await repository.query(repository.alterarSenhaSql1(), [
      command.session.userId,
    ]);
    if (result.rows.length === 0) {
      command.message("error_msg", "Usuário não encontrado");
      return outcome.complete("/dashboard?settings=account");
    }
    const user = result.rows[0];
    const senhaAtualValida = await passwords.compare(senha_atual, user.senha);
    if (!senhaAtualValida) {
      command.message("error_msg", "Senha atual incorreta");
      return outcome.complete("/dashboard?settings=account");
    }
    if (!nova_senha) {
      command.message(
        "error_msg",
        "A nova senha deve ter entre 12 e 128 caracteres",
      );
      return outcome.complete("/dashboard?settings=account");
    }
    if (nova_senha !== confirmar_senha) {
      command.message("error_msg", "As senhas não coincidem");
      return outcome.complete("/dashboard?settings=account");
    }
    const novaSenhaHash = await passwords.hash(nova_senha);
    await repository.query(repository.alterarSenhaSql2(), [
      novaSenhaHash,
      command.session.userId,
    ]);
    await repository.query(repository.alterarSenhaSql3(), [
      String(command.session.userId),
    ]);
    const oldSessionData = {
      user: command.session.user,
      userStatus: command.session.userStatus,
      userId: command.session.userId,
      userCargo: command.session.userCargo,
    };
    await new Promise((resolve, reject) =>
      command.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    Object.assign(command.session, oldSessionData);
    command.session.csrfToken = crypto.randomBytes(32).toString("hex");
    await new Promise((resolve, reject) =>
      command.session.save((err) => (err ? reject(err) : resolve())),
    );
    command.message("success_msg", "Senha alterada com sucesso!");
    outcome.complete("/dashboard?settings=account");
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    command.message("error_msg", "Erro ao alterar senha");
    outcome.complete("/dashboard?settings=account");
  }
};
exports.alunoDados = async (command, outcome) => {
  try {
    const alunoId = integerId(command.ids.id);
    if (!alunoId)
      return outcome.code(400).data({
        error: "ID de aluno inválido",
      });
    const result = await repository.query(repository.alunoDadosSql1(), [
      alunoId,
    ]);
    if (result.rows.length === 0) {
      return outcome.code(404).data({
        error: "Aluno não encontrado",
      });
    }
    outcome.data(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar dados do aluno:", err);
    outcome.code(500).data({
      error: "Erro ao buscar dados",
    });
  }
};
exports.gerarSenhaAluno = async (command, outcome) => {
  try {
    const alunoId = integerId(command.ids.id);
    if (!alunoId)
      return outcome.code(400).data({
        error: "ID de aluno inválido",
      });
    const senha = randomPassword();
    const senhaHash = await passwords.hash(senha);
    const result = await repository.query(repository.gerarSenhaAlunoSql1(), [
      senhaHash,
      alunoId,
    ]);
    if (result.rows.length === 0)
      return outcome.code(404).data({
        error: "Credenciais do aluno não encontradas",
      });
    await repository.query(repository.gerarSenhaAlunoSql2(), [String(alunoId)]);
    return outcome.data({
      sucesso: true,
      email: result.rows[0].email,
      matricula: result.rows[0].matricula,
      senha,
    });
  } catch (err) {
    console.error("Erro ao gerar senha do aluno:", err);
    outcome.code(500).data({
      error: "Erro ao gerar nova senha",
    });
  }
};
exports.competenciasAluno = async (command, outcome) => {
  const alunoId = integerId(command.ids.id);
  if (!alunoId)
    return outcome.code(400).data({
      error: "ID de aluno inválido",
    });
  try {
    const result = await repository.query(repository.competenciasAlunoSql1(), [
      alunoId,
    ]);
    outcome.data(result.rows);
  } catch (error) {
    console.error("Erro ao buscar competências:", error);
    outcome.code(500).data({
      error: "Erro ao buscar competências",
    });
  }
};
exports.adicionarCompetencia = async (command, outcome) => {
  const aluno_id = integerId(command.input.aluno_id);
  const competencia_id = integerId(command.input.competencia_id);
  const nota = numberInRange(command.input.nota, 0, 10);
  const observacoes = text(command.input.observacoes, 2000) || null;
  if (!aluno_id || !competencia_id || nota === null) {
    command.message(
      "error_msg",
      "Todos os campos obrigatórios devem ser preenchidos",
    );
    return outcome.complete("/dashboard/edit");
  }
  if (nota === null) {
    command.message("error_msg", "A nota deve estar entre 0 e 10");
    return outcome.complete("/dashboard/edit");
  }
  try {
    await repository.query(repository.adicionarCompetenciaSql1(), [
      aluno_id,
      competencia_id,
      nota,
      observacoes || null,
    ]);
    const { criarNotificacao } = require("../services/notificationService");
    await criarNotificacao(
      "competencia",
      null,
      aluno_id,
      "Nova Competência",
      `Uma nova competência foi registrada: ${nota}`,
      `/aluno/competencias`,
      "fas fa-trophy",
      "#217346",
    );
    command.message("success_msg", "Competência adicionada com sucesso!");
    outcome.complete("/dashboard/edit");
  } catch (error) {
    console.error("Erro ao adicionar competência:", error);
    command.message("error_msg", "Erro ao adicionar competência");
    outcome.complete("/dashboard/edit");
  }
};
exports.deletarCompetencia = async (command, outcome) => {
  const compId = integerId(command.ids.id);
  if (!compId) {
    command.message("error_msg", "Competência inválida");
    return outcome.complete("/dashboard/edit");
  }
  try {
    await repository.query(repository.deletarCompetenciaSql1(), [compId]);
    command.message("success_msg", "Competência removida com sucesso");
    outcome.complete("/dashboard/edit");
  } catch (error) {
    console.error("Erro ao deletar competência:", error);
    command.message("error_msg", "Erro ao deletar competência");
    outcome.complete("/dashboard/edit");
  }
};
exports.atualizarPresenca = async (command, outcome) => {
  const aluno_id = integerId(command.input.aluno_id);
  const presenca = numberInRange(command.input.presenca, 0, 100);
  if (!aluno_id || presenca === null) {
    command.message("error_msg", "Dados de presença inválidos");
    return outcome.complete("/dashboard/edit");
  }
  try {
    await repository.query(repository.atualizarPresencaSql1(), [
      presenca,
      aluno_id,
    ]);
    command.message("success_msg", "Presença atualizada com sucesso!");
    outcome.complete("/dashboard/edit");
  } catch (err) {
    console.error(err);
    command.message("error_msg", "Erro ao atualizar presença");
    outcome.complete("/dashboard/edit");
  }
};
exports.addAluno = async (command, outcome) => {
  const nome = personName(command.input?.nome);
  const ano_escolar = ALLOWED_YEARS.includes(command.input?.ano_escolar)
    ? command.input.ano_escolar
    : null;
  const idade = numberInRange(command.input?.idade, 10, 20);
  if (!nome || !ano_escolar || idade === null || !Number.isInteger(idade)) {
    command.message(
      "error_msg",
      "Todos os campos são obrigatórios e devem ser válidos.",
    );
    return outcome.complete("/dashboard/edit");
  }
  const client = await repository.connect();
  let inTransaction = false;
  try {
    await client.query(repository.addAlunoSql1());
    inTransaction = true;
    const duplicate = await client.query(repository.addAlunoSql2(), [nome]);
    if (duplicate.rows.length) {
      await client.query(repository.addAlunoSql3());
      inTransaction = false;
      command.message("error_msg", "Já existe um aluno com esse nome.");
      return outcome.complete("/dashboard/edit");
    }
    const email = `${(normalizeToEmailName(nome) || "aluno").slice(0, 55)}-${crypto.randomBytes(4).toString("hex")}@aluno.analisai.com`;
    const matricula = `ALU${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
    const senha = randomPassword();
    const senhaHash = await passwords.hash(senha);
    const alunoResult = await client.query(repository.addAlunoSql4(), [
      nome,
      ano_escolar,
      idade,
    ]);
    await client.query(repository.addAlunoSql5(), [
      nome,
      email,
      senhaHash,
      matricula,
      alunoResult.rows[0].id,
    ]);
    await client.query(repository.addAlunoSql6());
    inTransaction = false;
    command.message(
      "success_msg",
      `Aluno cadastrado com sucesso! Login: ${email} / Senha temporária: ${senha}`,
    );
    return outcome.complete("/dashboard/edit");
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query(repository.addAlunoSql7());
      } catch (_) {}
    }
    console.error("Erro ao adicionar aluno:", err);
    command.message(
      "error_msg",
      err.code === "23505"
        ? "E-mail, matrícula ou aluno já existente. Tente novamente."
        : "Erro ao adicionar aluno.",
    );
    return outcome.complete("/dashboard/edit");
  } finally {
    client.release();
  }
};
exports.deleteAluno = async (command, outcome) => {
  const id = integerId(command.ids.id);
  if (!id) {
    command.message("error_msg", "Aluno inválido");
    return outcome.complete("/dashboard/edit");
  }
  try {
    await repository.query(repository.deleteAlunoSql1(), [id]);
    command.message("success_msg", "Aluno removido com sucesso!");
    outcome.complete("/dashboard/edit");
  } catch (err) {
    console.error(err);
    command.message("error_msg", "Erro ao remover aluno");
    outcome.complete("/dashboard/edit");
  }
};
exports.eraseAll = async (command, outcome) => {
  const client = await repository.connect();
  try {
    await client.query(repository.eraseAllSql1());
    await repository.erasePedagogicalData(client);
    await client.query(repository.eraseAllSql2());
    command.message(
      "success_msg",
      "Todos os dados foram apagados com sucesso!",
    );
    outcome.complete("/dashboard/edit");
  } catch (err) {
    await client.query(repository.eraseAllSql3());
    console.error("Erro ao apagar os dados:", err);
    command.message("error_msg", "Erro ao apagar os dados no banco de dados.");
    outcome.complete("/dashboard/edit");
  } finally {
    client.release();
  }
};
async function processarImportacao(command, alunos, incluirCompetencias) {
  if (!Array.isArray(alunos))
    return {
      status: 400,
      body: {
        sucesso: false,
        erro: "Dados inválidos.",
      },
    };
  if (alunos.length > 500)
    return {
      status: 400,
      body: {
        sucesso: false,
        erro: "Limite de 500 alunos por importação.",
      },
    };
  const validos = [];
  for (const raw of alunos) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return {
        status: 400,
        body: {
          sucesso: false,
          erro: "Aluno inválido na importação.",
        },
      };
    const nome = personName(raw.nome);
    const ano_escolar = ALLOWED_YEARS.includes(raw.ano_escolar)
      ? raw.ano_escolar
      : null;
    const idade = numberInRange(raw.idade, 10, 20);
    const presenca = numberInRange(raw.presenca ?? 100, 0, 100);
    if (
      !nome ||
      !ano_escolar ||
      idade === null ||
      !Number.isInteger(idade) ||
      presenca === null ||
      !Number.isInteger(presenca)
    )
      return {
        status: 400,
        body: {
          sucesso: false,
          erro: "A importação contém nome, turma, idade ou presença inválidos.",
        },
      };
    validos.push({
      nome,
      ano_escolar,
      idade,
      presenca,
      competencias:
        incluirCompetencias && Array.isArray(raw.competencias)
          ? raw.competencias
          : [],
    });
  }
  const names = [...new Set(validos.map((item) => item.nome))];
  const existing = names.length
    ? await repository.query(repository.processarImportacaoSql1(), [names])
    : {
        rows: [],
      };
  const existingNames = new Set(existing.rows.map((row) => row.nome));
  const credenciais = [];
  let importados = 0;
  let duplicados = 0;
  let totalCompetencias = 0;
  const client = await repository.connect();
  let inTransaction = false;
  try {
    await client.query(repository.processarImportacaoSql2());
    inTransaction = true;
    const competencies = await client.query(
      repository.processarImportacaoSql3(),
    );
    const competencyMap = new Map(
      competencies.rows.map((row) => [row.nome, row.id]),
    );
    for (const item of validos) {
      if (item.competencias.length > 50) {
        await client.query(repository.processarImportacaoSql8());
        inTransaction = false;
        return {
          status: 400,
          body: {
            sucesso: false,
            erro: "Limite de 50 competências por aluno.",
          },
        };
      }
      for (const comp of item.competencias) {
        if (
          !competencyMap.has(
            text(comp?.nome, 100, {
              min: 1,
            }),
          ) ||
          numberInRange(comp?.nota, 0, 10) === null
        ) {
          await client.query(repository.processarImportacaoSql8());
          inTransaction = false;
          return {
            status: 400,
            body: {
              sucesso: false,
              erro: "A importação contém competência inexistente ou nota inválida. Use os nomes do catálogo.",
            },
          };
        }
      }
    }
    for (const item of validos) {
      if (existingNames.has(item.nome)) {
        duplicados++;
        continue;
      }
      const email = `${(normalizeToEmailName(item.nome) || "aluno").slice(0, 55)}-${crypto.randomBytes(4).toString("hex")}@aluno.analisai.com`;
      const matricula = `ALU${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
      const senhaTemporaria = randomPassword();
      const senhaHash = await passwords.hash(senhaTemporaria);
      const alunoResult = await client.query(
        repository.processarImportacaoSql4(),
        [item.nome, item.ano_escolar, item.idade, item.presenca],
      );
      const alunoId = alunoResult.rows[0].id;
      await client.query(repository.processarImportacaoSql5(), [
        item.nome,
        email,
        senhaHash,
        matricula,
        alunoId,
      ]);
      credenciais.push({
        nome: item.nome,
        email,
        matricula,
        senha: senhaTemporaria,
      });
      importados++;
      existingNames.add(item.nome);
      for (const comp of item.competencias) {
        const compNome = text(comp?.nome, 100, {
          min: 1,
        });
        const compNota = numberInRange(comp?.nota, 0, 10);
        const competenciaId = compNome ? competencyMap.get(compNome) : null;
        if (!competenciaId || compNota === null) continue;
        await client.query(repository.processarImportacaoSql6(), [
          alunoId,
          competenciaId,
          compNota,
          "Importado via planilha",
        ]);
        totalCompetencias++;
      }
    }
    await client.query(repository.processarImportacaoSql7());
    inTransaction = false;
    return {
      status: 200,
      body: {
        sucesso: true,
        importados,
        duplicados,
        ...(incluirCompetencias
          ? {
              totalCompetencias,
            }
          : {}),
        mensagem: incluirCompetencias
          ? `${importados} alunos importados com ${totalCompetencias} competências! ${duplicados} duplicados ignorados.`
          : `${importados} alunos importados com sucesso! ${duplicados} duplicados ignorados.`,
        credenciais,
      },
    };
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query(repository.processarImportacaoSql8());
      } catch (_) {}
    }
    throw err;
  } finally {
    client.release();
  }
}
exports.importarDados = async (command, outcome) => {
  try {
    const result = await processarImportacao(
      command,
      command.input?.alunos,
      false,
    );
    return outcome.code(result.status).data(result.body);
  } catch (err) {
    console.error("Erro na importação:", err);
    return outcome.code(500).data({
      sucesso: false,
      erro: "Erro interno durante a importação.",
    });
  }
};
exports.importarDadosCompletos = async (command, outcome) => {
  try {
    const result = await processarImportacao(
      command,
      command.input?.alunos,
      true,
    );
    return outcome.code(result.status).data(result.body);
  } catch (err) {
    console.error("Erro na importação completa:", err);
    return outcome.code(500).data({
      sucesso: false,
      erro: "Erro interno durante a importação.",
    });
  }
};
exports.baixarModeloImportacao = async (command, outcome) => {
  try {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Relatório AnalisAI");
    worksheet.columns = [
      {
        key: "A",
        width: 10,
      },
      {
        key: "B",
        width: 20,
      },
      {
        key: "C",
        width: 20,
      },
      {
        key: "D",
        width: 24,
      },
      {
        key: "E",
        width: 12,
      },
      {
        key: "F",
        width: 12,
      },
      {
        key: "G",
        width: 25,
      },
      {
        key: "H",
        width: 120,
      },
    ];
    try {
      const logoPath = path.join(__dirname, "../../../assets/xls-logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoId = workbook.addImage({
          buffer: logoBuffer,
          extension: "png",
        });
        worksheet.addImage(logoId, {
          tl: {
            col: 0,
            row: 0,
          },
          br: {
            col: 3,
            row: 6,
          },
        });
      }
    } catch (e) {
      console.log("Logo não encontrado", e);
    }
    worksheet.mergeCells("D2:G4");
    const titleCell = worksheet.getCell("D2");
    titleCell.value = "MODELO DE IMPORTAÇÃO - PREENCHA OS DADOS";
    titleCell.font = {
      size: 16,
      bold: true,
      color: {
        argb: "FFFF0101",
      },
    };
    titleCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    const headerRow = worksheet.getRow(8);
    headerRow.values = [
      "ID",
      "ALUNO",
      "ANO ESCOLAR",
      "IDADE",
      "MÉDIA",
      "PRESENÇA",
      "NÍVEL",
      "COMPETÊNCIAS",
    ];
    headerRow.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FFFF0101",
        },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    });
    worksheet.addRow([
      "",
      "JOÃO SILVA",
      "1º MÉDIO",
      15,
      "",
      "90%",
      "",
      "Raciocínio Lógico: 8.5; Comunicação: 7.0",
    ]);
    worksheet.addRow([
      "",
      "MARIA OLIVEIRA",
      "2º MÉDIO",
      16,
      "",
      "85%",
      "",
      "Proatividade: 9.0; Organização: 6.5",
    ]);
    worksheet.addRow([
      "",
      "PEDRO SANTOS",
      "3º MÉDIO",
      17,
      "",
      "95%",
      "",
      "Liderança: 8.0; Trabalho em Equipe: 7.5",
    ]);
    worksheet.addRow([
      "",
      "ANA BEATRIZ",
      "9º FUNDAMENTAL",
      14,
      "",
      "100%",
      "",
      "Comunicação: 9.5; Criatividade: 8.0",
    ]);
    let currentRow = 8 + 5 + 2;
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = "INSTRUÇÕES DE PREENCHIMENTO:";
    titleRow.getCell(1).font = {
      bold: true,
      color: {
        argb: "FFFF0101",
      },
    };
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst1 = worksheet.getRow(currentRow);
    inst1.getCell(1).value =
      "1. ID: Deixe em branco (será gerado automaticamente)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst2 = worksheet.getRow(currentRow);
    inst2.getCell(1).value = "2. ALUNO: Nome completo (apenas letras)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst3 = worksheet.getRow(currentRow);
    inst3.getCell(1).value =
      "3. ANO ESCOLAR: Use 1º MÉDIO, 2º MÉDIO, 3º MÉDIO ou 9º FUNDAMENTAL";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst4 = worksheet.getRow(currentRow);
    inst4.getCell(1).value = "4. IDADE: Número entre 10 e 20";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst5 = worksheet.getRow(currentRow);
    inst5.getCell(1).value =
      "5. MÉDIA: Deixe em branco (calculada automaticamente)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst6 = worksheet.getRow(currentRow);
    inst6.getCell(1).value = "6. PRESENÇA: Número entre 0 e 100 (pode usar %)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst7 = worksheet.getRow(currentRow);
    inst7.getCell(1).value =
      "7. NÍVEL: Deixe em branco (calculado automaticamente)";
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    const inst8 = worksheet.getRow(currentRow);
    inst8.getCell(1).value =
      '8. COMPETÊNCIAS: Formato "Competência: Nota; Competência: Nota"';
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;
    outcome.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    outcome.header(
      "Content-Disposition",
      "attachment; filename=modelo_importacao_analisai.xlsx",
    );
    outcome.binary(Buffer.from(await workbook.xlsx.writeBuffer()));
  } catch (err) {
    console.error(err);
    outcome.code(500).data("Erro ao gerar modelo");
  }
};
