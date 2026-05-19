import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { NoteSelector } from "../hackmd/client.js";

export interface GitHubSyncState {
  key: string;
  repository: string;
  filePath: string;
  initialBranch: string;
  activeBranch: string;
  baseBranch: string;
  includeTitleTags?: boolean;
  sourceBranch?: string;
  sourceSha?: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
  updatedAt?: string;
}

export interface GitHubSyncStateStore {
  get(key: string): Promise<GitHubSyncState | null>;
  set(state: GitHubSyncState): Promise<void>;
}

export class FileGitHubSyncStateStore implements GitHubSyncStateStore {
  constructor(private readonly path: string = defaultGitHubSyncStatePath()) {}

  async get(key: string): Promise<GitHubSyncState | null> {
    const states = await this.readStates();
    return states[key] ?? null;
  }

  async set(state: GitHubSyncState): Promise<void> {
    const states = await this.readStates();
    states[state.key] = {
      ...state,
      updatedAt: state.updatedAt ?? new Date().toISOString(),
    };

    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(states, null, 2)}\n`, "utf8");
  }

  private async readStates(): Promise<Record<string, GitHubSyncState>> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as Record<string, GitHubSyncState>;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }
}

export function makeSyncStateKey(selector: NoteSelector): string {
  if (selector.teamPath) {
    return `team:${selector.teamPath}:${selector.noteId}`;
  }

  return `personal:${selector.noteId}`;
}

export function defaultGitHubSyncStatePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.HACKMD_MCP_STATE_PATH?.trim()) {
    return env.HACKMD_MCP_STATE_PATH.trim();
  }

  const stateHome = env.XDG_STATE_HOME?.trim() || join(homedir(), ".local", "state");
  return join(stateHome, "hackmd-mcp-server", "github-sync.json");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
