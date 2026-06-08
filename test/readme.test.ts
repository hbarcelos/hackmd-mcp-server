import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("README Codex npx configuration", () => {
  it("uses a cwd-independent npx prefix", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("npx -y --prefix /tmp hackmd-mcp-server@{VERSION}");
    expect(readme).toContain('args = ["-y", "--prefix", "/tmp", "hackmd-mcp-server@{VERSION}"]');
  });
});
