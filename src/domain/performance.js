// Original pedagogical thresholds. The client receives results, not these rules.
function gradeClass(value) {
  const n = Number(value) || 0;
  return n >= 7 ? "apto" : n >= 5 ? "desenvolvimento" : "inapto";
}
function studentLevel(average, attendance) {
  return average >= 7 && attendance >= 75
    ? "APTO"
    : average < 5 || attendance < 50
      ? "INAPTO"
      : "EM DESENVOLVIMENTO";
}
function mean(competencies) {
  return competencies.length
    ? competencies.reduce((sum, c) => sum + Number(c.nota || 0), 0) /
        competencies.length
    : 0;
}
module.exports = { gradeClass, studentLevel, mean };
