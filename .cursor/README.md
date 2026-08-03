# MCP configuration for Governor

This project uses **Model Context Protocol (MCP)** so Cursor can use external tools and data sources while working in this repo.

## Config file

- **Location:** [.cursor/mcp.json](mcp.json)
- **Scope:** Project-only (this file applies when this folder is the workspace root).

## Governor Integration

Say **"add Governor"** or **"integrate Governor"** in chat. The AI will follow [.cursor/rules/governor-integration.mdc](rules/governor-integration.mdc) and [docs/GOVERNOR_INTEGRATION_WORKFLOW.md](../docs/GOVERNOR_INTEGRATION_WORKFLOW.md).

## Connected servers

| Server       | Purpose |
|-------------|---------|
| **fetch**   | Fetch URLs and get content as HTML, JSON, text, or Markdown. Useful for docs, API responses, and live pages. |
| **filesystem** | Read/write and search files under the workspace. Uses `${workspaceFolder}` so access is limited to this project. |

## Adding more MCPs

1. Open **Cursor → Settings → Tools & MCP** and edit the config, or edit `.cursor/mcp.json` directly.
2. Use the [Cursor MCP directory](https://cursor.com/docs/context/mcp/directory) for one-click installs, or add entries manually.

### Example: Browser MCP (for testing the demo)

If you use the Cursor IDE Browser MCP (e.g. for testing `demo/`), it is usually configured in **Settings → Tools & MCP** at the application level. No change is required in this file unless you want it listed here.

### Example: stdio server

```json
"server-name": {
  "command": "npx",
  "args": ["-y", "package-name"],
  "env": { "API_KEY": "${env:API_KEY}" }
}
```

### Example: remote server

```json
"remote-name": {
  "url": "https://your-mcp-endpoint.com/mcp",
  "headers": { "Authorization": "Bearer ${env:TOKEN}" }
}
```

## Interpolation

You can use in `mcp.json`:

- `${workspaceFolder}` – project root
- `${env:VAR_NAME}` – environment variable
- `${userHome}` – user home directory

See [Cursor MCP docs](https://cursor.com/docs/context/mcp) for full reference.
