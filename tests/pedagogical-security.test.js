const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) =>
  fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("class-scoped routes rate-limit before the database-backed ownership middleware", () => {
  const source = read("src/presentation/routes.js");
  const routeBlocks = source
    .split(/(?=router\.(?:get|post|patch|put|delete)\s*\()/)
    .slice(1);
  const scopedRoutes = routeBlocks.filter((block) => block.includes("checkAssignedClass"));

  assert.ok(scopedRoutes.length >= 15, "expected class-scoped routes to be registered");
  for (const block of scopedRoutes) {
    const scopeIndex = block.indexOf("checkAssignedClass");
    const rateLimitIndex = block.indexOf("rateLimit(");
    const route = block.match(/router\.(\w+)\s*\(\s*["']([^"']+)["']/);
    assert.ok(
      rateLimitIndex >= 0 && rateLimitIndex < scopeIndex,
      `${route?.[1] || "route"} ${route?.[2] || "(unknown)"} must rate-limit before class ownership queries`,
    );
  }
});

test("task class filters remain parameterized SQL", () => {
  const source = read("src/infrastructure/repositories/tarefaUseCasesRepository.js");
  assert.ok(
    source.includes('exports.listarSql2 = (part0) => " AND t.turma = $" + part0;'),
    "class filters must use a PostgreSQL placeholder, never inline a value",
  );
});

test("the Express IP limiter is mounted before every API route", () => {
  const source = read("src/presentation/app.js");
  const limiterImport = source.indexOf('require("express-rate-limit")');
  const limiterMount = source.indexOf("app.use(apiRateLimit)");
  const firstRoute = source.indexOf('app.get("/health"');
  assert.ok(limiterImport >= 0, "standard Express rate limiter must be imported");
  assert.ok(limiterMount >= 0, "standard Express rate limiter must be mounted");
  assert.ok(firstRoute >= 0, "health route must be registered");
  assert.ok(limiterImport < limiterMount, "rate limiter must be created before mounting");
  assert.ok(limiterMount < firstRoute, "rate limiter must run before route handlers");
});
