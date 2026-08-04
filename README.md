# mcp-disney

Disney character database MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_characters` | Search the Disney character database by name (e.g. "Mickey Mouse", "Elsa", "Stitch"). Returns matching characters with their film, TV-show, video-game and theme-park-attraction appearances plus an image URL. Matching is exact-ish on the name field. |
| `get_character` | Fetch a single Disney character by numeric id (_id). Returns the full record: films, short films, TV shows, video games, park attractions, allies, enemies, image URL and source URL. |
| `list_characters` | List/paginate the Disney character database. Returns a page of characters (id, name, image URL) plus total count and total page count. Useful for browsing the full catalog. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "disney": {
      "url": "https://gateway.pipeworx.io/disney/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Disney data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
