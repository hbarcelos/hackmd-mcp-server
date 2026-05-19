import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FileGitHubSyncStateStore, makeSyncStateKey } from "../src/github/sync-state.js";

describe("GitHub sync state", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keys personal and team notes separately", () => {
    expect(makeSyncStateKey({ noteId: "note-1" })).toBe("personal:note-1");
    expect(makeSyncStateKey({ teamPath: "docs", noteId: "note-1" })).toBe("team:docs:note-1");
  });

  it("persists note sync state to a local JSON file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hackmd-sync-state-"));
    tempDirs.push(dir);
    const path = join(dir, "state.json");
    const store = new FileGitHubSyncStateStore(path);

    await store.set({
      key: "personal:note-1",
      repository: "owner/repo",
      filePath: "docs/note.md",
      initialBranch: "hackmd/note",
      activeBranch: "hackmd/note",
      baseBranch: "main",
      pullRequestNumber: 12,
      pullRequestUrl: "https://github.example/owner/repo/pull/12",
    });

    await expect(new FileGitHubSyncStateStore(path).get("personal:note-1")).resolves.toMatchObject({
      repository: "owner/repo",
      filePath: "docs/note.md",
      initialBranch: "hackmd/note",
      pullRequestNumber: 12,
    });
  });
});
