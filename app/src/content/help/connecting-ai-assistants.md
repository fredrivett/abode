# Connecting AI assistants

Let an AI assistant like Claude or Cursor search and read your <Abode />, so you can ask it about things you've saved ("what was that article on sourdough?", "find the chairs I saved last month"). <Abode /> runs an MCP server, the standard way assistants connect to apps. Access is read-only: an assistant can look things up, never change or delete anything.

## 1. Create a token

1. Go to **Settings → Access tokens**.
2. Name it after the assistant (e.g. **Claude Code**), keep **Read your library** ticked, and create it.
3. Copy the token. It's shown only once.

A token only needs **Read your library** for this. Leave **Save new items** unticked unless you also want to save with it.

## 2. Add abode to your assistant

The server address is:

```
{{appUrl}}/api/mcp
```

Replace `abode_pat_…` below with your token.

### Claude Code

```
claude mcp add --transport http abode {{appUrl}}/api/mcp --header "Authorization: Bearer abode_pat_…"
```

### Cursor

Add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "abode": {
      "url": "{{appUrl}}/api/mcp",
      "headers": { "Authorization": "Bearer abode_pat_…" }
    }
  }
}
```

### Claude Desktop

Open **Settings → Developer → Edit Config** and add:

```json
{
  "mcpServers": {
    "abode": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "{{appUrl}}/api/mcp", "--header", "Authorization:${ABODE_AUTH}"],
      "env": { "ABODE_AUTH": "Bearer abode_pat_…" }
    }
  }
}
```

Keep `Bearer ` in front of the token inside `ABODE_AUTH`. It lives there, not in `args`, because spaces in `args` break on Windows. Then restart Claude Desktop. This needs [Node.js](https://nodejs.org) installed.

Custom connectors on claude.ai (the website) aren't supported yet. They sign in with OAuth rather than a token.

## What the assistant can do

- **Search or browse** your items: by text, tag or kind, or your most recent saves
- **Read an item** in full: article text, notes, highlights, product and book details
- **List your tags and kinds**, to know what to filter by
- **List your rooms**

## Revoking access

Revoke the token in **Settings → Access tokens** and the assistant loses access straight away. Each token shows when it was last used.
