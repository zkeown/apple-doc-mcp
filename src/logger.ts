import pino from 'pino';

/**
 * Log levels supported by the application.
 * MCP servers should log to stderr (stdout is reserved for protocol messages).
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

const getLogLevel = (): LogLevel => {
	const level = process.env.APPLE_DOC_LOG_LEVEL?.toLowerCase();
	const validLevels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
	if (level && validLevels.includes(level as LogLevel)) {
		return level as LogLevel;
	}

	return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

/**
 * Base logger instance configured for the Apple Doc MCP server.
 * Outputs JSON to stderr (MCP protocol requires stdout for messages).
 */
export const logger = pino({
	name: 'apple-doc-mcp',
	level: getLogLevel(),
	// MCP servers must use stderr for logging (stdout is for protocol)
	transport: undefined,
}, pino.destination(2)); // Fd 2 = stderr

/**
 * Creates a child logger with additional context.
 * Use this for operation-specific logging.
 *
 * @example
 * const opLogger = createLogger({ operation: 'searchSymbols', framework: 'SwiftUI' });
 * opLogger.info('Search started');
 */
export function createLogger(context: Record<string, unknown>) {
	return logger.child(context);
}

/**
 * Creates a logger for a specific operation with timing support.
 * Automatically logs duration when endOperation is called.
 *
 * @example
 * const op = createOperationLogger('fetchSymbol', { path: '/documentation/swiftui/view' });
 * try {
 *   const result = await fetchSymbol(path);
 *   op.success({ symbolName: result.name });
 * } catch (error) {
 *   op.failure(error);
 * }
 */
export function createOperationLogger(operation: string, context: Record<string, unknown> = {}) {
	const startTime = Date.now();
	const opLogger = logger.child({operation, ...context});

	return {
		logger: opLogger,

		debug(message: string, data?: Record<string, unknown>) {
			opLogger.debug(data, message);
		},

		info(message: string, data?: Record<string, unknown>) {
			opLogger.info(data, message);
		},

		warn(message: string, data?: Record<string, unknown>) {
			opLogger.warn(data, message);
		},

		error(message: string, error?: unknown, data?: Record<string, unknown>) {
			const errorData = error instanceof Error
				? {err: {message: error.message, stack: error.stack, name: error.name}}
				: {err: error};
			opLogger.error({...errorData, ...data}, message);
		},

		success(data?: Record<string, unknown>) {
			const durationMs = Date.now() - startTime;
			opLogger.info({durationMs, success: true, ...data}, 'Operation completed');
		},

		failure(error: unknown, data?: Record<string, unknown>) {
			const durationMs = Date.now() - startTime;
			const errorData = error instanceof Error
				? {err: {message: error.message, stack: error.stack, name: error.name}}
				: {err: error};
			opLogger.error({
				durationMs,
				success: false,
				...errorData,
				...data,
			}, 'Operation failed');
		},
	};
}

export type OperationLogger = ReturnType<typeof createOperationLogger>;
