const test = require("node:test");
const assert = require("node:assert/strict");
const { calendarDaysInYear, summarizeAttendance } = require("../src/domain/attendance");
const { buildStudentReport } = require("../src/application/services/studentReportPdf");

test("calendar day count handles common and leap years", () => {
  assert.equal(calendarDaysInYear(2025), 365);
  assert.equal(calendarDaysInYear(2024), 366);
  assert.equal(calendarDaysInYear(2000), 366);
  assert.equal(calendarDaysInYear(2100), 365);
  assert.throws(() => calendarDaysInYear(0), RangeError);
});

test("attendance percentage is calculated from registered lesson periods, not calendar days", () => {
  const summary = summarizeAttendance([
    { status: "PRESENTE" },
    { status: "PRESENTE" },
    { status: "FALTA" },
    { status: "JUSTIFICADA" },
  ]);
  assert.deepEqual(summary, {
    total: 4,
    presentes: 2,
    faltas: 1,
    justificadas: 1,
    percentual: 50,
  });
  assert.equal(summarizeAttendance([]).percentual, null);
  assert.throws(() => summarizeAttendance([{ status: "INVALIDO" }]), TypeError);
});

test("student report service emits a PDF and does not invent 100% attendance when there are no records", () => {
  const pdf = buildStudentReport({
    student: { nome: "João da Silva", ano_escolar: "1º MÉDIO", matricula: "ALU123", nivel: "EM DESENVOLVIMENTO", presenca: 100 },
    competencies: [{ nome: "Comunicação", categoria: "Comportamental", nota: 8.5, observacoes: "Boa evolução", data_registro: "2026-04-01" }],
    attendance: { total_aulas: 0, presencas: 0, faltas: 0, justificadas: 0, dias_registrados: 0 },
    year: 2026,
    yearDays: 365,
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  const latin1 = pdf.toString("latin1");
  assert.ok(latin1.includes("/Type /Catalog"));
  assert.ok(latin1.includes("startxref"));
  assert.ok(latin1.includes("Relatorio pedagogico individual"));
  assert.ok(latin1.includes("sem registros de aula"));
});
