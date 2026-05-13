import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HackMdClient } from "../src/hackmd/client.js";

import type { HackMdHttpError } from "../src/hackmd/client.js";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("HackMdClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: HackMdClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    client = new HackMdClient({
      apiToken: "secret",
      apiUrl: "https://api.example/v1",
      fetch: fetchMock,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends bearer auth when loading the current profile", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ name: "Ada" }));

    await expect(client.getProfile()).resolves.toEqual({ name: "Ada" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/me", {
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("uses personal note endpoints when no team path is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: "note-1" }]));

    await client.listNotes();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/notes", {
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("uses team note endpoints when a team path is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "note-1" }));

    await client.getNote({ teamPath: "team/space", noteId: "note 1" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/teams/team%2Fspace/notes/note%201", {
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("serializes note creation bodies", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "note-1" }));

    await client.createNote({
      title: "Plan",
      content: "# Plan",
      tags: ["work"],
      readPermission: "guest",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/notes", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Plan",
        content: "# Plan",
        tags: ["work"],
        readPermission: "guest",
      }),
    });
  });

  it("serializes note update bodies", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "note-1" }));

    await client.updateNote({
      noteId: "note-1",
      content: "updated",
      writePermission: "owner",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/notes/note-1", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "updated",
        writePermission: "owner",
      }),
    });
  });

  it("surfaces HTTP failures with status, endpoint, and response text", async () => {
    fetchMock.mockResolvedValue(new Response("bad token", { status: 401 }));

    await expect(client.getProfile()).rejects.toMatchObject({
      name: "HackMdHttpError",
      status: 401,
      path: "/me",
      responseText: "bad token",
    } satisfies Partial<HackMdHttpError>);
  });

  it("surfaces network failures with the requested URL and cause", async () => {
    const dnsError = new Error("getaddrinfo EAI_AGAIN api.hackmd.io");
    const fetchError = new TypeError("fetch failed", { cause: dnsError });
    fetchMock.mockRejectedValue(fetchError);

    await expect(client.listNotes()).rejects.toMatchObject({
      name: "HackMdNetworkError",
      url: "https://api.example/v1/notes",
      cause: fetchError,
    });
  });

  it("uses native fetch when no fetch implementation is injected", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse([{ id: "note-1" }]));

    const clientWithoutInjectedFetch = new HackMdClient({
      apiToken: "secret",
      apiUrl: "https://api.example/v1",
    });

    await expect(clientWithoutInjectedFetch.listNotes()).resolves.toEqual([{ id: "note-1" }]);
    expect(globalThis.fetch).toHaveBeenCalledWith("https://api.example/v1/notes", {
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    });
  });
});
