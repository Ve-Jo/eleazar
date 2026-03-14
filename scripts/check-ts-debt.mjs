import fs from "fs";
import path from "path";

const args = process.argv.slice(2);

const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
};

const targetArg = getArgValue("--target");
const maxJsFilesArg = getArgValue("--max-js-files");
const maxAnyArg = getArgValue("--max-any");
const maxAsAnyArg = getArgValue("--max-as-any");
const maxColonAnyArg = getArgValue("--max-colon-any");

if (!targetArg || !maxJsFilesArg || !maxAnyArg) {
  console.error(
    "Usage: bun check-ts-debt.mjs --target <path> --max-js-files <number> --max-any <number>"
  );
  process.exit(1);
}

const rootPath = path.resolve(process.cwd(), targetArg);
const maxJsFiles = Number(maxJsFilesArg);
const maxAny = Number(maxAnyArg);

if (!Number.isFinite(maxJsFiles) || !Number.isFinite(maxAny)) {
  console.error("--max-js-files and --max-any must be valid numbers");
  process.exit(1);
}

const ignoredDirectories = new Set([
  "node_modules",
  ".git",
  ".turbo",
  "dist",
  "build",
  "coverage",
]);

const codeExtensions = new Set([".ts", ".js", ".d.ts", ".tsx", ".jsx"]);

let jsFileCount = 0;
let anyCount = 0;
let asAnyCount = 0;
let colonAnyCount = 0;

const walk = (currentPath) => {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walk(entryPath);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (entry.name.endsWith(".js")) {
      jsFileCount += 1;
    }

    if (!codeExtensions.has(path.extname(entry.name)) && !entry.name.endsWith(".d.ts")) {
      continue;
    }

    const content = fs.readFileSync(entryPath, "utf8");
    const matches = content.match(/\bany\b/g);
    anyCount += matches ? matches.length : 0;
    const asAnyMatches = content.match(/\bas\s+any\b/g);
    asAnyCount += asAnyMatches ? asAnyMatches.length : 0;
    const colonAnyMatches = content.match(/:\s*any\b/g);
    colonAnyCount += colonAnyMatches ? colonAnyMatches.length : 0;
  }
};

walk(rootPath);

console.log(`[ts-debt] target=${targetArg}`);
console.log(`[ts-debt] js_files=${jsFileCount} max=${maxJsFiles}`);
console.log(`[ts-debt] any_usages=${anyCount} max=${maxAny}`);
console.log(
  `[ts-debt] as_any_usages=${asAnyCount} max=${
    maxAsAnyArg !== null ? Number(maxAsAnyArg) : "n/a"
  }`
);
console.log(
  `[ts-debt] colon_any_usages=${colonAnyCount} max=${
    maxColonAnyArg !== null ? Number(maxColonAnyArg) : "n/a"
  }`
);

const failures = [];

if (jsFileCount > maxJsFiles) {
  failures.push(`js_files ${jsFileCount} exceeds max ${maxJsFiles}`);
}

if (anyCount > maxAny) {
  failures.push(`any_usages ${anyCount} exceeds max ${maxAny}`);
}

if (maxAsAnyArg !== null) {
  const maxAsAny = Number(maxAsAnyArg);
  if (!Number.isFinite(maxAsAny)) {
    console.error("--max-as-any must be a valid number when provided");
    process.exit(1);
  }
  if (asAnyCount > maxAsAny) {
    failures.push(`as_any_usages ${asAnyCount} exceeds max ${maxAsAny}`);
  }
}

if (maxColonAnyArg !== null) {
  const maxColonAny = Number(maxColonAnyArg);
  if (!Number.isFinite(maxColonAny)) {
    console.error("--max-colon-any must be a valid number when provided");
    process.exit(1);
  }
  if (colonAnyCount > maxColonAny) {
    failures.push(`colon_any_usages ${colonAnyCount} exceeds max ${maxColonAny}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[ts-debt] ${failure}`);
  }
  process.exit(1);
}
