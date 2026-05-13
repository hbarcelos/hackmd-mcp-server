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

Create a HackMD API token from your HackMD account settings. Treat it like a password: do not commit it to git, paste it into prompts, or put it in shared MCP configuration files.

## Install

Use the published npm package directly with `npx`:

```bash
npx -y hackmd-mcp-server@0.1.0
```

Or install the CLI globally:

```bash
npm install -g hackmd-mcp-server@0.1.0
hackmd-mcp
```

For development from a cloned checkout:

```bash
npm install
npm run build
```

Run the built server directly:

```bash
HACKMD_API_TOKEN=your-token npm start
```

Or install the checkout as a local global command:

```bash
npm install -g .
HACKMD_API_TOKEN=your-token hackmd-mcp
```

Optional environment variables:

| Variable           | Required | Default                    | Description                                                        |
| ------------------ | -------- | -------------------------- | ------------------------------------------------------------------ |
| `HACKMD_API_TOKEN` | Yes      | none                       | HackMD API token used for all requests.                            |
| `HACKMD_API_URL`   | No       | `https://api.hackmd.io/v1` | Override only for testing or custom HackMD-compatible deployments. |

## Tools

| Tool                 | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `hackmd_profile`     | Get the current HackMD user profile.                                 |
| `hackmd_list_notes`  | List personal notes, or team notes when `teamPath` is provided.      |
| `hackmd_get_note`    | Read one note by `noteId`.                                           |
| `hackmd_create_note` | Create a personal or team note.                                      |
| `hackmd_update_note` | Update note content, title, tags, permissions, folder, or permalink. |

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

Permission values:

- `readPermission`: `owner`, `signed_in`, or `guest`
- `writePermission`: `owner`, `signed_in`, or `guest`

## Add to Codex

Codex reads MCP server configuration from `~/.codex/config.toml`. The Codex CLI can add a local stdio server for you.

Recommended, using the published npm package:

```bash
codex mcp add hackmd \
  --env HACKMD_API_TOKEN=your-token \
  -- npx -y hackmd-mcp-server@0.1.0
```

If you installed the command globally:

```bash
codex mcp add hackmd \
  --env HACKMD_API_TOKEN=your-token \
  -- hackmd-mcp
```

If you want to run from a cloned checkout instead:

```bash
cd /path/to/hackmd-mcp-server
npm install
npm run build
codex mcp add hackmd \
  --env HACKMD_API_TOKEN=your-token \
  -- node /path/to/hackmd-mcp-server/dist/cli.js
```

Equivalent manual `~/.codex/config.toml` entry:

```toml
[mcp_servers.hackmd]
command = "npx"
args = ["-y", "hackmd-mcp-server@0.1.0"]
enabled = true

[mcp_servers.hackmd.env]
HACKMD_API_TOKEN = "your-token"
```

For a globally installed command:

```toml
[mcp_servers.hackmd]
command = "hackmd-mcp"
enabled = true

[mcp_servers.hackmd.env]
HACKMD_API_TOKEN = "your-token"
```

For a checkout-based setup:

```toml
[mcp_servers.hackmd]
command = "node"
args = ["/path/to/hackmd-mcp-server/dist/cli.js"]
enabled = true

[mcp_servers.hackmd.env]
HACKMD_API_TOKEN = "your-token"
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
  --env HACKMD_API_TOKEN=your-token \
  hackmd -- npx -y hackmd-mcp-server@0.1.0
```

If you installed the command globally:

```bash
claude mcp add --transport stdio --scope user \
  --env HACKMD_API_TOKEN=your-token \
  hackmd -- hackmd-mcp
```

Project-local setup from a cloned checkout:

```bash
cd /path/to/hackmd-mcp-server
npm install
npm run build
claude mcp add --transport stdio --scope local \
  --env HACKMD_API_TOKEN=your-token \
  hackmd -- node /path/to/hackmd-mcp-server/dist/cli.js
```

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
      "args": ["-y", "hackmd-mcp-server@0.1.0"],
      "env": {
        "HACKMD_API_TOKEN": "your-token"
      }
    }
  }
}
```

Restart Claude Desktop after saving the file. If you prefer a checkout-based setup, use `"command": "node"` and `"args": ["/path/to/hackmd-mcp-server/dist/cli.js"]` after running `npm install && npm run build`.

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

Publish the current version:

```bash
npm publish
```

For the next release, use `npm version patch`, `npm version minor`, or `npm version major` as appropriate, then publish. During `0.x`, minor versions may include breaking changes; patch versions should remain bugfix-only.

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

## Troubleshooting

**The MCP client shows no HackMD tools**

- Restart the MCP client after adding the server.
- Confirm the server appears in `codex mcp list`, `claude mcp list`, or your client’s MCP settings.
- Run `npm run build` again if you are using a checkout-based setup.

**Authentication fails**

- Regenerate the HackMD API token.
- Confirm the environment variable is named exactly `HACKMD_API_TOKEN`.
- Avoid quotes around the token in CLI `--env` usage unless your shell requires them.

**Requests fail with `fetch failed`, `Connect Timeout Error`, or `EAI_AGAIN`**

- Restart the MCP client so it picks up the latest server build.
- The server automatically detects whether IPv6 is usable on the current network and configures Node's native fetch to avoid unreachable IPv6 paths when needed.
- If the error persists, verify that the MCP client is allowed to make outbound network requests.

**The server exits immediately**

- Run `HACKMD_API_TOKEN=your-token node /path/to/hackmd-mcp-server/dist/cli.js` manually.
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
HACKMD_API_TOKEN=your-token npm run dev
```

## References

- HackMD API docs: <https://api.hackmd.io/v1/docs>
- Codex MCP configuration: <https://www.mintlify.com/openai/codex/configuration/mcp-servers>
- Claude Code MCP docs: <https://code.claude.com/docs/en/mcp>
