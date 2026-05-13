import { z } from "zod";

import type { CreateNoteInput, HackMdClient, ListNotesInput, NoteSelector, UpdateNoteInput } from "../hackmd/client.js";

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

export interface HackMdToolClient {
  getProfile(): Promise<unknown>;
  listNotes(input?: ListNotesInput): Promise<unknown>;
  getNote(input: NoteSelector): Promise<unknown>;
  createNote(input: CreateNoteInput): Promise<unknown>;
  updateNote(input: UpdateNoteInput): Promise<unknown>;
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

export function toolHandlers(client: HackMdToolClient | HackMdClient) {
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
  };
}

export function toTextResult(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) ?? String(value) }],
  };
}
