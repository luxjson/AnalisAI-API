const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
  });
}

function resolveRelative(importer, specifier) {
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    base, base + ".js", base + ".cjs", base + ".mjs", base + ".json", base + ".node",
    path.join(base, "index.js"), path.join(base, "index.cjs"),
    path.join(base, "index.mjs"), path.join(base, "index.json"),
  ];
  return candidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  });
}

const sourceFiles = [...walk(path.join(root, "src")), ...walk(path.join(root, "scripts")), ...walk(path.join(root, "tests"))]
  .filter((file) => /\.(?:js|cjs|mjs)$/.test(file) && path.resolve(file) !== path.resolve(__filename));

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  const patterns = [
    /\brequire\s*\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g,
    /\bfrom\s*(['"])(\.\.?\/[^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g,
    /\bimport\s*(['"])(\.\.?\/[^'"]+)\1/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (!resolveRelative(file, match[2])) {
        errors.push(path.relative(root, file) + ": unresolved local import " + match[2]);
      }
    }
  }
}

const routesPath = path.join(root, "src/presentation/routes.js");
const routesSource = fs.readFileSync(routesPath, "utf8");
const importBindings = new Map();
for (const match of routesSource.matchAll(/\bconst\s+(\w+)\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)/g)) {
  const target = resolveRelative(routesPath, match[3]);
  if (target) importBindings.set(match[1], target);
}
const routePattern = /router\.(get|post|patch|put|delete)\(\s*"([^"]+)"([\s\S]*?)(?=\nrouter\.(?:get|post|patch|put|delete)\(|\nconst spreadsheets|\nmodule\.exports)/g;
let routeCount = 0;
for (const match of routesSource.matchAll(routePattern)) {
  routeCount++;
  for (const handler of match[3].matchAll(/\bexecute\(\s*(\w+)\.(\w+)\s*\)/g)) {
    const target = importBindings.get(handler[1]);
    if (!target) {
      errors.push("routes.js: no module binding for handler " + handler[1] + "." + handler[2]);
      continue;
    }
    const moduleSource = fs.readFileSync(target, "utf8");
    if (!new RegExp("\\bexports\\." + handler[2] + "\\s*=").test(moduleSource)) {
      errors.push("routes.js: " + handler[1] + "." + handler[2] + " is not exported by " + path.relative(root, target));
    }
  }
  if (match[2].startsWith("/admin/") && !/\bcheckAdmin\b/.test(match[3])) {
    errors.push("routes.js: administrative route lacks checkAdmin: " + match[1].toUpperCase() + " " + match[2]);
  }
}
if (routeCount < 70) errors.push("routes.js: expected at least 70 registered routes, found " + routeCount);

for (const file of sourceFiles.filter((item) => item.startsWith(path.join(root, "src/application")))) {
  const content = fs.readFileSync(file, "utf8");
  for (const binding of content.matchAll(/\bconst\s+(\w+)\s*=\s*require\(\s*(['"])([^'"]*\/repositories\/[^'"]+)\2\s*\)/g)) {
    const target = resolveRelative(file, binding[3]);
    if (!target) continue;
    const repositorySource = fs.readFileSync(target, "utf8");
    for (const call of content.matchAll(new RegExp("\\b" + binding[1] + "\\.(\\w+)\\s*\\(", "g"))) {
      if (!new RegExp("\\bexports\\." + call[1] + "\\s*=").test(repositorySource)) {
        errors.push(path.relative(root, file) + ": repository method " + binding[1] + "." + call[1] + " missing from " + path.relative(root, target));
      }
    }
  }
}

const appSource = fs.readFileSync(path.join(root, "src/presentation/app.js"), "utf8");
if (!(appSource.indexOf("csrfProtection") >= 0 && appSource.indexOf("csrfProtection") < appSource.indexOf('require("./routes")'))) {
  errors.push("app.js: CSRF middleware must be mounted before API routes");
}

const openapiPath = path.join(root, "docs/openapi.json");
let openapi;
try {
  openapi = JSON.parse(fs.readFileSync(openapiPath, "utf8"));
} catch (error) {
  errors.push("docs/openapi.json: invalid JSON (" + error.message + ")");
}
function toOpenApiPath(value) {
  return value.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}
if (openapi) {
  if (!String(openapi.openapi || "").startsWith("3.")) errors.push("docs/openapi.json: missing OpenAPI 3 version");
  const paths = openapi.paths || {};
  const operationIds = new Set();
  for (const [pathname, operations] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(operations || {})) {
      if (!operation || typeof operation !== "object") continue;
      if (operation.operationId) {
        if (operationIds.has(operation.operationId)) {
          errors.push("docs/openapi.json: duplicate operationId " + operation.operationId);
        }
        operationIds.add(operation.operationId);
      }
      for (const response of Object.values(operation.responses || {})) {
        const ref = response && response.$ref;
        if (ref && ref.startsWith("#/components/")) {
          const parts = ref.slice(2).split("/");
          let target = openapi;
          for (const part of parts) target = target && target[part.replace(/~1/g, "/").replace(/~0/g, "~")];
          if (!target) errors.push("docs/openapi.json: unresolved reference " + ref + " in " + method.toUpperCase() + " " + pathname);
        }
      }
    }
  }
  const registered = [];
  for (const match of routesSource.matchAll(routePattern)) {
    registered.push([match[1].toLowerCase(), toOpenApiPath("/api/v1" + match[2])]);
  }
  registered.push(
    ["get", "/health"], ["get", "/api/v1"], ["get", "/api/v1/auth/session"],
    ["get", "/api/v1/openapi.json"], ["get", "/api/v1/arquivos/{filename}"],
  );
  for (const [method, pathname] of registered) {
    if (!paths[pathname] || !paths[pathname][method]) {
      errors.push("OpenAPI is missing " + method.toUpperCase() + " " + pathname);
    }
  }
}

const migrationDir = path.join(root, "migrations");
const migrationNames = fs.readdirSync(migrationDir).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
migrationNames.forEach((name, index) => {
  const expected = String(index + 1).padStart(3, "0") + "_";
  if (!name.startsWith(expected)) errors.push("Migration sequence gap or ordering issue at " + name);
});
if (!fs.readFileSync(path.join(root, "render.yaml"), "utf8").includes("rootDir: api")) {
  console.log("Render rootDir check: repository root is used.");
} else {
  errors.push("render.yaml: rootDir must not point to a nonexistent api/ directory");
}

if (errors.length) {
  console.error("Repository integrity check failed:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("Repository integrity passed: " + sourceFiles.length + " JS files, " + routeCount + " route declarations, local imports, controller exports, repository methods, OpenAPI coverage, and migrations.");
}
