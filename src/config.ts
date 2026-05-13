export interface HackMdConfig {
  apiToken?: string;
  apiUrl: string;
}

const DEFAULT_API_URL = "https://api.hackmd.io/v1";

export interface LoadConfigOptions {
  requireApiToken?: boolean;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadConfigOptions = {}
): HackMdConfig {
  const requireApiToken = options.requireApiToken ?? true;
  const apiToken = env.HACKMD_API_TOKEN?.trim();

  if (!apiToken && requireApiToken) {
    throw new Error("HACKMD_API_TOKEN is required");
  }

  return {
    apiToken,
    apiUrl: stripTrailingSlash(env.HACKMD_API_URL?.trim() || DEFAULT_API_URL)
  };
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
