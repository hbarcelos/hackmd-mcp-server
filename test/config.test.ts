import { describe, expect, it } from "vitest";

import { loadConfig, loadGitHubConfig } from "../src/config.js";

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
