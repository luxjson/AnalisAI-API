const repository = require("../../infrastructure/repositories/checkupServiceRepository.js");
const bcrypt = require("../../infrastructure/passwords");
const SYSTEM_TABLES = [
  "usuarios",
  "alunos",
  "alunos_login",
  "competencias",
  "aluno_competencias",
  "notas_detalhadas",
  "tarefas",
  "tarefas_alunos",
  "calendario_eventos",
  "feriados",
  "solicitacoes_senha",
  "notificacoes",
  "configuracoes_notificacoes",
  "ia_conversas",
  "ia_mensagens",
  "ia_auditoria_notas",
];
async function runSystemCheckup() {
  const results = [];
  for (const tableName of SYSTEM_TABLES) {
    try {
      const tableDiagnostic = await diagnoseTable(tableName);
      results.push(tableDiagnostic);
    } catch (err) {
      console.error(`Erro ao diagnosticar tabela ${tableName}:`, err.message);
      results.push({
        table: tableName,
        exists: false,
        totalRows: 0,
        hasIssues: true,
        issuesCount: 1,
        issues: ["Erro ao verificar a estrutura da tabela."],
      });
    }
  }
  const totalIssues = results.reduce((acc, curr) => acc + curr.issuesCount, 0);
  const healthyTables = results.filter((r) => !r.hasIssues).length;
  return {
    timestamp: new Date().toISOString(),
    totalTables: results.length,
    healthyTables,
    problematicTables: results.length - healthyTables,
    totalIssues,
    isHealthy: totalIssues === 0,
    tables: results,
  };
}
async function diagnoseTable(tableName) {
  const countRes = await repository.query(repository.diagnoseTableSql1(), [
    tableName,
  ]);
  if (parseInt(countRes.rows[0].total) === 0) {
    return {
      table: tableName,
      exists: false,
      totalRows: 0,
      hasIssues: true,
      issuesCount: 1,
      issues: ["Tabela não existe no banco de dados."],
    };
  }
  const rowCountRes = await repository.query(
    repository.diagnoseTableSql2(tableName),
  );
  const totalRows = parseInt(rowCountRes.rows[0].total);
  const issues = [];
  switch (tableName) {
    case "alunos": {
      const invalidPresenca = await repository.query(
        repository.diagnoseTableSql3(),
      );
      if (parseInt(invalidPresenca.rows[0].count) > 0) {
        issues.push(
          `${invalidPresenca.rows[0].count} aluno(s) com frequência fora da faixa permitida (0-100%).`,
        );
      }
      const invalidNota = await repository.query(
        repository.diagnoseTableSql4(),
      );
      if (parseInt(invalidNota.rows[0].count) > 0) {
        issues.push(
          `${invalidNota.rows[0].count} aluno(s) com média geral fora do intervalo (0.0 - 10.0).`,
        );
      }
      const invalidIdade = await repository.query(
        repository.diagnoseTableSql5(),
      );
      if (parseInt(invalidIdade.rows[0].count) > 0) {
        issues.push(
          `${invalidIdade.rows[0].count} aluno(s) com idade atípica (< 10 ou > 20 anos).`,
        );
      }
      const semLogin = await repository.query(repository.diagnoseTableSql6());
      if (parseInt(semLogin.rows[0].count) > 0) {
        issues.push(
          `${semLogin.rows[0].count} aluno(s) cadastrado(s) sem credenciais de acesso no portal.`,
        );
      }
      break;
    }
    case "alunos_login": {
      const orfaosLogin = await repository.query(
        repository.diagnoseTableSql7(),
      );
      if (parseInt(orfaosLogin.rows[0].count) > 0) {
        issues.push(
          `${orfaosLogin.rows[0].count} conta(s) de login órfã(s) apontando para alunos inexistentes.`,
        );
      }
      const duplicateMatricula = await repository.query(
        repository.diagnoseTableSql8(),
      );
      if (parseInt(duplicateMatricula.rows[0].count) > 0) {
        issues.push(
          `${duplicateMatricula.rows[0].count} matrícula(s) duplicada(s) detectada(s).`,
        );
      }
      break;
    }
    case "aluno_competencias": {
      const orfaosComp = await repository.query(repository.diagnoseTableSql9());
      if (parseInt(orfaosComp.rows[0].count) > 0) {
        issues.push(
          `${orfaosComp.rows[0].count} avaliação(ões) órfã(s) com aluno ou competência inexistente.`,
        );
      }
      const invalidGrade = await repository.query(
        repository.diagnoseTableSql10(),
      );
      if (parseInt(invalidGrade.rows[0].count) > 0) {
        issues.push(
          `${invalidGrade.rows[0].count} nota(s) de competência fora do intervalo [0.0 - 10.0].`,
        );
      }
      break;
    }
    case "tarefas": {
      const orfaosCriador = await repository.query(
        repository.diagnoseTableSql11(),
      );
      if (parseInt(orfaosCriador.rows[0].count) > 0) {
        issues.push(
          `${orfaosCriador.rows[0].count} tarefa(s) vinculada(s) a criador de usuário inexistente.`,
        );
      }
      const orfaosCompTarefa = await repository.query(
        repository.diagnoseTableSql12(),
      );
      if (parseInt(orfaosCompTarefa.rows[0].count) > 0) {
        issues.push(
          `${orfaosCompTarefa.rows[0].count} tarefa(s) referenciando competência inexistente.`,
        );
      }
      break;
    }
    case "tarefas_alunos": {
      const orfaosTarefasAlunos = await repository.query(
        repository.diagnoseTableSql13(),
      );
      if (parseInt(orfaosTarefasAlunos.rows[0].count) > 0) {
        issues.push(
          `${orfaosTarefasAlunos.rows[0].count} registro(s) de tarefa atribuída órfão(s).`,
        );
      }
      const invalidTaskGrade = await repository.query(
        repository.diagnoseTableSql14(),
      );
      if (parseInt(invalidTaskGrade.rows[0].count) > 0) {
        issues.push(
          `${invalidTaskGrade.rows[0].count} nota(s) de tarefa atribuída fora do limite [0.0 - 10.0].`,
        );
      }
      const invalidStatus = await repository.query(
        repository.diagnoseTableSql15(),
      );
      if (parseInt(invalidStatus.rows[0].count) > 0) {
        issues.push(
          `${invalidStatus.rows[0].count} registro(s) com status de entrega inválido.`,
        );
      }
      break;
    }
    case "usuarios": {
      const invalidCargo = await repository.query(
        repository.diagnoseTableSql16(),
      );
      if (parseInt(invalidCargo.rows[0].count) > 0) {
        issues.push(
          `${invalidCargo.rows[0].count} usuário(s) com cargo inconsistente.`,
        );
      }
      const invalidStatusUser = await repository.query(
        repository.diagnoseTableSql17(),
      );
      if (parseInt(invalidStatusUser.rows[0].count) > 0) {
        issues.push(
          `${invalidStatusUser.rows[0].count} usuário(s) com status inconsistente.`,
        );
      }
      break;
    }
    case "solicitacoes_senha": {
      const orfaosSolicitacoes = await repository.query(
        repository.diagnoseTableSql18(),
      );
      if (parseInt(orfaosSolicitacoes.rows[0].count) > 0) {
        issues.push(
          `${orfaosSolicitacoes.rows[0].count} solicitação(ões) de redefinição de usuário inexistente.`,
        );
      }
      const solicitacoesAntigas = await repository.query(
        repository.diagnoseTableSql19(),
      );
      if (parseInt(solicitacoesAntigas.rows[0].count) > 0) {
        issues.push(
          `${solicitacoesAntigas.rows[0].count} solicitação(ões) pendente(s) há mais de 30 dias.`,
        );
      }
      break;
    }
    case "notificacoes": {
      const orfaosNotificacoes = await repository.query(
        repository.diagnoseTableSql20(),
      );
      if (parseInt(orfaosNotificacoes.rows[0].count) > 0) {
        issues.push(
          `${orfaosNotificacoes.rows[0].count} notificação(ões) órfã(s) ou sem destinatário válido.`,
        );
      }
      break;
    }
    case "configuracoes_notificacoes": {
      const orfaosConfig = await repository.query(
        repository.diagnoseTableSql21(),
      );
      if (parseInt(orfaosConfig.rows[0].count) > 0) {
        issues.push(
          `${orfaosConfig.rows[0].count} configuração(ões) de notificação de usuário/aluno inexistente.`,
        );
      }
      break;
    }
    case "ia_conversas": {
      const orfaosConversas = await repository.query(
        repository.diagnoseTableSql22(),
      );
      if (parseInt(orfaosConversas.rows[0].count) > 0) {
        issues.push(
          `${orfaosConversas.rows[0].count} conversa(s) de IA órfã(s).`,
        );
      }
      break;
    }
    case "ia_mensagens": {
      const orfaosMensagens = await repository.query(
        repository.diagnoseTableSql23(),
      );
      if (parseInt(orfaosMensagens.rows[0].count) > 0) {
        issues.push(
          `${orfaosMensagens.rows[0].count} mensagem(ns) de IA pertencentes a conversas inexistentes.`,
        );
      }
      break;
    }
  }
  return {
    table: tableName,
    exists: true,
    totalRows,
    hasIssues: issues.length > 0,
    issuesCount: issues.length,
    issues,
  };
}

async function repairSystem(targetTable = "all") {
  if (targetTable !== "all" && !SYSTEM_TABLES.includes(targetTable)) {
    const error = new Error("Tabela de reparo inválida.");
    error.code = "INVALID_TARGET_TABLE";
    throw error;
  }
  const tablesToRepair = targetTable === "all" ? SYSTEM_TABLES : [targetTable];
  const client = await repository.connect();
  const summary = [];
  const credenciais = [];
  try {
    await client.query(repository.repairSystemSql1());
    for (const tableName of tablesToRepair) {
      switch (tableName) {
        case "alunos": {
          const fixPresenca = await client.query(repository.repairSystemSql2());
          if (fixPresenca.rowCount > 0) {
            summary.push(
              `[alunos] ${fixPresenca.rowCount} registro(s) de presença ajustado(s) para o limite legal (0-100%).`,
            );
          }
          const fixNota = await client.query(repository.repairSystemSql3());
          if (fixNota.rowCount > 0) {
            summary.push(
              `[alunos] ${fixNota.rowCount} média(s) fora do intervalo ajustada(s) para valores entre 0.0 e 10.0.`,
            );
          }
          const fixIdade = await client.query(repository.repairSystemSql4());
          if (fixIdade.rowCount > 0) {
            summary.push(
              `[alunos] ${fixIdade.rowCount} idade(s) ajustada(s) para a faixa permitida [10 - 20].`,
            );
          }
          const semLoginRes = await client.query(repository.repairSystemSql5());
          if (semLoginRes.rows.length > 0) {
            for (const aluno of semLoginRes.rows) {
              const matricula = `MAT${String(aluno.id).padStart(5, "0")}`;
              const emailPrefix = aluno.nome
                .toLowerCase()
                .replace(/[^a-z0-9]/g, ".")
                .replace(/\.+/g, ".")
                .slice(0, 30);
              const email = `${emailPrefix}${aluno.id}@escola.com`;
              const defaultPass =
                require("../../domain/validation").randomPassword();
              const hash = await bcrypt.hash(defaultPass);
              credenciais.push({
                nome: aluno.nome,
                email,
                matricula,
                senha: defaultPass,
              });
              await client.query(repository.repairSystemSql6(), [
                aluno.nome,
                email,
                hash,
                matricula,
                aluno.id,
              ]);
            }
            summary.push(
              `[alunos_login] Geradas ${semLoginRes.rows.length} nova(s) credencial(is) de acesso para aluno(s) sem login.`,
            );
          }
          break;
        }
        case "alunos_login": {
          const delOrfaosLogin = await client.query(
            repository.repairSystemSql7(),
          );
          if (delOrfaosLogin.rowCount > 0) {
            summary.push(
              `[alunos_login] ${delOrfaosLogin.rowCount} conta(s) de login órfã(s) sem aluno associado foram removida(s).`,
            );
          }
          break;
        }
        case "aluno_competencias": {
          const delOrfaosComp = await client.query(
            repository.repairSystemSql8(),
          );
          if (delOrfaosComp.rowCount > 0) {
            summary.push(
              `[aluno_competencias] ${delOrfaosComp.rowCount} avaliação(ões) órfã(s) removida(s).`,
            );
          }
          const fixNotasComp = await client.query(
            repository.repairSystemSql9(),
          );
          if (fixNotasComp.rowCount > 0) {
            summary.push(
              `[aluno_competencias] ${fixNotasComp.rowCount} nota(s) de competência corrigida(s) para o limite [0.0 - 10.0].`,
            );
          }
          break;
        }
        case "tarefas": {
          const fixCriador = await client.query(repository.repairSystemSql10());
          if (fixCriador.rowCount > 0) {
            summary.push(
              `[tarefas] ${fixCriador.rowCount} tarefa(s) com criador inexistente foram desvinculadas com segurança.`,
            );
          }
          const fixCompTarefa = await client.query(
            repository.repairSystemSql11(),
          );
          if (fixCompTarefa.rowCount > 0) {
            summary.push(
              `[tarefas] ${fixCompTarefa.rowCount} tarefa(s) com competência inexistente foram desvinculadas.`,
            );
          }
          break;
        }
        case "tarefas_alunos": {
          const delOrfaosTA = await client.query(
            repository.repairSystemSql12(),
          );
          if (delOrfaosTA.rowCount > 0) {
            summary.push(
              `[tarefas_alunos] ${delOrfaosTA.rowCount} registro(s) de tarefa atribuída órfão(s) excluído(s).`,
            );
          }
          const fixTaskNotas = await client.query(
            repository.repairSystemSql13(),
          );
          if (fixTaskNotas.rowCount > 0) {
            summary.push(
              `[tarefas_alunos] ${fixTaskNotas.rowCount} nota(s) de tarefa ajustada(s) para a faixa válida [0.0 - 10.0].`,
            );
          }
          const fixStatus = await client.query(repository.repairSystemSql14());
          if (fixStatus.rowCount > 0) {
            summary.push(
              `[tarefas_alunos] ${fixStatus.rowCount} status corrompido(s) redefinido(s) para 'PENDENTE'.`,
            );
          }
          break;
        }
        case "usuarios": {
          const fixCargo = await client.query(repository.repairSystemSql15());
          if (fixCargo.rowCount > 0) {
            summary.push(
              `[usuarios] ${fixCargo.rowCount} usuário(s) com cargo inválido foram redefinidos para 'Professor'.`,
            );
          }
          const fixStatusU = await client.query(repository.repairSystemSql16());
          if (fixStatusU.rowCount > 0) {
            summary.push(
              `[usuarios] ${fixStatusU.rowCount} usuário(s) com status corrompido foram ajustados para 'INATIVO'.`,
            );
          }
          break;
        }
        case "solicitacoes_senha": {
          const delOrfaosSol = await client.query(
            repository.repairSystemSql17(),
          );
          if (delOrfaosSol.rowCount > 0) {
            summary.push(
              `[solicitacoes_senha] ${delOrfaosSol.rowCount} solicitação(ões) de usuário inexistente foram removidas.`,
            );
          }
          const rejAntigas = await client.query(repository.repairSystemSql18());
          if (rejAntigas.rowCount > 0) {
            summary.push(
              `[solicitacoes_senha] ${rejAntigas.rowCount} solicitação(ões) pendente(s) há mais de 30 dias foram encerradas.`,
            );
          }
          break;
        }
        case "notificacoes": {
          const delNotif = await client.query(repository.repairSystemSql19());
          if (delNotif.rowCount > 0) {
            summary.push(
              `[notificacoes] ${delNotif.rowCount} notificação(ões) órfã(s) removida(s).`,
            );
          }
          break;
        }
        case "configuracoes_notificacoes": {
          const delCfg = await client.query(repository.repairSystemSql20());
          if (delCfg.rowCount > 0) {
            summary.push(
              `[configuracoes_notificacoes] ${delCfg.rowCount} configuração(ões) de notificação órfã(s) excluída(s).`,
            );
          }
          break;
        }
        case "ia_conversas": {
          const delConv = await client.query(repository.repairSystemSql21());
          if (delConv.rowCount > 0) {
            summary.push(
              `[ia_conversas] ${delConv.rowCount} conversa(s) de IA órfã(s) removida(s).`,
            );
          }
          break;
        }
        case "ia_mensagens": {
          const delMsg = await client.query(repository.repairSystemSql22());
          if (delMsg.rowCount > 0) {
            summary.push(
              `[ia_mensagens] ${delMsg.rowCount} mensagem(ns) de IA órfã(s) excluída(s).`,
            );
          }
          break;
        }
      }
    }
    await client.query(repository.repairSystemSql23());
    if (summary.length === 0) {
      summary.push(
        "Nenhuma anomalia ou dado corrompido necessitava de intervenção. A base está completamente íntegra.",
      );
    }
    return {
      success: true,
      changesCount: summary.length,
      credenciais,
      summary,
    };
  } catch (err) {
    await client.query(repository.repairSystemSql24());
    console.error("Erro durante o reparo de banco de dados:", err);
    throw err;
  } finally {
    client.release();
  }
}
module.exports = {
  SYSTEM_TABLES,
  runSystemCheckup,
  diagnoseTable,
  repairSystem,
};
