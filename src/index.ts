import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { HackMdClient } from "./hackmd/client.js";
import {
  createNoteSchema,
  getNoteSchema,
  listNotesSchema,
  profileSchema,
  toolHandlers,
  updateNoteSchema
} from "./tools/notes.js";

export function createServer(client: HackMdClient): McpServer {
  const server = new McpServer({
    name: "hackmd-mcp",
    version: "0.1.0"
  });
  const handlers = toolHandlers(client);

  server.registerTool(
    "hackmd_profile",
    {
      title: "HackMD Profile",
      description: "Get the current HackMD user's profile.",
      inputSchema: profileSchema.shape
    },
    handlers.hackmdProfile
  );

  server.registerTool(
    "hackmd_list_notes",
    {
      title: "List HackMD Notes",
      description: "List personal HackMD notes, or team notes when teamPath is provided.",
      inputSchema: listNotesSchema.shape
    },
    handlers.hackmdListNotes
  );

  server.registerTool(
    "hackmd_get_note",
    {
      title: "Get HackMD Note",
      description: "Read one HackMD note by noteId, optionally from a team workspace.",
      inputSchema: getNoteSchema.shape
    },
    handlers.hackmdGetNote
  );

  server.registerTool(
    "hackmd_create_note",
    {
      title: "Create HackMD Note",
      description: "Create a personal HackMD note, or a team note when teamPath is provided.",
      inputSchema: createNoteSchema.shape
    },
    handlers.hackmdCreateNote
  );

  server.registerTool(
    "hackmd_update_note",
    {
      title: "Update HackMD Note",
      description: "Update HackMD note content or metadata.",
      inputSchema: updateNoteSchema.shape
    },
    handlers.hackmdUpdateNote
  );

  return server;
}
