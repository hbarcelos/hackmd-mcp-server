import { setDefaultResultOrder } from "node:dns";
import { resolve6 } from "node:dns/promises";
import { connect, setDefaultAutoSelectFamily } from "node:net";
import { networkInterfaces } from "node:os";

const IPV6_REACHABILITY_TIMEOUT_MS = 1500;

export interface NativeFetchNetworkOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
  interfaces?: ReturnType<typeof networkInterfaces>;
  resolve6Host?: (host: string) => Promise<string[]>;
  connectToHost?: (host: string, port: number, timeoutMs: number) => Promise<void>;
  setDefaultAutoSelectFamily?: (value: boolean) => void;
  setDefaultResultOrder?: (order: "ipv4first" | "ipv6first" | "verbatim") => void;
}

export async function configureNativeFetchNetworking(options: NativeFetchNetworkOptions = {}): Promise<void> {
  const interfaces = options.interfaces ?? networkInterfaces();

  if (!hasGlobalIpv6Address(interfaces)) {
    configureIpv4Fallback(options);
    return;
  }

  const host = options.host ?? "api.hackmd.io";
  const port = options.port ?? 443;
  const timeoutMs = options.timeoutMs ?? IPV6_REACHABILITY_TIMEOUT_MS;
  const resolve6Host = options.resolve6Host ?? resolve6;
  const connectToHost = options.connectToHost ?? connectToHostWithTimeout;

  try {
    const addresses = await resolve6Host(host);
    if (addresses.length === 0) {
      configureIpv4Fallback(options);
      return;
    }

    await connectToFirstReachableHost(addresses, port, timeoutMs, connectToHost);
  } catch {
    configureIpv4Fallback(options);
  }
}

export function hasGlobalIpv6Address(interfaces: ReturnType<typeof networkInterfaces>): boolean {
  return Object.values(interfaces).some((addresses) =>
    addresses?.some(
      (address) => address.family === "IPv6" && !address.internal && isPublicIpv6Address(address.address),
    ),
  );
}

function configureIpv4Fallback(options: NativeFetchNetworkOptions): void {
  const setAutoSelectFamily = options.setDefaultAutoSelectFamily ?? setDefaultAutoSelectFamily;
  const setResultOrder = options.setDefaultResultOrder ?? setDefaultResultOrder;

  setAutoSelectFamily(false);
  setResultOrder("ipv4first");
}

async function connectToFirstReachableHost(
  hosts: string[],
  port: number,
  timeoutMs: number,
  connectToHost: (host: string, port: number, timeoutMs: number) => Promise<void>,
): Promise<void> {
  let lastError: unknown;

  for (const host of hosts) {
    try {
      await connectToHost(host, port, timeoutMs);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No reachable IPv6 address found");
}

function connectToHostWithTimeout(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port, timeout: timeoutMs });

    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`Timed out connecting to ${host}:${port}`));
    });
    socket.once("error", reject);
  });
}

function isPublicIpv6Address(address: string): boolean {
  const normalized = address.toLowerCase();

  return (
    !normalized.startsWith("fe80:") &&
    !normalized.startsWith("fc") &&
    !normalized.startsWith("fd") &&
    !normalized.startsWith("::1")
  );
}
