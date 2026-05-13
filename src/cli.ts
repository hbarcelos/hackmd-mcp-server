import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { HackMdClient } from "./hackmd/client.js";
import { createServer } from "./index.js";
import { configureNativeFetchNetworking } from "./network.js";

async function main(): Promise<void> {
  await configureNativeFetchNetworking();

  const config = loadConfig(process.env, { requireApiToken: false });
  const client = new HackMdClient(config);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  const keepAlive = setInterval(() => undefined, 1 << 30);

  process.stdin.once("end", () => {
    setImmediate(() => clearInterval(keepAlive));
  });

  await server.connect(transport);
  process.stdin.resume();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
