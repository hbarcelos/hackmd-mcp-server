import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as cli from "../src/cli.js";

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

  it("requires HACKMD_API_TOKEN before starting the MCP server", async () => {
    const configureNetworking = vi.fn();
    const connect = vi.fn();

    await expect(
      runCli({
        env: {},
        configureNetworking,
        createTransport: vi.fn(),
        createServerFromClient: vi.fn(() => ({ connect })),
        stdin: fakeStdin(),
      }),
    ).rejects.toThrow("HACKMD_API_TOKEN is required");

    expect(configureNetworking).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it("clears the keepalive interval when server connection fails", async () => {
    vi.useFakeTimers();

    await expect(
      runCli({
        env: { HACKMD_API_TOKEN: "token" },
        configureNetworking: vi.fn(),
        createTransport: vi.fn(),
        createServerFromClient: vi.fn(() => ({
          connect: vi.fn().mockRejectedValue(new Error("connect failed")),
        })),
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
