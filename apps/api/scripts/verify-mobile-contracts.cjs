const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const apiRoot = resolve(__dirname, "..");
const generatedPath = resolve(
  apiRoot,
  "../mobile/src/api/generated/openapi.ts",
);

const before = readFileSync(generatedPath);
const result = spawnSync("pnpm", ["generate:mobile-contracts"], {
  cwd: apiRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const after = readFileSync(generatedPath);
if (!before.equals(after)) {
  console.error(
    "Generated mobile contract changed during regeneration; worktree was stale.",
  );
  process.exit(1);
}

console.log("Generated mobile contract is deterministic and up to date.");
