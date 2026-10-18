const test = require("node:test");
const assert = require("node:assert/strict");
const validation = require("../src/domain/validation");

test("normalizes valid email addresses and rejects malformed input", () => {
  assert.equal(validation.email("  Professor@SENAI.COM "), "professor@senai.com");
  assert.equal(validation.email("not-an-email"), null);
  assert.equal(validation.email("a@b"), null);
});

test("accepts common Portuguese names and rejects names containing digits", () => {
  assert.equal(validation.personName("João da Silva"), "João da Silva");
  assert.equal(validation.personName("Ana-Maria D'Ávila"), "Ana-Maria D'Ávila");
  assert.equal(validation.personName("Aluno 123"), null);
});

test("enforces password length boundaries", () => {
  assert.equal(validation.password("123456789012"), "123456789012");
  assert.equal(validation.password("short"), null);
  assert.equal(validation.password("a".repeat(129)), null);
});

test("accepts only positive safe integer identifiers", () => {
  assert.equal(validation.integerId("42"), 42);
  assert.equal(validation.integerId(7), 7);
  assert.equal(validation.integerId("0"), null);
  assert.equal(validation.integerId("-1"), null);
  assert.equal(validation.integerId("1abc"), null);
  assert.equal(validation.integerId("9007199254740992"), null);
});

test("validates calendar dates instead of accepting rollover dates", () => {
  assert.equal(validation.dateOnly("2024-02-29"), "2024-02-29");
  assert.equal(validation.dateOnly("2023-02-29"), null);
  assert.equal(validation.dateOnly("2024-13-01"), null);
});

test("validates ranges, color values, and boolean inputs", () => {
  assert.equal(validation.numberInRange("7.5", 0, 10), 7.5);
  assert.equal(validation.numberInRange("11", 0, 10), null);
  assert.equal(validation.hexColor("#12aBcD"), "#12aBcD");
  assert.equal(validation.hexColor("red"), null);
  assert.equal(validation.booleanValue("false"), false);
  assert.equal(validation.booleanValue("yes"), null);
});

test("allows the coordinator role used by the application", () => {
  assert.deepEqual(validation.ALLOWED_CARGOS, ["Professor", "Coordenador", "Admin"]);
});
