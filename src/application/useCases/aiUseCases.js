const repository = require("../../infrastructure/repositories/aiUseCasesRepository.js");
const { integerId, text } = require("../../domain/validation");
const { uniqueRow } = require("../../domain/uniqueRow");
const {
  generateResponse,
  isDirectAnswerRequest,
  STUDENT_INSTRUCTION,
  TEACHER_INSTRUCTION,
  MAX_MESSAGE_LENGTH,
} = require("../services/aiService");
function requestData(command) {
  const message = text(command.input?.message, MAX_MESSAGE_LENGTH, {
    min: 1,
  });
  const conversationId = integerId(command.input?.conversationId);
  return {
    message,
    conversationId,
  };
}
async function getAssignedTeacherClasses(command) {
  if (command.session.userCargo !== "Professor") return null;
  const result = await repository.query(
    "SELECT turma FROM professor_turmas WHERE professor_id = $1 ORDER BY turma",
    [command.session.userId],
  );
  return result.rows.map((row) => row.turma);
}
function conversationTitle(message) {
  const title = message
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  return title.length > 58
    ? `${title.slice(0, 55)}...`
    : title || "Nova conversa";
}
function ownerFilter(command) {
  if (command.session?.aluno?.id)
    return {
      column: "aluno_id",
      id: command.session.aluno.id,
    };
  return {
    column: "usuario_id",
    id: command.session.userId,
  };
}
async function createConversation(command, title = "Nova conversa") {
  const owner = ownerFilter(command);
  const result = await repository.query(
    repository.createConversationSql1(owner.column),
    [owner.id, title.slice(0, 120)],
  );
  return result.rows[0];
}
async function findConversation(command, conversationId) {
  if (!conversationId) return null;
  const owner = ownerFilter(command);
  const result = await repository.query(
    repository.findConversationSql1(owner.column),
    [conversationId, owner.id],
  );
  return result.rows[0] || null;
}
async function saveMessage(conversationId, papel, conteudo) {
  await repository.query(repository.saveMessageSql1(), [
    conversationId,
    papel,
    conteudo,
  ]);
  await repository.query(repository.saveMessageSql2(), [conversationId]);
}
async function updateConversationTitle(conversationId, title) {
  await repository.query(repository.updateConversationTitleSql1(), [
    conversationTitle(title),
    conversationId,
  ]);
}
async function persistExchange(command, conversation, message, answer) {
  const savedConversation =
    conversation || (await createConversation(command, message));
  await saveMessage(savedConversation.id, "user", message);
  await saveMessage(savedConversation.id, "model", answer);
  await updateConversationTitle(savedConversation.id, message);
  return savedConversation;
}
async function detectGradeAction(message, classes = null) {
  const match = message.match(
    /altera(?:r)?\s+(?:a\s+)?nota\s+de\s+(.+?)\s+em\s+(.+?)\s+(?:para|pra)\s+(10(?:[.,]0)?|[0-9](?:[.,][0-9])?)/i,
  );
  if (!match) return null;
  const nota = Number(match[3].replace(",", "."));
  if (nota === null || nota < 0 || nota > 10) return null;
  const [student, competency] = await Promise.all([
    repository.query(repository.detectGradeActionSql1(), [match[1].trim()]),
    repository.query(repository.detectGradeActionSql2(), [match[2].trim()]),
  ]);
  const matchedStudent = uniqueRow(student.rows);
  const matchedCompetency = uniqueRow(competency.rows);
  if (!matchedStudent || !matchedCompetency) return null;
  if (classes !== null && !classes.includes(matchedStudent.ano_escolar))
    return null;
  return {
    alunoId: matchedStudent.id,
    alunoNome: matchedStudent.nome,
    competenciaId: matchedCompetency.id,
    competenciaNome: matchedCompetency.nome,
    nota,
  };
}
async function getConversationHistory(conversationId) {
  const result = await repository.query(
    repository.getConversationHistorySql1(),
    [conversationId],
  );
  return result.rows.reverse();
}
exports.history = async (command, outcome) => {
  try {
    const owner = ownerFilter(command);
    const conversations = await repository.query(
      repository.historySql1(owner.column),
      [owner.id],
    );
    if (conversations.rows.length === 0)
      return outcome.data({
        conversations: [],
      });
    const ids = conversations.rows.map((row) => row.id);
    const messages = await repository.query(repository.historySql2(), [ids]);
    const messagesByConversation = new Map(ids.map((id) => [id, []]));
    messages.rows.forEach((message) =>
      messagesByConversation.get(message.conversa_id).push({
        role: message.role,
        text: message.text,
      }),
    );
    return outcome.data({
      conversations: conversations.rows.map((conversation) => ({
        ...conversation,
        messages: messagesByConversation.get(conversation.id),
      })),
    });
  } catch (error) {
    return sendAiError(outcome, error);
  }
};
function sendAiError(outcome, error, extra = {}) {
  if (error.code === "AI_NOT_CONFIGURED")
    return outcome.code(503).data({
      error: "A IA ainda não foi configurada no servidor.",
      ...extra,
    });
  if (error.code === "AI_QUOTA_ERROR")
    return outcome.code(429).data({
      error: "O limite gratuito da IA foi atingido.",
      ...extra,
    });
  if (error.code === "AI_PROVIDER_ERROR")
    return outcome.code(502).data({
      error: "O serviço de IA não respondeu. Tente novamente em instantes.",
      ...extra,
    });
  if (error.name === "TimeoutError" || error.name === "AbortError")
    return outcome.code(504).data({
      error: "A IA demorou mais que o esperado. Tente novamente.",
      ...extra,
    });
  console.error("Erro na IA:", error);
  return outcome.code(500).data({
    error: "Não foi possível gerar a resposta.",
    ...extra,
  });
}
async function getStudentContext(alunoId) {
  const [student, competencies, tasks] = await Promise.all([
    repository.query(repository.getStudentContextSql1(), [alunoId]),
    repository.query(repository.getStudentContextSql2(), [alunoId]),
    repository.query(repository.getStudentContextSql3(), [alunoId]),
  ]);
  const studentRow = student.rows[0];
  return {
    aluno: studentRow
      ? {
          ...studentRow,
          presenca:
            studentRow.presenca_calculada == null
              ? null
              : Number(studentRow.presenca_calculada),
        }
      : null,
    competencias: competencies.rows,
    tarefas: tasks.rows,
  };
}
exports.studentPage = (command, outcome) =>
  outcome.data({
    aluno: command.session.aluno,
    user: command.session.aluno?.nome,
    userCargo: "Aluno",
    isAdmin: false,
  });
exports.teacherPage = (command, outcome) =>
  outcome.data({
    user: command.session.user,
    userCargo: command.session.userCargo,
    isAdmin: command.session.userCargo === "Admin",
  });
exports.studentChat = async (command, outcome) => {
  const { message, conversationId } = requestData(command);
  if (!message)
    return outcome.code(400).data({
      error: "Digite uma pergunta.",
    });
  let conversation;
  try {
    conversation = await findConversation(command, conversationId);
    if (conversationId && !conversation)
      return outcome.code(404).data({
        error: "Conversa não encontrada.",
      });
    const history = conversation
      ? await getConversationHistory(conversation.id)
      : [];
    if (isDirectAnswerRequest(message)) {
      const answer = [
        "Posso ajudar você a entender o conteúdo e montar os passos da ",
        "solução, mas não posso entregar uma atividade, prova ou ",
        "exercício pronto. Envie o enunciado ou diga qual parte ficou ",
        "difícil.",
      ].join("");
      conversation = await persistExchange(
        command,
        conversation,
        message,
        answer,
      );
      return outcome.data({
        answer,
        conversationId: conversation.id,
      });
    }
    const context = await getStudentContext(command.session.aluno.id);
    const answer = await generateResponse({
      systemInstruction: STUDENT_INSTRUCTION,
      context,
      message,
      history,
    });
    conversation = await persistExchange(
      command,
      conversation,
      message,
      answer,
    );
    return outcome.data({
      answer,
      conversationId: conversation.id,
    });
  } catch (error) {
    return sendAiError(
      outcome,
      error,
      conversation?.id
        ? {
            conversationId: conversation.id,
          }
        : {},
    );
  }
};
exports.teacherChat = async (command, outcome) => {
  const { message, conversationId } = requestData(command);
  if (!message)
    return outcome.code(400).data({
      error: "Digite uma pergunta.",
    });
  let conversation;
  try {
    conversation = await findConversation(command, conversationId);
    if (conversationId && !conversation)
      return outcome.code(404).data({
        error: "Conversa não encontrada.",
      });
    const history = conversation
      ? await getConversationHistory(conversation.id)
      : [];
    const classes = await getAssignedTeacherClasses(command);
    const gradeAction = await detectGradeAction(message, classes);
    if (gradeAction) {
      const answer = `Encontrei a alteração para ${gradeAction.alunoNome}, competência ${gradeAction.competenciaNome} e nota ${gradeAction.nota}. Confirme abaixo para aplicar.`;
      conversation = await persistExchange(
        command,
        conversation,
        message,
        answer,
      );
      return outcome.data({
        answer,
        conversationId: conversation.id,
        action: {
          type: "update_grade",
          ...gradeAction,
        },
      });
    }
    const [students, competencies, tasks] = await Promise.all([
      classes === null
        ? repository.query(repository.teacherChatSql2())
        : repository.query(repository.teacherChatSql2(true), [classes]),
      repository.query(repository.teacherChatSql3()),
      classes === null
        ? repository.query(repository.teacherChatSql4())
        : repository.query(repository.teacherChatSql4(true), [classes]),
    ]);
    const context = {
      alunos: students.rows.map((student) => ({
        ...student,
        presenca:
          student.presenca_calculada == null
            ? null
            : Number(student.presenca_calculada),
      })),
      competencias: competencies.rows,
      tarefas: tasks.rows,
    };
    const answer = await generateResponse({
      systemInstruction: TEACHER_INSTRUCTION,
      context,
      message,
      history,
    });
    conversation = await persistExchange(
      command,
      conversation,
      message,
      answer,
    );
    return outcome.data({
      answer,
      conversationId: conversation.id,
    });
  } catch (error) {
    return sendAiError(
      outcome,
      error,
      conversation?.id
        ? {
            conversationId: conversation.id,
          }
        : {},
    );
  }
};
exports.analyzeStudent = async (command, outcome) => {
  const alunoId = integerId(command.ids.id);
  if (!alunoId)
    return outcome.code(400).data({
      error: "Aluno inválido.",
    });
  try {
    const context = await getStudentContext(alunoId);
    if (!context.aluno)
      return outcome.code(404).data({
        error: "Aluno não encontrado.",
      });
    const message =
      text(command.input?.message, MAX_MESSAGE_LENGTH, {
        min: 1,
      }) ||
      "Faça um diagnóstico pedagógico conciso deste aluno. Liste situação atual, pontos fortes, prioridades de intervenção e próximos passos práticos.";
    const answer = await generateResponse({
      systemInstruction: TEACHER_INSTRUCTION,
      context,
      message,
      history: [],
    });
    return outcome.data({
      answer,
    });
  } catch (error) {
    return sendAiError(outcome, error);
  }
};
exports.updateGrade = async (command, outcome) => {
  const alunoId = integerId(command.input?.alunoId);
  const competenciaId = integerId(command.input?.competenciaId);
  const nota = require("../../domain/validation").numberInRange(
    command.input?.nota,
    0,
    10,
  );
  if (
    !alunoId ||
    !competenciaId ||
    nota === null ||
    nota < 0 ||
    nota > 10 ||
    command.input?.confirm !== true
  ) {
    return outcome.code(400).data({
      error: "Confirmação ou dados da nota inválidos.",
    });
  }
  const client = await repository.connect();
  try {
    await client.query(repository.updateGradeSql1());
    await client.query(repository.updateGradeSql2(), [alunoId]);
    const previous = await client.query(repository.updateGradeSql3(), [
      alunoId,
      competenciaId,
    ]);
    if (previous.rows[0]) {
      await client.query(repository.updateGradeSql4(), [
        nota,
        previous.rows[0].id,
      ]);
    } else {
      await client.query(repository.updateGradeSql5(), [
        alunoId,
        competenciaId,
        nota,
        "Registrado pelo professor via IA",
      ]);
    }
    await client.query(repository.updateGradeSql6(), [alunoId]);
    await client.query(repository.updateGradeSql7(), [
      command.session.userId,
      alunoId,
      competenciaId,
      previous.rows[0]?.nota ?? null,
      nota,
    ]);
    await client.query(repository.updateGradeSql8());
    return outcome.data({
      success: true,
      message: "Nota atualizada com sucesso.",
    });
  } catch (error) {
    await client.query(repository.updateGradeSql9());
    return sendAiError(outcome, error);
  } finally {
    client.release();
  }
};
exports.updateConversation = async (command, outcome) => {
  const conversationId = integerId(command.ids.id);
  const owner = ownerFilter(command);
  const title = text(command.input?.titulo, 120, {
    min: 1,
  });
  if (!conversationId)
    return outcome.code(400).data({
      error: "Conversa inválida.",
    });
  if (command.input?.acao === "renomear" && !title)
    return outcome.code(400).data({
      error: "Informe um nome válido.",
    });
  try {
    let result;
    if (command.input?.acao === "apagar") {
      result = await repository.query(
        repository.updateConversationSql1(owner.column),
        [conversationId, owner.id],
      );
    } else if (command.input?.acao === "fixar") {
      result = await repository.query(
        repository.updateConversationSql2(owner.column),
        [conversationId, owner.id],
      );
    } else if (command.input?.acao === "renomear") {
      result = await repository.query(
        repository.updateConversationSql3(owner.column),
        [title, conversationId, owner.id],
      );
    } else {
      return outcome.code(400).data({
        error: "Ação inválida.",
      });
    }
    if (!result.rows.length)
      return outcome.code(404).data({
        error: "Conversa não encontrada.",
      });
    return outcome.data({
      success: true,
      conversation: result.rows[0],
    });
  } catch (error) {
    return sendAiError(outcome, error);
  }
};
