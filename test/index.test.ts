import { describe, expect, it } from "vitest";

import {
  createServer,
  FileGitHubSyncStateStore,
  GitHubClient,
  GitHubHttpError,
  GitHubNetworkError,
  HackMdClient,
  HackMdHttpError,
  HackMdNetworkError,
} from "../src/index.js";

describe("package root exports", () => {
  it("exports server and HackMD client APIs", () => {
    expect(createServer).toBeTypeOf("function");
    expect(HackMdClient).toBeTypeOf("function");
    expect(HackMdHttpError).toBeTypeOf("function");
    expect(HackMdNetworkError).toBeTypeOf("function");
    expect(GitHubClient).toBeTypeOf("function");
    expect(GitHubHttpError).toBeTypeOf("function");
    expect(GitHubNetworkError).toBeTypeOf("function");
    expect(FileGitHubSyncStateStore).toBeTypeOf("function");
  });
});
