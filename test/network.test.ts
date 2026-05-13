import { describe, expect, it, vi } from "vitest";

import { configureNativeFetchNetworking, hasGlobalIpv6Address } from "../src/network.js";

describe("hasGlobalIpv6Address", () => {
  it("ignores link-local and internal IPv6 addresses", () => {
    expect(
      hasGlobalIpv6Address({
        lo: [ipv6Address("::1", true)],
        wifi: [ipv6Address("fe80::1")]
      })
    ).toBe(false);
  });

  it("ignores unique local IPv6 addresses", () => {
    expect(hasGlobalIpv6Address({ wifi: [ipv6Address("fd00::1")] })).toBe(false);
  });

  it("detects public IPv6 addresses", () => {
    expect(hasGlobalIpv6Address(globalIpv6Interfaces())).toBe(true);
  });
});

describe("configureNativeFetchNetworking", () => {
  it("disables address family autoselection when no public IPv6 address exists", async () => {
    const setDefaultAutoSelectFamily = vi.fn();

    await configureNativeFetchNetworking({
      interfaces: {},
      setDefaultAutoSelectFamily
    });

    expect(setDefaultAutoSelectFamily).toHaveBeenCalledWith(false);
  });

  it("leaves address family autoselection enabled when IPv6 is reachable", async () => {
    const setDefaultAutoSelectFamily = vi.fn();

    await configureNativeFetchNetworking({
      interfaces: globalIpv6Interfaces(),
      resolve6Host: vi.fn().mockResolvedValue(["2001:4860:4860::8888"]),
      connectToHost: vi.fn().mockResolvedValue(undefined),
      setDefaultAutoSelectFamily
    });

    expect(setDefaultAutoSelectFamily).not.toHaveBeenCalled();
  });

  it("leaves address family autoselection enabled when any IPv6 address is reachable", async () => {
    const setDefaultAutoSelectFamily = vi.fn();
    const connectToHost = vi
      .fn()
      .mockRejectedValueOnce(new Error("no route"))
      .mockResolvedValueOnce(undefined);

    await configureNativeFetchNetworking({
      interfaces: globalIpv6Interfaces(),
      resolve6Host: vi.fn().mockResolvedValue(["2001:4860:4860::8888", "2606:4700:4700::1111"]),
      connectToHost,
      setDefaultAutoSelectFamily
    });

    expect(setDefaultAutoSelectFamily).not.toHaveBeenCalled();
  });

  it("disables address family autoselection when configured IPv6 is unreachable", async () => {
    const setDefaultAutoSelectFamily = vi.fn();

    await configureNativeFetchNetworking({
      interfaces: globalIpv6Interfaces(),
      resolve6Host: vi.fn().mockResolvedValue(["2001:4860:4860::8888"]),
      connectToHost: vi.fn().mockRejectedValue(new Error("no route")),
      setDefaultAutoSelectFamily
    });

    expect(setDefaultAutoSelectFamily).toHaveBeenCalledWith(false);
  });
});

function globalIpv6Interfaces(): Parameters<typeof hasGlobalIpv6Address>[0] {
  return {
    wifi: [ipv6Address("2001:4860:4860::8888")]
  };
}

function ipv6Address(address: string, internal = false): NonNullable<
  Parameters<typeof hasGlobalIpv6Address>[0][string]
>[number] {
  return {
    address,
    netmask: "ffff:ffff:ffff:ffff::",
    family: "IPv6",
    mac: "00:00:00:00:00:00",
    internal,
    cidr: `${address}/64`,
    scopeid: 0
  };
}
