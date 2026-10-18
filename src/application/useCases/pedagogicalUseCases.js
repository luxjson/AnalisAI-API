const repository = require("../../infrastructure/repositories/pedagogicalUseCasesRepository");
const { buildStudentReport } = require("../services/studentReportPdf");
const { calendarDaysInYear } = require("../../domain/attendance");
const {
  ALLOWED_YEARS,
  integerId,
  personName,
  text,
  dateOnly,
} = require("../../domain/validation");

const ATTENDANCE_STATUSES = new Set(["PRESENTE", "FALTA", "JUSTIFICADA"]);
const validTime = (value) =>
  typeof value === "string" &&
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const currentYear = () => new Date().getFullYear();
const currentDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function validProfilePhoto(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 1_300_000) return undefined;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return undefined;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > 900 * 1024) return undefined;
  const validSignature =
    (match[1] === "png" &&
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (match[1] === "jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (match[1] === "webp" &&
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP");
  return validSignature ? value : undefined;
}

async function canManageClass(command, turma) {
  if (!ALLOWED_YEARS.includes(turma)) return false;
  if (command.session.userCargo !== "Professor") return true;
  const assigned = await repository.query(
    repository.assignedClassesSql(),
    [command.session.userId, turma],
  );
  return assigned.rows.length > 0;
}

exports.getProfile = async (command, outcome) => {
  const userId = integerId(command.session.userId);
  if (!userId) return outcome.code(401).data({ error: "Sessão inválida." });
  const result = await repository.query(repository.profileSql(), [userId]);
  if (!result.rows.length)
    return outcome.code(404).data({ error: "Conta não encontrada." });
  const user = result.rows[0];
  const classes =
    user.cargo === "Professor"
      ? await repository.query(repository.profileClassesSql(), [userId])
      : { rows: [] };
  return outcome.data({
    nome: user.nome,
    email: user.email,
    cargo: user.cargo,
    foto_perfil: user.foto_perfil,
    onboarding_concluido: user.onboarding_concluido,
    turmas: classes.rows.map((row) => row.turma),
    turmasDisponiveis: ALLOWED_YEARS,
  });
};

exports.saveProfile = async (command, outcome) => {
  const userId = integerId(command.session.userId);
  const nome = personName(command.input?.nome);
  const photo = validProfilePhoto(command.input?.foto_perfil);
  const cargo = command.session.userCargo;
  if (!userId) return outcome.code(401).data({ error: "Sessão inválida." });
  if (!nome)
    return outcome.code(400).data({ error: "Informe um nome válido." });
  if (photo === undefined)
    return outcome.code(400).data({
      error: "Use uma imagem PNG, JPEG ou WebP válida de até 900 KB.",
    });
  let turmas = [];
  if (cargo === "Professor") {
    const submitted = command.input?.turmas;
    turmas = [...new Set(Array.isArray(submitted) ? submitted : submitted ? [submitted] : [])];
    if (!turmas.length || turmas.some((turma) => !ALLOWED_YEARS.includes(turma)))
      return outcome.code(400).data({
        error: "Selecione ao menos uma turma válida sob sua responsabilidade.",
      });
  }

  const client = await repository.connect();
  try {
    await client.query("BEGIN");
    const saved = await client.query(
      repository.saveProfileSql(),
      [nome, photo, userId],
    );
    if (!saved.rows.length) throw new Error("Conta não encontrada.");
    if (cargo === "Professor") {
      await client.query(repository.deleteClassesSql(), [userId]);
      for (const turma of turmas)
        await client.query(repository.insertClassSql(), [userId, turma]);
    }
    await client.query("COMMIT");
    return outcome.data({
      sucesso: true,
      nome: saved.rows[0].nome,
      cargo: saved.rows[0].cargo,
      onboarding_concluido: true,
      turmas,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (process.env.NODE_ENV !== "production")
      console.error("Falha ao salvar perfil pedagógico:", error.message);
    return outcome.code(500).data({
      error: "Não foi possível salvar o perfil. Tente novamente.",
    });
  } finally {
    client.release();
  }
};

exports.getAttendance = async (command, outcome) => {
  const year = Number(command.filters.ano || currentYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return outcome.code(400).data({ error: "Ano letivo inválido." });
  const dataAula = command.filters.data
    ? dateOnly(command.filters.data)
    : currentDate();
  if (!dataAula)
    return outcome.code(400).data({ error: "Data da aula inválida." });
  const inicio = command.filters.horario_inicio || "07:30";
  const fim = command.filters.horario_fim || "08:20";
  if ((inicio && !validTime(inicio)) || (fim && !validTime(fim)))
    return outcome.code(400).data({ error: "Horário inválido." });
  if (inicio && fim && inicio >= fim)
    return outcome.code(400).data({ error: "O horário final deve ser posterior ao inicial." });

  let turmas;
  if (command.session.userCargo === "Professor") {
    const assigned = await repository.query(
      repository.teacherClassesSql(),
      [command.session.userId],
    );
    turmas = assigned.rows.map((row) => row.turma);
  } else {
    turmas = ALLOWED_YEARS;
  }
  const turma = ALLOWED_YEARS.includes(command.filters.turma)
    ? command.filters.turma
    : turmas[0];
  if (!turma || !(await canManageClass(command, turma)))
    return outcome.code(403).data({
      error: "Você não tem acesso a essa turma. Confira as turmas configuradas no seu perfil.",
    });

  const students = await repository.query(repository.attendanceStudentsSql(), [
    dataAula,
    inicio || "00:00",
    fim || "00:01",
    year,
    turma,
  ]);
  return outcome.data({
    user: command.session.user,
    userCargo: command.session.userCargo,
    turma,
    turmas,
    data: dataAula,
    ano: year,
    diasNoAno: calendarDaysInYear(year),
    horario_inicio: inicio,
    horario_fim: fim,
    alunos: students.rows,
    resumo: {
      totalAlunos: students.rows.length,
      frequenciaMedia: (() => {
        const withRecords = students.rows.filter((student) => Number(student.total_aulas) > 0);
        return withRecords.length
          ? Math.round(
              withRecords.reduce((sum, student) => sum + Number(student.frequencia_anual || 0), 0) /
                withRecords.length,
            )
          : null;
      })(),
      aulasRegistradas: students.rows.reduce(
        (max, student) => Math.max(max, Number(student.total_aulas || 0)),
        0,
      ),
    },
  });
};

exports.saveAttendance = async (command, outcome) => {
  const userId = integerId(command.session.userId);
  const turma = command.input?.turma;
  const dataAula = dateOnly(command.input?.data);
  const inicio = command.input?.horario_inicio;
  const fim = command.input?.horario_fim;
  const entries = command.input?.alunos;
  if (
    !userId ||
    !ALLOWED_YEARS.includes(turma) ||
    !dataAula ||
    !validTime(inicio) ||
    !validTime(fim) ||
    inicio >= fim ||
    !Array.isArray(entries) ||
    !entries.length ||
    entries.length > 500
  )
    return outcome.code(400).data({ error: "Confira turma, data, horários e lista de alunos." });
  if (!(await canManageClass(command, turma)))
    return outcome.code(403).data({ error: "Você não pode registrar frequência nessa turma." });

  const normalized = [];
  const seen = new Set();
  for (const entry of entries) {
    const id = integerId(entry?.aluno_id);
    const status = entry?.status;
    const justificativa = text(entry?.justificativa || "", 1000) || null;
    if (!id || seen.has(id) || !ATTENDANCE_STATUSES.has(status))
      return outcome.code(400).data({ error: "Cada aluno precisa ter uma situação de frequência válida." });
    seen.add(id);
    normalized.push({ id, status, justificativa });
  }

  const client = await repository.connect();
  try {
    await client.query("BEGIN");
    const classStudents = await client.query(repository.studentsInClassSql(), [turma]);
    const expected = classStudents.rows.map((row) => Number(row.id)).sort((a, b) => a - b);
    const submitted = normalized.map((row) => row.id).sort((a, b) => a - b);
    if (
      expected.length !== submitted.length ||
      expected.some((id, index) => id !== submitted[index])
    ) {
      await client.query("ROLLBACK");
      return outcome.code(409).data({
        error: "A lista de alunos mudou. Recarregue a turma antes de salvar a frequência.",
      });
    }
    for (const entry of normalized)
      await client.query(repository.upsertAttendanceSql(), [
        entry.id,
        turma,
        dataAula,
        inicio,
        fim,
        entry.status,
        entry.justificativa,
        userId,
      ]);
    await client.query(repository.refreshAttendancePercentagesSql(), [submitted]);
    await client.query("COMMIT");
    return outcome.data({
      sucesso: true,
      total: normalized.length,
      mensagem: "Frequência registrada. Os percentuais foram recalculados a partir das aulas registradas.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (process.env.NODE_ENV !== "production")
      console.error("Falha ao salvar frequência:", error.message);
    return outcome.code(500).data({ error: "Não foi possível salvar a frequência." });
  } finally {
    client.release();
  }
};

exports.studentReportPdf = async (command, outcome) => {
  const studentId = integerId(command.ids.id);
  if (!studentId) return outcome.code(400).data({ error: "Aluno inválido." });
  const studentResult = await repository.query(repository.studentReportSql(), [studentId]);
  const student = studentResult.rows[0];
  if (!student) return outcome.code(404).data({ error: "Aluno não encontrado." });

  if (command.session.aluno?.id) {
    if (Number(command.session.aluno.id) !== studentId)
      return outcome.code(403).data({ error: "Você só pode consultar seu próprio relatório." });
  } else if (command.session.userCargo === "Professor") {
    if (!(await canManageClass(command, student.ano_escolar)))
      return outcome.code(403).data({ error: "Este aluno não pertence às suas turmas." });
  }

  const year = Number(command.filters.ano || currentYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return outcome.code(400).data({ error: "Ano do relatório inválido." });
  const [competencies, attendance] = await Promise.all([
    repository.query(repository.studentCompetencesSql(), [studentId]),
    repository.query(repository.studentAttendanceSql(), [studentId, year]),
  ]);
  const pdf = buildStudentReport({
    student,
    competencies: competencies.rows,
    attendance: attendance.rows[0] || {},
    year,
    yearDays: calendarDaysInYear(year),
  });
  outcome.header("Content-Type", "application/pdf");
  outcome.header(
    "Content-Disposition",
    `attachment; filename="relatorio-aluno-${studentId}-${year}.pdf"`,
  );
  outcome.header("Cache-Control", "private, no-store");
  return outcome.binary(pdf);
};

exports.getReportRequests = async (command, outcome) => {
  const userId = integerId(command.session.userId);
  const cargo = command.session.userCargo;
  if (!userId) return outcome.code(401).data({ error: "Sessão inválida." });
  let requests;
  if (cargo === "Admin") {
    requests = await repository.query(repository.reportRequestsForAdminSql());
  } else if (cargo === "Coordenador") {
    requests = await repository.query(repository.reportRequestsForCoordinatorSql(), [userId]);
  } else {
    requests = await repository.query(repository.reportRequestsForTeacherSql(), [userId]);
  }
  const result = {
    userCargo: cargo,
    solicitacoes: requests.rows,
  };
  if (cargo === "Admin" || cargo === "Coordenador") {
    const [teachers, students] = await Promise.all([
      repository.query(repository.teachersSql()),
      repository.query("SELECT id, nome, ano_escolar FROM alunos ORDER BY nome ASC LIMIT 2000"),
    ]);
    const teachersWithClasses = await Promise.all(
      teachers.rows.map(async (teacher) => {
        const classes = await repository.query(repository.teacherClassesSql(), [teacher.id]);
        return { ...teacher, turmas: classes.rows.map((row) => row.turma) };
      }),
    );
    result.professores = teachersWithClasses;
    result.alunos = students.rows;
    result.turmasDisponiveis = ALLOWED_YEARS;
  }
  return outcome.data(result);
};

exports.createReportRequest = async (command, outcome) => {
  const userId = integerId(command.session.userId);
  if (!userId) return outcome.code(401).data({ error: "Sessão inválida." });
  if (!["Coordenador", "Admin"].includes(command.session.userCargo))
    return outcome.code(403).data({ error: "Somente coordenadores e administradores podem solicitar relatórios." });

  const professorId = integerId(command.input?.professor_id);
  const alunoId = command.input?.aluno_id ? integerId(command.input.aluno_id) : null;
  let turma = command.input?.turma || null;
  const mensagem = text(command.input?.mensagem, 1000, { min: 3 });
  if (!professorId || !mensagem || (command.input?.aluno_id && !alunoId))
    return outcome.code(400).data({ error: "Informe professor e uma solicitação válida." });

  let aluno = null;
  if (alunoId) {
    const student = await repository.query(
      "SELECT id, nome, ano_escolar FROM alunos WHERE id = $1 LIMIT 1",
      [alunoId],
    );
    if (!student.rows.length)
      return outcome.code(404).data({ error: "Aluno não encontrado." });
    aluno = student.rows[0];
    if (!turma) turma = aluno.ano_escolar;
    if (turma !== aluno.ano_escolar)
      return outcome.code(400).data({ error: "A turma selecionada não corresponde ao aluno." });
  }
  if (turma && !ALLOWED_YEARS.includes(turma))
    return outcome.code(400).data({ error: "Turma inválida." });
  const teacher = await repository.query(
    "SELECT id, nome FROM usuarios WHERE id = $1 AND cargo = 'Professor' AND status = 'ATIVO' LIMIT 1",
    [professorId],
  );
  if (!teacher.rows.length)
    return outcome.code(404).data({ error: "Professor não encontrado." });
  if (turma) {
    const assigned = await repository.query(repository.assignedClassesSql(), [professorId, turma]);
    if (!assigned.rows.length)
      return outcome.code(400).data({ error: "Esse professor ainda não está vinculado à turma selecionada." });
  }

  const created = await repository.query(repository.createReportRequestSql(), [
    userId,
    professorId,
    alunoId,
    turma,
    mensagem,
  ]);
  await repository.query(repository.notifyReportRequestSql(), [
    professorId,
    "Nova solicitação de relatório",
    `${command.session.user || "Coordenação"} solicitou um relatório pedagógico${aluno ? ` de ${aluno.nome}` : turma ? ` para a turma ${turma}` : ""}.`,
  ]);
  return outcome.data({
    sucesso: true,
    solicitacao: created.rows[0],
    mensagem: "Solicitação encaminhada ao professor.",
  });
};

exports.updateReportRequest = async (command, outcome) => {
  const id = integerId(command.ids.id);
  const userId = integerId(command.session.userId);
  const status = command.input?.status;
  const resposta = text(command.input?.resposta || "", 2000) || null;
  if (!id || !userId || !["EM_ANDAMENTO", "CONCLUIDA"].includes(status))
    return outcome.code(400).data({ error: "Atualização de solicitação inválida." });
  if (!["Professor", "Admin"].includes(command.session.userCargo))
    return outcome.code(403).data({ error: "Apenas o professor responsável pode atualizar a solicitação." });
  const result = await repository.query(repository.updateReportRequestSql(), [
    status,
    resposta,
    id,
    userId,
  ]);
  if (!result.rows.length)
    return outcome.code(404).data({ error: "Solicitação não encontrada para este professor." });
  return outcome.data({ sucesso: true, solicitacao: result.rows[0] });
};

exports.isLeapYear = (year) => calendarDaysInYear(year);
