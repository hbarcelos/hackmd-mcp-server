import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  createNoteSchema,
  getNoteSchema,
  githubSyncStatusSchema,
  listNotesSchema,
  profileSchema,
  pullGitHubFileToHackMdSchema,
  syncNoteToGitHubSchema,
  toolHandlers,
  updateNoteSchema,
} from "./tools/notes.js";

import type { HackMdClient } from "./hackmd/client.js";

export function createServer(client: HackMdClient): McpServer {
  const server = new McpServer({
    name: "hackmd-mcp",
    version: "0.1.0",
  });
  const handlers = toolHandlers(client);

  server.registerTool(
    "hackmd_profile",
    {
      title: "HackMD Profile",
      description: "Get the current HackMD user's profile.",
      inputSchema: profileSchema.shape,
    },
    handlers.hackmdProfile,
  );

  server.registerTool(
    "hackmd_list_notes",
    {
      title: "List HackMD Notes",
      description: "List personal HackMD notes, or team notes when teamPath is provided.",
      inputSchema: listNotesSchema.shape,
    },
    handlers.hackmdListNotes,
  );

  server.registerTool(
    "hackmd_get_note",
    {
      title: "Get HackMD Note",
      description: "Read one HackMD note by noteId, optionally from a team workspace.",
      inputSchema: getNoteSchema.shape,
    },
    handlers.hackmdGetNote,
  );

  server.registerTool(
    "hackmd_create_note",
    {
      title: "Create HackMD Note",
      description: "Create a personal HackMD note, or a team note when teamPath is provided.",
      inputSchema: createNoteSchema.shape,
    },
    handlers.hackmdCreateNote,
  );

  server.registerTool(
    "hackmd_update_note",
    {
      title: "Update HackMD Note",
      description: "Update HackMD note content or metadata.",
      inputSchema: updateNoteSchema,
    },
    handlers.hackmdUpdateNote,
  );

  server.registerTool(
    "hackmd_sync_note_to_github",
    {
      title: "Sync HackMD Note to GitHub",
      description:
        "Sync the current HackMD note content to a non-default GitHub branch and create or reuse a pull request.",
      inputSchema: syncNoteToGitHubSchema.shape,
    },
    handlers.hackmdSyncNoteToGitHub,
  );

  server.registerTool(
    "hackmd_pull_github_file_to_hackmd",
    {
      title: "Pull GitHub File to HackMD",
      description: "Create or update a HackMD note from a GitHub Markdown file and start GitHub sync state.",
      inputSchema: pullGitHubFileToHackMdSchema.shape,
    },
    handlers.hackmdPullGitHubFileToHackMd,
  );

  server.registerTool(
    "hackmd_github_sync_status",
    {
      title: "HackMD GitHub Sync Status",
      description: "Read locally remembered GitHub sync state for a HackMD note.",
      inputSchema: githubSyncStatusSchema.shape,
    },
    handlers.hackmdGitHubSyncStatus,
  );

  return server;
}

export { GitHubClient, GitHubHttpError, GitHubNetworkError } from "./github/client.js";
export { FileGitHubSyncStateStore } from "./github/sync-state.js";
export { HackMdClient, HackMdHttpError, HackMdNetworkError } from "./hackmd/client.js";
export type {
  CreatePullRequestInput,
  GitHubClientOptions,
  GitHubFile,
  GitHubPullRequest,
  GitHubRef,
  GitHubRepository,
  PutFileInput,
} from "./github/client.js";
export type {
  GitHubSyncResult,
  PullGitHubFileToHackMdInput,
  PullGitHubFileToHackMdResult,
  SyncNoteToGitHubInput,
} from "./github/sync.js";
export type { GitHubSyncState, GitHubSyncStateStore } from "./github/sync-state.js";
export type {
  CommentPermissionType,
  CreateNoteInput,
  HackMdClientOptions,
  ListNotesInput,
  NotePermissionRole,
  NoteSelector,
  SuggestEditPermissionType,
  UpdateNoteInput,
} from "./hackmd/client.js";
