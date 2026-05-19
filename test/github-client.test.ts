import { describe, expect, it, vi } from "vitest";

import { GitHubClient } from "../src/github/client.js";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("GitHubClient", () => {
  it("requests repository metadata with GitHub API headers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ default_branch: "main" }));
    const client = new GitHubClient({
      apiToken: "ghs_secret",
      apiUrl: "https://api.github.example",
      fetch: fetchMock,
    });

    await expect(client.getRepository("owner/repo")).resolves.toEqual({ default_branch: "main" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.github.example/repos/owner/repo", {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer ghs_secret",
        "User-Agent": "hackmd-mcp-server",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  });

  it("creates refs and writes file contents", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ref: "refs/heads/hackmd/plan", object: { sha: "abc123" } }))
      .mockResolvedValueOnce(jsonResponse({ content: { sha: "file-sha" } }));
    const client = new GitHubClient({
      apiToken: "ghs_secret",
      apiUrl: "https://api.github.example/",
      fetch: fetchMock,
    });

    await client.createBranch("owner/repo", "hackmd/plan", "abc123");
    await client.putFile({
      repository: "owner/repo",
      path: "docs/plan.md",
      branch: "hackmd/plan",
      content: "# Plan\n",
      message: "Sync HackMD note",
      sha: "old-file-sha",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.github.example/repos/owner/repo/git/refs");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        ref: "refs/heads/hackmd/plan",
        sha: "abc123",
      }),
    });
    const firstInit = fetchMock.mock.calls[0]?.[1];
    const secondInit = fetchMock.mock.calls[1]?.[1];
    if (!firstInit || !secondInit) {
      throw new Error("expected GitHub client to call fetch twice");
    }

    expect(firstInit.headers).toMatchObject({
      Authorization: "Bearer ghs_secret",
      "Content-Type": "application/json",
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.github.example/repos/owner/repo/contents/docs%2Fplan.md");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        message: "Sync HackMD note",
        content: Buffer.from("# Plan\n", "utf8").toString("base64"),
        branch: "hackmd/plan",
        sha: "old-file-sha",
      }),
    });
    expect(secondInit.headers).toMatchObject({
      Authorization: "Bearer ghs_secret",
      "Content-Type": "application/json",
    });
  });

  it("fetches file contents by path and branch", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        sha: "file-sha",
        content: Buffer.from("# Body\n", "utf8").toString("base64"),
        encoding: "base64",
      }),
    );
    const client = new GitHubClient({
      apiToken: "ghs_secret",
      apiUrl: "https://api.github.example",
      fetch: fetchMock,
    });

    await expect(client.getFile("owner/repo", "docs/release.md", "main")).resolves.toMatchObject({
      sha: "file-sha",
      encoding: "base64",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.github.example/repos/owner/repo/contents/docs%2Frelease.md?ref=main",
    );
  });

  it("surfaces HTTP failures with endpoint context", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("bad credentials", { status: 401 }));
    const client = new GitHubClient({
      apiToken: "bad",
      apiUrl: "https://api.github.example",
      fetch: fetchMock,
    });

    await expect(client.getRepository("owner/repo")).rejects.toMatchObject({
      name: "GitHubHttpError",
      status: 401,
      path: "/repos/owner/repo",
      responseText: "bad credentials",
    });
  });
});
