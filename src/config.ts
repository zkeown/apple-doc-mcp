import {join} from 'node:path';

/**
 * Centralized configuration for the Apple Documentation MCP server.
 * Values can be overridden via environment variables.
 */

const parseIntOrDefault = (envVar: string, value: string | undefined, defaultValue: number): number => {
	if (!value) {
		return defaultValue;
	}

	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) {
		// Use console.warn since logger may not be initialized yet during config load
		console.warn(`[config] Invalid value for ${envVar}: "${value}", using default: ${defaultValue}`);
		return defaultValue;
	}

	return parsed;
};

export const config = {
	cache: {
		/** Memory cache TTL in milliseconds (default: 10 minutes) */
		ttlMs: parseIntOrDefault('APPLE_DOC_CACHE_TTL_MS', process.env.APPLE_DOC_CACHE_TTL_MS, 10 * 60 * 1000),
		/** Maximum entries in memory cache (default: 100) */
		maxSize: parseIntOrDefault('APPLE_DOC_CACHE_MAX_SIZE', process.env.APPLE_DOC_CACHE_MAX_SIZE, 100),
		/**
		 * Cache directory path (default: ~/.cache/apple-doc-mcp).
		 * Can be overridden via APPLE_DOC_CACHE_DIR environment variable.
		 * If relative path is provided, it's resolved from current working directory.
		 */
		directory: process.env.APPLE_DOC_CACHE_DIR
			?? join(process.env.HOME ?? process.cwd(), '.cache', 'apple-doc-mcp'),
	},
	http: {
		/** HTTP request timeout in milliseconds (default: 15 seconds) */
		timeoutMs: parseIntOrDefault('APPLE_DOC_TIMEOUT_MS', process.env.APPLE_DOC_TIMEOUT_MS, 15_000),
		/** Base URL for Apple documentation API */
		baseUrl: 'https://developer.apple.com/tutorials/data',
		/** Maximum retry attempts for transient failures (default: 3) */
		maxRetryAttempts: parseIntOrDefault('APPLE_DOC_MAX_RETRIES', process.env.APPLE_DOC_MAX_RETRIES, 3),
		/** Base delay between retries in milliseconds (default: 500) */
		baseRetryDelayMs: parseIntOrDefault('APPLE_DOC_RETRY_DELAY_MS', process.env.APPLE_DOC_RETRY_DELAY_MS, 500),
		/**
		 * User-Agent header for HTTP requests.
		 * Can be overridden via APPLE_DOC_USER_AGENT environment variable.
		 */
		userAgent: process.env.APPLE_DOC_USER_AGENT ?? 'apple-doc-mcp/1.0.0',
		/** Maximum concurrent HTTP requests (default: 5) */
		maxConcurrent: parseIntOrDefault('APPLE_DOC_MAX_CONCURRENT', process.env.APPLE_DOC_MAX_CONCURRENT, 5),
	},
	search: {
		/** Default maximum search results (default: 20) */
		defaultMaxResults: parseIntOrDefault('APPLE_DOC_MAX_RESULTS', process.env.APPLE_DOC_MAX_RESULTS, 20),
		/** Default page size for discovery (default: 25) */
		defaultPageSize: parseIntOrDefault('APPLE_DOC_PAGE_SIZE', process.env.APPLE_DOC_PAGE_SIZE, 25),
	},
	indexing: {
		/** Batch size for async file processing (default: 10) */
		batchSize: parseIntOrDefault('APPLE_DOC_INDEX_BATCH_SIZE', process.env.APPLE_DOC_INDEX_BATCH_SIZE, 10),
		/**
		 * Minimum symbol count threshold for local index.
		 * If the index has fewer symbols than this threshold, fallback to framework search.
		 * (default: 50)
		 */
		minSymbolCountThreshold: parseIntOrDefault('APPLE_DOC_MIN_SYMBOL_COUNT', process.env.APPLE_DOC_MIN_SYMBOL_COUNT, 50),
		/** File read timeout in milliseconds (default: 5 seconds) */
		fileReadTimeoutMs: parseIntOrDefault('APPLE_DOC_FILE_READ_TIMEOUT_MS', process.env.APPLE_DOC_FILE_READ_TIMEOUT_MS, 5000),
	},
	ui: {
		/** Maximum number of suggestions to show when technology not found (default: 5) */
		maxSuggestions: parseIntOrDefault('APPLE_DOC_MAX_SUGGESTIONS', process.env.APPLE_DOC_MAX_SUGGESTIONS, 5),
		/** Maximum number of framework categories to display in overview (default: 5) */
		maxCategories: parseIntOrDefault('APPLE_DOC_MAX_CATEGORIES', process.env.APPLE_DOC_MAX_CATEGORIES, 5),
	},
} as const;

export type Config = typeof config;
