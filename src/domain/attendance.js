const ATTENDANCE_STATUSES = Object.freeze(["PRESENTE", "FALTA", "JUSTIFICADA"]);

function calendarDaysInYear(year) {
  if (!Number.isInteger(year) || year < 1 || year > 9999)
    throw new RangeError("Ano inválido.");
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0) ? 366 : 365;
}

function summarizeAttendance(records) {
  const summary = { total: 0, presentes: 0, faltas: 0, justificadas: 0, percentual: null };
  for (const record of records) {
    if (!ATTENDANCE_STATUSES.includes(record.status))
      throw new TypeError("Situação de frequência inválida.");
    summary.total += 1;
    if (record.status === "PRESENTE") summary.presentes += 1;
    if (record.status === "FALTA") summary.faltas += 1;
    if (record.status === "JUSTIFICADA") summary.justificadas += 1;
  }
  if (summary.total > 0)
    summary.percentual = Math.round((summary.presentes / summary.total) * 100);
  return summary;
}

module.exports = { ATTENDANCE_STATUSES, calendarDaysInYear, summarizeAttendance };
