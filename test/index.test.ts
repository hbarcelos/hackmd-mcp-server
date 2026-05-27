import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };
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

  it("advertises the package version during MCP initialization", async () => {
    const server = createServer(new HackMdClient({ apiToken: "token", apiUrl: "https://api.hackmd.io/v1" }));
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    try {
      await client.connect(clientTransport);

      expect(client.getServerVersion()).toEqual({
        name: "hackmd-mcp",
        version: packageJson.version,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
