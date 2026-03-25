import { readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../src/", import.meta.url);
const files = [];

async function walk(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  for (const entry of entries) {
    const entryUrl = new URL(entry.name, dirUrl);
    if (entry.isDirectory()) {
      await walk(new URL(`${entry.name}/`, dirUrl));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryUrl);
    }
  }
}

await walk(root);

for (const fileUrl of files) {
  try {
    execFileSync(process.execPath, ["--check", fileURLToPath(fileUrl)], {
      stdio: "pipe"
    });
  } catch (error) {
    console.error(`Syntax error in ${path.basename(fileUrl.pathname)}:`, error);
    process.exit(1);
  }
}

console.log(`Syntax check passed for ${files.length} source files.`);
