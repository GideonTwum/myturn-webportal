import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readVersion(pkgPath) {
  if (!existsSync(pkgPath)) return null;
  return JSON.parse(readFileSync(pkgPath, "utf8")).version;
}

const locations = [
  join(root, "node_modules/react/package.json"),
  join(root, "apps/mobile-app/node_modules/react/package.json"),
];

const versions = locations.map(readVersion).filter(Boolean);
const unique = [...new Set(versions)];

if (unique.length === 0) {
  console.error("FAIL: react is not installed. Run npm install from the repo root.");
  process.exit(1);
}

if (unique.length > 1) {
  console.error(`FAIL: multiple react versions: ${unique.join(", ")}`);
  locations.forEach((p, i) => {
    const v = readVersion(p);
    if (v) console.error(`  ${v} at ${p}`);
  });
  process.exit(1);
}

if (unique[0] !== "19.1.0") {
  console.warn(`WARN: expected react@19.1.0, got react@${unique[0]}`);
}

try {
  execSync("npm ls react react-native -w mobile-app --depth=0", {
    cwd: root,
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}

console.log(`OK: single react@${unique[0]} across the monorepo`);
