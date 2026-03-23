# Setting Up the Playwriter MCP Server

The Playwriter MCP server is required for browser automation tasks like refreshing auth tokens (KCLS, Libby, Goodreads, StoryGraph). This document explains how an agent should configure it.

## Check if Playwriter MCP is Already Configured

Run `/mcp` in the Copilot CLI to list active MCP servers. If `playwriter` appears in the list, no setup is needed.

## Adding the Playwriter MCP Server

### Option 1: Via `/mcp add` (Interactive)

1. Run `/mcp add` in the Copilot CLI
2. Fill in the fields:
   - **Name:** `playwriter`
   - **Type:** `stdio`
   - **Command:** `npx`
   - **Args:** `-y playwriter@latest`
   - **Env:** `PLAYWRITER_AUTO_ENABLE=1`
3. Press `Ctrl+S` to save

This persists to `~/.copilot/mcp-config.json` and applies to all future sessions.

### Option 2: Directly Edit `mcp-config.json`

Create or edit `~/.copilot/mcp-config.json` and add:

```json
{
  "mcpServers": {
    "playwriter": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "playwriter@latest"],
      "env": {
        "PLAYWRITER_AUTO_ENABLE": "1"
      }
    }
  }
}
```

If the file already exists with other servers, merge the `playwriter` key into the existing `mcpServers` object.

### Option 3: Per-Session via CLI Flag

If the user prefers not to install globally, launch Copilot with the project's `.mcp.json`:

```bash
copilot --additional-mcp-config @.mcp.json
```

This loads the config from the project's `.mcp.json` for that session only.

## Verifying the Setup

After adding the server, run `/mcp` to confirm `playwriter` appears and its status is healthy. If it shows an error, ensure `npx` is available on `PATH` and Node.js is installed.

## What Playwriter Enables

With Playwriter configured, the agent can:
- Extract auth cookies/tokens from the user's Chrome browser
- Navigate to login pages and capture session data
- Run the `refresh-kcls`, `refresh-libby`, `refresh-goodreads`, and `refresh-storygraph` skills