const { parentPort, workerData } = require("node:worker_threads");
const XLSX = require("xlsx");
const {
  personName,
  numberInRange,
  ALLOWED_YEARS,
  text,
} = require("../domain/validation");
try {
  const bytes = Buffer.from(workerData);
  const binary =
    bytes.subarray(0, 2).toString() === "PK" ||
    bytes.subarray(0, 2).equals(Buffer.from([0xd0, 0xcf]));
  const wb = XLSX.read(binary ? bytes : bytes.toString("utf8"), {
    type: binary ? "buffer" : "string",
    sheetRows: 2000,
    cellFormula: false,
    cellHTML: false,
    bookVBA: false,
  });
  if (!wb.SheetNames.length) throw Error("Sem abas");
  const lines = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: null,
  });
  const header = lines
    .slice(0, 30)
    .findIndex((row) => row[0] === "ID" && row[1] === "ALUNO");
  if (header < 0) throw Error("Cabeçalho inválido");
  const alunos = [];
  for (const row of lines.slice(header + 1)) {
    if (/HISTÓRICO|INSTRUÇÕES/.test(String(row[0] || "").toUpperCase())) break;
    if (!row.some((v) => v !== null && v !== "")) continue;
    const nome = personName(
      String(row[1] ?? "")
        .trim()
        .toUpperCase(),
    );
    const ano_escolar = row[2];
    const idade = numberInRange(row[3] ?? 15, 10, 20);
    const presenca = numberInRange(
      String(row[5] ?? 100)
        .replace("%", "")
        .trim(),
      0,
      100,
    );
    if (
      !nome ||
      !ALLOWED_YEARS.includes(ano_escolar) ||
      idade === null ||
      !Number.isInteger(idade) ||
      presenca === null ||
      !Number.isInteger(presenca)
    )
      throw Error("Campos inválidos");
    const competencias = [];
    const value = String(row[7] ?? "").trim();
    if (value && value !== "Sem competências") {
      const parts = value.split(";").filter((v) => v.trim());
      if (parts.length > 10) throw Error("Limite de competências");
      for (const part of parts) {
        const separator = part.lastIndexOf(":");
        const comp = text(part.slice(0, separator).trim(), 100, { min: 1 });
        const nota = numberInRange(
          part
            .slice(separator + 1)
            .trim()
            .replace(",", "."),
          0,
          10,
        );
        if (separator < 1 || !comp || nota === null)
          throw Error("Competência inválida");
        competencias.push({ nome: comp, nota });
      }
    }
    alunos.push({ nome, ano_escolar, idade, presenca, competencias });
    if (alunos.length > 100) throw Error("Limite de 100 alunos por importação");
  }
  if (!alunos.length) throw Error("Sem alunos");
  parentPort.postMessage({ alunos });
} catch {
  parentPort.postMessage({ error: "Planilha inválida." });
}
