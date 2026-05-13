import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../src/cli.js";

describe("runCli", () => {
  afterEach(() => {
    vi.useRealTimers();
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
});

function fakeStdin(): Pick<NodeJS.ReadStream, "once" | "resume"> {
  return {
    once: vi.fn(),
    resume: vi.fn(),
  };
}
