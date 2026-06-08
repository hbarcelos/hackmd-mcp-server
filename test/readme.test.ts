import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("README Codex npx configuration", () => {
  it("uses an npm alias package spec to avoid local package shadowing", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("npx -y npm:hackmd-mcp-server@{VERSION}");
    expect(readme).toContain('args = ["-y", "npm:hackmd-mcp-server@{VERSION}"]');
  });
});
