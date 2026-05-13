import type { HackMdConfig } from "../config.js";

type Fetch = typeof fetch;

export type NotePermissionRole = "owner" | "signed_in" | "guest";
export type CommentPermissionType =
  | "disabled"
  | "forbidden"
  | "owners"
  | "signed_in_users"
  | "everyone";
export type SuggestEditPermissionType =
  | "disabled"
  | "forbidden"
  | "owners"
  | "signed_in_users";

export interface NoteSelector {
  noteId: string;
  teamPath?: string;
}

export interface ListNotesInput {
  teamPath?: string;
}

export interface CreateNoteInput {
  teamPath?: string;
  title?: string;
  content: string;
  tags?: string[];
  description?: string;
  readPermission?: NotePermissionRole;
  writePermission?: NotePermissionRole;
  commentPermission?: CommentPermissionType;
  suggestEditPermission?: SuggestEditPermissionType;
  parentFolderId?: string;
  permalink?: string;
}

export interface UpdateNoteInput {
  teamPath?: string;
  noteId: string;
  title?: string;
  content?: string;
  tags?: string[];
  description?: string;
  readPermission?: NotePermissionRole;
  writePermission?: NotePermissionRole;
  parentFolderId?: string;
  permalink?: string;
}

export interface HackMdClientOptions extends HackMdConfig {
  fetch?: Fetch;
}

export class HackMdHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly responseText: string
  ) {
    super(`HackMD API request failed: ${status} ${path} ${responseText}`);
    this.name = "HackMdHttpError";
  }
}

export class HackMdNetworkError extends Error {
  constructor(
    public readonly url: string,
    public override readonly cause: unknown
  ) {
    super(`HackMD API request failed before receiving a response: ${url}`, { cause });
    this.name = "HackMdNetworkError";
  }
}

export class HackMdClient {
  private readonly apiToken?: string;
  private readonly apiUrl: string;
  private readonly fetchImpl: Fetch;

  constructor(options: HackMdClientOptions) {
    this.apiToken = options.apiToken;
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  async getProfile(): Promise<unknown> {
    return this.request("/me");
  }

  async listNotes(input: ListNotesInput = {}): Promise<unknown> {
    return this.request(this.notesPath(input.teamPath));
  }

  async getNote(input: NoteSelector): Promise<unknown> {
    return this.request(`${this.notesPath(input.teamPath)}/${encodePathSegment(input.noteId)}`);
  }

  async createNote(input: CreateNoteInput): Promise<unknown> {
    const { teamPath, ...body } = input;

    return this.request(this.notesPath(teamPath), {
      method: "POST",
      body
    });
  }

  async updateNote(input: UpdateNoteInput): Promise<unknown> {
    const { teamPath, noteId, ...body } = input;

    return this.request(`${this.notesPath(teamPath)}/${encodePathSegment(noteId)}`, {
      method: "PATCH",
      body
    });
  }

  private notesPath(teamPath?: string): string {
    if (teamPath) {
      return `/teams/${encodePathSegment(teamPath)}/notes`;
    }

    return "/notes";
  }

  private async request(
    path: string,
    options: { method?: string; body?: Record<string, unknown> } = {}
  ): Promise<unknown> {
    if (!this.apiToken) {
      throw new Error("HACKMD_API_TOKEN is required");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`
    };

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers
    };

    if (options.body) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    const url = `${this.apiUrl}${path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      throw new HackMdNetworkError(url, error);
    }

    if (!response.ok) {
      throw new HackMdHttpError(response.status, path, await response.text());
    }

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return JSON.parse(text);
    }

    return text;
  }
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}
