import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HackMdClient } from "../src/hackmd/client.js";

import type { HackMdHttpError } from "../src/hackmd/client.js";
import type { MockedFunction } from "vitest";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("HackMdClient", () => {
  let fetchMock: MockedFunction<typeof fetch>;
  let client: HackMdClient;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    client = new HackMdClient({
      apiToken: "secret",
      apiUrl: "https://api.example/v1",
      fetch: fetchMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends bearer auth when loading the current profile", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ name: "Ada" }));

    await expect(client.getProfile()).resolves.toEqual({ name: "Ada" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/me", {
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("requires HACKMD_API_TOKEN only when making a request", async () => {
    const clientWithoutToken = new HackMdClient({
      apiUrl: "https://api.example/v1",
      fetch: fetchMock,
    });

    await expect(clientWithoutToken.getProfile()).rejects.toThrow("HACKMD_API_TOKEN is required");
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("uses personal folder endpoints when no team path is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: "folder-1" }]));

    await client.listFolders();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/folders", {
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("uses team folder endpoints when a team path is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "folder-1" }));

    await client.getFolder({ teamPath: "team/space", folderId: "folder 1" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/teams/team%2Fspace/folders/folder%201", {
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

  it("serializes folder creation bodies", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "folder-1" }));

    await client.createFolder({
      teamPath: "team",
      name: "Runbooks",
      description: "Operational docs",
      icon: "book",
      color: "#3366ff",
      parentFolderId: "parent-1",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/teams/team/folders", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Runbooks",
        description: "Operational docs",
        icon: "book",
        color: "#3366ff",
        parentFolderId: "parent-1",
      }),
    });
  });

  it("serializes folder update bodies with nullable fields", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "folder-1" }));

    await client.updateFolder({
      folderId: "folder-1",
      name: "Archive",
      description: null,
      icon: null,
      color: null,
      parentFolderId: null,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/folders/folder-1", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Archive",
        description: null,
        icon: null,
        color: null,
        parentFolderId: null,
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
    const nativeFetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([{ id: "note-1" }]));

    const clientWithoutInjectedFetch = new HackMdClient({
      apiToken: "secret",
      apiUrl: "https://api.example/v1",
    });

    await expect(clientWithoutInjectedFetch.listNotes()).resolves.toEqual([{ id: "note-1" }]);
    expect(nativeFetchSpy).toHaveBeenCalledWith("https://api.example/v1/notes", {
      method: "GET",
      headers: { Authorization: "Bearer secret" },
    });
  });
});
