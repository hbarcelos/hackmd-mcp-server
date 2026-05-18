import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tagName = `v${packageJson.version}`;

function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");

  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return "";
  }

  console.log(printable);
  const result = execFileSync(command, args, { encoding: "utf8", stdio: options.stdio ?? "pipe" });

  return typeof result === "string" ? result.trim() : "";
}

function output(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function succeeds(command, args) {
  try {
    output(command, args);
    return true;
  } catch {
    return false;
  }
}

function assertCleanWorkingTree() {
  const status = output("git", ["status", "--porcelain"]);

  if (status) {
    if (dryRun) {
      console.log("[dry-run] working tree is not clean; real release would stop here");
      return;
    }

    throw new Error("Working tree must be clean before creating a GitHub release.");
  }
}

function localTagExists() {
  return succeeds("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tagName}`]);
}

function assertSignedLocalTag() {
  run("git", ["tag", "-v", tagName], { stdio: "inherit" });
}

function remoteTagExists() {
  return succeeds("gh", ["api", `repos/:owner/:repo/git/ref/tags/${tagName}`]);
}

function releaseExists() {
  if (dryRun) {
    return false;
  }

  return succeeds("gh", ["release", "view", tagName, "--json", "tagName"]);
}

function main() {
  assertCleanWorkingTree();

  if (!localTagExists()) {
    run("git", ["tag", "-a", tagName, "-m", tagName], { stdio: "inherit" });
  }

  assertSignedLocalTag();

  if (!remoteTagExists()) {
    run("git", ["push", "origin", tagName], { stdio: "inherit" });
  }

  if (!releaseExists()) {
    run("gh", ["release", "create", tagName, "--verify-tag", "--generate-notes", "--title", tagName], {
      stdio: "inherit",
    });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
