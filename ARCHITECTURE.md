# Apple Doc MCP Server Architecture

This document describes the architecture of the Apple Developer Documentation MCP server.

## Overview

The Apple Doc MCP Server provides access to Apple Developer Documentation through the Model Context Protocol (MCP). It enables LLM applications like Claude to browse, search, and retrieve Apple framework documentation.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Client (Claude)                       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ MCP Protocol (stdio)
┌─────────────────────────────────▼───────────────────────────────┐
│                          MCP Server                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Tool Handlers                         │    │
│  │  discover_technologies │ choose_technology │ search...   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Server State                          │    │
│  │  Active Technology │ Framework Index │ Symbol Index      │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  AppleDevDocsClient                      │    │
│  │  HTTP Client │ File Cache │ Memory Cache                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────▼───────────────────────────────┐
│                   Apple Developer API                            │
│              developer.apple.com/tutorials/data                  │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── index.ts                 # CLI entry point
├── logger.ts                # Structured logging (pino)
├── config.ts                # Centralized configuration
├── apple-client.ts          # Main documentation client
├── apple-client/
│   ├── http-client.ts       # HTTP requests with retry logic
│   ├── formatters.ts        # Text extraction utilities
│   ├── cache/
│   │   ├── file-cache.ts    # Persistent disk cache
│   │   └── memory-cache.ts  # In-memory LRU cache
│   └── types/
│       ├── index.ts         # Type definitions
│       ├── schemas.ts       # Zod validation schemas
│       └── validators.ts    # Runtime validators
└── server/
    ├── app.ts               # MCP server factory
    ├── state.ts             # Session state management
    ├── context.ts           # Handler context types
    ├── tools.ts             # Tool registration
    ├── markdown.ts          # Markdown formatting helpers
    ├── handlers/
    │   ├── discover.ts      # Browse technologies
    │   ├── choose-technology.ts
    │   ├── current-technology.ts
    │   ├── get-documentation.ts
    │   ├── search-symbols.ts
    │   ├── version.ts
    │   ├── cache-status.ts
    │   └── search/          # Search subsystem
    │       ├── scoring.ts
    │       └── strategies/
    ├── formatters/
    │   └── symbol-formatter.ts  # Symbol documentation formatting
    ├── services/
    │   ├── local-symbol-index.ts
    │   ├── framework-loader.ts
    │   ├── symbol-resolver.ts   # Symbol path resolution
    │   └── symbol-index-factory.ts
    └── utils/
        ├── path-utils.ts
        └── tokenizer.ts
```

## Core Components

### 1. MCP Server (`server/app.ts`)

Creates and configures the MCP server instance. Registers all tools and wires up dependencies.

### 2. AppleDevDocsClient (`apple-client.ts`)

The main client for fetching Apple documentation. Responsibilities:

- Fetch framework data and symbol documentation
- Manage caching (file + memory)
- Search within frameworks
- Extract text from documentation blocks

### 3. Server State (`server/state.ts`)

Maintains session state across tool invocations:

- **Active Technology**: Currently selected framework
- **Framework Data**: Cached framework details
- **Framework Index**: Searchable index of symbols
- **Local Symbol Index**: Full-text search index

### 4. Tool Handlers (`server/handlers/`)

Each tool has a dedicated handler following the builder pattern:

```typescript
export const buildHandlerName = (context: ServerContext) => {
  return async (args: ArgsType): Promise<ToolResponse> => {
    // Implementation
  };
};
```

## Data Flow

### Technology Selection Flow

```
1. discover_technologies → List available frameworks
2. choose_technology → Select a framework, load into state
3. search_symbols / get_documentation → Query selected framework
```

### Caching Strategy

**Two-Tier Cache:**

1. **Memory Cache** (MemoryCache)
   - LRU eviction
   - TTL-based expiration (default 10 min)
   - Maximum 100 entries

2. **File Cache** (FileCache)
   - Persistent across sessions
   - Stored in `.cache/` directory
   - JSON files per framework/symbol

**Cache Flow:**
```
Request → Memory Cache (hit?) → File Cache (hit?) → Apple API
                ↑                      ↑
            Cache miss            Cache miss
```

### Search Architecture

The search system uses multiple strategies:

1. **Local Symbol Index**: Tokenized full-text search on cached data
2. **Framework References**: Direct search on framework.references
3. **Fallback Strategies**: Hierarchical and regex-based searches

## Configuration

All configuration is centralized in `config.ts`:

| Setting | Default | Environment Variable |
|---------|---------|---------------------|
| Cache TTL | 10 min | `APPLE_DOC_CACHE_TTL_MS` |
| Cache Max Size | 100 | `APPLE_DOC_CACHE_MAX_SIZE` |
| HTTP Timeout | 15s | `APPLE_DOC_TIMEOUT_MS` |
| Max Retries | 3 | `APPLE_DOC_MAX_RETRIES` |
| Default Results | 20 | `APPLE_DOC_MAX_RESULTS` |
| Log Level | debug/info | `APPLE_DOC_LOG_LEVEL` |

## Error Handling

- **McpError**: Used for MCP protocol-level errors
- **Error Cause Chaining**: Original errors preserved via `{cause: error}`
- **Structured Logging**: All errors logged with context via pino
- **Retry Logic**: Exponential backoff for transient failures (503, 429, 500)

## Logging

Structured JSON logging via pino:

```typescript
import { logger, createOperationLogger } from './logger.js';

// Simple logging
logger.info({ framework: 'SwiftUI' }, 'Framework loaded');

// Operation logging with timing
const op = createOperationLogger('fetchSymbol', { path });
try {
  const result = await fetchSymbol(path);
  op.success({ symbolCount: result.symbols.length });
} catch (error) {
  op.failure(error);
}
```

## Type System

### Key Types

- `Technology`: Framework metadata from the API
- `FrameworkData`: Full framework with references
- `SymbolData`: Individual symbol documentation
- `ReferenceData`: Cross-references between symbols
- `PlatformInfo`: Platform availability data

### Validation

Runtime validation using Zod schemas:

- Input validation on all tool arguments
- Response validation for API data
- Type guards for type narrowing

## Testing

### Unit Tests

- Located alongside source files (`*.test.ts`)
- Run with: `pnpm test`
- Coverage threshold: 80%

### Integration Tests

- Test real API interactions (`*.integration.test.ts`)
- Run with: `pnpm test:integration`
- Daily scheduled runs in CI

## Security Considerations

- No hardcoded credentials
- Input length limits on all string parameters
- Bounds validation on numeric inputs (maxResults, page)
- Path sanitization for cache file names
- HTTP headers mimic browser (User-Agent, DNT, Referer)
