import { pathToFileURL } from "node:url";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { HackMdClient } from "./hackmd/client.js";
import { createServer } from "./index.js";
import { configureNativeFetchNetworking } from "./network.js";

const KEEP_ALIVE_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface ConnectableServer {
  connect(transport: StdioServerTransport): Promise<void>;
}

export interface CliOptions {
  env?: NodeJS.ProcessEnv;
  stdin?: Pick<NodeJS.ReadStream, "once" | "resume">;
  configureNetworking?: () => Promise<void>;
  createTransport?: () => StdioServerTransport;
  createServerFromClient?: (client: HackMdClient) => ConnectableServer;
}

export async function runCli(options: CliOptions = {}): Promise<void> {
  const env = options.env ?? process.env;
  const stdin = options.stdin ?? process.stdin;
  const configureNetworking = options.configureNetworking ?? configureNativeFetchNetworking;
  const makeTransport = options.createTransport ?? (() => new StdioServerTransport());
  const makeServer = options.createServerFromClient ?? createServer;

  const config = loadConfig(env);
  await configureNetworking();

  const client = new HackMdClient(config);
  const server = makeServer(client);
  const transport = makeTransport();
  // Stdio transports do not always keep the event loop alive by themselves.
  const keepAlive = setInterval(() => undefined, KEEP_ALIVE_INTERVAL_MS);

  stdin.once("end", () => {
    setImmediate(() => clearInterval(keepAlive));
  });

  try {
    await server.connect(transport);
  } catch (error) {
    clearInterval(keepAlive);
    throw error;
  }

  stdin.resume();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
