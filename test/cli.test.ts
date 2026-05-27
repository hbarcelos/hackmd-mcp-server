import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as cli from "../src/cli.js";
import { createServer } from "../src/index.js";

import type { HackMdClient } from "../src/hackmd/client.js";

const { runCli } = cli;

describe("runCli", () => {
  let tempDirs: string[] = [];

  afterEach(() => {
    vi.useRealTimers();

    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }

    tempDirs = [];
  });

  it("starts the MCP server without HACKMD_API_TOKEN", async () => {
    const configureNetworking = vi.fn();
    const connect = vi.fn().mockResolvedValue(undefined);
    const createServerFromClient = vi.fn(() => ({ connect }));

    await runCli({
      env: {},
      configureNetworking,
      createTransport: vi.fn(),
      createServerFromClient,
      stdin: fakeStdin(),
    });

    expect(configureNetworking).toHaveBeenCalledOnce();
    expect(createServerFromClient).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledOnce();
  });

  it("clears the keepalive interval when server connection fails", async () => {
    vi.useFakeTimers();

    await expect(
      runCli({
        env: { HACKMD_API_TOKEN: "token" },
        configureNetworking: vi.fn(),
        createTransport: vi.fn(),
        createServerFromClient: vi.fn((client: HackMdClient) => {
          const server = createServer(client);
          vi.spyOn(server, "connect").mockRejectedValue(new Error("connect failed"));
          return server;
        }),
        stdin: fakeStdin(),
      }),
    ).rejects.toThrow("connect failed");

    expect(vi.getTimerCount()).toBe(0);
  });

  it("recognizes npm bin symlinks as CLI entrypoints", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "hackmd-mcp-cli-"));
    tempDirs.push(tempDir);

    const realCliPath = join(tempDir, "dist", "cli.js");
    const symlinkPath = join(tempDir, "node_modules", ".bin", "hackmd-mcp");
    mkdirSync(join(tempDir, "dist"), { recursive: true });
    mkdirSync(join(tempDir, "node_modules", ".bin"), { recursive: true });
    writeFileSync(realCliPath, "");
    symlinkSync(realCliPath, symlinkPath);

    const isCliEntrypoint = (
      cli as typeof cli & {
        isCliEntrypoint?: (moduleUrl: string, argvPath: string | undefined) => boolean;
      }
    ).isCliEntrypoint;

    expect(isCliEntrypoint?.(pathToFileURL(realCliPath).href, symlinkPath)).toBe(true);
  });
});

function fakeStdin(): Pick<NodeJS.ReadStream, "once" | "resume"> {
  return {
    once: vi.fn(),
    resume: vi.fn(),
  };
}
