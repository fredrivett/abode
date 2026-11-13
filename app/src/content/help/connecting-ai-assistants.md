# Connecting AI assistants

Let an AI assistant like Claude or Cursor search and read your <Abode />, so you can ask it about things you've saved ("what was that article on sourdough?", "find the chairs I saved last month") or what you've been reading ("what did I highlight this week?", "which books did I finish this month?", "what articles did I read last week?"). <Abode /> runs an MCP server, the standard way assistants connect to apps. Access is read-only: an assistant can look things up, never change or delete anything.

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
- **See your highlights from a period**: passages you highlighted between two dates, with your notes and the item each one is from (up to 200 per request; the assistant is told when there are more)
- **See your reading from a period**: books you finished (or marked as did not finish), started or made progress on, with their status, dates, rating and review
- **See the articles you read in a period**: articles you marked as read or scrolled through, with how far you got
- **List your tags and kinds**, to know what to filter by
- **List your rooms**

A book date you only know to the month or year (say, "finished in 2024") counts for a period only when the period covers that whole month or year, or, for the current month or year, runs from its start through today. "This month" includes a book finished "this month", but "this week" doesn't, since it may have been earlier. Reading progress keeps only its latest update, so a book or article counts as progressed in a period only if that latest update falls inside it. An article counts as read when you mark it read, not just when you open it.

## Revoking access

Revoke the token in **Settings → Access tokens** and the assistant loses access straight away. Each token shows when it was last used.
