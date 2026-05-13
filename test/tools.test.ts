import { describe, expect, it, vi } from "vitest";

import {
  createNoteSchema,
  getNoteSchema,
  listNotesSchema,
  profileSchema,
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
});

describe("toolHandlers", () => {
  it("returns MCP text content with JSON results", async () => {
    const client = {
      getProfile: vi.fn().mockResolvedValue({ name: "Ada" }),
      listNotes: vi.fn().mockResolvedValue([{ id: "note-1" }]),
      getNote: vi.fn().mockResolvedValue({ id: "note-1", content: "body" }),
      createNote: vi.fn().mockResolvedValue({ id: "note-2" }),
      updateNote: vi.fn().mockResolvedValue({ id: "note-1", content: "new" }),
    };

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
