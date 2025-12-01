# Apple Documentation MCP Server

> **Fork Note**: This is an actively maintained fork of [MightyDillah/apple-doc-mcp](https://github.com/MightyDillah/apple-doc-mcp), with improvements including retry logic, LRU caching, async I/O, and better test coverage.

An MCP (Model Context Protocol) server providing seamless access to Apple Developer Documentation with smart search and wildcard support.

## Features

- Browse and explore Apple frameworks (SwiftUI, UIKit, Foundation, etc.)
- Smart search with wildcard support (`*` and `?`)
- Rich symbol documentation with declarations, parameters, and examples
- Platform filtering (iOS, macOS, watchOS, tvOS, visionOS)
- Persistent caching for offline access
- Technology-scoped queries for focused searches

## Installation

```bash
npm install -g apple-doc-mcp-server
```

Or use npx directly:

```bash
npx apple-doc-mcp-server
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "apple-docs": {
      "command": "npx",
      "args": ["apple-doc-mcp-server"]
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APPLE_DOC_CACHE_TTL_MS` | `600000` | Memory cache TTL (10 minutes) |
| `APPLE_DOC_CACHE_MAX_SIZE` | `100` | Max entries in memory cache |
| `APPLE_DOC_CACHE_DIR` | `.cache` | Cache directory |
| `APPLE_DOC_TIMEOUT_MS` | `15000` | HTTP request timeout |
| `APPLE_DOC_MAX_RETRIES` | `3` | Max retry attempts |
| `APPLE_DOC_MAX_RESULTS` | `20` | Default search results |

## Available Tools

### `discover_technologies`

Browse available Apple frameworks with optional filtering and pagination.

```text
Arguments:
  - query (optional): Filter by keyword
  - page (optional): Page number (default 1)
  - pageSize (optional): Results per page (default 25, max 100)
```

### `choose_technology`

Select a framework to scope subsequent searches.

```text
Arguments:
  - name: Technology name (e.g., "SwiftUI", "UIKit")
  - identifier (optional): Full identifier if known
```

### `current_technology`

Show the currently selected technology.

### `search_symbols`

Search for symbols within the selected framework.

```text
Arguments:
  - query: Search keywords (supports * and ? wildcards)
  - maxResults (optional): Max results (default 20)
  - platform (optional): Filter by platform
  - symbolType (optional): Filter by kind (class, struct, protocol)
```

### `get_documentation`

Get detailed documentation for a specific symbol.

```text
Arguments:
  - path: Symbol name or path (e.g., "View", "Button", "GridItem")
```

### `cache_status`

View cache statistics and diagnostics.

### `get_version`

Get server version information.

## Typical Workflow

1. **Discover frameworks**: Use `discover_technologies` to browse available options
2. **Select framework**: Use `choose_technology` to set your focus (e.g., "SwiftUI")
3. **Search symbols**: Use `search_symbols` to find APIs (e.g., "Grid*" for grid-related)
4. **Get details**: Use `get_documentation` for specific symbol documentation

## Search Tips

- Use `*` for any characters: `Grid*` matches GridItem, GridRow, etc.
- Use `?` for single character: `View?` matches Views but not View
- Combine with filters: Search "button" with platform "iOS"
- Case-insensitive matching

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run integration tests
pnpm test:integration

# Lint
pnpm lint
```

## License

MIT
