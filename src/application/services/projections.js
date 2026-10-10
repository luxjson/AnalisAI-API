const { gradeClass, studentLevel, mean } = require("../../domain/performance");
function project(value) {
  if (Array.isArray(value)) return value.map(project);
  if (
    !value ||
    typeof value !== "object" ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  )
    return value;
  const result = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, project(item)]),
  );
  const grade = result.nota ?? result.media_dia ?? result.media;
  if (grade !== undefined) {
    const numeric =
      result.categoria &&
      result.soma !== undefined &&
      result.media !== undefined
        ? Number(result.media) / 10
        : Number(grade);
    result.gradeClass = gradeClass(numeric);
    result.gradeColor = {
      apto: "#217346",
      desenvolvimento: "#d4a017",
      inapto: "#ff0101",
    }[result.gradeClass];
    result.gradeChartColor = {
      apto: "rgba(0, 255, 0, 0.5)",
      desenvolvimento: "rgba(255, 255, 0, 0.5)",
      inapto: "rgba(255, 0, 0, 0.5)",
    }[result.gradeClass];
  }
  if (
    result.ano_escolar &&
    Array.isArray(result.competencias) &&
    result.presenca !== undefined
  ) {
    result.media_competencias = mean(result.competencias);
    result.nivel = studentLevel(
      result.media_competencias,
      Number(result.presenca),
    );
    result.nivelClass =
      result.nivel === "APTO"
        ? "apto"
        : result.nivel === "INAPTO"
          ? "inapto"
          : "em-desenvolvimento";
  }
  if (result.mediaGeral !== undefined)
    result.mediaGeralClass = gradeClass(result.mediaGeral);
  if (Array.isArray(result.competencias))
    result.performanceSummary = {
      avaliadas: result.competencias.length,
      aptas: result.competencias.filter((c) => c.gradeClass === "apto").length,
      melhorar: result.competencias.filter((c) => c.gradeClass === "inapto")
        .length,
    };
  if (Array.isArray(result.alunos)) {
    result.schoolSummary = {};
    for (const group of ["MÉDIO", "FUNDAMENTAL"]) {
      const students = result.alunos.filter((a) =>
        a.ano_escolar?.includes(group),
      );
      result.schoolSummary[group] = {
        total: students.length,
        apto: students.filter((a) => a.nivel === "APTO").length,
        inapto: students.filter((a) => a.nivel === "INAPTO").length,
        desenvolvimento: students.filter(
          (a) => a.nivel === "EM DESENVOLVIMENTO",
        ).length,
      };
    }
  }
  if (
    result.filtros?.mes &&
    result.filtros?.ano &&
    Array.isArray(result.eventos) &&
    Array.isArray(result.feriados)
  ) {
    const { ano, mes } = result.filtros;
    const last = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dayOnly = (value) =>
      String(value instanceof Date ? value.toISOString() : value).slice(0, 10);
    result.calendar = {
      startWeek: new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay(),
      days: Array.from(
        {
          length: last,
        },
        (_, index) => {
          const dia = index + 1;
          const date = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          return {
            dia,
            date,
            eventos: result.eventos.filter(
              (e) =>
                dayOnly(e.data_inicio) <= date &&
                dayOnly(e.data_fim || e.data_inicio) >= date,
            ),
            feriados: result.feriados.filter(
              (f) => dayOnly(f.data).slice(5) === date.slice(5),
            ),
          };
        },
      ),
    };
  }
  return result;
}
module.exports = {
  project,
};
