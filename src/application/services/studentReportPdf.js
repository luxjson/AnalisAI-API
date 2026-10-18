function normalizePdfText(value) {
  return String(value ?? "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\u0020-\u00ff]/g, "?");
}

function wrapLines(value, width = 88) {
  const words = normalizePdfText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (word.length > width) {
      if (line) lines.push(line);
      line = "";
      for (let offset = 0; offset < word.length; offset += width)
        lines.push(word.slice(offset, offset + width));
      continue;
    }
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function hexText(value) {
  return Buffer.from(normalizePdfText(value), "latin1").toString("hex").toUpperCase();
}

function makePdf(lines) {
  const pageChunks = [];
  for (let index = 0; index < lines.length; index += 50)
    pageChunks.push(lines.slice(index, index + 50));
  if (!pageChunks.length) pageChunks.push(["Relatorio pedagogico"]);

  const fontId = 3 + pageChunks.length * 2;
  const objects = new Map();
  const pageIds = pageChunks.map((_, index) => 3 + index * 2);
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageChunks.length} >>`,
  );

  pageChunks.forEach((chunk, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const body = [
      "BT",
      "/F1 10 Tf",
      "48 790 Td",
      "14 TL",
      ...chunk.map((line) => `<${hexText(line)}> Tj T*`),
      "ET",
    ].join("\n");
    const bodyLength = Buffer.byteLength(body, "latin1");
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.set(
      contentId,
      `<< /Length ${bodyLength} >>\nstream\n${body}\nendstream`,
    );
  });
  objects.set(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  const chunks = [Buffer.from("%PDF-1.4\n% AnalisAI\n", "latin1")];
  const offsets = [0];
  let offset = chunks[0].length;
  for (let id = 1; id <= fontId; id++) {
    const object = Buffer.from(`${id} 0 obj\n${objects.get(id)}\nendobj\n`, "latin1");
    offsets[id] = offset;
    chunks.push(object);
    offset += object.length;
  }
  const xrefOffset = offset;
  const xref = [
    "xref",
    `0 ${fontId + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((position) => `${String(position).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${fontId + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

function datePt(value) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

exports.buildStudentReport = ({ student, competencies, attendance, year, yearDays }) => {
  const total = Number(attendance.total_aulas || 0);
  const present = Number(attendance.presencas || 0);
  const percent = total ? Math.round((present / total) * 100) : null;
  const lines = [
    "AnalisAI | Relatorio pedagogico individual",
    "Painel de Analise de Desempenho por Competencias",
    "",
    `Aluno: ${student.nome}`,
    `Turma: ${student.ano_escolar}`,
    `Matricula: ${student.matricula || "Nao informada"}`,
    `Nivel registrado: ${student.nivel || "Em desenvolvimento"}`,
    `Ano de referencia: ${year} (${yearDays} dias no calendario)`,
    "",
    "FREQUENCIA",
    `Aulas com registro: ${total}`,
    `Presencas: ${present}`,
    `Faltas: ${Number(attendance.faltas || 0)}`,
    `Faltas justificadas: ${Number(attendance.justificadas || 0)}`,
    `Dias de aula registrados: ${Number(attendance.dias_registrados || 0)}`,
    `Frequencia calculada: ${percent === null ? "sem registros de aula" : percent + "%"}`,
    "Calculo: presencas divididas pelos periodos de aula registrados. Faltas justificadas permanecem no total de periodos, mas sao contabilizadas separadamente.",
    "",
    "COMPETENCIAS E HABILIDADES",
  ];
  if (!competencies.length) lines.push("Nenhuma avaliacao de competencia registrada.");
  competencies.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.nome} | Categoria: ${item.categoria || "Nao informada"} | Nota: ${item.nota}/10 | Data: ${datePt(item.data_registro)}`,
    );
    if (item.observacoes) lines.push(`   Observacao: ${item.observacoes}`);
  });
  lines.push("", `Gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, "Relatorio gerado a partir dos registros existentes no AnalisAI.");
  return makePdf(lines.flatMap((line) => wrapLines(line)));
};
