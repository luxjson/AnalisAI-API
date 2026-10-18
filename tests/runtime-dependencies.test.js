const test = require("node:test");
const assert = require("node:assert/strict");

test("Argon2 runtime binding loads and exposes hash/verify APIs", () => {
  const argon2 = require("argon2");
  assert.equal(typeof argon2.hash, "function");
  assert.equal(typeof argon2.verify, "function");
});

test("API route composition loads without connecting to a live database", () => {
  process.env.NODE_ENV = "test";
  process.env.DB_URL ||= "postgresql://analisai_test:analisai_test@127.0.0.1:5432/analisai_test";
  process.env.APP_ORIGIN ||= "http://localhost:5173";
  process.env.SESSION_SECRET ||= "unit-test-session-secret-at-least-32-chars";

  const { createApp } = require("../src/presentation/app");
  assert.equal(typeof createApp, "function");
});
