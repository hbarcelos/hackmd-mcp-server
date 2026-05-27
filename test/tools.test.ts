import { describe, expect, it, vi } from "vitest";

import { HackMdClient } from "../src/hackmd/client.js";
import {
  createNoteSchema,
  getNoteSchema,
  listNotesSchema,
  profileSchema,
  pullGitHubFileToHackMdSchema,
  syncNoteToGitHubSchema,
  toTextResult,
  toolHandlers,
  updateNoteSchema,
} from "../src/tools/notes.js";

describe("note tool schemas", () => {
  it("accepts empty list/profile inputs and rejects invalid permissions", () => {
    expect(profileSchema.parse({})).toEqual({});
    expect(listNotesSchema.parse({})).toEqual({});

    expect(() => createNoteSchema.parse({ content: "body", readPermission: "public" })).toThrow();
  });

  it("requires noteId for get and update", () => {
    expect(() => getNoteSchema.parse({})).toThrow();
    expect(() => updateNoteSchema.parse({ content: "body" })).toThrow();
  });

  it("requires update inputs to include at least one note change", () => {
    expect(() => updateNoteSchema.parse({ noteId: "note-1" })).toThrow();
    expect(() => updateNoteSchema.parse({ noteId: "note-1", teamPath: "team" })).toThrow();
    expect(updateNoteSchema.parse({ noteId: "note-1", title: "Updated" })).toEqual({
      noteId: "note-1",
      title: "Updated",
    });
  });

  it("allows GitHub re-sync inputs without repository", () => {
    expect(syncNoteToGitHubSchema.parse({ noteId: "note-1" })).toEqual({ noteId: "note-1" });
    expect(syncNoteToGitHubSchema.parse({ noteId: "note-1", repository: "owner/repo" })).toEqual({
      noteId: "note-1",
      repository: "owner/repo",
    });
    expect(() => syncNoteToGitHubSchema.parse({ noteId: "note-1", repository: "owner/repo/extra" })).toThrow();
  });

  it("validates GitHub-to-HackMD bootstrap inputs", () => {
    expect(
      pullGitHubFileToHackMdSchema.parse({
        repository: "owner/repo",
        filePath: "docs/note.md",
        noteId: "note-1",
        overwriteHackMdContent: true,
      }),
    ).toEqual({
      repository: "owner/repo",
      filePath: "docs/note.md",
      noteId: "note-1",
      overwriteHackMdContent: true,
    });
    expect(() => pullGitHubFileToHackMdSchema.parse({ repository: "owner/repo" })).toThrow();
    expect(() =>
      pullGitHubFileToHackMdSchema.parse({ repository: "owner/repo/extra", filePath: "docs/note.md" }),
    ).toThrow();
  });
});

describe("toolHandlers", () => {
  it("returns MCP text content with JSON results", async () => {
    const client = new HackMdClient({ apiToken: "token", apiUrl: "https://api.hackmd.example", fetch: vi.fn() });
    vi.spyOn(client, "getProfile").mockResolvedValue({ name: "Ada" });
    vi.spyOn(client, "listNotes").mockResolvedValue([{ id: "note-1" }]);
    vi.spyOn(client, "getNote").mockResolvedValue({ id: "note-1", content: "body" });
    vi.spyOn(client, "createNote").mockResolvedValue({ id: "note-2" });
    vi.spyOn(client, "updateNote").mockResolvedValue({ id: "note-1", content: "new" });

    const handlers = toolHandlers(client);

    await expect(handlers.hackmdProfile({})).resolves.toEqual({
      content: [{ type: "text", text: JSON.stringify({ name: "Ada" }, null, 2) }],
    });
    await expect(handlers.hackmdListNotes({})).resolves.toEqual({
      content: [{ type: "text", text: JSON.stringify([{ id: "note-1" }], null, 2) }],
    });
    await expect(handlers.hackmdCreateNote({ content: "body", title: "Title" })).resolves.toEqual({
      content: [{ type: "text", text: JSON.stringify({ id: "note-2" }, null, 2) }],
    });
  });

  it("always returns string content for undefined values", () => {
    expect(toTextResult(undefined)).toEqual({
      content: [{ type: "text", text: "undefined" }],
    });
  });
});
