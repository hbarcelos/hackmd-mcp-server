import { decodeGitHubFileContent } from "./client.js";
import { parseMarkdownForHackMdImport, renderMarkdownForGitHubSync } from "./markdown.js";
import { makeSyncStateKey } from "./sync-state.js";

import type { GitHubClient, GitHubFile, GitHubPullRequest } from "./client.js";
import type { GitHubSyncState, GitHubSyncStateStore } from "./sync-state.js";
import type { HackMdClient, NoteSelector } from "../hackmd/client.js";

export interface SyncNoteToGitHubInput extends NoteSelector {
  repository?: string;
  branch?: string;
  filePath?: string;
  baseBranch?: string;
  includeTitleTags?: boolean;
  allowDefaultBranch?: boolean;
  pullRequestTitle?: string;
  pullRequestBody?: string;
  version?: string;
}

export type GitHubSyncStatusInput = NoteSelector;

export interface PullGitHubFileToHackMdInput {
  repository: string;
  filePath: string;
  branch?: string;
  syncBranch?: string;
  noteId?: string;
  teamPath?: string;
  overwriteHackMdContent?: boolean;
  includeTitleTags?: boolean;
  readPermission?: "owner" | "signed_in" | "guest";
  writePermission?: "owner" | "signed_in" | "guest";
}

export interface GitHubSyncResult {
  status: "synced" | "unchanged";
  repository: string;
  branch: string;
  baseBranch: string;
  filePath: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
}

export interface PullGitHubFileToHackMdResult {
  status: "created" | "updated";
  noteId: string;
  repository: string;
  filePath: string;
  branch: string;
  baseBranch: string;
}

export interface SyncDependencies {
  hackmd: Pick<HackMdClient, "getNote">;
  github: Pick<
    GitHubClient,
    | "getRepository"
    | "getBranchRef"
    | "getFile"
    | "createBranch"
    | "putFile"
    | "findOpenPullRequest"
    | "getPullRequest"
    | "createPullRequest"
  >;
  syncStateStore: GitHubSyncStateStore;
  now?: () => Date;
}

export interface PullDependencies {
  hackmd: Pick<HackMdClient, "createNote" | "updateNote">;
  github: Pick<GitHubClient, "getRepository" | "getBranchRef" | "getFile" | "createBranch">;
  syncStateStore: GitHubSyncStateStore;
  now?: () => Date;
}

interface HackMdNoteForSync {
  id?: string;
  shortId?: string;
  title?: string;
  tags?: string[];
  content?: string;
}

export async function syncNoteToGitHub(
  input: SyncNoteToGitHubInput,
  dependencies: SyncDependencies,
): Promise<GitHubSyncResult> {
  if (input.version && input.version !== "latest") {
    throw new Error("Named HackMD versions are not supported by the public HackMD API; omit version or use latest.");
  }

  validateFilePath(input.filePath);

  const stateKey = makeSyncStateKey(input);
  const existingState = await dependencies.syncStateStore.get(stateKey);
  if (existingState && input.filePath && input.filePath !== existingState.filePath) {
    throw new Error("The GitHub sync filename cannot be changed after the initial sync.");
  }

  const repository = input.repository ?? existingState?.repository;
  if (!repository) {
    throw new Error("repository is required for the initial GitHub sync");
  }

  const note = normalizeNote(await dependencies.hackmd.getNote(input));
  const repo = await dependencies.github.getRepository(repository);
  const baseBranch = input.baseBranch ?? existingState?.baseBranch ?? repo.default_branch;
  const filePath = existingState?.filePath ?? input.filePath ?? suggestFilePath(note);
  validateFilePath(filePath);

  const previousPull = await loadPreviousPullRequest(existingState, repository, dependencies);
  const previousPullMerged = Boolean(previousPull?.merged_at);
  const branch =
    input.branch ??
    (previousPullMerged
      ? suggestNextMergedBranch(note, dependencies.now, existingState?.activeBranch)
      : (existingState?.activeBranch ?? suggestBranch(note, dependencies.now)));

  if (!input.allowDefaultBranch && branch === repo.default_branch) {
    throw new Error("Refusing to sync directly to the default branch. Choose a sync branch or set allowDefaultBranch.");
  }

  const baseRef = await dependencies.github.getBranchRef(repository, baseBranch);
  const targetFile = await dependencies.github.getFile(repository, filePath, branch);
  if (branch !== baseBranch && (!existingState || previousPullMerged || input.branch)) {
    await dependencies.github.createBranch(repository, branch, baseRef.object.sha);
  }

  const content = renderMarkdownForGitHubSync({
    content: note.content,
    title: note.title,
    tags: note.tags,
    includeTitleTags: input.includeTitleTags ?? existingState?.includeTitleTags ?? false,
  });

  const currentContent = decodeGitHubFileContent(targetFile);
  if (currentContent === content) {
    return {
      status: "unchanged",
      repository,
      branch,
      baseBranch,
      filePath,
      pullRequestNumber: existingState?.pullRequestNumber,
      pullRequestUrl: existingState?.pullRequestUrl,
    };
  }

  const title = note.title || note.shortId || input.noteId;
  const message = `Sync HackMD note: ${title}`;
  await dependencies.github.putFile({
    repository,
    path: filePath,
    branch,
    content,
    message,
    sha: targetFile?.sha,
  });

  const pullRequest =
    branch === baseBranch
      ? null
      : ((previousPull && previousPull.state === "open"
          ? previousPull
          : await dependencies.github.findOpenPullRequest(repository, branch)) ??
        (await dependencies.github.createPullRequest({
          repository,
          title: input.pullRequestTitle ?? message,
          head: branch,
          base: baseBranch,
          body: input.pullRequestBody ?? defaultPullRequestBody(input, note),
        })));

  await dependencies.syncStateStore.set({
    key: stateKey,
    repository,
    filePath,
    initialBranch: existingState?.initialBranch ?? branch,
    activeBranch: branch,
    baseBranch,
    includeTitleTags: input.includeTitleTags ?? existingState?.includeTitleTags,
    sourceBranch: existingState?.sourceBranch,
    sourceSha: existingState?.sourceSha,
    pullRequestNumber: pullRequest?.number,
    pullRequestUrl: pullRequest?.html_url,
  });

  return {
    status: "synced",
    repository,
    branch,
    baseBranch,
    filePath,
    pullRequestNumber: pullRequest?.number,
    pullRequestUrl: pullRequest?.html_url,
  };
}

export async function pullGitHubFileToHackMd(
  input: PullGitHubFileToHackMdInput,
  dependencies: PullDependencies,
): Promise<PullGitHubFileToHackMdResult> {
  validateFilePath(input.filePath);

  if (input.noteId && !input.overwriteHackMdContent) {
    throw new Error("overwriteHackMdContent must be true to update an existing HackMD note from GitHub.");
  }

  const existingState = input.noteId
    ? await dependencies.syncStateStore.get(makeSyncStateKey({ teamPath: input.teamPath, noteId: input.noteId }))
    : null;
  if (existingState && (existingState.repository !== input.repository || existingState.filePath !== input.filePath)) {
    throw new Error("This HackMD note is already synced to a different GitHub repository or file.");
  }

  const repo = await dependencies.github.getRepository(input.repository);
  const sourceBranch = input.branch ?? repo.default_branch;
  const file = await dependencies.github.getFile(input.repository, input.filePath, sourceBranch);
  if (!file) {
    throw new Error("GitHub file content must be base64-encoded Markdown.");
  }
  const content = decodeRequiredGitHubFile(file);
  const parsed = parseMarkdownForHackMdImport({ content, filePath: input.filePath });
  const includeTitleTags = input.includeTitleTags ?? parsed.hadTitleTagsFrontmatter;
  const syncBranch = input.syncBranch ?? suggestBranch({ title: parsed.title }, dependencies.now);

  if (syncBranch === repo.default_branch || syncBranch === sourceBranch) {
    throw new Error("syncBranch must be different from the source/default branch.");
  }

  const noteId = input.noteId ?? (await createHackMdNoteFromGitHub(input, parsed, dependencies));
  if (input.noteId) {
    await dependencies.hackmd.updateNote({
      teamPath: input.teamPath,
      noteId,
      content: parsed.content,
      title: parsed.title,
      tags: parsed.tags,
    });
  }

  const baseRef = await dependencies.github.getBranchRef(input.repository, sourceBranch);
  await dependencies.github.createBranch(input.repository, syncBranch, baseRef.object.sha);

  await dependencies.syncStateStore.set({
    key: makeSyncStateKey({ teamPath: input.teamPath, noteId }),
    repository: input.repository,
    filePath: input.filePath,
    initialBranch: syncBranch,
    activeBranch: syncBranch,
    baseBranch: sourceBranch,
    includeTitleTags,
    sourceBranch,
    sourceSha: file.sha,
  });

  return {
    status: input.noteId ? "updated" : "created",
    noteId,
    repository: input.repository,
    filePath: input.filePath,
    branch: syncBranch,
    baseBranch: sourceBranch,
  };
}

export async function getGitHubSyncStatus(
  input: GitHubSyncStatusInput,
  store: GitHubSyncStateStore,
): Promise<GitHubSyncState | null> {
  return store.get(makeSyncStateKey(input));
}

function normalizeNote(value: unknown): Required<Pick<HackMdNoteForSync, "content">> & HackMdNoteForSync {
  if (!value || typeof value !== "object") {
    throw new Error("HackMD note response did not include note content");
  }

  const note = value as HackMdNoteForSync;
  if (typeof note.content !== "string") {
    throw new Error("HackMD note response did not include note content");
  }

  return note as Required<Pick<HackMdNoteForSync, "content">> & HackMdNoteForSync;
}

async function createHackMdNoteFromGitHub(
  input: PullGitHubFileToHackMdInput,
  parsed: { content: string; title: string; tags?: string[] },
  dependencies: PullDependencies,
): Promise<string> {
  const created = await dependencies.hackmd.createNote({
    teamPath: input.teamPath,
    content: parsed.content,
    title: parsed.title,
    tags: parsed.tags,
    readPermission: input.readPermission,
    writePermission: input.writePermission,
  });

  return normalizeCreatedNoteId(created);
}

function normalizeCreatedNoteId(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new Error("HackMD create note response did not include a note id");
  }

  const note = value as { id?: unknown; shortId?: unknown };
  if (typeof note.id === "string" && note.id) {
    return note.id;
  }

  if (typeof note.shortId === "string" && note.shortId) {
    return note.shortId;
  }

  throw new Error("HackMD create note response did not include a note id");
}

function decodeRequiredGitHubFile(file: GitHubFile): string {
  const content = decodeGitHubFileContent(file);
  if (content === null) {
    throw new Error("GitHub file content must be base64-encoded Markdown.");
  }

  return content;
}

async function loadPreviousPullRequest(
  state: GitHubSyncState | null,
  repository: string,
  dependencies: SyncDependencies,
): Promise<GitHubPullRequest | null> {
  if (!state?.pullRequestNumber) {
    return null;
  }

  return dependencies.github.getPullRequest(repository, state.pullRequestNumber);
}

function suggestFilePath(note: HackMdNoteForSync): string {
  return `${slugify(note.title || note.shortId || note.id || "hackmd-note")}.md`;
}

function suggestBranch(note: HackMdNoteForSync, now: (() => Date) | undefined, suffix?: number): string {
  const date = formatDate(now?.() ?? new Date());
  return `hackmd/${slugify(note.title || note.shortId || note.id || "note")}-${date}${suffix ? `-${suffix}` : ""}`;
}

function suggestNextMergedBranch(
  note: HackMdNoteForSync,
  now: (() => Date) | undefined,
  activeBranch: string | undefined,
): string {
  const baseBranch = suggestBranch(note, now);
  const escapedBaseBranch = baseBranch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = activeBranch?.match(new RegExp(`^${escapedBaseBranch}-(\\d+)$`));
  const suffix = match ? Number(match[1]) + 1 : 2;

  return `${baseBranch}-${suffix}`;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "note"
  );
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function validateFilePath(path: string | undefined): void {
  if (!path) {
    return;
  }

  if (path.startsWith("/") || path.includes("..") || path.endsWith("/") || !path.endsWith(".md")) {
    throw new Error("filePath must be a relative Markdown file path without parent-directory segments.");
  }
}

function defaultPullRequestBody(input: SyncNoteToGitHubInput, note: HackMdNoteForSync): string {
  const title = note.title ? ` "${note.title}"` : "";
  return `Syncs HackMD note${title}.\n\nHackMD note ID: ${input.noteId}`;
}
