export interface HackMdConfig {
  apiToken?: string;
  apiUrl: string;
}

const DEFAULT_API_URL = "https://api.hackmd.io/v1";
const DEFAULT_GITHUB_API_URL = "https://api.github.com";

export interface GitHubConfig {
  apiToken?: string;
  apiUrl: string;
  statePath?: string;
}

export interface LoadConfigOptions {
  requireApiToken?: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, options: LoadConfigOptions = {}): HackMdConfig {
  const requireApiToken = options.requireApiToken ?? true;
  const apiToken = env.HACKMD_API_TOKEN?.trim();

  if (!apiToken && requireApiToken) {
    throw new Error("HACKMD_API_TOKEN is required");
  }

  return {
    apiToken,
    apiUrl: stripTrailingSlash(env.HACKMD_API_URL?.trim() || DEFAULT_API_URL),
  };
}

export function loadGitHubConfig(env: NodeJS.ProcessEnv = process.env): GitHubConfig {
  return {
    apiToken: env.GITHUB_TOKEN?.trim() || undefined,
    apiUrl: stripTrailingSlash(env.GITHUB_API_URL?.trim() || DEFAULT_GITHUB_API_URL),
    statePath: env.HACKMD_MCP_STATE_PATH?.trim() || undefined,
  };
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
