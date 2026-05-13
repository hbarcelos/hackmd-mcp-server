import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("requires HACKMD_API_TOKEN", () => {
    expect(() => loadConfig({})).toThrow("HACKMD_API_TOKEN is required");
  });

  it("can defer the missing token error for MCP startup", () => {
    expect(loadConfig({}, { requireApiToken: false })).toEqual({
      apiToken: undefined,
      apiUrl: "https://api.hackmd.io/v1"
    });
  });

  it("uses the default HackMD API URL", () => {
    expect(loadConfig({ HACKMD_API_TOKEN: "token" })).toEqual({
      apiToken: "token",
      apiUrl: "https://api.hackmd.io/v1"
    });
  });

  it("allows overriding the HackMD API URL without a trailing slash", () => {
    expect(
      loadConfig({
        HACKMD_API_TOKEN: "token",
        HACKMD_API_URL: "https://example.test/v1/"
      })
    ).toEqual({
      apiToken: "token",
      apiUrl: "https://example.test/v1"
    });
  });
});
