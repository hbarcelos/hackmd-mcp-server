import { describe, expect, it, vi } from "vitest";

import { toolHandlers } from "../src/tools/notes.js";

const note = {
  id: "note-1",
  shortId: "abc123",
  title: "Release Plan",
  tags: ["docs"],
  content: "# Release Plan\n",
};
const fixedNow = () => new Date("2026-05-19T00:00:00Z");

function makeClients() {
  const hackmd = {
    getProfile: vi.fn(),
    listNotes: vi.fn(),
    getNote: vi.fn().mockResolvedValue(note),
    createNote: vi.fn(),
    updateNote: vi.fn(),
  };
  const github = {
    getRepository: vi.fn().mockResolvedValue({ default_branch: "main" }),
    getBranchRef: vi.fn().mockResolvedValue({ object: { sha: "base-sha" } }),
    getFile: vi.fn().mockResolvedValue(null),
    createBranch: vi.fn().mockResolvedValue({}),
    putFile: vi.fn().mockResolvedValue({ content: { sha: "new-sha" } }),
    findOpenPullRequest: vi.fn().mockResolvedValue(null),
    getPullRequest: vi.fn(),
    createPullRequest: vi.fn().mockResolvedValue({ number: 7, html_url: "https://github.example/owner/repo/pull/7" }),
  };
  const store = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  };

  return { hackmd, github, store };
}

describe("GitHub sync tool handlers", () => {
  it("syncs current note content to a generated non-default branch and creates a PR", async () => {
    const { hackmd, github, store } = makeClients();
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    const result = await handlers.hackmdSyncNoteToGitHub({
      noteId: "note-1",
      repository: "owner/repo",
    });

    expect(github.createBranch).toHaveBeenCalledWith("owner/repo", "hackmd/release-plan-20260519", "base-sha");
    expect(github.putFile).toHaveBeenCalledWith({
      repository: "owner/repo",
      path: "release-plan.md",
      branch: "hackmd/release-plan-20260519",
      content: "# Release Plan\n",
      message: "Sync HackMD note: Release Plan",
      sha: undefined,
    });
    expect(github.createPullRequest.mock.calls[0]?.[0]).toMatchObject({
      repository: "owner/repo",
      title: "Sync HackMD note: Release Plan",
      head: "hackmd/release-plan-20260519",
      base: "main",
    });
    const createPullRequestInput = github.createPullRequest.mock.calls[0]?.[0] as { body: string };
    expect(createPullRequestInput.body).toContain("note-1");
    expect(store.set).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "personal:note-1",
        repository: "owner/repo",
        filePath: "release-plan.md",
        initialBranch: "hackmd/release-plan-20260519",
        activeBranch: "hackmd/release-plan-20260519",
        pullRequestNumber: 7,
      }),
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      status: "synced",
      branch: "hackmd/release-plan-20260519",
      filePath: "release-plan.md",
      pullRequestUrl: "https://github.example/owner/repo/pull/7",
    });
  });

  it("rejects direct sync to the repository default branch unless explicitly allowed", async () => {
    const { hackmd, github, store } = makeClients();
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await expect(
      handlers.hackmdSyncNoteToGitHub({
        noteId: "note-1",
        repository: "owner/repo",
        branch: "main",
      }),
    ).rejects.toThrow("Refusing to sync directly to the default branch");
  });

  it("does not try to create the default branch when direct sync is explicitly allowed", async () => {
    const { hackmd, github, store } = makeClients();
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await handlers.hackmdSyncNoteToGitHub({
      noteId: "note-1",
      repository: "owner/repo",
      branch: "main",
      allowDefaultBranch: true,
    });

    expect(github.createBranch).not.toHaveBeenCalled();
    expect(github.createPullRequest).not.toHaveBeenCalled();
    expect(github.putFile).toHaveBeenCalledWith(expect.objectContaining({ branch: "main" }));
  });

  it("keeps the original file path on re-sync", async () => {
    const { hackmd, github, store } = makeClients();
    store.get.mockResolvedValue({
      key: "personal:note-1",
      repository: "owner/repo",
      filePath: "docs/release.md",
      initialBranch: "hackmd/release-plan",
      activeBranch: "hackmd/release-plan",
      baseBranch: "main",
      pullRequestNumber: 7,
      pullRequestUrl: "https://github.example/owner/repo/pull/7",
    });
    github.findOpenPullRequest.mockResolvedValue({
      number: 7,
      html_url: "https://github.example/owner/repo/pull/7",
    });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await expect(
      handlers.hackmdSyncNoteToGitHub({
        noteId: "note-1",
        repository: "owner/repo",
        filePath: "docs/renamed.md",
      }),
    ).rejects.toThrow("cannot be changed after the initial sync");
  });

  it("uses remembered repository and file path on re-sync", async () => {
    const { hackmd, github, store } = makeClients();
    store.get.mockResolvedValue({
      key: "personal:note-1",
      repository: "owner/repo",
      filePath: "docs/release.md",
      initialBranch: "hackmd/release-plan",
      activeBranch: "hackmd/release-plan",
      baseBranch: "main",
      pullRequestNumber: 7,
      pullRequestUrl: "https://github.example/owner/repo/pull/7",
    });
    github.getPullRequest.mockResolvedValue({
      number: 7,
      state: "open",
      html_url: "https://github.example/owner/repo/pull/7",
    });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await handlers.hackmdSyncNoteToGitHub({
      noteId: "note-1",
    });

    expect(github.putFile).toHaveBeenCalledWith(
      expect.objectContaining({ repository: "owner/repo", path: "docs/release.md" }),
    );
  });

  it("creates a fresh branch after the previous PR was merged", async () => {
    const { hackmd, github, store } = makeClients();
    store.get.mockResolvedValue({
      key: "personal:note-1",
      repository: "owner/repo",
      filePath: "docs/release.md",
      initialBranch: "hackmd/release-plan",
      activeBranch: "hackmd/release-plan",
      baseBranch: "main",
      pullRequestNumber: 7,
      pullRequestUrl: "https://github.example/owner/repo/pull/7",
    });
    github.getPullRequest.mockResolvedValue({ number: 7, state: "closed", merged_at: "2026-05-18T12:00:00Z" });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await handlers.hackmdSyncNoteToGitHub({
      noteId: "note-1",
      repository: "owner/repo",
    });

    expect(github.createBranch).toHaveBeenCalledWith("owner/repo", "hackmd/release-plan-20260519-2", "base-sha");
    expect(github.putFile).toHaveBeenCalledWith(expect.objectContaining({ path: "docs/release.md" }));
  });

  it("increments the fresh branch suffix after repeated merged PRs", async () => {
    const { hackmd, github, store } = makeClients();
    store.get.mockResolvedValue({
      key: "personal:note-1",
      repository: "owner/repo",
      filePath: "docs/release.md",
      initialBranch: "hackmd/release-plan",
      activeBranch: "hackmd/release-plan-20260519-2",
      baseBranch: "main",
      pullRequestNumber: 8,
      pullRequestUrl: "https://github.example/owner/repo/pull/8",
    });
    github.getPullRequest.mockResolvedValue({ number: 8, state: "closed", merged_at: "2026-05-18T12:00:00Z" });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await handlers.hackmdSyncNoteToGitHub({
      noteId: "note-1",
      repository: "owner/repo",
    });

    expect(github.createBranch).toHaveBeenCalledWith("owner/repo", "hackmd/release-plan-20260519-3", "base-sha");
  });

  it("reports unsupported explicit historical versions", async () => {
    const { hackmd, github, store } = makeClients();
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await expect(
      handlers.hackmdSyncNoteToGitHub({
        noteId: "note-1",
        repository: "owner/repo",
        version: "2026-05-01",
      }),
    ).rejects.toThrow("Named HackMD versions are not supported");
  });

  it("returns remembered sync status", async () => {
    const { hackmd, github, store } = makeClients();
    store.get.mockResolvedValue({
      key: "personal:note-1",
      repository: "owner/repo",
      filePath: "docs/release.md",
    });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await expect(handlers.hackmdGitHubSyncStatus({ noteId: "note-1" })).resolves.toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              key: "personal:note-1",
              repository: "owner/repo",
              filePath: "docs/release.md",
            },
            null,
            2,
          ),
        },
      ],
    });
  });

  it("creates a HackMD note from a GitHub file and starts sync state", async () => {
    const { hackmd, github, store } = makeClients();
    github.getFile.mockResolvedValue({
      sha: "file-sha",
      encoding: "base64",
      content: Buffer.from("---\ntitle: Imported Note\ntags:\n  - docs\n---\n\n# Imported\n", "utf8").toString(
        "base64",
      ),
    });
    hackmd.createNote.mockResolvedValue({ id: "new-note-id", title: "Imported Note" });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    const result = await handlers.hackmdPullGitHubFileToHackMd({
      repository: "owner/repo",
      filePath: "docs/imported.md",
    });

    expect(github.getFile).toHaveBeenCalledWith("owner/repo", "docs/imported.md", "main");
    expect(hackmd.createNote).toHaveBeenCalledWith({
      content: "# Imported\n",
      title: "Imported Note",
      tags: ["docs"],
    });
    expect(github.createBranch).toHaveBeenCalledWith("owner/repo", "hackmd/imported-note-20260519", "base-sha");
    expect(store.set).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "personal:new-note-id",
        repository: "owner/repo",
        filePath: "docs/imported.md",
        baseBranch: "main",
        initialBranch: "hackmd/imported-note-20260519",
        activeBranch: "hackmd/imported-note-20260519",
        includeTitleTags: true,
        sourceBranch: "main",
        sourceSha: "file-sha",
      }),
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      status: "created",
      noteId: "new-note-id",
      repository: "owner/repo",
      filePath: "docs/imported.md",
      branch: "hackmd/imported-note-20260519",
    });
  });

  it("requires an overwrite flag before updating an existing HackMD note from GitHub", async () => {
    const { hackmd, github, store } = makeClients();
    github.getFile.mockResolvedValue({
      sha: "file-sha",
      encoding: "base64",
      content: Buffer.from("# Imported\n", "utf8").toString("base64"),
    });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await expect(
      handlers.hackmdPullGitHubFileToHackMd({
        noteId: "note-1",
        repository: "owner/repo",
        filePath: "docs/imported.md",
      }),
    ).rejects.toThrow("overwriteHackMdContent");
    expect(hackmd.updateNote).not.toHaveBeenCalled();
  });

  it("updates an existing HackMD note from GitHub when overwrite is confirmed", async () => {
    const { hackmd, github, store } = makeClients();
    github.getFile.mockResolvedValue({
      sha: "file-sha",
      encoding: "base64",
      content: Buffer.from("# Imported\n", "utf8").toString("base64"),
    });
    hackmd.updateNote.mockResolvedValue({ id: "note-1" });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await handlers.hackmdPullGitHubFileToHackMd({
      noteId: "note-1",
      repository: "owner/repo",
      filePath: "docs/imported.md",
      overwriteHackMdContent: true,
    });

    expect(hackmd.updateNote).toHaveBeenCalledWith({
      noteId: "note-1",
      content: "# Imported\n",
      title: "imported",
      tags: undefined,
    });
    expect(store.set).toHaveBeenCalledWith(expect.objectContaining({ key: "personal:note-1" }));
  });

  it("rejects bootstrapping a synced note to a different GitHub file", async () => {
    const { hackmd, github, store } = makeClients();
    store.get.mockResolvedValue({
      key: "personal:note-1",
      repository: "owner/repo",
      filePath: "docs/old.md",
      initialBranch: "hackmd/old",
      activeBranch: "hackmd/old",
      baseBranch: "main",
    });
    github.getFile.mockResolvedValue({
      sha: "file-sha",
      encoding: "base64",
      content: Buffer.from("# Imported\n", "utf8").toString("base64"),
    });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await expect(
      handlers.hackmdPullGitHubFileToHackMd({
        noteId: "note-1",
        repository: "owner/repo",
        filePath: "docs/new.md",
        overwriteHackMdContent: true,
      }),
    ).rejects.toThrow("already synced");
  });

  it("uses remembered includeTitleTags on later HackMD-to-GitHub syncs", async () => {
    const { hackmd, github, store } = makeClients();
    store.get.mockResolvedValue({
      key: "personal:note-1",
      repository: "owner/repo",
      filePath: "docs/release.md",
      initialBranch: "hackmd/release-plan",
      activeBranch: "hackmd/release-plan",
      baseBranch: "main",
      includeTitleTags: true,
    });
    const handlers = toolHandlers(hackmd, { github, syncStateStore: store, now: fixedNow });

    await handlers.hackmdSyncNoteToGitHub({
      noteId: "note-1",
    });

    expect(github.putFile).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "---\ntitle: Release Plan\ntags:\n  - docs\n---\n\n# Release Plan\n",
      }),
    );
  });
});
