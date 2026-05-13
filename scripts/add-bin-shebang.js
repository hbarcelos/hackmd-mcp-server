import { chmod, readFile, writeFile } from "node:fs/promises";

const binPath = new URL("../dist/cli.js", import.meta.url);
const shebang = "#!/usr/bin/env node\n";
const contents = await readFile(binPath, "utf8");

if (!contents.startsWith(shebang)) {
  await writeFile(binPath, `${shebang}${contents}`);
}

await chmod(binPath, 0o755);
