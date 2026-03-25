import { mkdir, writeFile } from "node:fs/promises";

await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../dist/README.txt", import.meta.url),
  "Build placeholder for Express backend.\n"
);

console.log("Backend build completed.");
