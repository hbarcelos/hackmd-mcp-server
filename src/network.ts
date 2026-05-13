import { resolve6 } from "node:dns/promises";
import { connect, setDefaultAutoSelectFamily } from "node:net";
import { networkInterfaces } from "node:os";

export interface NativeFetchNetworkOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
  interfaces?: ReturnType<typeof networkInterfaces>;
  resolve6Host?: (host: string) => Promise<string[]>;
  connectToHost?: (host: string, port: number, timeoutMs: number) => Promise<void>;
  setDefaultAutoSelectFamily?: (value: boolean) => void;
}

export async function configureNativeFetchNetworking(
  options: NativeFetchNetworkOptions = {}
): Promise<void> {
  const interfaces = options.interfaces ?? networkInterfaces();

  if (!hasGlobalIpv6Address(interfaces)) {
    disableNetworkFamilyAutoselection(options);
    return;
  }

  const host = options.host ?? "api.hackmd.io";
  const port = options.port ?? 443;
  const timeoutMs = options.timeoutMs ?? 1500;
  const resolve6Host = options.resolve6Host ?? resolve6;
  const connectToHost = options.connectToHost ?? connectToHostWithTimeout;

  try {
    const addresses = await resolve6Host(host);
    if (addresses.length === 0) {
      disableNetworkFamilyAutoselection(options);
      return;
    }

    await Promise.any(addresses.map((address) => connectToHost(address, port, timeoutMs)));
  } catch {
    disableNetworkFamilyAutoselection(options);
  }
}

export function hasGlobalIpv6Address(interfaces: ReturnType<typeof networkInterfaces>): boolean {
  return Object.values(interfaces).some((addresses) =>
    addresses?.some(
      (address) =>
        address.family === "IPv6" && !address.internal && isPublicIpv6Address(address.address)
    )
  );
}

function disableNetworkFamilyAutoselection(options: NativeFetchNetworkOptions): void {
  const setAutoSelectFamily = options.setDefaultAutoSelectFamily ?? setDefaultAutoSelectFamily;

  setAutoSelectFamily(false);
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
