import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface HackMdConfig {
  apiToken?: string;
  apiUrl: string;
}

const DEFAULT_API_URL = "https://api.hackmd.io/v1";
const DEFAULT_GITHUB_API_URL = "https://api.github.com";
const SUPPORTED_ENV_KEYS = new Set([
  "HACKMD_API_TOKEN",
  "HACKMD_API_URL",
  "GITHUB_TOKEN",
  "GITHUB_API_URL",
  "HACKMD_MCP_STATE_PATH",
]);

export interface GitHubConfig {
  apiToken?: string;
  apiUrl: string;
  statePath?: string;
}

export interface LoadConfigOptions {
  requireApiToken?: boolean;
}

export interface LoadEnvironmentOptions {
  env?: NodeJS.ProcessEnv;
  envFilePath?: string;
}

export function loadEnvironment(options: LoadEnvironmentOptions = {}): NodeJS.ProcessEnv {
  const env = options.env ?? process.env;
  const envFilePath = options.envFilePath ?? join(process.cwd(), ".env");

  if (!existsSync(envFilePath)) {
    return { ...env };
  }

  return {
    ...parseDotEnv(readFileSync(envFilePath, "utf8")),
    ...env,
  };
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

function parseDotEnv(contents: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (!SUPPORTED_ENV_KEYS.has(key)) {
      continue;
    }

    env[key] = unquoteDotEnvValue(rawValue);
  }

  return env;
}

function unquoteDotEnvValue(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  const commentIndex = trimmed.indexOf(" #");
  return commentIndex === -1 ? trimmed : trimmed.slice(0, commentIndex).trimEnd();
}
