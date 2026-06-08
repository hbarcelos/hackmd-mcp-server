# HackMD MCP

Read and write HackMD notes from any MCP-compatible AI tool.

This server exposes a small, focused HackMD toolset over stdio. It is designed for local use with coding agents such as Codex and Claude Code, and desktop MCP clients such as Claude Desktop.

## Features

- Read your HackMD profile.
- List personal notes.
- Read a note by ID.
- Create new notes.
- Update note content and metadata.
- Work with team workspaces by passing `teamPath`.
- Keep credentials local through environment variables.

## Requirements

- Node.js 24 LTS
- npm
- A HackMD API token
- A GitHub personal access token when using GitHub sync tools

Create a HackMD API token from your HackMD account settings. Treat it like a password: do not commit it to git, paste it into prompts, or put it in shared MCP configuration files.

## Install

Use the published npm package directly with `npx`:

```bash
npx -y hackmd-mcp-server@{VERSION}
```

Or install the CLI globally:

```bash
npm install -g hackmd-mcp-server@{VERSION}
hackmd-mcp
```

Replace `{VERSION}` with a specific published version. Pin the package to a specific version in MCP configuration; do not use mutable tags such as `latest` there, because a future package update would change the code your MCP client starts without an explicit config change.

For development from a cloned checkout:

```bash
npm install
npm run build
```

Run the built server directly:

```bash
HACKMD_API_TOKEN=your-token GITHUB_TOKEN=your-github-token npm start
```

Or install the checkout as a local global command:

```bash
npm install -g .
HACKMD_API_TOKEN=your-token GITHUB_TOKEN=your-github-token hackmd-mcp
```

Optional environment variables:

| Variable                | Required | Default                                              | Description                                                        |
| ----------------------- | -------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| `HACKMD_API_TOKEN`      | Yes      | none                                                 | HackMD API token used for all requests.                            |
| `HACKMD_API_URL`        | No       | `https://api.hackmd.io/v1`                           | Override only for testing or custom HackMD-compatible deployments. |
| `GITHUB_TOKEN`          | No       | none                                                 | Required only for GitHub sync tools. Needs contents and PR access. |
| `GITHUB_API_URL`        | No       | `https://api.github.com`                             | Override for GitHub Enterprise REST API deployments.               |
| `HACKMD_MCP_STATE_PATH` | No       | `$XDG_STATE_HOME/hackmd-mcp-server/github-sync.json` | Override the local file used to remember GitHub sync state.        |

The server also reads these supported variables from a `.env` file in its working directory when they are not already present in the inherited process environment. Inherited environment variables take precedence over `.env` values.

## Tools

| Tool                                | Purpose                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `hackmd_profile`                    | Get the current HackMD user profile.                                             |
| `hackmd_list_notes`                 | List personal notes, or team notes when `teamPath` is provided.                  |
| `hackmd_get_note`                   | Read one note by `noteId`.                                                       |
| `hackmd_create_note`                | Create a personal or team note.                                                  |
| `hackmd_update_note`                | Update note content, title, tags, permissions, folder, or permalink.             |
| `hackmd_sync_note_to_github`        | Sync current note content to a GitHub branch and pull request.                   |
| `hackmd_pull_github_file_to_hackmd` | Create or update a HackMD note from a GitHub Markdown file and start sync state. |
| `hackmd_github_sync_status`         | Read remembered local GitHub sync state for a note.                              |

Common inputs:

```json
{
  "noteId": "abc123",
  "teamPath": "my-team",
  "title": "Release notes",
  "content": "# Release notes\n\nDraft text...",
  "tags": ["release", "draft"],
  "readPermission": "guest",
  "writePermission": "owner"
}
```

Omit `teamPath` for personal notes. Include `teamPath` to use team note endpoints.

### GitHub sync

`hackmd_sync_note_to_github` streamlines the note-to-GitHub flow by choosing safe defaults:

- It reads the current/latest HackMD note content. Named historical HackMD versions are not supported by the public HackMD API, so explicit older `version` values return an unsupported error.
- It refuses to sync directly to the repository default branch unless `allowDefaultBranch` is `true`.
- It suggests a branch from the note title, such as `hackmd/release-plan-20260519`.
- It suggests a Markdown filename from the note title, such as `release-plan.md`.
- It includes or merges YAML front matter `title` by default, and includes `tags` only when the note has tags. Set `includeTitleTags` to `false` to write raw note content.
- It creates or reuses an open pull request for the sync branch.

First sync example:

```json
{
  "noteId": "abc123",
  "repository": "owner/repo"
}
```

Override branch, path, or front matter behavior on the first sync:

```json
{
  "noteId": "abc123",
  "repository": "owner/repo",
  "branch": "hackmd/release-notes",
  "filePath": "docs/release-notes.md",
  "includeTitleTags": false
}
```

Re-sync remembers the repository, filename, initial branch, and PR in local state. You can call it with just the note selector:

```json
{
  "noteId": "abc123"
}
```

On re-sync, the filename cannot be changed. Branch, base branch, and front matter options can still be overridden. If the previous PR was merged, the next re-sync keeps the original filename, creates a fresh branch from the default branch, and opens a new PR.

To start from an existing GitHub Markdown file, use `hackmd_pull_github_file_to_hackmd`. It treats YAML front matter as the source of truth for HackMD metadata, derives and adds `title` front matter on the sync branch when the source file has none, strips front matter from the HackMD note body, creates a non-default future sync branch, and records the repo/path state for later re-syncs. It does not write metadata normalization back to the source/default branch.

Create a new HackMD note from GitHub:

```json
{
  "repository": "owner/repo",
  "filePath": "docs/release-notes.md"
}
```

Update an existing HackMD note from GitHub:

```json
{
  "noteId": "abc123",
  "repository": "owner/repo",
  "filePath": "docs/release-notes.md",
  "overwriteHackMdContent": true
}
```

When updating an existing note, `overwriteHackMdContent` must be `true` because the GitHub file replaces the current HackMD content. If a note already has sync state for another repo or file, the bootstrap tool rejects the relink.

GitHub token permissions:

- Prefer a fine-grained personal access token scoped only to the target repository or repositories.
- Required repository permissions:
  - `Metadata`: read-only.
  - `Contents`: read and write.
  - `Pull requests`: read and write.
- Optional repository permission:
  - `Workflows`: read and write, only if you sync files under `.github/workflows/`.
- Classic personal access tokens are broader. Use `repo` for private repositories, or `public_repo` if you only sync public repositories.

Permission values:

- `readPermission`: `owner`, `signed_in`, or `guest`
- `writePermission`: `owner`, `signed_in`, or `guest`

## Add to Codex

Codex reads MCP server configuration from `~/.codex/config.toml`. The Codex CLI can add a local stdio server for you.

Recommended, using the published npm package:

```bash
codex mcp add hackmd \
  -- npx -y hackmd-mcp-server@{VERSION}
```

If you installed the command globally:

```bash
codex mcp add hackmd \
  -- hackmd-mcp
```

If you want to run from a cloned checkout instead:

```bash
cd /path/to/hackmd-mcp-server
npm install
npm run build
codex mcp add hackmd \
  -- node /path/to/hackmd-mcp-server/dist/cli.js
```

Set `HACKMD_API_TOKEN` and, for GitHub sync tools, `GITHUB_TOKEN` in the environment that starts Codex. Do not paste tokens into Codex MCP configuration files.

Equivalent manual `~/.codex/config.toml` entry:

```toml
[mcp_servers.hackmd]
command = "npx"
args = ["-y", "hackmd-mcp-server@{VERSION}"]
enabled = true
env_vars = ["HACKMD_API_TOKEN", "GITHUB_TOKEN"]
```

For a globally installed command:

```toml
[mcp_servers.hackmd]
command = "hackmd-mcp"
enabled = true
env_vars = ["HACKMD_API_TOKEN", "GITHUB_TOKEN"]
```

For a checkout-based setup:

```toml
[mcp_servers.hackmd]
command = "node"
args = ["/path/to/hackmd-mcp-server/dist/cli.js"]
enabled = true
env_vars = ["HACKMD_API_TOKEN", "GITHUB_TOKEN"]
```

Verify:

```bash
codex mcp list
codex mcp get hackmd
```

Restart Codex after adding the server.

## Add to Claude Code

Claude Code supports local stdio MCP servers through `claude mcp add`.

Recommended, using the published npm package:

```bash
claude mcp add --transport stdio --scope user \
  --env 'HACKMD_API_TOKEN=${HACKMD_API_TOKEN}' \
  --env 'GITHUB_TOKEN=${GITHUB_TOKEN}' \
  hackmd -- npx -y hackmd-mcp-server@{VERSION}
```

If you installed the command globally:

```bash
claude mcp add --transport stdio --scope user \
  --env 'HACKMD_API_TOKEN=${HACKMD_API_TOKEN}' \
  --env 'GITHUB_TOKEN=${GITHUB_TOKEN}' \
  hackmd -- hackmd-mcp
```

Project-local setup from a cloned checkout:

```bash
cd /path/to/hackmd-mcp-server
npm install
npm run build
claude mcp add --transport stdio --scope local \
  --env 'HACKMD_API_TOKEN=${HACKMD_API_TOKEN}' \
  --env 'GITHUB_TOKEN=${GITHUB_TOKEN}' \
  hackmd -- node /path/to/hackmd-mcp-server/dist/cli.js
```

Set `HACKMD_API_TOKEN` and, for GitHub sync tools, `GITHUB_TOKEN` in the environment that starts Claude Code. The single quotes above keep your shell from expanding the token values while `claude mcp add` writes the config.

Verify:

```bash
claude mcp list
claude mcp get hackmd
```

Inside Claude Code, run:

```text
/mcp
```

Use `--scope user` if you want HackMD available in every project. Use `--scope local` if you only want it in the current project.

## Add to Claude Desktop

Open your Claude Desktop MCP configuration file and add:

```json
{
  "mcpServers": {
    "hackmd": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "hackmd-mcp-server@{VERSION}"],
      "env": {
        "HACKMD_API_TOKEN": "${HACKMD_API_TOKEN}",
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Set `HACKMD_API_TOKEN` and, for GitHub sync tools, `GITHUB_TOKEN` in the environment that starts Claude Desktop, then restart Claude Desktop after saving the file. If you prefer a checkout-based setup, use `"command": "node"` and `"args": ["/path/to/hackmd-mcp-server/dist/cli.js"]` after running `npm install && npm run build`.

Common config file locations:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Publishing

This package follows semver and starts at `0.1.0`.

Before publishing:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Publish the current version and create the matching GitHub tag/release:

```bash
npm publish
npm run release:github
```

`npm run release:github` reads the current `package.json` version, creates and verifies a signed local `vX.Y.Z` tag when missing, pushes that tag, then creates the matching GitHub release with generated notes. The working tree must be clean before running it.

For the next release, use `npm version patch --no-git-tag-version`, `npm version minor --no-git-tag-version`, or `npm version major --no-git-tag-version` as appropriate, commit the version bump, publish, then run `npm run release:github`. During `0.x`, minor versions may include breaking changes; patch versions should remain bugfix-only.

## Example Prompts

After the server is connected, ask your MCP client:

```text
List my HackMD notes.
```

```text
Create a HackMD note titled "Architecture notes" with this content:
# Architecture notes

The first draft goes here.
```

```text
Read HackMD note abc123 and summarize the open action items.
```

```text
Update HackMD note abc123 with the revised content below.
```

For team notes:

```text
List notes in the HackMD team workspace "my-team".
```

For GitHub sync:

```text
Sync HackMD note abc123 to owner/repo on GitHub.
```

```text
Create a HackMD note from owner/repo docs/release-notes.md and start syncing it.
```

```text
Show the GitHub sync status for HackMD note abc123.
```

## Troubleshooting

**The MCP client shows no HackMD tools**

- Restart the MCP client after adding the server.
- Confirm the server appears in `codex mcp list`, `claude mcp list`, or your client’s MCP settings.
- Run `npm run build` again if you are using a checkout-based setup.

**Authentication fails**

- Regenerate the HackMD API token.
- Confirm the environment variable is named exactly `HACKMD_API_TOKEN`.
- Confirm the MCP client process inherits `HACKMD_API_TOKEN`; avoid storing the token directly in MCP config files.

**GitHub sync fails with `GITHUB_TOKEN is required`**

- Set `GITHUB_TOKEN` in the MCP server environment.
- Confirm the token can write repository contents and create pull requests for the target repository.

**Requests fail with `fetch failed`, `Connect Timeout Error`, or `EAI_AGAIN`**

- Restart the MCP client so it picks up the latest server build.
- The server automatically detects whether IPv6 is usable on the current network and configures Node's native fetch to avoid unreachable IPv6 paths when needed.
- If the error persists, verify that the MCP client is allowed to make outbound network requests.

**The server exits immediately**

- Run `HACKMD_API_TOKEN=your-token GITHUB_TOKEN=your-github-token node /path/to/hackmd-mcp-server/dist/cli.js` manually.
- Check that Node.js 24 LTS is the active runtime.
- Use absolute paths in desktop client configuration.

**Team notes are not found**

- Confirm the `teamPath` matches the team path in the HackMD URL.
- Confirm your HackMD token has access to that team workspace.

## Development

```bash
npm install
npm run lint
npm test
npm run typecheck
npm run build
```

This project uses ESLint for semantic checks and Prettier for formatting. Editor integrations should run both the TypeScript language server and ESLint language server; ESLint is intentionally not configured with formatting rules, so it can report code-quality issues without fighting Prettier.

Run in development mode:

```bash
HACKMD_API_TOKEN=your-token GITHUB_TOKEN=your-github-token npm run dev
```

## References

- HackMD API docs: <https://api.hackmd.io/v1/docs>
- HackMD GitHub sync guide: <https://homepage.hackmd.io/blog/2023/12/20/sync-notes-to-github>
- GitHub REST API docs: <https://docs.github.com/en/rest>
- Codex MCP configuration: <https://www.mintlify.com/openai/codex/configuration/mcp-servers>
- Claude Code MCP docs: <https://code.claude.com/docs/en/mcp>
