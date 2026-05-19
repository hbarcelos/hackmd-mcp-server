type Fetch = typeof fetch;

export interface GitHubClientOptions {
  apiToken?: string;
  apiUrl?: string;
  fetch?: Fetch;
}

export interface GitHubRepository {
  default_branch: string;
}

export interface GitHubRef {
  ref?: string;
  object: {
    sha: string;
  };
}

export interface GitHubFile {
  sha: string;
  content?: string;
  encoding?: string;
}

export interface GitHubPullRequest {
  number: number;
  state?: string;
  html_url: string;
  merged_at?: string | null;
}

export interface PutFileInput {
  repository: string;
  path: string;
  branch: string;
  content: string;
  message: string;
  sha?: string;
}

export interface CreatePullRequestInput {
  repository: string;
  title: string;
  head: string;
  base: string;
  body?: string;
}

export class GitHubHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly responseText: string,
  ) {
    super(`GitHub API request failed: ${status} ${path} ${responseText}`);
    this.name = "GitHubHttpError";
  }
}

export class GitHubNetworkError extends Error {
  constructor(
    public readonly url: string,
    public override readonly cause: unknown,
  ) {
    super(`GitHub API request failed before receiving a response: ${url}`, { cause });
    this.name = "GitHubNetworkError";
  }
}

export class GitHubClient {
  private readonly apiToken?: string;
  private readonly apiUrl: string;
  private readonly fetchImpl: Fetch;

  constructor(options: GitHubClientOptions = {}) {
    this.apiToken = options.apiToken;
    this.apiUrl = (options.apiUrl ?? "https://api.github.com").replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  async getRepository(repository: string): Promise<GitHubRepository> {
    return this.request(`/repos/${encodeRepository(repository)}`) as Promise<GitHubRepository>;
  }

  async getBranchRef(repository: string, branch: string): Promise<GitHubRef> {
    return this.request(
      `/repos/${encodeRepository(repository)}/git/ref/heads/${encodePath(branch)}`,
    ) as Promise<GitHubRef>;
  }

  async createBranch(repository: string, branch: string, sha: string): Promise<unknown> {
    return this.request(`/repos/${encodeRepository(repository)}/git/refs`, {
      method: "POST",
      body: {
        ref: `refs/heads/${branch}`,
        sha,
      },
    });
  }

  async getFile(repository: string, path: string, branch: string): Promise<GitHubFile | null> {
    try {
      return (await this.request(
        `/repos/${encodeRepository(repository)}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
      )) as GitHubFile;
    } catch (error) {
      if (error instanceof GitHubHttpError && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  async putFile(input: PutFileInput): Promise<unknown> {
    return this.request(`/repos/${encodeRepository(input.repository)}/contents/${encodePath(input.path)}`, {
      method: "PUT",
      body: {
        message: input.message,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        branch: input.branch,
        ...(input.sha ? { sha: input.sha } : {}),
      },
    });
  }

  async findOpenPullRequest(repository: string, branch: string): Promise<GitHubPullRequest | null> {
    const { owner } = splitRepository(repository);
    const pulls = (await this.request(
      `/repos/${encodeRepository(repository)}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
    )) as GitHubPullRequest[];

    return pulls[0] ?? null;
  }

  async getPullRequest(repository: string, number: number): Promise<GitHubPullRequest> {
    return this.request(`/repos/${encodeRepository(repository)}/pulls/${number}`) as Promise<GitHubPullRequest>;
  }

  async createPullRequest(input: CreatePullRequestInput): Promise<GitHubPullRequest> {
    return this.request(`/repos/${encodeRepository(input.repository)}/pulls`, {
      method: "POST",
      body: {
        title: input.title,
        head: input.head,
        base: input.base,
        ...(input.body ? { body: input.body } : {}),
      },
    }) as Promise<GitHubPullRequest>;
  }

  private async request(
    path: string,
    options: { method?: string; body?: Record<string, unknown> } = {},
  ): Promise<unknown> {
    if (!this.apiToken) {
      throw new Error("GITHUB_TOKEN is required for HackMD GitHub sync tools");
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.apiToken}`,
      "User-Agent": "hackmd-mcp-server",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
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
      throw new GitHubNetworkError(url, error);
    }

    if (!response.ok) {
      throw new GitHubHttpError(response.status, path, await response.text());
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

export function decodeGitHubFileContent(file: GitHubFile | null): string | null {
  if (!file?.content || file.encoding !== "base64") {
    return null;
  }

  return Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
}

function splitRepository(repository: string): { owner: string; repo: string } {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('repository must use the "owner/repo" format');
  }

  return { owner: parts[0], repo: parts[1] };
}

function encodeRepository(repository: string): string {
  const { owner, repo } = splitRepository(repository);
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function encodePath(value: string): string {
  return encodeURIComponent(value);
}
