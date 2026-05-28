import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadConfig, loadEnvironment, loadGitHubConfig } from "../src/config.js";

let tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs = [];
});

describe("loadEnvironment", () => {
  it("loads supported variables from a dotenv file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "hackmd-mcp-config-"));
    tempDirs.push(tempDir);
    const envFilePath = join(tempDir, ".env");
    writeFileSync(
      envFilePath,
      [
        "HACKMD_API_TOKEN=hackmd-token",
        "HACKMD_API_URL=https://hackmd.example/v1/",
        "GITHUB_TOKEN='github-token'",
        'GITHUB_API_URL="https://github.example/api/v3/"',
        "HACKMD_MCP_STATE_PATH=/tmp/hackmd-state.json",
        "IGNORED_SECRET=do-not-load",
      ].join("\n"),
    );

    expect(loadEnvironment({ env: {}, envFilePath })).toEqual({
      HACKMD_API_TOKEN: "hackmd-token",
      HACKMD_API_URL: "https://hackmd.example/v1/",
      GITHUB_TOKEN: "github-token",
      GITHUB_API_URL: "https://github.example/api/v3/",
      HACKMD_MCP_STATE_PATH: "/tmp/hackmd-state.json",
    });
  });

  it("keeps inherited environment variables ahead of dotenv values", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "hackmd-mcp-config-"));
    tempDirs.push(tempDir);
    const envFilePath = join(tempDir, ".env");
    writeFileSync(envFilePath, "HACKMD_API_TOKEN=dotenv-token\nGITHUB_TOKEN=dotenv-github-token\n");

    expect(
      loadEnvironment({
        env: { HACKMD_API_TOKEN: "inherited-token" },
        envFilePath,
      }),
    ).toMatchObject({
      HACKMD_API_TOKEN: "inherited-token",
      GITHUB_TOKEN: "dotenv-github-token",
    });
  });
});

describe("loadConfig", () => {
  it("requires HACKMD_API_TOKEN", () => {
    expect(() => loadConfig({})).toThrow("HACKMD_API_TOKEN is required");
  });

  it("can defer the missing token error for library callers", () => {
    expect(loadConfig({}, { requireApiToken: false })).toEqual({
      apiToken: undefined,
      apiUrl: "https://api.hackmd.io/v1",
    });
  });

  it("uses the default HackMD API URL", () => {
    expect(loadConfig({ HACKMD_API_TOKEN: "token" })).toEqual({
      apiToken: "token",
      apiUrl: "https://api.hackmd.io/v1",
    });
  });

  it("allows overriding the HackMD API URL without a trailing slash", () => {
    expect(
      loadConfig({
        HACKMD_API_TOKEN: "token",
        HACKMD_API_URL: "https://example.test/v1/",
      }),
    ).toEqual({
      apiToken: "token",
      apiUrl: "https://example.test/v1",
    });
  });
});

describe("loadGitHubConfig", () => {
  it("loads optional GitHub sync configuration", () => {
    expect(loadGitHubConfig({})).toEqual({
      apiToken: undefined,
      apiUrl: "https://api.github.com",
      statePath: undefined,
    });
  });

  it("allows overriding GitHub API URL and sync state path", () => {
    expect(
      loadGitHubConfig({
        GITHUB_TOKEN: "ghs_secret",
        GITHUB_API_URL: "https://github.example/api/v3/",
        HACKMD_MCP_STATE_PATH: "/tmp/hackmd-state.json",
      }),
    ).toEqual({
      apiToken: "ghs_secret",
      apiUrl: "https://github.example/api/v3",
      statePath: "/tmp/hackmd-state.json",
    });
  });
});
