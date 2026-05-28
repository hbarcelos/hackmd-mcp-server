import { z } from "zod";

import { loadEnvironment, loadGitHubConfig } from "../config.js";
import { GitHubClient } from "../github/client.js";
import { getGitHubSyncStatus, pullGitHubFileToHackMd, syncNoteToGitHub } from "../github/sync.js";
import { FileGitHubSyncStateStore } from "../github/sync-state.js";

import type { HackMdClient } from "../hackmd/client.js";
import type { GitHubSyncStateStore } from "../github/sync-state.js";

const notePermissionRoleSchema = z.enum(["owner", "signed_in", "guest"]);
const commentPermissionSchema = z.enum(["disabled", "forbidden", "owners", "signed_in_users", "everyone"]);
const suggestEditPermissionSchema = z.enum(["disabled", "forbidden", "owners", "signed_in_users"]);
const updateNoteFields = [
  "title",
  "content",
  "tags",
  "description",
  "readPermission",
  "writePermission",
  "parentFolderId",
  "permalink",
] as const;

export const profileSchema = z.object({}).strict();

export const listNotesSchema = z
  .object({
    teamPath: z.string().min(1).optional(),
  })
  .strict();

export const getNoteSchema = z
  .object({
    teamPath: z.string().min(1).optional(),
    noteId: z.string().min(1),
  })
  .strict();

export const createNoteSchema = z
  .object({
    teamPath: z.string().min(1).optional(),
    title: z.string().optional(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
    readPermission: notePermissionRoleSchema.optional(),
    writePermission: notePermissionRoleSchema.optional(),
    commentPermission: commentPermissionSchema.optional(),
    suggestEditPermission: suggestEditPermissionSchema.optional(),
    parentFolderId: z.string().min(1).optional(),
    permalink: z.string().min(1).optional(),
  })
  .strict();

export const updateNoteSchema = z
  .object({
    teamPath: z.string().min(1).optional(),
    noteId: z.string().min(1),
    title: z.string().optional(),
    content: z.string().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
    readPermission: notePermissionRoleSchema.optional(),
    writePermission: notePermissionRoleSchema.optional(),
    parentFolderId: z.string().min(1).optional(),
    permalink: z.string().min(1).optional(),
  })
  .strict()
  .refine((input) => updateNoteFields.some((field) => input[field] !== undefined), {
    message: "At least one note field must be provided to update.",
  });

export const syncNoteToGitHubSchema = z
  .object({
    teamPath: z.string().min(1).optional(),
    noteId: z.string().min(1),
    repository: z
      .string()
      .regex(/^[^/]+\/[^/]+$/, 'repository must use the "owner/repo" format')
      .optional(),
    branch: z.string().min(1).optional(),
    filePath: z.string().min(1).optional(),
    baseBranch: z.string().min(1).optional(),
    includeTitleTags: z.boolean().optional(),
    allowDefaultBranch: z.boolean().optional(),
    pullRequestTitle: z.string().min(1).optional(),
    pullRequestBody: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
  })
  .strict();

export const githubSyncStatusSchema = z
  .object({
    teamPath: z.string().min(1).optional(),
    noteId: z.string().min(1),
  })
  .strict();

export const pullGitHubFileToHackMdSchema = z
  .object({
    repository: z.string().regex(/^[^/]+\/[^/]+$/, 'repository must use the "owner/repo" format'),
    filePath: z.string().min(1),
    branch: z.string().min(1).optional(),
    syncBranch: z.string().min(1).optional(),
    teamPath: z.string().min(1).optional(),
    noteId: z.string().min(1).optional(),
    overwriteHackMdContent: z.boolean().optional(),
    includeTitleTags: z.boolean().optional(),
    readPermission: notePermissionRoleSchema.optional(),
    writePermission: notePermissionRoleSchema.optional(),
  })
  .strict();

export interface ToolHandlerOptions {
  github?: GitHubClient;
  syncStateStore?: GitHubSyncStateStore;
  now?: () => Date;
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

export function toolHandlers(client: HackMdClient, options: ToolHandlerOptions = {}) {
  const githubConfig = loadGitHubConfig(loadEnvironment());
  const github = options.github ?? new GitHubClient(githubConfig);
  const syncStateStore = options.syncStateStore ?? new FileGitHubSyncStateStore(githubConfig.statePath);

  return {
    hackmdProfile: async (input: z.infer<typeof profileSchema>): Promise<ToolResult> => {
      void input;
      return toTextResult(await client.getProfile());
    },

    hackmdListNotes: async (input: z.infer<typeof listNotesSchema>): Promise<ToolResult> =>
      toTextResult(await client.listNotes(input)),

    hackmdGetNote: async (input: z.infer<typeof getNoteSchema>): Promise<ToolResult> =>
      toTextResult(await client.getNote(input)),

    hackmdCreateNote: async (input: z.infer<typeof createNoteSchema>): Promise<ToolResult> =>
      toTextResult(await client.createNote(input)),

    hackmdUpdateNote: async (input: z.infer<typeof updateNoteSchema>): Promise<ToolResult> =>
      toTextResult(await client.updateNote(input)),

    hackmdSyncNoteToGitHub: async (input: z.infer<typeof syncNoteToGitHubSchema>): Promise<ToolResult> =>
      toTextResult(
        await syncNoteToGitHub(input, {
          hackmd: client,
          github,
          syncStateStore,
          now: options.now,
        }),
      ),

    hackmdPullGitHubFileToHackMd: async (input: z.infer<typeof pullGitHubFileToHackMdSchema>): Promise<ToolResult> =>
      toTextResult(
        await pullGitHubFileToHackMd(input, {
          hackmd: client,
          github,
          syncStateStore,
          now: options.now,
        }),
      ),

    hackmdGitHubSyncStatus: async (input: z.infer<typeof githubSyncStatusSchema>): Promise<ToolResult> =>
      toTextResult(await getGitHubSyncStatus(input, syncStateStore)),
  };
}

export function toTextResult(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) ?? String(value) }],
  };
}
