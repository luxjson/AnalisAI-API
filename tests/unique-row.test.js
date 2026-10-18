const test = require("node:test");
const assert = require("node:assert/strict");
const { uniqueRow } = require("../src/domain/uniqueRow");

test("returns a row when a lookup has exactly one match", () => {
  const row = { id: 7, nome: "Ana Silva" };
  assert.equal(uniqueRow([row]), row);
});

test("refuses zero, ambiguous, and malformed lookup results", () => {
  assert.equal(uniqueRow([]), null);
  assert.equal(uniqueRow([{ id: 1 }, { id: 2 }]), null);
  assert.equal(uniqueRow(null), null);
  assert.equal(uniqueRow({ id: 1 }), null);
});

test("AI grade actions require unique student and competency lookup queries", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const repository = fs.readFileSync(
    path.join(root, "src/infrastructure/repositories/aiUseCasesRepository.js"),
    "utf8",
  );
  const useCases = fs.readFileSync(
    path.join(root, "src/application/useCases/aiUseCases.js"),
    "utf8",
  );
  assert.match(repository, /detectGradeActionSql1[\s\S]*?LIMIT 2/);
  assert.match(repository, /detectGradeActionSql2[\s\S]*?LIMIT 2/);
  assert.match(useCases, /uniqueRow\(student\.rows\)/);
  assert.match(useCases, /uniqueRow\(competency\.rows\)/);
});
